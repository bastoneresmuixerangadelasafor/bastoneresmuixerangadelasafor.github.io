function saveEvent_({event}) {
  if (!event || !event.name) {
    return API.newError_({ error: 'El nom de l\'actuació és obligatori' });
  }
  
  const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
  const sheetName = sanitizeSheetName_(event.name);
  
  // Check if sheet already exists
  let sheet = spreadsheet.getSheetByName(sheetName);
  const isNewSheet = !sheet;
  
  if (isNewSheet) {
    // Create new sheet
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    // Clear existing content
    sheet.clear();
  }
  
  // Build the data to write
  const data = [];
  
  // Header row with event info
  // Store datetime with apostrophe prefix to force plain text in Google Sheets
  const storedDatetime = event.datetime ? "'" + event.datetime : '';
  const storedMeetingPlace = event.meetingPlace || '';
  data.push(['Actuació:', event.name]);
  data.push(['Data:', storedDatetime]);
  data.push(['Lloc de trobada:', storedMeetingPlace]);
  data.push([]); // Empty row
  
  // Process each diagram (dance)
  if (event.diagrams && event.diagrams.length > 0) {
    event.diagrams.forEach(function(diagram, diagramIndex) {
      // Dance name header
      const backup = diagram.backup || [];
      const ballRow = ['Ball:', diagram.danceName, 'Reserves:'].concat(backup);
      data.push(ballRow);
      
      // Description (if any)
      data.push(['Descripció:', diagram.description ?? '']);
      
      const rows = diagram.rows || 2;
      const cols = diagram.columns || 2;
      const positions = diagram.positions || [];
      const groups = diagram.groups || [];
      
      // Create header row with group letters
      const headerRow = ['Posició'];
      groups.forEach(function(group, groupIndex) {
        headerRow.push('Grup ' + String.fromCharCode(65 + groupIndex));
      });
      data.push(headerRow);
      
      // Create data rows for each position
      for (let order = 1; order <= rows * cols; order++) {
        const pos = positions.find(function(p) { return p.order === order; });
        const posTag = pos ? pos.tag : '';
        
        const posRow = [posTag];
        groups.forEach(function(group) {
          const cellIndex = order - 1;
          posRow.push(group[cellIndex] || '');
        });
        data.push(posRow);
      }     
      
      data.push([]); // Empty row between dances
    });
  }
  
  // Write all data at once
  if (data.length > 0) {
    const range = sheet.getRange(1, 1, data.length, getMaxColumns_(data));
    range.setValues(padDataRows_(data, getMaxColumns_(data)));
    
    // Format the sheet
    formatEventSheet_(sheet, event);
  }
  
  // Update the Llistat sheet with event name, date and meeting place
  updateEventsList_(spreadsheet, event.name, storedDatetime, storedMeetingPlace);

  // Ensure event column exists in the attendance sheet
  ensureAttendanceColumn_(spreadsheet, event.name);

  CACHE.bumpVersion('events');
  
  try {
    if (isNewSheet) notifyEventCreated({ name: event.name, date: event.datetime });
  } catch (e) {
    console.error('Error sending event notification: ' + e.toString());
  }

  return API.newResult_({
    result: {
      message: isNewSheet ? 'Actuació creada correctament' : 'Actuació actualitzada correctament',
      sheetName: sheetName,
    },
  });
}

/**
 * Updates the events list (Llistat sheet) with event name, date and meeting place
 * Avoids duplicates by checking if event already exists
 * @param {Spreadsheet} spreadsheet - The spreadsheet object
 * @param {string} eventName - The event name
 * @param {string} isoDatetime - The event datetime in ISO format
 * @param {string} meetingPlace - The meeting place
 */
function updateEventsList_(spreadsheet, eventName, isoDatetime, meetingPlace) {
  const listSheet = spreadsheet.getSheetByName(EVENTS_SHEET_NAME);
  if (!listSheet) {
    console.log('Llistat sheet not found');
    return;
  }
  
  const data = listSheet.getDataRange().getValues();
  let existingRow = -1;
  
  // Search for existing event by name (skip header row)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eventName) {
      existingRow = i + 1; // Convert to 1-based row number
      break;
    }
  }
  
  if (existingRow > 0) {
    // Update existing row
    listSheet.getRange(existingRow, 1, 1, 3).setValues([[eventName, isoDatetime, meetingPlace || '']]);
  } else {
    // Append new row
    listSheet.appendRow([eventName, isoDatetime, meetingPlace || '']);
  }
}

