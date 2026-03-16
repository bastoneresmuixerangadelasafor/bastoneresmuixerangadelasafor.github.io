function getMembers_({forceRefresh}) {
	forceRefresh = forceRefresh || false;
	
	try {
		// Reload from database if force refresh is requested	
		return API.newResult_({
      result: forceRefresh ? CACHE.retrieveMembersFromDB() : CACHE.getMembers(),
    });
	} catch (error) {
		console.log('Error getting members: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function saveMember_({member}) {
	try {
		if (!member) {
			return API.newError_({ error: 'Dades de membre invàlides' });
		}

		// Check if this is a new member (no ID or isNew flag)
		const isNewMember = !member.id || member.isNew;

		if (isNewMember) {
			return createNewMember_(member);
		}

		// Find the member index for existing member
    const members = CACHE.getMembers();
		const memberIndex = members.findIndex(function(m) { 
			return m.id === member.id; 
		});

		if (memberIndex === -1) {
			return API.newError_({ error: 'Membre no trobat' });
		}

		// Capture old email before update to invalidate cache if email changes
		const oldEmail = members[memberIndex].email;

		// Update the member data in memory
		// KID members cannot have email, roles, or relations
		const isKid = member.type === 'KID';
		const email = isKid ? '' : (member.email || '');
		const roles = isKid ? [] : (member.roles || []);
		const relations = isKid ? [] : (member.relations || []);
		
		members[memberIndex] = {
			id: member.id,
			name: member.name,
			email: email,
			type: member.type,
			roles: roles,
			relations: relations,
      active: member.active !== false,
		};

		// Persist to Google Spreadsheet
		const spreadsheet = SpreadsheetApp.openById(MEMBERS_SPREADSHEET_ID);
		const sheet = spreadsheet.getSheetByName(MEMBERS_SHEET_NAME);
		const data = sheet.getDataRange().getValues();
		
		// Find the row with matching ID (skip header row at index 0)
		let rowIndex = -1;
		for (let i = 1; i < data.length; i++) {
			if (String(data[i][0]) === String(member.id)) {
				rowIndex = i + 1; // Sheet rows are 1-indexed
				break;
			}
		}

		if (rowIndex === -1) {
			return API.newError_({ error: 'Membre no trobat al full de càlcul' });
		}

		// Prepare the row data
		// Expected columns: ID, Name, Email, Type, Roles, Relations
		const rolesString = (member.roles || []).join(', ');
		const relationsString = (member.relations || []).join(', ');
		const rowData = [
			member.id,
			member.name,
			member.email || '',
			member.type,
			rolesString,
			relationsString,
     		member.active !== false
		];

		// Update the row in the spreadsheet
		sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);

		// Invalidate user profile cache for both old and new email
		if (oldEmail) {
			const oldCacheKey = 'userProfile_' + oldEmail.toLowerCase();
			cache.remove(oldCacheKey);
		}
		if (email && email.toLowerCase() !== (oldEmail || '').toLowerCase()) {
			const newCacheKey = 'userProfile_' + email.toLowerCase();
			cache.remove(newCacheKey);
		}

		console.log('Member updated and persisted: ' + JSON.stringify(members[memberIndex]));

		return API.newResult_({ result: {member: MEMBERS[memberIndex]} });
	} catch (error) {
		console.log('Error saving member: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function createNewMember_(memberData) {
	try {
		if (!memberData.name || !memberData.name.trim()) {
			return API.newError_({ error: 'El nom del membre és obligatori' });
		}

		// Generate a new unique ID
		const newId = generateMemberId_();

		// KID members cannot have email, roles, or relations
		const isKid = memberData.type === 'KID';
		const email = isKid ? '' : (memberData.email || '');
		const roles = isKid ? [] : (memberData.roles || []);
		const relations = isKid ? [] : (memberData.relations || []);

		const newMember = {
			id: newId,
			name: memberData.name.trim(),
			email: email,
			type: memberData.type || 'ADULT',
			roles: roles,
			relations: relations,
			active: true
		};

		// Add to in-memory array
		CACHE.addMember(newMember);

		// Persist to Google Spreadsheet
		const spreadsheet = SpreadsheetApp.openById(MEMBERS_SPREADSHEET_ID);
		const sheet = spreadsheet.getSheetByName(MEMBERS_SHEET_NAME);

		// Prepare the row data
		const rolesString = roles.join(', ');
		const relationsString = relations.join(', ');
		const rowData = [
			newId,
			newMember.name,
			newMember.email,
			newMember.type,
			rolesString,
			relationsString,
			true
		];

		// Append the new row
		sheet.appendRow(rowData);

		console.log('New member created: ' + JSON.stringify(newMember));

		return API.newResult_({ result: { member: newMember } });
	} catch (error) {
		console.log('Error creating member: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function saveAllMembers_({members}) {
	try {
		if (!members || !Array.isArray(members)) {
			return API.newError_({ error: 'Dades de membres invàlides' });
		}

		const results = [];
		const errors = [];

		members.forEach(function(member) {
			const result = saveMember_({member});
			if (result.success) {
				results.push(result.member);
			} else {
				errors.push({ id: member.id, error: result.error });
			}
		});

		if (errors.length > 0) {
			return API.newError_({
				error: 'Alguns membres no s\'han pogut desar: ' + errors.map(function(e) { return e.error; }).join(', '),
			});
		}

		return API.newResult_({ result: {members: results} });
	} catch (error) {
		console.log('Error saving all members: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function getMemberPositions_({memberAlias}) {
	if (!memberAlias) return API.newError_({ error: 'No s\'ha especificat l\'àlies del membre.' });

	try {
		const positions = CACHE.retrieveMemberPositionsFromDB(memberAlias);
		return API.newResult_({ result: positions });
	} catch (error) {
		console.log('Error getting member positions: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function updateMemberPosition_({ memberAlias, danceName, positionOrder, value }) {
	if (!memberAlias) return API.newError_({ error: 'No s\'ha especificat l\'àlies del membre.' });
	if (!danceName) return API.newError_({ error: 'No s\'ha especificat el nom de la dansa.' });
	if (positionOrder === undefined || positionOrder === null) return API.newError_({ error: 'No s\'ha especificat l\'ordre de la posició.' });
	if (!value) return API.newError_({ error: 'No s\'ha especificat el valor.' });

	try {
		CACHE.updateMemberPositionInDB({ memberAlias, danceName, positionOrder, value });
		return API.newResult_({ result: { success: true } });
	} catch (error) {
		console.log('Error updating member position: ' + error.toString());
		return API.newError_({ error: error.toString() });
	}
}

function generateMemberId_() {
	// Generate ID based on timestamp and random component
	const timestamp = new Date().getTime();
	const random = Math.floor(Math.random() * 10000);
	return 'M' + timestamp + random;
}
