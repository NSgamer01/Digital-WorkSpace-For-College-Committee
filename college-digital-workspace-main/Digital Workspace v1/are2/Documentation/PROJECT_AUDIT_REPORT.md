# 🔍 PROJECT AUDIT REPORT — Digital Workspace

> **Audit Date:** March 10, 2026  
> **Scope:** Duplicate files, unused code, orphaned components, security leaks, conflicting implementations, sensitive data in documentation files

---

## 🚨 CRITICAL: SENSITIVE DATA IN DOCUMENTATION FILES

### Verdict: ✅ CLEAN — No credentials leaked

Both `PROJECT_COMPARISON_REPORT.md` and `DOCUMENTATION_WALKTHROUGH.md` were scanned for:

| Pattern Searched | Result |
|-----------------|--------|
| API keys / `apiKey` | ✅ Not found |
| Passwords / bcrypt hashes (`$2a$`, `$2b$`) | ✅ Not found |
| Secrets / JWT secrets | ✅ Not found |
| Service account JSON / private keys | ✅ Not found |
| `admin@workspace.com` | ✅ Not found |
| `client_email` / `project_id=` | ✅ Not found |
| Supabase keys | ✅ Not found |
| Google Client IDs | ✅ Not found |
| Firebase config values | ✅ Not found |

**All references in docs are generic** (e.g., "password hashing", "JWT tokens") — no actual credential values.

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Service Account Private Keys NOT Gitignored

**Files at risk:**
- `server/config/firebase-service-account.json` — Contains **full Firebase private key**
- `server/config/google-calendar-credentials.json` — Contains **Google Calendar private key**
- `workspace-backend/config/firebase-service-account.json` — **Duplicate** of service account

**Problem:** None of the `.gitignore` files exclude `*.json` credential files from `config/` directories. If this repo is pushed to GitHub, **private keys are exposed**.

> [!CAUTION]
> **Fix:** Add to **all three** `.gitignore` files:
> ```
> config/firebase-service-account.json
> config/google-calendar-credentials.json
> ```
> If already pushed to git, **rotate these keys immediately** in Firebase Console and Google Cloud Console.

### 2. `workspace-backend/.gitignore` Missing `.env`

The `workspace-backend/.gitignore` file does **NOT** ignore `.env`:
```
# node_modules/     ← COMMENTED OUT (!)
database.sqlite
uploads/
```

**Problems:**
- `.env` with DB password `shre1234` would be committed
- `node_modules/` line is **commented out** — would commit all dependencies
- No coverage for credential JSON files

> [!CAUTION]
> **Fix:** Rewrite `workspace-backend/.gitignore` to:
> ```
> node_modules/
> .env
> uploads/
> database.sqlite
> config/firebase-service-account.json
> ```

### 3. Hardcoded Default Admin Password in Schema

`server/database/schema.sql` line 556 contains a bcrypt hash of the default admin password (`admin123`):
```sql
'$2a$10$rQKl8QqK12/4EXsNuFGNSuLBGwHqMPDQ3FLoEqwSrRXvMxqZy1Yb6'
```

