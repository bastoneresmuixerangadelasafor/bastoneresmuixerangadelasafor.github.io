function saveEvent_({event}) {
  if (!event || !event.name) {
    return {
      success: false,
      error: 'El nom de l\'actuació és obligatori',
    };
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
  
  return {
    success: true,
    result: {
      message: isNewSheet ? 'Actuació creada correctament' : 'Actuació actualitzada correctament',
      sheetName: sheetName,
    },
  };
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
  
  // Truncate to 31 characters (Google Sheets limit)
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  
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

function getEvents_(forceRefresh) {
  forceRefresh = forceRefresh || false;
	
	try {
		// Reload from database if force refresh is requested	
		const events = forceRefresh ? CACHE.retrieveEventsFromDB() : CACHE.getEvents();
    const sortedEvents = events.slice().sort(function(a, b) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    return {success: true, result: sortedEvents};
	} catch (error) {
		console.log('Error getting events: ' + error.toString());
		return {
      success: false, 
      error: error.toString(),
    };
	}
}

function getTrainings_(forceRefresh) {
  forceRefresh = forceRefresh || false;
  
  try {
    // Reload from database if force refresh is requested
    const trainings = forceRefresh ? CACHE.retrieveTrainingsFromDB() : CACHE.getTrainings();
    const sortedTrainings = Object.keys(trainings)
    .sort(function(a,b) { return a > b })
    .map(function(k) { 
      return {
        id: k,
        date: k,
        assistance: trainings[k].attendees,
        description: trainings[k].description,
      };
    });
    
    return {success: true, result: sortedTrainings};
  } catch (error) {
    console.log('Error getting training sessions: ' + error.toString());
    return {success: false, error: error.toString()};
  }
}

function getTrainingById_({trainingId}) {
  if (!trainingId) return { success: false, error: 'No s\'ha especificat l\'ID de l\'assaig.' };
  
  try {
    const trainings = CACHE.getTrainings();
    const training = trainings[trainingId];
    
    if (training === undefined) {
      console.log('Training session not found: ' + trainingId);
      return { success: false, error: 'Training session not found: ' + trainingId };
    }
    
    return {
      success: true,
      result: {
        id: trainingId,
        date: trainingId,
        assistance: training.attendees,
        description: training.description
      },
    };
  } catch (error) {
    console.log('Error getting training by ID: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function getEventById_({eventId}) {
  if (!eventId) return { success: false, error: 'No s\'ha especificat l\'ID de l\'esdeveniment.' };
  
  try {
    const spreadsheet = SpreadsheetApp.openById(EVENTS_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(eventId);
    
    if (!sheet) {
      console.log('Event sheet not found: ' + eventId);
      return { success: false, error: 'Event sheet not found: ' + eventId };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 3) return { success: false, error: 'Event data is incomplete' };
    
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
    
    return {
      success: true,
      result: {
        id: eventId,
        name: eventName,
        datetime: eventDate,
        meetingPlace: eventMeetingPlace,
        diagrams: diagrams
      },
    };
  } catch (error) {
    console.log('Error getting event by ID: ' + error.toString());
    return { success: false, error: error.toString() };
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