function setEventVisibility_({eventName, visible}) {
  if (!eventName) {
    return API.newError_({ error: 'El nom de l\'actuació és obligatori' });
  }

  const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
  const listSheet = spreadsheet.getSheetByName(EVENTS_SHEET_NAME);
  if (!listSheet) {
    return API.newError_({ error: 'No s\'ha trobat el full de llistat' });
  }

  const data = listSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eventName) {
      listSheet.getRange(i + 1, 6).setValue(visible ? true : '');
      CACHE.clearEvents();
      CACHE.bumpVersion('events');
      const msg = visible ? 'Actuació visible correctament' : 'Actuació ocultada correctament';
      return API.newResult_({ result: { message: msg } });
    }
  }

  return API.newError_({ error: 'No s\'ha trobat l\'actuació' });
}

function ensureAttendanceColumn_(spreadsheet, eventName) {
  const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
  if (!sheet) {
    console.log('Attendance sheet not found');
    return;
  }

  const headerRow = sheet.getDataRange().getValues()[0];
  for (let i = 1; i < headerRow.length; i++) {
    const cellVal = headerRow[i] instanceof Date ? dateToString_(headerRow[i]) : String(headerRow[i]).replace(/^'/, '').trim();
    if (cellVal === String(eventName).trim()) {
      return;
    }
  }

  const newColumn = headerRow.length + 1;
  sheet.getRange(1, newColumn).setValue("'" + eventName);
}

/**
 * Sanitizes a string to be used as a sheet name
 * Sheet names cannot contain: : \ / ? * [ ]
 * Maximum length is 31 characters
 */
function sanitizeSheetName_(name) {
  let sanitized = name
    .replace(/[:\\/\?\*\[\]]/g, '-')
    .replace(/['"]/g, '')
    .trim();
  
  return sanitized;
}

function getMaxColumns_(data) {
  let max = 0;
  data.forEach(function(row) {
    if (row.length > max) max = row.length;
  });
  return max || 1;
}

function padDataRows_(data, maxCols) {
  return data.map(function(row) {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });
}

function getEvents_({forceRefresh} = {}) {
  forceRefresh = forceRefresh === true || forceRefresh === "true";
	
	try {
		// Reload from database if force refresh is requested	
		const events = forceRefresh ? CACHE.retrieveEventsFromDB() : CACHE.getEvents();
    const sortedEvents = events.slice().sort(function(a, b) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    return API.newResult_({ result: sortedEvents });
	} catch (error) {
		console.log('Error getting events: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function getTrainings_({forceRefresh} = {}) {
  forceRefresh = forceRefresh === true || forceRefresh === "true";
  
  try {
    // Reload from database if force refresh is requested
    const trainings = forceRefresh ? CACHE.retrieveTrainingsFromDB() : CACHE.getTrainings();
    
    const sortedTrainings = Object.keys(trainings)
    .sort(function(a,b) { return a > b })
    .map(function(k) { 
      const training = trainings[k];
      const result = {
        id: k,
        date: k,
        attendees: training.attendees || [],
        rejections: training.rejections || [],
        notes: training.notes || {},
        description: training.description,
      };
      
      return result;
    });
    
    return API.newResult_({ result: sortedTrainings });
  } catch (error) {
    console.log('Error getting training sessions: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}

function getTrainingById_({trainingId, token}) {
  if (!trainingId) return API.newError_({ error: 'No s\'ha especificat l\'ID de l\'assaig.' });
  
  try {
    const trainings = CACHE.getTrainings();
    const training = trainings[trainingId];
    
    if (training === undefined) {
      console.log('Training session not found: ' + trainingId);
      return API.newError_({ error: 'Training session not found: ' + trainingId });
    }
    
    const result = {
      id: trainingId,
      date: trainingId,
      attendees: training.attendees || [],
      rejections: training.rejections || [],
      notes: training.notes || {},
      description: training.description
    };
    
    return API.newResult_({ result: result });
  } catch (error) {
    console.log('Error getting training by ID: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}


function getEventById_({eventId}) {
  if (!eventId) return API.newError_({ error: 'No s\'ha especificat l\'ID de l\'esdeveniment.' });
  
  try {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(eventId);
    
    if (!sheet) {
      console.log('Event sheet not found, creating: ' + eventId);
      sheet = spreadsheet.insertSheet(eventId);

      var events = CACHE.getEvents();
      var matchedEvent = events.find(function(ev) { return ev.id === eventId || ev.name === eventId; });
      var bareEventName = matchedEvent ? matchedEvent.name : eventId;
      var bareDate = matchedEvent && matchedEvent.date ? "'" + matchedEvent.date : '';
      var bareMeetingPlace = matchedEvent ? (matchedEvent.meetingPlace || '') : '';

      var bareData = [
        ['Actuació:', bareEventName],
        ['Data:', bareDate],
        ['Lloc de trobada:', bareMeetingPlace],
        ['', '']
      ];
      sheet.getRange(1, 1, bareData.length, 2).setValues(bareData);

      sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#e8f5e9');
      sheet.getRange('A2:B2').setFontWeight('bold').setBackground('#e8f5e9');
      sheet.getRange('A3:B3').setFontWeight('bold').setBackground('#e8f5e9');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 3) return API.newError_({ error: 'Event data is incomplete' });
    
    // Parse header info
    const eventName = data[0][1] || '';
    // Date may be stored as Date object or string (possibly with apostrophe prefix)
    let eventDate = '';
    if (data[1][1]) {
      if (data[1][1] instanceof Date) {
        // Date object from legacy data - convert to datetime-local format
        // Use UTC methods to avoid timezone conversion, then adjust for Spain timezone (+1/+2)
        const d = data[1][1];
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        eventDate = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
      } else {
        // String - remove apostrophe prefix if present
        eventDate = String(data[1][1]).replace(/^'/, '');
      }
    }
    
    // Parse meeting place (row 3, column B - may be empty for legacy events)
    let eventMeetingPlace = '';
    let startRow = 3; // Default for legacy events without meeting place
    if (data.length > 2 && data[2][0] === 'Lloc de trobada:') {
      eventMeetingPlace = data[2][1] || '';
      startRow = 4; // New format has meeting place row
    }
    
    // Parse diagrams (dances)
    const diagrams = [];
    let currentDance = null;
    let i = startRow; // Start after header rows and empty row
    
    while (i < data.length) {
      const row = data[i];
      
      // Check for dance header
      if (row[0] === 'Ball:') {
        // Save previous dance if exists
        if (currentDance) {
          diagrams.push(currentDance);
        }
        
        // Read backup list from Ball row (columns 3 onwards: each member in separate cell)
        let backup = [];
        if (row[2] === 'Reserves:') {
          for (let col = 3; col < row.length; col++) {
            if (row[col] && String(row[col]).trim().length > 0) {
              backup.push(String(row[col]).trim());
            } else {
              break;
            }
          }
        }
        
        currentDance = {
          danceName: row[1] || '',
          description: '',
          rows: 0,
          columns: 0,
          positions: [],
          groups: [],
          backup: backup
        };
        i++;
        
        // Check for description row
        if (i < data.length && data[i][0] === 'Descripció:') {
          currentDance.description = data[i][1] || '';
          i++;
        }
        
        // Next row should be header row with Posició, Grup A, Grup B, etc.
        if (i < data.length && (data[i][0] === 'Posició' || data[i][0] === 'Tag')) {
          const headerRow = data[i];
          // Count groups (columns after Tag)
          const groupCount = headerRow.filter(function(cell, idx) {
            return idx >= 1 && cell && String(cell).startsWith('Grup');
          }).length;
          
          // Initialize groups arrays
          for (let g = 0; g < groupCount; g++) {
            currentDance.groups.push([]);
          }
          i++;
          
          // Read position rows until empty row or next Ball:
          let positionOrder = 1;
          let maxCol = 0;
          let rowCount = 0;
          
          while (i < data.length && data[i][0] !== 'Ball:' && data[i][0] !== '') {
            const posRow = data[i];
            const posTag = posRow[0] || '';
            
            currentDance.positions.push({
              order: positionOrder,
              label: posTag, // Use tag as label for display
              tag: posTag
            });
            
            // Read group assignments
            for (let g = 0; g < groupCount; g++) {
              const memberName = posRow[1 + g] || null;
              currentDance.groups[g].push(memberName);
            }
            
            positionOrder++;
            i++;
          }
          
          // Calculate rows and columns from position count
          // Common structures: 2x2=4, 2x3=6, 3x2=6, 2x4=8, 4x2=8
          const totalPositions = currentDance.positions.length;
          if (totalPositions === 4) {
            currentDance.rows = 2;
            currentDance.columns = 2;
          } else if (totalPositions === 6) {
            currentDance.rows = 2;
            currentDance.columns = 3;
          } else if (totalPositions === 8) {
            currentDance.rows = 2;
            currentDance.columns = 4;
          } else {
            // Default to 2 rows
            currentDance.rows = 2;
            currentDance.columns = Math.ceil(totalPositions / 2);
          }
        }
      } else if (row[0] === '') {
        // Empty row, skip
        i++;
      } else {
        i++;
      }
    }
    
    // Save last dance
    if (currentDance) {
      diagrams.push(currentDance);
    }

    // Fetch member attendance data for this event
    const allEventAssistance = CACHE.retrieveEventMemberAssistanceFromDB();
    const eventAssistance = allEventAssistance[eventName] || { attendees: [], rejections: [], notes: {} };

    return API.newResult_({
      result: {
        id: eventId,
        name: eventName,
        datetime: eventDate,
        meetingPlace: eventMeetingPlace,
        diagrams: diagrams,
        attendees: eventAssistance.attendees,
        rejections: eventAssistance.rejections,
        notes: eventAssistance.notes
      },
    });
  } catch (error) {
    console.log('Error getting event by ID: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}

function calculateEventDancePositions_({ danceName, attendees }) {
  if (!danceName) return API.newError_({ error: 'El nom del ball és obligatori.' });

  try {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const events = CACHE.getEvents();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pastEvents = events.filter(function (ev) {
      return ev.date && new Date(ev.date) < now;
    });

    var positionMembers = {};

    pastEvents.forEach(function (ev) {
      var sheet = spreadsheet.getSheetByName(ev.id);
      if (!sheet) return;

      var data = sheet.getDataRange().getValues();
      var i = 0;

      while (i < data.length) {
        var row = data[i];
        if (row[0] === 'Ball:' && row[1] === danceName) {
          i++;
          if (i < data.length && data[i][0] === 'Descripció:') i++;
          if (i < data.length && (data[i][0] === 'Posició' || data[i][0] === 'Tag')) {
            var headerRow = data[i];
            var groupCount = headerRow.filter(function (cell, idx) {
              return idx >= 1 && cell && String(cell).startsWith('Grup');
            }).length;
            i++;

            var posOrder = 1;
            while (i < data.length && data[i][0] !== 'Ball:' && data[i][0] !== '') {
              var posRow = data[i];
              var posTag = posRow[0] || ('Pos ' + posOrder);

              if (!positionMembers[posOrder]) {
                positionMembers[posOrder] = { tag: posTag, members: {} };
              }

              for (var g = 0; g < groupCount; g++) {
                var member = posRow[1 + g];
                if (member && String(member).trim().length > 0) {
                  var memberName = String(member).trim();
                  positionMembers[posOrder].members[memberName] = (positionMembers[posOrder].members[memberName] || 0) + 1;
                }
              }

              posOrder++;
              i++;
            }
          } else {
            i++;
          }
        } else {
          i++;
        }
      }
    });

    var result = {};
    var orders = Object.keys(positionMembers);
    orders.forEach(function (order) {
      var pos = positionMembers[order];
      var sorted = Object.keys(pos.members)
        .map(function (name) { return { name: name, count: pos.members[name] }; })
        .sort(function (a, b) { return b.count - a.count; });

      if (attendees && attendees.length > 0) {
        sorted.forEach(function (entry) {
          entry.attending = attendees.indexOf(entry.name) !== -1;
        });
      }

      result[order] = { tag: pos.tag, members: sorted };
    });

    return API.newResult_({ result: result });
  } catch (error) {
    console.log('Error calculating dance positions: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}

function formatEventSheet_(sheet, event) {
  // Auto-resize columns
  const lastCol = sheet.getLastColumn();
  for (let i = 1; i <= lastCol; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Format header rows (Actuació, Data, and Lloc de trobada)
  sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange('A2:B2').setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange('A3:B3').setFontWeight('bold').setBackground('#e8f5e9');
  
  // Find and format dance headers
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Ball:') {
      // Format dance header
      sheet.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#bbdefb');
      
      // Format position header row (next row)
      if (i + 1 < data.length && data[i + 1][0] === 'Posició') {
        const headerRange = sheet.getRange(i + 2, 1, 1, lastCol);
        headerRange.setFontWeight('bold').setBackground('#e3f2fd');
      }
    }
  }
  
  // Freeze first column for easier navigation
  sheet.setFrozenColumns(1);
}
/**
 * Save/update a training session
 * @param {Object} training - Training object with date (training ID or new date), description, and optionally attendance
 * @returns {Object} Result object with success status
 */
function saveTraining_({training}) {
  if (!training || !training.date) {
    return API.newError_({ error: 'La data de l\'assaig és obligatòria' });
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(TRAINING_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    if (!data || data.length < 2) {
      return API.newError_({ error: 'No hi ha dades de entrenament' });
    }

    // The training.date is the training ID (either existing or new)
    const trainingId = training.date;
    const headerRow = data[0];
    let dateColumn = -1;

    // Find the column index that matches this training ID
    for (let i = 1; i < headerRow.length; i++) {
      const cellDate = headerRow[i] instanceof Date ? dateToString_(headerRow[i]) : String(headerRow[i]).replace(/^'/, '');
      if (cellDate === String(trainingId)) {
        dateColumn = i + 1; // Sheets columns are 1-indexed
        break;
      }
    }

    // If column doesn't exist, create it (for new trainings)
    const isNewTraining = dateColumn === -1;
    if (dateColumn === -1) {
      // Insert a new column after the last training column
      const lastDataColumn = headerRow.length;
      dateColumn = lastDataColumn + 1;
      
      // Expand the data range to include the new column
      const newHeaderRow = headerRow.slice();
      newHeaderRow.push(trainingId);
      
      // Set the new header value and the description note
      // Prefix with apostrophe so Sheets stores it as text, not a Date object
      sheet.getRange(1, dateColumn).setValue("'" + trainingId);
      sheet.getRange(1, dateColumn).setNote(training.description || '');
      
      console.log("Created new training column:", dateColumn, "for date:", trainingId);
    } else {
      // Update the description in header notes for existing column
      sheet.getRange(1, dateColumn).setNote(training.description || '');

      // If the date has changed, update the column header
      if (training.newDate && String(training.newDate) !== String(trainingId)) {
        sheet.getRange(1, dateColumn).setValue("'" + training.newDate);
      }
    }

    // If attendance data is provided, update it
    if (training.attendees && Array.isArray(training.attendees)) {
      // First clear all existing marks in this column (start from row 2, skipping header)
      for (let i = 2; i <= data.length; i++) {
        sheet.getRange(i, dateColumn).setValue('');
      }

      // Then add marks for attendees
      training.attendees.forEach(function (memberName) {
        // Search for the member in the first column
        for (let i = 1; i < data.length; i++) {
          const cellName = String(data[i][0]).trim();
          if (cellName === String(memberName).trim()) {
            sheet.getRange(i + 1, dateColumn).setValue('SI');
            break;
          }
        }
      });
    }

    // Invalidate cache so next read gets fresh data
    const finalTrainingId = training.newDate || trainingId;
    if (training.newDate && training.newDate !== trainingId) {
      CACHE.renameTraining({ oldDate: trainingId, newDate: finalTrainingId, updates: training });
    } else {
      CACHE.addTraining({ training: { ...training, date: finalTrainingId } });
    }
    CACHE.bumpVersion('trainings');

    // try {
    //   if (isNewTraining) notifyTrainingCreated({ date: finalTrainingId });
    // } catch (e) {
    //   console.error('Error sending training notification: ' + e.toString());
    // }

    return API.newResult_({
      result: {
        message: 'Assaig actualitzat correctament',
        trainingId: finalTrainingId,
      },
    });
  } catch (error) {
    console.error('Error saving training:', error.toString());
    return API.newError_({ error: 'Error desant l\'assaig: ' + error.toString() });
  }
}

/**
 * Helper function to get training attendance context (sheet, column, row)
 * @param {string} trainingId - The training ID
 * @param {Object} user - The user object with alias
 * @returns {Object} Context object with sheet, dateColumn, userRow, or error
 */
function getTrainingAttendanceContext_({trainingId, user}) {
  if (!trainingId) {
    return { error: API.newError_({ error: 'La data de l\'assaig és obligatòria' }) };
  }

  if (!user || !user.alias) {
    return { error: API.newError_({ error: 'No s\'ha pogut identificar l\'usuari.' }) };
  }

  const spreadsheet = SpreadsheetApp.openById(TRAINING_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  if (!data || data.length < 2) {
    return { error: API.newError_({ error: 'No hi ha dades d\'entrenament' }) };
  }

  const headerRow = data[0];
  let dateColumn = -1;

  for (let i = 1; i < headerRow.length; i++) {
    const cellDate = headerRow[i] instanceof Date ? dateToString_(headerRow[i]) : String(headerRow[i]).replace(/^'/, '');
    if (cellDate === String(trainingId)) {
      dateColumn = i + 1; // Sheets columns are 1-indexed
      break;
    }
  }

  if (dateColumn === -1) {
    return { error: API.newError_({ error: 'No s\'ha trobat l\'assaig: ' + trainingId }) };
  }

  // Find the user's row by alias
  let userRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(user.alias).trim()) {
      userRow = i + 1; // Sheets rows are 1-indexed
      break;
    }
  }

  if (userRow === -1) {
    const newRowIndex = data.length + 1;
    sheet.getRange(newRowIndex, 1).setValue(user.alias);
    userRow = newRowIndex;
  }

  return { sheet, dateColumn, userRow, trainingId };
}

/**
 * Confirm training attendance
 * @param {string} trainingId - The training ID
 * @param {Object} user - The user object with alias
 * @returns {Object} Result object with status
 */
function confirmTrainingAttendance_({trainingId, user}) {
  try {
    const context = getTrainingAttendanceContext_({trainingId, user});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('SI');
    SpreadsheetApp.flush();

    // Invalidate cache
    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        status: 'confirmed',
        value: 'SI',
        message: 'Assistència confirmada',
      },
    });
  } catch (error) {
    console.error('Error confirming training attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

/**
 * Cancel training attendance (mark as not attending)
 * @param {string} trainingId - The training ID
 * @param {Object} user - The user object with alias
 * @returns {Object} Result object with status
 */
function cancelTrainingAttendance_({trainingId, user}) {
  try {
    const context = getTrainingAttendanceContext_({trainingId, user});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('NO');
    SpreadsheetApp.flush();

    // Invalidate cache
    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        status: 'not-attending',
        value: 'NO',
        message: 'Has marcat que no assistiràs',
      },
    });
  } catch (error) {
    console.error('Error canceling training attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

/**
 * Verify that a member ID is in the user's relatedMembers list
 * @param {string} memberId - The member ID to verify
 * @param {Object} user - The user object with relatedMembers
 * @returns {boolean} True if the memberId is a related member
 */
function isRelatedMember_(memberId, user) {
  if (!user || !user.relations || !Array.isArray(user.relations)) {
    return false;
  }
  return user.relations.some(function(rmId) {
    return rmId === memberId;
  });
}

/**
 * Confirm training attendance for a related member
 * @param {string} trainingId - The training ID
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 * @param {Object} user - The user object with alias and relatedMembers
 * @returns {Object} Result object with status
 */
function confirmRelatedMemberAttendance_({trainingId, memberId, memberAlias, user}) {
  try {
    // Verify the memberId is in the user's relatedMembers
    if (!isRelatedMember_(memberId, user)) {
      return API.newError_({ error: 'No tens permís per gestionar l\'assistència d\'aquest membre.', status: 403 });
    }

    // Create a user object with the related member's alias
    const relatedUser = { alias: memberAlias };
    const context = getTrainingAttendanceContext_({trainingId, user: relatedUser});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('SI');
    SpreadsheetApp.flush();

    // Invalidate cache
    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberId: memberId,
        memberAlias: memberAlias,
        status: 'confirmed',
        value: 'SI',
        message: 'Assistència confirmada',
      },
    });
  } catch (error) {
    console.error('Error confirming related member attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

/**
 * Cancel training attendance for a related member
 * @param {string} trainingId - The training ID
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 * @param {Object} user - The user object with alias and relatedMembers
 * @returns {Object} Result object with status
 */
function cancelRelatedMemberAttendance_({trainingId, memberId, memberAlias, user}) {
  try {
    // Verify the memberId is in the user's relatedMembers
    if (!isRelatedMember_(memberId, user)) {
      return API.newError_({ error: 'No tens permís per gestionar l\'assistència d\'aquest membre.', status: 403 });
    }

    // Create a user object with the related member's alias
    const relatedUser = { alias: memberAlias };
    const context = getTrainingAttendanceContext_({trainingId, user: relatedUser});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('NO');
    SpreadsheetApp.flush();

    // Invalidate cache
    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberId: memberId,
        memberAlias: memberAlias,
        status: 'not-attending',
        value: 'NO',
        message: 'Marcat que no assistirà',
      },
    });
  } catch (error) {
    console.error('Error canceling related member attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

/**
 * Admin function to set member attendance for a training session
 * @param {string} trainingId - The training ID
 * @param {string} memberAlias - The member alias to set attendance for
 * @param {boolean} attending - True to confirm attendance, false to clear
 * @param {Object} user - The admin user object
 * @returns {Object} Result object with status
 */
function adminSetMemberAttendance_({trainingId, memberAlias, attending, user}) {
  try {
    // Create a fake user object with the member alias to reuse getTrainingAttendanceContext_
    const memberUser = { alias: memberAlias };
    const context = getTrainingAttendanceContext_({trainingId, user: memberUser});
    if (context.error) return context.error;

    const newValue = attending ? 'SI' : 'NO';
    context.sheet.getRange(context.userRow, context.dateColumn).setValue(newValue);
    SpreadsheetApp.flush();

    // Invalidate cache
    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberAlias: memberAlias,
        attending: attending,
        message: attending ? 'Assistència confirmada' : 'Assistència rebutjada',
      },
    });
  } catch (error) {
    console.error('Error setting member attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

function saveTrainingNote_({trainingId, note, user}) {
  try {
    const context = getTrainingAttendanceContext_({trainingId, user});
    if (context.error) return context.error;

    const cell = context.sheet.getRange(context.userRow, context.dateColumn);
    cell.setNote(note || '');
    SpreadsheetApp.flush();

    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        note: note || '',
        message: note ? 'Nota desada' : 'Nota esborrada',
      },
    });
  } catch (error) {
    console.error('Error saving training note:', error.toString());
    return API.newError_({ error: 'Error desant la nota: ' + error.toString() });
  }
}

function saveRelatedMemberTrainingNote_({trainingId, memberId, memberAlias, note, user}) {
  try {
    if (!isRelatedMember_(memberId, user)) {
      return API.newError_({ error: 'No tens permís per gestionar les notes d\'aquest membre.', status: 403 });
    }

    const relatedUser = { alias: memberAlias };
    const context = getTrainingAttendanceContext_({trainingId, user: relatedUser});
    if (context.error) return context.error;

    const cell = context.sheet.getRange(context.userRow, context.dateColumn);
    cell.setNote(note || '');
    SpreadsheetApp.flush();

    CACHE.bumpVersion('trainings');
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberAlias: memberAlias,
        note: note || '',
        message: note ? 'Nota desada' : 'Nota esborrada',
      },
    });
  } catch (error) {
    console.error('Error saving related member training note:', error.toString());
    return API.newError_({ error: 'Error desant la nota: ' + error.toString() });
  }
}

function confirmEventMemberAttendance_({eventId, memberAlias, attending, user}) {
  try {
    const isSelf = user.alias === memberAlias;
    const isAdmin = (user.roles || []).indexOf('ADMIN') !== -1;
    let isRelated = false;
    if (!isSelf && !isAdmin) {
      const members = CACHE.getMembers();
      const targetMember = members.find(function(m) { return m.alias === memberAlias; });
      isRelated = targetMember && isRelatedMember_(targetMember.id, user);
    }
    if (!isSelf && !isRelated && !isAdmin) {
      return API.newError_({ error: 'No tens permís per modificar l\'assistència d\'aquest membre.', status: 403 });
    }

    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const notes = sheet.getDataRange().getNotes();

    // Find the column for this event (look in header row for matching event name)
    let eventColumnIndex = -1;
    const headerRow = data[0];
    for (let i = 1; i < headerRow.length; i++) {
      const cellVal = headerRow[i] instanceof Date ? dateToString_(headerRow[i]) : String(headerRow[i]).replace(/^'/, '').trim();
      if (cellVal === String(eventId).trim()) {
        eventColumnIndex = i;
        break;
      }
    }

    if (eventColumnIndex === -1) {
      return API.newError_({ error: 'No s\'ha trobat la columna per a l\'esdeveniment' });
    }

    // Find the row for this member
    let memberRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(memberAlias).trim()) {
        memberRowIndex = i;
        break;
      }
    }

    if (memberRowIndex === -1) {
      memberRowIndex = data.length;
      sheet.getRange(memberRowIndex + 1, 1).setValue(memberAlias);
    }

    // Update the attendance value
    const newValue = attending ? 'SI' : 'NO';
    sheet.getRange(memberRowIndex + 1, eventColumnIndex + 1).setValue(newValue);

    // Invalidate cache
    CACHE.retrieveEventMemberAssistanceFromDB();
    CACHE.bumpVersion('events');

    return API.newResult_({
      result: {
        eventId: eventId,
        memberAlias: memberAlias,
        attending: attending,
        message: attending ? 'Assistència confirmada' : 'Assistència rebutjada',
      },
    });
  } catch (error) {
    console.error('Error setting event member attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}

function checkFormAttendance_({spreadsheetId, eventId}) {
  if (!spreadsheetId) {
    return API.newError_({ error: 'Cal indicar l\'identificador de la fulla de respostes.', status: 400 });
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return API.newResult_({ result: [] });
    }

    const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
    const nameColIndex = headers.indexOf('nom');
    const attendanceColIndex = 2;
    const participatesColIndex = headers.findIndex(function(h) { return h.indexOf('en què participes') !== -1; });

    if (nameColIndex === -1 || participatesColIndex === -1) {
      return API.newError_({ error: 'No s\'han trobat les columnes "Nom" o "En què participes?" a la fulla.', status: 400 });
    }

    var eventAttendees = [];
    if (eventId && eventId !== 'null' && eventId !== 'undefined') {
      const allEventAssistance = CACHE.retrieveEventMemberAssistanceFromDB();
      console.log('checkFormAttendance: eventId=' + eventId + ', keys=' + JSON.stringify(Object.keys(allEventAssistance)));
      const eventAssistance = allEventAssistance[eventId] || allEventAssistance[String(eventId).replace(/^'/, '').trim()] || { attendees: [], rejections: [] };
      eventAttendees = eventAssistance.attendees || [];
      console.log('checkFormAttendance: eventAttendees=' + JSON.stringify(eventAttendees));
    }

    const members = CACHE.getMembers();
    const matches = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const participates = String(row[participatesColIndex] || '').toLowerCase();
      if (participates.indexOf('ball de bastons') === -1) continue;

      const formName = String(row[nameColIndex] || '').trim();
      if (!formName) continue;

      const formAttendance = String(row[attendanceColIndex] || '').trim().toLowerCase();
      const formSaysYes = formAttendance.length > 0 && formAttendance !== 'no';

      console.log('checkFormAttendance row ' + i + ': name=' + formName + ', attendance="' + formAttendance + '", formSaysYes=' + formSaysYes);

      const formNameLower = formName.toLowerCase();
      const matchedMember = members.find(function(m) {
        const memberName = (m.name || '').toLowerCase();
        const memberAlias = (m.alias || '').toLowerCase();
        return memberName === formNameLower || memberAlias === formNameLower ||
               memberName.indexOf(formNameLower) !== -1 || formNameLower.indexOf(memberName) !== -1 ||
               (memberAlias && (memberAlias.indexOf(formNameLower) !== -1 || formNameLower.indexOf(memberAlias) !== -1));
      });

      var attendanceMismatch = null;
      if (matchedMember && eventId) {
        const memberAlias = matchedMember.alias || '';
        const confirmedInApp = eventAttendees.indexOf(memberAlias) !== -1;
        if (formSaysYes && !confirmedInApp) {
          attendanceMismatch = 'form_yes_app_no';
        } else if (!formSaysYes && confirmedInApp) {
          attendanceMismatch = 'form_no_app_yes';
        }
      }

      matches.push({
        formName: formName,
        memberAlias: matchedMember ? matchedMember.alias : null,
        memberName: matchedMember ? matchedMember.name : null,
        matched: !!matchedMember,
        formAttendance: formSaysYes ? 'yes' : 'no',
        attendanceMismatch: attendanceMismatch,
      });
    }

    return API.newResult_({ result: matches });
  } catch (error) {
    console.error('Error checking form attendance:', error.toString());
    return API.newError_({ error: 'Error llegint la fulla de respostes: ' + error.toString() });
  }
}