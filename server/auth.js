function loginWithEmailPassword_({ email, password }) {
  try {
    if (!email || !password) {
      return {
        success: false,
        error: "Cal proporcionar el correu electrònic i la contrasenya",
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Format de correu electrònic no vàlid",
      };
    }

    // Get stored credentials from Script Properties (admin-managed)
    const usersData = scriptProps.getProperty(USER_CREDS);
    const users = usersData ? JSON.parse(usersData) : {};

    // Check if user exists
    const storedUser = users[email.toLowerCase()];
    if (!storedUser) {
      return {
        success: false,
        error: "Correu electrònic o contrasenya incorrectes",
      };
    }

    // Verify password (using simple hash comparison)
    const hashedPassword = hashPassword_({ password });
    if (storedUser.passwordHash !== hashedPassword) {
      return {
        success: false,
        error: "Correu electrònic o contrasenya incorrectes",
      };
    }

    // Find matching member from MEMBERS
    const member = CACHE.getMembers().find(function (m) {
      return m.email && m.email.toLowerCase() === email.toLowerCase();
    });

    if (!member) {
      return {
        success: false,
        error: "L'usuari no és un membre registrat",
      };
    }

    // Generate session token
    const token = generateSessionToken_({ member });
    saveUserSession_({ token });

    const displayName = member.name;
    const roles = member.roles || [];
    return {
      success: true,
      result: {
        user: {
          email: email,
          displayName: displayName,
          avatar: generateAvatarUrl_(displayName, roles),
          memberType: member.type,
          roles: roles,
          relations: member.relations || [],
          relatedMembers: member.relatedMembers || [],
        },
        token: token,
      },
    };
  } catch (error) {
    console.log("Error in loginWithEmailPassword: " + error.toString());
    return {
      success: false,
      error: "Error en iniciar sessió. Si us plau, torna-ho a provar.",
    };
  }
}

function sendAccessLink_({ email }) {
  try {
    if (!email) {
      return {
        success: false,
        error: "Cal proporcionar el correu electrònic",
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Format de correu electrònic no vàlid",
      };
    }

    const accessUrl = `${WEBSITE_URL}#home`;
    const subject = `Accés a ${TITLE}`;
    const htmlBody = `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f7fafc; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Accés a ${TITLE}</h1>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
          <p style="font-size: 18px; margin-bottom: 20px;">Hola,</p>
          <p style="margin-bottom: 25px;">Fes clic al botó de sota per accedir a la plataforma de forma segura. Aquest enllaç és d'un sol ús i caducarà aviat.</p>
          <a href="${accessUrl}" style="display: block; width: fit-content; margin: 0 auto 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Accedir a la plataforma</a>
          <p style="font-size: 14px; color: #718096; margin-bottom: 20px;">Si no has sol·licitat aquest accés, pots ignorar aquest correu electrònic.</p>
          <p style="font-size: 14px; color: #718096;">IMPORTANT: No comparteixis aquest enllaç amb ningú.</p>
        </div>
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${TITLE}. Tots els drets reservats.</p>
        </div>
      </div>
    </div>`;

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
    });

    return {
      success: true,
      result: { message: "Enllaç d'accés enviat al correu correctament" },
    };
  } catch (error) {
    console.log("Error in sendAccessLink: " + error.toString());
    return {
      success: false,
      error: "Error en enviar l'accés. Si us plau, torna-ho a provar.",
    };
  }
}

function registerWithEmailPassword_({ email, password }) {
  try {
    if (!email || !password) {
      return {
        success: false,
        error: "Cal proporcionar el correu electrònic i la contrasenya",
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Format de correu electrònic no vàlid",
      };
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        success: false,
        error: "La contrasenya ha de tenir almenys 8 caràcters",
      };
    }

    // Get stored credentials
    const usersData = scriptProps.getProperty(USER_CREDS);
    const users = usersData ? JSON.parse(usersData) : {};

    // Check if user already exists
    if (users[email.toLowerCase()]) {
      return {
        success: false,
        error: "Ja existeix un compte amb aquest correu electrònic",
      };
    }

    // Hash password and store user
    const hashedPassword = hashPassword_({ password });
    users[email.toLowerCase()] = {
      passwordHash: hashedPassword,
    };

    scriptProps.setProperty(USER_CREDS, JSON.stringify(users));

    return {
      success: true,
      message: "Compte creat correctament. Si us plau, inicia sessió.",
    };
  } catch (error) {
    console.log("Error in registerWithEmailPassword: " + error.toString());
    return {
      success: false,
      error: "Error en el registre. Si us plau, torna-ho a provar.",
    };
  }
}

