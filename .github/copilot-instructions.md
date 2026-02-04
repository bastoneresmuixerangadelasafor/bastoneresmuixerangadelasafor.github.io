# Copilot Instructions for Bastoneres

## Project Overview

**Bastoneres** is a Progressive Web App (PWA) for managing dance performances and training sessions. It's built with Google Apps Script (GAS) backend, vanilla JavaScript frontend, and Nunjucks templating.

### Architecture

- **Server**: Google Apps Script (GAS) - handles authentication, data persistence, and API endpoints
- **Frontend**: Single Page App (SPA) in vanilla JS with client-side routing
- **Data**: Google Sheets as database (configurable via spreadsheet IDs)
- **Build**: Eleventy (11ty) generates HTML from Nunjucks templates
- **Models**: TypeScript interfaces that compile to JS in `model/generated/`

### Key Data Flows

1. **Server Layer** (`server/*.js`): GAS functions that read/write Google Sheets
2. **Cache Layer** (`CACHE` object): Dual-tier caching using CacheService (temp) + PropertiesService (persistent)
3. **API Layer** (`server/api.js`): REST-like interface with token validation
4. **Frontend** (`docs/scripts/main.js`): SPA routing, state management via `AppState` global
5. **Templates** (`templates/_includes/*.njk`): Nunjucks markup + inline JavaScript for events management

## Critical Patterns

### Backend: Database Layer

- **Location**: `server/db.js` - `CACHE` class manages all data retrieval
- **Pattern**: Cache-first with fallback to Sheets; always update cache when data changes
- **Key Methods**:
  - `getMembers()` → Returns cached array or calls `retrieveMembersFromDB()`
  - `retrieveTrainingsFromDB()` → Extracts notes using `sheet.getDataRange().getNotes()` for multiline descriptions
  - Data format: Training object with `{ attendees: [], description: string }`

**Example**: When loading trainings, always extract both attendees AND header notes:

```javascript
const notes = sheet.getDataRange().getNotes();
trainingsByDate[date] = {
  attendees: [],
  description: headerNotes[index] || "",
};
```

### Backend: Event/Training Business Logic

- **Location**: `server/event.js` - Contains all event/training orchestration
- **Pattern**: Validate input → Transform → Write to Sheets → Update cache
- **Note**: Training data structure changed to include `description` field; all consuming code must handle both `training.attendees` and `training.description`

### Frontend: State Management

- **Global State**: `AppState` object tracks user, auth status, current view, and IDs to load
- **View Loading**: `navigateTo()` handles routing, triggers `loadViewData()` for that view type
- **Pattern**: Store ID in `AppState.trainingIdToLoad`, then call `loadTrainingData(id)` when view activates
- **Edit Mode Protection**: `isInEditMode()` checks for unsaved changes before navigation

### Frontend: Role-Based Access Control

- **User Object**: Contains `roles` array (e.g., `["ADMIN"]`)
- **Pattern**: Always check with `AppState.currentUser.roles.includes("ADMIN")` before showing edit UI
- **Example Training Form**:
  - Admin sees: Input fields + save button
  - Non-admin sees: Read-only labels with text content
- **Function**: `applyTrainingEditableState()` toggles visibility based on admin role

### Frontend: Dance Detection

- **Function**: `detectAndDisplayDancesFromDescription()` searches `dancesData` array against description text
- **Pattern**: Case-insensitive substring match; displays results as chips in UI
- **Event Listener**: Attached to training description input in `initializeTrainingFormListeners()`
- **CSS**: `.training-field-label` uses `white-space: pre-wrap` to preserve line breaks in read-only mode

### Frontend: Training Form Modes

- **Edit Mode**: Page title "Assaig", description loaded, admin sees input fields
- **Create Mode**: Page title "Nou assaig", empty form, description field ready for input
- **Title Update**: `updateTrainingPageTitle(isEditing)` switches text based on mode
- **Both Modes**: Initialize listeners via `initializeTrainingFormListeners()` to detect dances as user types

## Build & Deployment

### Local Development

```bash
npm run setup_dev      # Configure for development
npm run build_dev      # Generate server/html from templates
npm run clasp_push     # Push to GAS development version
```

### Production Deployment

```bash
npm run setup_prod     # Configure for production (different env vars)
npm run build_prod     # Generate docs (public website)
npm run clasp_push_prod # Deploy with production GAS version
```

### TypeScript Models

```bash
npm run ts_model       # Compile model/*.ts to model/generated/*.js
```

Always run this after modifying TypeScript interface files.

## File Organization

| Path                        | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `model/*.ts`                | TypeScript interfaces defining domain objects (Dance, Event, Member, etc.) |
| `model/generated/*.js`      | Compiled JS models—regenerate with `npm run ts_model`                      |
| `server/*.js`               | GAS backend: API handlers, DB layer, auth, business logic                  |
| `docs/scripts/*.js`         | Frontend SPA: routing, state, UI handlers, API client calls                |
| `templates/_includes/*.njk` | Nunjucks template fragments—rendered into HTML by Eleventy                 |
| `data/generate_dances.js`   | Generates dance data JSON from TypeScript models                           |

## Common Tasks

### Add New Field to Training

1. Update schema in `server/db.js` retrieval function
2. Update `server/event.js` if saving logic needed
3. Update frontend in `docs/scripts/main.js` (`loadTrainingData()`, `applyTrainingEditableState()`)
4. Update HTML template in `templates/_includes/main.njk` with input + label elements
5. Add CSS styles for `.training-field` input/label pair
6. If needed: add event listener in `initializeTrainingFormListeners()`

### Add New Admin-Only Feature

1. Check user role: `AppState.currentUser.roles.includes("ADMIN")`
2. Hide/show UI elements by toggling `display: none` on `.admin-only` or similar class
3. Add event listeners only for admin users
4. Verify `applyTrainingEditableState()` or equivalent disables non-admin access

### Debug Cache Issues

- Check `CACHE` class in `server/db.js`—verify cache key matches between get/set
- Use PropertiesService for persistent cache; CacheService for session-only
- After schema changes, invalidate cache manually or restart GAS service

## Testing Workflow

- **Dev Version**: Push changes with `npm run deploy_dev` → access via test.html
- **Prod Version**: Run full pipeline with `npm run deploy_prod` → live website
- **Template Changes**: Rebuild with `npm run build_dev` or `npm run build_prod` before deploying

## Key Gotchas

1. **Training Description Persistence**: Always include header notes extraction; `description` field is critical for dance detection
2. **Cache Invalidation**: Update cache immediately after data writes; stale cache breaks role-based features
3. **Role Checking**: Non-admin users must have UI hidden, not just disabled—prevents XSS
4. **Multiline Text**: Use `white-space: pre-wrap` for read-only labels to preserve line breaks
5. **TypeScript Models**: Changes to `model/*.ts` require `npm run ts_model` before build; forgotten builds cause runtime errors
6. **Eleventy Build**: Template changes go unnoticed until rebuild; remember to run `npm run build_dev/prod`
7. **Google Sheets API**: `getDataRange().getNotes()` is crucial for extracting header row metadata (e.g., training notes)

## DISAPPROVED PATTERNS

**🚫 NEVER modify HTML files directly!**

All HTML files (`docs/index.html`, `server/html/test.html`) are generated from Nunjucks templates. Make changes to the corresponding `.njk` file in `templates/_includes/` instead, then rebuild:

- `npm run build_dev` for development
- `npm run build_prod` for production

This ensures consistency between dev and prod versions and prevents your changes from being overwritten during the next build.
