function dateToString_(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
}

const CACHE = new class GAppsServerCache {
  constructor() {
    this.temp_ = CacheService.getScriptCache();
    this.cache_ = PropertiesService.getScriptProperties();
  }

  getMembers() {
    const cachedMembers = this.cache_.getProperty(MEMBER_CACHE);
    if (cachedMembers) {
      return JSON.parse(cachedMembers);
    }
    return this.retrieveMembersFromDB();
  }

  addMember(member) {
    const members = this.getMembers();
    members.push(member);
    this.cache_.setProperty(MEMBER_CACHE, JSON.stringify(members));
  }

  retrieveMembersFromDB() {
    const spreadsheet = SpreadsheetApp.openById(MEMBERS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(MEMBERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    // Skip header row and map data to member objects
    // Expected columns: ID, Name, Email, Type, Roles, Relations
    const members = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows

      const member = {
        id: row[0],
        alias: row[1] || '',
        name: row[2] || '',
        email: row[3] || '',
        type: row[4] || '',
        active: row[7] === '' || row[7] === undefined ? true : Boolean(row[7]),
      };

      // Parse Roles (comma-separated string to array)
      if (row[5]) {
        member.roles = String(row[5]).split(',').map(r => r.trim());
      }

      // Parse Relations (comma-separated string to array)
      if (row[6]) {
        member.relations = String(row[6]).split(',').map(r => r.trim());
      }

      members.push(member);
    }

    // Create a map of ID to member for resolving relations
    const memberMap = {};
    members.forEach(function (m) {
      memberMap[m.id] = m;
    });

    members.forEach(member => {
      let relatedMembers = [];
      if (member.relations && Array.isArray(member.relations)) {
        member.relations.forEach(function (relationId) {
          let relatedMember = memberMap[relationId];
          if (relatedMember) {
            relatedMembers.push({
              id: relatedMember.id,
              alias: relatedMember.alias || "",
              name: relatedMember.name,
              type: relatedMember.type || "",
              avatar: generateAvatarUrl_(
                relatedMember.name,
                relatedMember.roles || [],
              ),
            });
          }
        });
        member.relatedMembers = relatedMembers;
      }
    });

    this.cache_.setProperty(MEMBER_CACHE, JSON.stringify(members));

    return members;
  }

  getEvents() {
    const cachedEvents = this.cache_.getProperty(EVENT_CACHE);
    if (cachedEvents) {
      return JSON.parse(cachedEvents);
    }
    return this.retrieveEventsFromDB();
  }

  getNextEvent({forceRefresh = false} = {}) {
    let nextEventDate = !forceRefresh && this.cache_.getProperty(NEXT_EVENT);
    if(!nextEventDate) {
      const events = CACHE.getEvents();
      const now = new Date();
      
      // Filter events that are in the future and sort by date
      const futureEvents = events
        .filter(event => {
          if (!event.date) return false;
          const eventDate = new Date(event.date);
          return eventDate > now;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      nextEventDate = futureEvents.length > 0 ? futureEvents[0].date : null;
      
      if (nextEventDate) {
        this.cache_.setProperty(NEXT_EVENT, nextEventDate);
      } else {
        this.cache_.deleteProperty(NEXT_EVENT);
      }
    }

    return API.newResult_({ result: {eventData: nextEventDate } });
  }

  retrieveEventsFromDB() {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(EVENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const assistance = this.retrieveEventMemberAssistanceFromDB();

    // Skip header row and map data to event objects
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows

      const name = row[0] || '';
      // Handle date - could be Date object or string (with possible apostrophe prefix)
      let date = '';
      if (row[1]) {
        if (row[1] instanceof Date) {
          // Date object - convert to datetime-local format preserving local time
          const d = row[1];
          date = dateToString_(d);
        } else {
          // String - remove apostrophe prefix if present
          date = String(row[1]).replace(/^'/, '');
        }
      }

      const eventAssistance = assistance[name] || { attendees: null, rejections: null, notes: null };

      const event = {
        id: name.replace(/[:\\/\?\*\[\]]/g, '-').trim(),
        name: name,
        date: date,
        meetingPlace: row[2] || '',
        placeUrl: row[3] || '',
        confirmed: row[4] === '' || row[4] === undefined ? false : Boolean(row[4]),
        visible: row[5] === '' || row[5] === undefined ? false : Boolean(row[5]),
        attendees: eventAssistance.attendees,
        rejections: eventAssistance.rejections,
        notes: eventAssistance.notes,
      };

      events.push(event);
    }

    return events;
  }
  getTrainings() {
    const cachedTrainings = this.cache_.getProperty(TRAINING_CACHE);
    if (cachedTrainings) {
      return JSON.parse(cachedTrainings);
    }
    return this.retrieveTrainingsFromDB();
  }

  addTraining({ training }) {
    const trainings = this.getTrainings();
    const dateKey = training.date || new Date().toISOString().split('T')[0];
    trainings[dateKey] = training;
    this.cache_.setProperty(TRAINING_CACHE, JSON.stringify(trainings));
  }

  getNextTraining({forceRefresh = false} = {}) {
    let nextTrainingDate = !forceRefresh && this.cache_.getProperty(NEXT_TRAINING);
    
    if (nextTrainingDate && (nextTrainingDate === "false" || nextTrainingDate === "null" || isNaN(new Date(nextTrainingDate).getTime()))) {
      nextTrainingDate = null;
    }

    if(!nextTrainingDate) {
      const trainings = CACHE.getTrainings();
      const now = new Date();
      let foundDate = null;
      for (const dateStr in trainings) {
        const trainingDate = new Date(dateStr); 
        if (trainingDate > now) {
          if (foundDate === null || trainingDate < foundDate) {
            foundDate = trainingDate;
          }
        }
      }
      
      if (foundDate) {
        nextTrainingDate = dateToString_(foundDate);
        this.cache_.setProperty(NEXT_TRAINING, nextTrainingDate);
      } else {
        nextTrainingDate = null;
        this.cache_.deleteProperty(NEXT_TRAINING);
      }
    }

    return API.newResult_({ result: {trainingData: nextTrainingDate} });
  }

  retrieveTrainingsFromDB() {
    const spreadsheet = SpreadsheetApp.openById(TRAINING_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const notes = sheet.getDataRange().getNotes();

    if (!data || data.length < 2) {
      return {};
    }

    const dates = data[0].slice(1);
    const headerNotes = notes[0].slice(1); // Get notes from header row
    const trainingsByDate = {};

    dates.forEach((date, index) => {
      const attendees = [];
      const rejections = [];
      const cellNotes = {};
      for (let i = 1; i < data.length; i++) {
        const memberName = data[i][0];
        const attendance = data[i][index + 1]; // +1 because dates are sliced from index 1
        const cellNote = notes[i][index + 1];
        if (memberName && attendance === 'SI') {
          attendees.push(memberName);
        } else if (memberName && attendance === 'NO') {
          rejections.push(memberName);
        }
        if (memberName && cellNote) {
          cellNotes[memberName] = cellNote;
        }
      }
      trainingsByDate[date] = {
        attendees: attendees,
        rejections: rejections,
        description: headerNotes[index] || '',
        notes: cellNotes
      };
    });

    return trainingsByDate;
  }

  getEventMemberAssistance(memberName) {
    const allAssistance = this.retrieveEventMemberAssistanceFromDB();
    return allAssistance[memberName] || null;
  }

  retrieveEventMemberAssistanceFromDB() {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const notes = sheet.getDataRange().getNotes();

    if (!data || data.length < 2) {
      return {};
    }

    const dates = data[0].slice(1);
    const eventAssistance = {};

    dates.forEach((eventName, dateIndex) => {
      const attendees = [];
      const rejections = [];
      const cellNotes = {};

      for (let i = 1; i < data.length; i++) {
        const memberName = data[i][0];
        const attendance = data[i][dateIndex + 1];
        const cellNote = notes[i][dateIndex + 1];

        if (memberName && attendance === 'SI') {
          attendees.push(memberName);
        } else if (memberName && attendance === 'NO') {
          rejections.push(memberName);
        }

        if (memberName && cellNote) {
          cellNotes[memberName] = cellNote;
        }
      }

      eventAssistance[eventName] = {
        attendees: attendees,
        rejections: rejections,
        notes: cellNotes
      };
    });

    return eventAssistance;
  }

  removeExpiredSessionTokens() {
    try {
      const sessionsData = this.cache_.getProperty(USER_SESSION);
      if (!sessionsData) {
        return;
      }

      const sessions = JSON.parse(sessionsData);
      if (!Array.isArray(sessions)) {
        this.cache_.deleteProperty(USER_SESSION);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const validSessions = sessions.filter(token => {
        if (typeof token !== 'string') {
          return false;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
          return false;
        }

        try {
          const payload = JSON.parse(
            Utilities.newBlob(
              Utilities.base64DecodeWebSafe(parts[1]),
            ).getDataAsString(),
          );

          if (!payload || typeof payload.exp !== 'number') {
            return true;
          }

          return payload.exp > now;
        } catch (error) {
          return false;
        }
      });

      if (validSessions.length === sessions.length) {
        return;
      }

      if (validSessions.length > 0) {
        this.cache_.setProperty(USER_SESSION, JSON.stringify(validSessions));
      } else {
        this.cache_.deleteProperty(USER_SESSION);
      }
    } catch (error) {
      console.log('Error in removeExpiredSessionTokens: ' + error.toString());
    }
  }
}