function changeUserPassword_({ email, newPassword }) {
  try {
    if (!email || !newPassword) {
      return {
        success: false,
        error: "Cal proporcionar el correu electrònic i la nova contrasenya",
      };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return {
        success: false,
        error: "La contrasenya ha de tenir almenys 8 caràcters",
      };
    }

    // Get stored credentials
    const usersData = scriptProps.getProperty(USER_CREDS);
    const users = usersData ? JSON.parse(usersData) : {};

    // Check if user exists
    const emailLower = email.toLowerCase();
    if (!users[emailLower]) {
      // Create new user entry if doesn't exist
      users[emailLower] = {};
    }

    // Hash and update password
    const hashedPassword = hashPassword_({ password: newPassword });
    users[emailLower].passwordHash = hashedPassword;

    scriptProps.setProperty(USER_CREDS, JSON.stringify(users));

    return {
      success: true,
      result: { message: "Contrasenya canviada correctament" },
    };
  } catch (error) {
    console.log("Error in changeUserPassword: " + error.toString());
    return {
      success: false,
      error: "Error en canviar la contrasenya. Si us plau, torna-ho a provar.",
    };
  }
}

function hashPassword_({ password }) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
  );
  return rawHash
    .map(function (byte) {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    })
    .join("");
}

function generateSessionToken_({ member }) {
  // Create JWT token
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: member.id,
    email: member.email,
    name: member.name,
    roles: member.roles || [],
    type: member.type,
    relations: member.relations || [],
    active: member.active,
    iat: now,
    exp: now + 7776000, // 3 months expiration
  };

  const base64Header = Utilities.base64EncodeWebSafe(
    JSON.stringify(header),
  ).replace(/=+$/, "");
  const base64Payload = Utilities.base64EncodeWebSafe(
    JSON.stringify(payload),
  ).replace(/=+$/, "");

  const signatureInput = base64Header + "." + base64Payload;
  const secret = scriptProps.getProperty("JWT_SECRET") || "default_secret";

  const signature = Utilities.computeHmacSha256Signature(
    signatureInput,
    secret,
  );
  const base64Signature = Utilities.base64EncodeWebSafe(signature).replace(
    /=+$/,
    "",
  );

  return base64Header + "." + base64Payload + "." + base64Signature;
}

function saveUserSession_({ token }) {
  try {
    // Store session
    const sessionsData = scriptProps.getProperty(USER_SESSION);
    const sessions = sessionsData ? JSON.parse(sessionsData) : [];

    sessions.push(token);
    scriptProps.setProperty(USER_SESSION, JSON.stringify(sessions));
  } catch (error) {
    console.log("Error in _saveUserSession: " + error.toString());
  }
}

function getUserFromSession_({ token }) {
  try {
    const sessionsData = scriptProps.getProperty(USER_SESSION);
    const sessions = sessionsData ? JSON.parse(sessionsData) : [];

    if (sessions.indexOf(token) !== -1) {
      // Decode the JWT token to extract user data
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Utilities.newBlob(
            Utilities.base64DecodeWebSafe(parts[1]),
          ).getDataAsString(),
        );
        return {
          email: payload.email,
          name: payload.name,
          roles: payload.roles,
          memberId: payload.sub,
          memberType: payload.type,
          relations: payload.relations,
          active: payload.active,
        };
      }
    }

    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

function clearSession_({ token }) {
  try {
    if (token) {
      // Get current sessions
      const sessionsData = scriptProps.getProperty(USER_SESSION);
      const sessions = sessionsData ? JSON.parse(sessionsData) : [];

      // Remove the session with the given token
      const sessionIndex = sessions.indexOf(token);
      if (sessionIndex !== -1) {
        sessions.splice(sessionIndex, 1);
        scriptProps.setProperty(USER_SESSION, JSON.stringify(sessions));
      }
    }
  } catch (error) {
    console.log("Error in clearSession: " + error.toString());
  }
}

