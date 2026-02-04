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

  getNextEvent(){
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
    
    return {success: true, result: {eventData: futureEvents.length > 0 ? futureEvents[0].date : null }};
  }

  retrieveEventsFromDB() {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(EVENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

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

      const event = {
        id: name.replace(/[:\\/\?\*\[\]]/g, '-').trim().substring(0, 31),
        name: name,
        date: date,
        meetingPlace: row[2] || '',
        placeUrl: row[3] || '',
        confirmed: row[4] === '' || row[4] === undefined ? false : Boolean(row[4]),
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

  getNextTraining(){
    const trainings = CACHE.getTrainings();
    const now = new Date();
    let nextTrainingDate = null;  
    for (const dateStr in trainings) {
      const trainingDate = new Date(dateStr); 
      if (trainingDate > now) {
        if (nextTrainingDate === null || trainingDate < nextTrainingDate) {
          nextTrainingDate = trainingDate;
        }
      }
    }
    return {success: true, result: {trainingData: nextTrainingDate ? dateToString_(nextTrainingDate) : null}};
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
      for (let i = 1; i < data.length; i++) {
        const memberName = data[i][0];
        const attendance = data[i][index + 1]; // +1 because dates are sliced from index 1
        if (memberName && attendance === 'X') {
          attendees.push(memberName);
        }
      }
      trainingsByDate[date] = {
        attendees: attendees,
        description: headerNotes[index] || ''
      };
    });

    return trainingsByDate;
  }
}