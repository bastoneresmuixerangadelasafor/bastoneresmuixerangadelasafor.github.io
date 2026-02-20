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
      data.push(['Ball:', diagram.danceName]);
      
      // Description (if any)
      if (diagram.description) {
        data.push(['Descripció:', diagram.description]);
      }
      
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
  forceRefresh = forceRefresh || false;
	
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
  forceRefresh = forceRefresh || false;
  
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
        assistance: training.attendees || [],
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
      assistance: training.attendees,
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
      console.log('Event sheet not found: ' + eventId);
      return API.newError_({ error: 'Event sheet not found: ' + eventId });
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
        
        currentDance = {
          danceName: row[1] || '',
          description: '',
          rows: 0,
          columns: 0,
          positions: [],
          groups: []
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
        attendees: eventAssistance.attendees || [],
        rejections: eventAssistance.rejections || [],
        notes: eventAssistance.notes || {}
      },
    });
  } catch (error) {
    console.log('Error getting event by ID: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}

/**
 * Formats the event sheet with colors and styles
 */
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
      const headerDate = headerRow[i];
      // Compare the header date with the training ID
      if (String(headerDate) === String(trainingId)) {
        dateColumn = i + 1; // Sheets columns are 1-indexed
        break;
      }
    }

    // If column doesn't exist, create it (for new trainings)
    if (dateColumn === -1) {
      // Insert a new column after the last training column
      const lastDataColumn = headerRow.length;
      dateColumn = lastDataColumn + 1;
      
      // Expand the data range to include the new column
      const newHeaderRow = headerRow.slice();
      newHeaderRow.push(trainingId);
      
      // Set the new header value and the description note
      sheet.getRange(1, dateColumn).setValue(trainingId);
      sheet.getRange(1, dateColumn).setNote(training.description || '');
      
      console.log("Created new training column:", dateColumn, "for date:", trainingId);
    } else {
      // Update the description in header notes for existing column
      sheet.getRange(1, dateColumn).setNote(training.description || '');
    }

    // If attendance data is provided, update it
    if (training.assistance && Array.isArray(training.assistance)) {
      // First clear all existing marks in this column (start from row 2, skipping header)
      for (let i = 2; i <= data.length; i++) {
        sheet.getRange(i, dateColumn).setValue('');
      }

      // Then add marks for attendees
      training.assistance.forEach(function (memberName) {
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
    CACHE.addTraining({ training });

    return API.newResult_({
      result: {
        message: 'Assaig actualitzat correctament',
        trainingId: trainingId,
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
    if (String(headerRow[i]) === String(trainingId)) {
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
    return { error: API.newError_({ error: 'No s\'ha trobat el membre: ' + user.alias }) };
  }

  return { sheet, dateColumn, userRow, trainingId };
}

/**
 * Reset training attendance to not-confirmed state
 * @param {string} trainingId - The training ID
 * @param {Object} user - The user object with alias
 * @returns {Object} Result object with status
 */
function resetTrainingAttendance_({trainingId, user}) {
  try {
    const context = getTrainingAttendanceContext_({trainingId, user});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('');

    // Invalidate cache
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        status: 'not-confirmed',
        value: '',
        message: 'Estat restablert a no confirmat',
      },
    });
  } catch (error) {
    console.error('Error resetting training attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
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

    // Invalidate cache
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

    // Invalidate cache
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

    // Invalidate cache
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

    // Invalidate cache
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
 * Reset training attendance for a related member to not-confirmed state
 * @param {string} trainingId - The training ID
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 * @param {Object} user - The user object with alias and relatedMembers
 * @returns {Object} Result object with status
 */
function resetRelatedMemberAttendance_({trainingId, memberId, memberAlias, user}) {
  try {
    // Verify the memberId is in the user's relatedMembers
    if (!isRelatedMember_(memberId, user)) {
      return API.newError_({ error: 'No tens permís per gestionar l\'assistència d\'aquest membre.', status: 403 });
    }

    // Create a user object with the related member's alias
    const relatedUser = { alias: memberAlias };
    const context = getTrainingAttendanceContext_({trainingId, user: relatedUser});
    if (context.error) return context.error;

    context.sheet.getRange(context.userRow, context.dateColumn).setValue('');

    // Invalidate cache
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberId: memberId,
        memberAlias: memberAlias,
        status: 'not-confirmed',
        value: '',
        message: 'Estat restablert a no confirmat',
      },
    });
  } catch (error) {
    console.error('Error resetting related member attendance:', error.toString());
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

    const newValue = attending ? 'SI' : '';
    context.sheet.getRange(context.userRow, context.dateColumn).setValue(newValue);

    // Invalidate cache
    CACHE.retrieveTrainingsFromDB();

    return API.newResult_({
      result: {
        trainingId: context.trainingId,
        memberAlias: memberAlias,
        attending: attending,
        message: attending ? 'Assistència confirmada' : 'Assistència esborrada',
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

function adminSetEventMemberAttendance_({eventId, memberAlias, attending}) {
  try {
    const spreadsheet = SpreadsheetApp.openById(TRAINING_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ASSISTANCE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const notes = sheet.getDataRange().getNotes();

    // Find the column for this event (look in header row for matching event name)
    let eventColumnIndex = -1;
    const headerRow = data[0];
    for (let i = 1; i < headerRow.length; i++) {
      if (headerRow[i] === eventId) {
        eventColumnIndex = i;
        break;
      }
    }

    if (eventColumnIndex === -1) {
      return API.newError_({ error: 'No s\'ha trobat la columna per a l\'desenvolupament' });
    }

    // Find the row for this member
    let memberRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === memberAlias) {
        memberRowIndex = i;
        break;
      }
    }

    if (memberRowIndex === -1) {
      return API.newError_({ error: 'No s\'ha trobat el membre' });
    }

    // Update the attendance value
    const newValue = attending ? 'SI' : '';
    sheet.getRange(memberRowIndex + 1, eventColumnIndex + 1).setValue(newValue);

    // Invalidate cache
    CACHE.retrieveEventMemberAssistanceFromDB();

    return API.newResult_({
      result: {
        eventId: eventId,
        memberAlias: memberAlias,
        attending: attending,
        message: attending ? 'Assistència confirmada' : 'Assistència esborrada',
      },
    });
  } catch (error) {
    console.error('Error setting event member attendance:', error.toString());
    return API.newError_({ error: 'Error actualitzant l\'assistència: ' + error.toString() });
  }
}