> [!WARNING]
> **Risk:** Low (it's a hash, not plaintext), but the comment on line 552 says `password: admin123`. Change this password after initial setup.

---

## 🟡 DUPLICATE & CONFLICTING FILES

### 4. Duplicate Firebase Service Account

| File | Size |
|------|------|
| `server/config/firebase-service-account.json` | 2.4 KB |
| `workspace-backend/config/firebase-service-account.json` | (duplicate) |

**Fix:** Keep one source of truth. Both backends can reference the same file via relative path or environment variable.

### 5. Dual Backend Servers — Overlapping Routes

| Route Area | `server/routes/` | `workspace-backend/routes/` | Conflict? |
|-----------|-------------------|---------------------------|-----------|
| Auth | `auth.js` (3.9 KB) | `auth.js` (9.6 KB) | ⚠️ Different implementations |
| Tasks | `tasks.js` (33.6 KB) | `tasks.js` (14.1 KB) | ⚠️ Server version is 2.4x larger |
| Files | `files.js` (28.6 KB) | `files.js` (17.3 KB) | ⚠️ Server version has more features |
| Chat | `chat.js` (17 KB) | `chat.js` (9.5 KB) | ⚠️ Different implementations |
| Meetings | `meetings.js` (11.2 KB) | `meetings.js` (11 KB) | ⚠️ Similar size |
| Committees | `committees.js` (24.9 KB) | `committees.js` (19.5 KB) | ⚠️ Both have implementations |
| Announcements | `announcements.js` (9.9 KB) | `announcements.js` (7.9 KB) | ⚠️ Both have implementations |
| Activity | `activity.js` (3 KB) | `activity.js` (2 KB) | ⚠️ Both exist |
| **Server-Only** | channels, folders, admin, analytics, notifications, settings, taskEmail, gcalendar | *(missing)* | — |
| **WB-Only** | *(missing)* | `email.js` (9.5 KB) | — |

> [!IMPORTANT]
> **Two full backends with overlapping routes.** The frontend `VITE_API_URL` points to `localhost:3001` (workspace-backend). Clarify which is the active backend and consider consolidating.

### 6. Duplicate Meeting Modals

| Component | Size | Used By |
|-----------|------|---------|
| `MeetingModal.jsx` | 33.5 KB | ✅ `Calendar.jsx`, `DashboardMeetings.jsx` |
| `ScheduleMeetingModal.jsx` | 8.9 KB | ❌ **Only imports itself** (orphaned) |

**Fix:** Delete `ScheduleMeetingModal.jsx` — `MeetingModal.jsx` is the active one.

### 7. Legacy + Current Auth Pages

| Page | Size | Route |
|------|------|-------|
| `Auth.jsx` | 18.2 KB | `/auth` — Legacy combined login+signup modal |
| `Login.jsx` | 11.2 KB | `/login` — Current login page |
| `Signup.jsx` | 10.8 KB | `/signup` — Current signup page |

**Fix:** Consider removing `Auth.jsx` if `/auth` route is no longer needed. App.jsx routes it as a `PublicOnlyRoute` marked "Legacy."

---

## 🟠 ORPHANED / UNUSED FILES

### 8. Orphaned Frontend Components

| File | Size | Imported By | Verdict |
|------|------|------------|---------|
| `StatusDropdown.jsx` | 6 KB | ❌ Only itself | 🗑️ **Delete** |
| `ScheduleMeetingModal.jsx` | 8.9 KB | ❌ Only itself | 🗑️ **Delete** |
| `UserStatus.jsx` | 2.5 KB | ❌ Only itself | 🗑️ **Delete** |

### 9. Debug / Test Scripts Left in Server

| File | Size | Purpose | Verdict |
|------|------|---------|---------|
| `server/check_db.js` | 2 KB | DB connectivity test | 🗑️ Move to `scripts/` or delete |
| `server/check_flow.js` | 2.9 KB | Flow debugging | 🗑️ Delete |
| `server/check_storage.js` | 1.2 KB | Storage debug | 🗑️ Delete |
| `server/test_upload.js` | 1.9 KB | Upload test | 🗑️ Delete |
| `server/migrate_missing.js` | 1.5 KB | One-time migration | 🗑️ Move to `scripts/` or delete |

### 10. One-time Migration Scripts in `server/scripts/`

| File | Size | Purpose | Verdict |
|------|------|---------|---------|
| `addFirebaseUid.js` | 1 KB | One-time UID migration | ⚠️ Keep but mark as "ran" |
| `addTaskComments.js` | 2.5 KB | One-time schema update | ⚠️ Keep but mark |
| `addUserToCommittee.js` | 3 KB | One-time user setup | ⚠️ Keep but mark |
| `fixPasswordHash.js` | 0.8 KB | One-time password fix | ⚠️ Keep but mark |
| `fixTaskStatus.js` | 1.4 KB | One-time status fix | ⚠️ Keep but mark |
| `fixUsers.js` | 0.9 KB | One-time user fix | ⚠️ Keep but mark |
| `migrate_chat.sql` | 2.3 KB | One-time chat migration | ⚠️ Keep for reference |
| `migrate_remove_user_fk.js` | 3.4 KB | One-time FK removal | ⚠️ Keep but mark |

### 11. Frontend Migration Script in Wrong Location

`src/utils/migrateRoles.js` (2 KB) — A Firestore role migration script sitting in the frontend `utils/` folder. This is a one-time admin script, not a runtime utility.

**Fix:** Move to `server/scripts/` or delete if already ran.

### 12. `FirebaseDebug.jsx` in Production Render

`src/components/FirebaseDebug.jsx` (12.7 KB) is **imported and rendered** in `App.jsx`:
```jsx
import FirebaseDebug from './components/FirebaseDebug';
// ...
<FirebaseDebug />  // Renders debug panel in production!
```

**Fix:** Remove from `App.jsx` or wrap in `process.env.NODE_ENV === 'development'` check.

---

## 🔵 STRUCTURAL ISSUES

### 13. Split Context Folders

| Folder | Contents |
|--------|----------|
| `src/context/` | Only `AuthContext.jsx` (10.8 KB) |
| `src/contexts/` | `CommitteeContext.jsx`, `ThemeContext.jsx`, `SettingsContext.jsx`, `NotificationContext.jsx` |

**Fix:** Move `AuthContext.jsx` into `src/contexts/` and update the import in `App.jsx`.

### 14. Unused npm Dependency: `gapi-script`

`package.json` includes `"gapi-script": "^1.2.0"` but **no file imports it**. The project now uses `@react-oauth/google` instead.

**Fix:** Run `npm uninstall gapi-script`.

### 15. Supabase — Minimal Usage

`@supabase/supabase-js` (in `package.json`) is only used in **one file**: `ChatArea.jsx` for file upload storage via Supabase Storage. The rest of the app uses PostgreSQL + local disk.

**Verdict:** Intentional (Supabase storage for chat attachments). Not an issue, but worth knowing.

### 16. `workspace Drive/` Folder

An empty `workspace Drive/Uploads/` directory exists at project root. This is the file upload destination for the `server/` backend (`UPLOAD_BASE_DIR=../workspace Drive/Uploads`).

**Verdict:** Intentional, not orphaned. Ensure it's in `.gitignore` if you don't want uploaded files in the repo.

---

## ✅ VERIFIED — NOT ISSUES

| Item | Reason |
|------|--------|
| `DashboardPanel.jsx` | Used by `Dashboard.jsx` ✅ |
| `QuickActionCard.jsx` | Used by `Dashboard.jsx` ✅ |
| `StatCard.jsx` | Used by `Dashboard.jsx` ✅ |
| `TaskColumn.jsx` | Used by `Tasks.jsx` ✅ |
| `RecentActivity.jsx` | Used by `Dashboard.jsx` ✅ |
| `GoogleEventDetail.jsx` | Used by `Calendar.jsx` ✅ |
| `ThemeToggle.jsx` + `.css` | Used by `Topbar.jsx` ✅ |
| `ThemePreview.jsx` | Used by theme settings ✅ |
| `App.css` | Global styles ✅ |
| `Calendar.css` | Calendar-specific styles ✅ |
| `index.css` | Main stylesheet (41 KB) ✅ |

---

## 📋 ACTION PLAN — PRIORITY ORDER

### 🔴 Do Immediately (Security)

| # | Action | Files Affected |
|---|--------|---------------|
| 1 | Add credential files to ALL `.gitignore` files | `.gitignore`, `server/.gitignore`, `workspace-backend/.gitignore` |
| 2 | Fix `workspace-backend/.gitignore` (uncomment node_modules, add .env) | `workspace-backend/.gitignore` |
| 3 | If repo was pushed to GitHub: **rotate all keys** | Firebase Console, Google Cloud Console |

### 🟡 Do Soon (Cleanup)

| # | Action | Files Affected |
|---|--------|---------------|
| 4 | Delete orphaned components | `StatusDropdown.jsx`, `ScheduleMeetingModal.jsx`, `UserStatus.jsx` |
| 5 | Remove/guard `FirebaseDebug` from production | `App.jsx`, optionally `FirebaseDebug.jsx` |
| 6 | Delete debug scripts from server root | `check_db.js`, `check_flow.js`, `check_storage.js`, `test_upload.js` |
| 7 | Move `migrateRoles.js` out of `src/utils/` | `src/utils/migrateRoles.js` → `server/scripts/` or delete |
| 8 | Uninstall `gapi-script` | Run `npm uninstall gapi-script` |

### 🟢 Do When Convenient (Organization)

| # | Action | Files Affected |
|---|--------|---------------|
| 9 | Merge `src/context/` into `src/contexts/` | Move `AuthContext.jsx`, update import in `App.jsx` |
| 10 | Consider removing legacy `Auth.jsx` | `src/pages/Auth.jsx`, route in `App.jsx` |
| 11 | Consolidate or document dual backend purpose | `server/` vs `workspace-backend/` |
| 12 | Move root `migrate_missing.js` into `scripts/` | `server/migrate_missing.js` |

---

*End of Audit Report*