function logoutUser_({ token }) {
  try {
    clearSession_({ token });
    return {
      success: true,
      result: { message: "Sessió tancada correctament" },
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

function getCurrentUser_({ token }) {
  try {
    // First check for email/password session
    const user = getUserFromSession_({ token });
    if (user) {
      const userProfile = getUserProfile_({ email: user.email });
      const displayName = userProfile.displayName || user.email.split("@")[0];
      const roles = userProfile.roles || [];
      return {
        success: true,
        result: {
          user: {
            email: user.email,
            displayName: displayName,
            avatar: generateAvatarUrl_(displayName, roles),
            memberType: userProfile.memberType || "",
            roles: roles,
            relations: userProfile.relations || [],
            relatedMembers: userProfile.relatedMembers || [],
          },
        },
      };
    }

    // No valid session
    return {
      success: false,
      error: "Usuari no autenticat",
    };
  } catch (error) {
    console.log("Error getting current user: " + error.toString());
    return {
      success: false,
      error: error.toString(),
    };
  }
}

function getUserProfile_({ email, forceRefresh } = {}) {
  const cacheKey = "userProfile_" + email;

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      // Check if cached profile has relatedMembers (for migration)
      const parsedCache = JSON.parse(cached);
      if (parsedCache.relatedMembers !== undefined) {
        return parsedCache;
      }
      // Cache is outdated, clear it and continue to rebuild
      cache.remove(cacheKey);
    }
  } else {
    cache.remove(cacheKey);
  }

  // Find matching member from MEMBERS by email
  const member = CACHE.getMembers().find(function (m) {
    return m.email && m.email.toLowerCase() === email.toLowerCase();
  });

  if (!member) {
    return {
      success: false,
      error: "Membre no trobat",
    };
  }

  // Create a map of ID to member for resolving relations
  const memberMap = {};
  CACHE.getMembers().forEach(function (m) {
    memberMap[m.id] = m;
  });

  // Resolve relation IDs to names
  let resolvedRelations = [];
  let relatedMembers = [];
  if (member.relations && Array.isArray(member.relations)) {
    member.relations.forEach(function (relationId) {
      let relatedMember = memberMap[relationId];
      if (relatedMember) {
        resolvedRelations.push(relatedMember.name);
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
  }

  const profile = {
    success: true,
    email: member.email,
    displayName: member.name || email.split("@")[0],
    memberId: member.id,
    memberType: member.type || "",
    roles: member.roles || [],
    relations: resolvedRelations,
    relatedMembers: relatedMembers,
  };

  // Cache for 6 hours
  cache.put(cacheKey, JSON.stringify(profile), 21600);
  return profile;
}

function saveUserProfile_(email, profile) {
  const cacheKey = "userProfile_" + email;
  const profileStr = JSON.stringify(profile);

  // Save to Properties (persistent)
  const props = PropertiesService.getUserProperties();
  props.setProperty(cacheKey, profileStr);

  // Update cache
  cache.put(cacheKey, profileStr, 21600);

  return profile;
}

function isAdminUser_(user) {
  const profile = getUserProfile_({ email: user.email });
  return profile.roles && profile.roles.includes("ADMIN");
}

function generateAvatarUrl_(name, roles) {
  // Use UI Avatars as a fallback (no external dependencies needed)
  const encodedName = encodeURIComponent(name || "User");
  const isAdmin = Array.isArray(roles) && roles.includes("ADMIN");
  const background = isAdmin ? "000000" : "667eea";
  return `https://ui-avatars.com/api/?name=${encodedName}&background=${background}&color=fff&size=128`;
}

function sendRegistrationRequest_({ name, email }) {
  try {
    if (!name || !email) {
      return {
        success: false,
        error: "Cal proporcionar el nom i el correu electrònic",
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Format de correu electrònic no vàlid",
      };
    }

    // Get the owner email (the user who deployed the script)
    const ownerEmail = Session.getEffectiveUser().getEmail();

    // Send email to the owner
    const subject = "Nova sol·licitud de registre - " + name;
    const formattedDate = new Date().toLocaleString("ca-ES");
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Nova Sol·licitud de Registre</h1>
      </div>
      <div style="padding: 20px;">
        <p style="font-size: 16px;">S'ha rebut una nova sol·licitud de registre amb les següents dades:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tbody>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 12px 0; font-weight: bold; width: 150px;">Nom en la colla:</td>
              <td style="padding: 12px 0;">${name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 12px 0; font-weight: bold;">Email:</td>
              <td style="padding: 12px 0;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: bold;">Data:</td>
              <td style="padding: 12px 0;">${formattedDate}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="background-color: #f7f7f7; color: #777; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">Aquest és un correu electrònic automàtic. Si us plau, no responguis.</p>
      </div>
    </div>
    `;

    MailApp.sendEmail({
      to: ownerEmail,
      subject: subject,
      htmlBody: htmlBody,
    });

    return {
      success: true,
      result: { message: "Sol·licitud de registre enviada correctament" },
    };
  } catch (error) {
    console.log("Error in sendRegistrationRequest: " + error.toString());
    return {
      success: false,
      error: "Error en enviar la sol·licitud. Si us plau, torna-ho a provar.",
    };
  }
}

