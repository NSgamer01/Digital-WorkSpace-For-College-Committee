# 📊 DIGITAL WORKSPACE — PROJECT vs DOCUMENTATION COMPARISON REPORT

> **Generated:** March 10, 2026  
> **Purpose:** Compare the *actual codebase* against the documentation walkthrough template to identify what's accurate, what needs correction, and what's missing.

---

## 🔑 EXECUTIVE SUMMARY

The Claude-generated documentation walkthrough provides a solid structure but contains **several inaccuracies** when compared to the actual codebase. The most critical differences are in **version numbers**, **architecture details**, **storage limits**, and **some feature descriptions**. This report flags every discrepancy so your final Black Book documentation is technically accurate.

| Category | Accuracy | Notes |
|----------|----------|-------|
| Project Structure | ⚠️ Partial | Two backend servers exist, template assumes one |
| Tech Versions | ❌ Wrong | Almost all version numbers are outdated/incorrect |
| Features List | ✅ Mostly Right | Core features are correctly identified |
| Database Schema | ⚠️ Partial | Template uses Firestore-only; actual uses PostgreSQL + Firestore hybrid |
| Security Details | ✅ Mostly Right | Firestore rules and middleware match |
| Code Snippets | ❌ Wrong | Template code uses Firestore patterns; actual code uses PostgreSQL backend API |
| Storage Limit | ❌ Wrong | Template says 10 GB; actual schema says 5 GB |
| User Roles | ⚠️ Partial | Template says 4 roles; actual has 6 roles |

---

## 📦 SECTION 1: TECHNOLOGY STACK COMPARISON

### 1.1 Frontend Technologies

| Technology | Doc Template Says | Actual Codebase | Match? |
|------------|------------------|-----------------|--------|
| React | 18.2.0 | **19.2.0** | ❌ |
| Tailwind CSS | 3.3.0 | **3.4.19** | ❌ |
| React Router DOM | 6.x | **7.13.0** | ❌ |
| Lucide React | *(not versioned)* | **0.575.0** | ✅ |
| Build Tool | *(not mentioned)* | **Vite 7.3.1** | ❌ Missing |
| Animation Library | *(not mentioned)* | **framer-motion 12.34.3** | ❌ Missing |
| Calendar UI | *(not mentioned)* | **react-big-calendar 1.19.4** | ❌ Missing |
| Emoji Picker | *(not mentioned)* | **emoji-picker-react 4.18.0** | ❌ Missing |
| Toast Notifications | *(not mentioned)* | **react-hot-toast 2.6.0** | ❌ Missing |
| Google OAuth | *(not mentioned)* | **@react-oauth/google 0.13.4** | ❌ Missing |
| HTTP Client | *(not mentioned)* | **axios 1.13.5** | ❌ Missing |
| Date Library | *(not mentioned)* | **moment 2.30.1** | ❌ Missing |
| Supabase Client | *(not mentioned)* | **@supabase/supabase-js 2.98.0** | ❌ Missing |

### 1.2 Backend Technologies

| Technology | Doc Template Says | Actual Codebase | Match? |
|------------|------------------|-----------------|--------|
| Node.js | 18.x | *(check runtime)* | ⚠️ Verify |
| Express.js | 4.18.x | **4.21.0** | ❌ |
| PostgreSQL | 15 | **pg driver 8.13.0** | ⚠️ Version depends on installed DB |
| Firebase Admin | *(mentioned)* | **13.7.0** (server) / **13.0.0** (workspace-backend) | ✅ |
| Firebase Client SDK | *(not versioned)* | **12.9.0** | ❌ Missing |
| Google APIs | *(mentioned)* | **googleapis 171.4.0** | ✅ |
| Nodemailer | *(mentioned)* | **8.0.1** (workspace-backend) | ✅ |
| Helmet (Security) | *(not mentioned)* | **7.1.0** (server) | ❌ Missing |
| JWT | *(mentioned)* | **jsonwebtoken 9.0.2** | ✅ |
| Rate Limiting | *(not mentioned)* | **express-rate-limit 7.4.0** | ❌ Missing |
| Multer (Uploads) | *(not mentioned)* | **1.4.5-lts.1** | ❌ Missing |
| bcryptjs | *(not mentioned)* | **2.4.3** | ❌ Missing |
| UUID | *(not mentioned)* | **10.0.0** | ❌ Missing |

### 1.3 Development Tools

| Tool | Doc Template Says | Actual Codebase | Match? |
|------|------------------|-----------------|--------|
| IDE | VS Code | *(assumed)* | ✅ |
| Version Control | Git/GitHub | *(assumed)* | ✅ |
| Build Tool | *(not mentioned)* | **Vite 7.3.1** | ❌ Missing |
| Linter | *(not mentioned)* | **ESLint 9.39.1** | ❌ Missing |
| Dev Server | *(not mentioned)* | **nodemon 3.1.4** | ❌ Missing |
| CSS Processing | *(not mentioned)* | **PostCSS 8.5.6 + Autoprefixer 10.4.24** | ❌ Missing |

---

## 🏗️ SECTION 2: ARCHITECTURE COMPARISON

### 2.1 Project Structure

**Doc Template Assumes:**
```
workspace/
├── src/             # Frontend
workspace-backend/
├── routes/          # Backend
```

**Actual Project Has TWO Backend Servers:**
```
are2/
├── src/                    # Frontend (React + Vite)
├── server/                 # Backend Server 1 (Primary - Express + PostgreSQL)
│   ├── routes/ (16 files)  # Full API: auth, tasks, files, folders, channels, chat, meetings, etc.
│   ├── middleware/ (6)     # auth, admin, committee, checkStorage, errorHandler, upload
│   ├── database/           # schema.sql (573 lines, 15 tables)
│   ├── config/             # Firebase Admin, Google Calendar credentials, DB manager
│   └── scripts/ (12)      # Migration & init scripts
├── workspace-backend/      # Backend Server 2 (Multi-committee - Express + PostgreSQL)
│   ├── routes/ (9 files)   # auth, tasks, files, meetings, chat, committees, announcements, email, activity
│   ├── middleware/ (2)     # Auth middleware
│   └── database/           # Committee-specific schemas
└── Documentation/          # Word file + reference PDF
```

> **⚠️ IMPORTANT:** The documentation should clarify the dual-backend architecture. `server/` is the primary backend with full feature set, `workspace-backend/` handles multi-committee operations.

### 2.2 Frontend Architecture

**Doc Template Says:** `components/`, `pages/`, `contexts/`, `utils/`, `hooks/`, `firebase/`

**Actual Structure:**
```
src/
├── pages/ (13 files)       # Auth, Login, Signup, Dashboard, Tasks, TaskDetail, Calendar,
│                           #   Messages, Drive, Members, Settings, AdminPanel
├── components/ (32 files + 4 subdirs)
│   ├── settings/ (8)       # Profile, Account, Appearance, Accessibility, Calendar,
│   │                       #   Notification, Privacy, Storage
│   ├── taskDetail/ (11)    # BlockEditor, CommentsSection, FormattingToolbar,
│   │                       #   SlashCommandMenu, various property editors
│   ├── admin/ (1)
│   └── announcement/ (2)
├── Chat/ (14 files)        # ← NOTE: Separate top-level Chat module, NOT under components/
│   ├── components/ (10)    # ChatArea, ChatBubble, ChatInput, ChatHeader, ChannelSidebar,
│   │                       #   DirectMessages, GeneralChatChannel, AnnouncementChannel, etc.
│   ├── hooks/ (3)
│   └── data/ (1)
├── contexts/ (4)           # CommitteeContext, ThemeContext, SettingsContext, NotificationContext
├── context/ (1)            # AuthContext (separate folder!)
├── hooks/ (10)             # useCalendar, useChannels, useDrive, useMeetings, useMessages,
│                           #   usePresence, useTyping, useAnnouncements, useBrowserNotifications,
│                           #   useUserPresence
├── services/ (10)          # authService, chatService, googleCalendar (28KB!), localDriveAPI,
│                           #   meetingService, taskService, presenceService, announcementService,
│                           #   activityService, supabaseClient
├── firebase/ (1)           # config.js
├── styles/ (1)             # themes.js (4 themes + auto)
├── config/ (1)
├── constants/ (1)
├── routes/ (1)
└── utils/ (3)              # api.js + others
```

> **⚠️ KEY DIFFERENCE:** Template lists a simple structure. Actual project has a much richer organization with separate `Chat/` module, `services/` layer, `taskDetail/` rich editor components, and split context folders (`contexts/` + `context/`).

---

## 👥 SECTION 3: USER ROLES COMPARISON

| Doc Template Says | Actual Schema (PostgreSQL) |
|------------------|---------------------------|
| Admin | ✅ `admin` |
| Faculty | ❌ Called `teacher` in schema |
| Head | ✅ `head` |
| Member | ✅ `member` |
| *(not mentioned)* | ❌ `student` (default role) |
| *(not mentioned)* | ❌ `volunteer` |

**Actual Role CHECK constraint:**
```sql
role VARCHAR(20) DEFAULT 'student'
    CHECK (role IN ('student', 'teacher', 'admin', 'head', 'volunteer', 'member'))
```

> **⚠️ FIX NEEDED:** Documentation uses "Faculty" but code uses "teacher". Default role is "student" not "member". There are 6 roles, not 4.

---

## 💾 SECTION 4: DATABASE COMPARISON

### 4.1 Storage Limit

| | Doc Template | Actual Schema |
|-|-------------|---------------|
| Storage Limit | **10 GB** per user | **5 GB** per user (`5368709120` bytes) |

> **❌ CRITICAL:** Template consistently says 10 GB. Actual code sets `storage_limit BIGINT DEFAULT 5368709120` (= 5 GB).

### 4.2 Database Tables

The template mentions simple Firestore collections. The actual project uses **15 PostgreSQL tables** + Firestore for presence/real-time only:

| # | Table | In Template? | Notes |
|---|-------|-------------|-------|
| 1 | `users` | ✅ Mentioned | Template says Firestore; actual is PostgreSQL |
| 2 | `folders` | ❌ Missing | With color, icon, starring, trash, path hierarchy |
| 3 | `folder_shares` | ❌ Missing | Permission-based folder sharing |
| 4 | `files` | ✅ Partial | Template is Firestore; actual PostgreSQL with versioning, checksums, share tokens |
| 5 | `file_shares` | ❌ Missing | Share links with passwords, expiry, access counts |
| 6 | `file_versions` | ❌ Missing | Full file version history |
| 7 | `file_comments` | ❌ Missing | Threaded comments on files |
| 8 | `tags` + `file_tags` | ❌ Missing | Tag system for file organization |
| 9 | `activity_log` | ❌ Missing | Full audit trail with IP, user-agent |
| 10 | `storage_analytics` | ❌ Missing | Per-user storage breakdown by type |
| 11 | `tasks` + `task_attachments` | ✅ Partial | Template uses `visibleTo` array (Firestore); actual uses `assigned_to` + `created_by` references |
| 12 | `task_comments` | ❌ Missing | Comments with reactions on tasks |
| 13 | `chat_rooms` + `chat_participants` + `messages` + `message_reads` | ✅ Partial | Template uses Firestore chats; actual is full PostgreSQL chat system |
| 14 | `meetings` + `meeting_participants` | ✅ Partial | More fields in actual (recurring, all-day, minutes, attachments) |
| 15 | `announcements` | ✅ Partial | More fields: priority, category, pinning, target_roles, expiry |
| 16 | `committees` + `committee_members` | ✅ Mentioned | Actual has proper relational structure |
| 17 | `notifications` | ✅ Partial | More types: task_assigned, meeting_invite, mention, etc. |

**Also includes:**
- 4 database **Views**: `file_details`, `folder_details`, `user_storage`, `recent_activity`
- **Triggers**: auto `updated_at`, auto storage calculation on file insert/delete
- **Full-text search** index on file names
- Seed data for default admin + chat rooms

> **⚠️ MAJOR:** The documentation template treats the database as Firestore-only. Your actual project is a **PostgreSQL-primary + Firestore-for-realtime hybrid**. This needs to be accurately reflected in the Black Book.

### 4.3 Firestore Usage (Actual)

Firestore is used for **real-time features only**, NOT as the primary database:
- **Presence/Status** (Firebase Realtime Database): online/offline tracking
- **Chat Messages** (Firestore `chats/{chatId}/messages`): real-time messaging
- **Typing Indicators** (Firestore `chats/{chatId}/typing`)
- **Security Rules**: 189 lines covering chats, users, tasks, meetings, uploads, announcements, committees

---

## 🎨 SECTION 5: FEATURES COMPARISON

### 5.1 Themes

| Doc Template | Actual Code |
|-------------|-------------|
| 4 themes + auto | ✅ **Correct**: Light, Dark, Purple Dream, Ocean Blue + Auto (System) |
| *(no details)* | Each theme has ~28 CSS custom properties (bg, text, border, accent, shadow, sidebar, input, card variants) |

### 5.2 Settings System

**Template mentions:** Profile editing, Theme selection, Appearance customization, Accessibility options

**Actual has 8 settings panels:**
| Panel | File | In Template? |
|-------|------|-------------|
| Profile Settings | `ProfileSettings.jsx` (10KB) | ✅ |
| Account Settings | `AccountSettings.jsx` (9KB) | ❌ Missing |
| Appearance Settings | `AppearanceSettings.jsx` (20KB) | ✅ |
| Accessibility Settings | `AccessibilitySettings.jsx` (17KB) | ❌ Missing |
| Calendar Settings | `CalendarSettings.jsx` (6KB) | ❌ Missing |
| Notification Settings | `NotificationSettings.jsx` (5KB) | ❌ Missing |
| Privacy Settings | `PrivacySettings.jsx` (6KB) | ❌ Missing |
| Storage Settings | `StorageSettings.jsx` (7KB) | ❌ Missing |

### 5.3 Task System

| Feature | Doc Template | Actual Code |
|---------|-------------|-------------|
| Basic CRUD | ✅ | ✅ |
| Privacy (visibleTo) | ✅ Firestore array | ❌ Uses `assigned_to` + `created_by` PostgreSQL columns instead |
| Status options | "not_started" | `pending, todo, in_progress, review, done, completed, cancelled` (7 statuses) |
| Priority | mentioned | `low, medium, high, urgent` ✅ |
| Labels/Tags | not mentioned | ✅ `labels TEXT[]` array |
| Attachments | not mentioned | ✅ `attachments JSONB` |
| Task Comments | not mentioned | ✅ Full comment system with reactions |
| Rich Editor | not mentioned | ✅ **BlockEditor** with SlashCommandMenu, FormattingToolbar (Notion-like!) |
| Task Email Notifications | not mentioned | ✅ Dedicated `taskEmail.js` route (13KB) |

### 5.4 Chat/Messaging System

| Feature | Doc Template | Actual Code |
|---------|-------------|-------------|
| Direct Messages | ✅ | ✅ |
| General Chat | ✅ | ✅ |
| Announcements | ✅ | ✅ |
| Typing Indicators | not mentioned | ✅ `useTyping.js` + `TypingIndicator.jsx` |
| Emoji Picker | not mentioned | ✅ `emoji-picker-react` |
| Message Read Receipts | not mentioned | ✅ `readBy` field in Firestore rules |
| Chat Rooms (PostgreSQL) | not mentioned | ✅ `chat_rooms` table with types: general, direct, announcement, group |

### 5.5 Drive/File System

| Feature | Doc Template | Actual Code |
|---------|-------------|-------------|
| File Upload | ✅ | ✅ |
| Storage Quota | 10 GB | **5 GB** ❌ |
| Folder System | mentioned | ✅ Full hierarchy with `parent_id`, color, icon customization |
| Starred Files | ✅ | ✅ |
| Trashed Files | not detailed | ✅ Soft delete with `trashed_at` |
| File Sharing | not mentioned | ✅ Share links with passwords, expiry, permissions |
| File Versions | not mentioned | ✅ `file_versions` table |
| File Comments | not mentioned | ✅ Threaded comments |
| File Tags | not mentioned | ✅ Tag system |
| Full-text Search | not mentioned | ✅ PostgreSQL GIN index |
| Download Count | not mentioned | ✅ Tracked per file |
| Storage Analytics | not mentioned | ✅ Breakdown by file type |

### 5.6 Calendar System

| Feature | Doc Template | Actual Code |
|---------|-------------|-------------|
| Event Creation | ✅ | ✅ |
| Google Calendar Sync | ✅ | ✅ (`googleCalendar.js` — 29KB service!) |
| Google Meet Links | ✅ | ✅ |
| Meeting Types | not detailed | `meeting, event, deadline, reminder` |
| Recurring Events | not mentioned | ✅ `is_recurring` + `recurrence_rule` |
| All-day Events | not mentioned | ✅ `is_all_day` |
| Meeting Minutes | not mentioned | ✅ `minutes TEXT` field |
| Attendee RSVP | not mentioned | ✅ `meeting_participants` with status: pending/accepted/declined/tentative |
| Email Invitations | mentioned | ✅ Via `email.js` route |

### 5.7 Other Features

| Feature | Doc Template | Actual Code |
|---------|-------------|-------------|
| Online/Offline Presence | mentioned | ✅ `usePresence.js` + `useUserPresence.js` + Firebase RTDB |
| Admin Panel | not mentioned | ✅ Full `AdminPanel.jsx` (16KB) + admin routes + admin middleware |
| Analytics Routes | not mentioned | ✅ `analytics.js` route (8KB) |
| Committee Switching | not mentioned | ✅ `CommitteeSwitcher.jsx` (9KB) |
| Committee Selector | mentioned | ✅ `CommitteeSelector.jsx` (11KB) |
| Dashboard Meetings | not detailed | ✅ `DashboardMeetings.jsx` + `UpcomingMeetings.jsx` |
| Browser Notifications | mentioned | ✅ `useBrowserNotifications.js` + `NotificationPermissionBanner.jsx` |
| Notification Context | not detailed | ✅ Full `NotificationContext.jsx` (5KB) |
| Protected Routes | not mentioned | ✅ `RequireAuth` + `RequireCommittee` + `PublicOnlyRoute` |
| Framer Motion Animations | not mentioned | ✅ Used throughout for page transitions and micro-animations |

---

## 🔒 SECTION 6: SECURITY COMPARISON

| Security Feature | Doc Template | Actual Code |
|-----------------|-------------|-------------|
| Firebase Auth | ✅ | ✅ |
| JWT Tokens | ✅ | ✅ `jsonwebtoken 9.0.2` |
| RBAC | ✅ | ✅ Firestore rules + middleware |
| Firestore Security Rules | ✅ mentioned | ✅ **189 lines** with helper functions |
| SQL Injection Prevention | ✅ parameterized | ✅ via `pg` driver |
| CORS | not mentioned | ✅ Configured with allowedOrigins whitelist |
| Helmet | not mentioned | ✅ `helmet 7.1.0` |
| Rate Limiting | not mentioned | ✅ `express-rate-limit 7.4.0` |
| File Upload Validation | ✅ type whitelist | ✅ `multer` + `checkStorage` middleware |
| Password Hashing | ✅ Firebase handles | ✅ Also `bcryptjs 2.4.3` for server-side auth |
| Committee Data Isolation | ✅ mentioned | ✅ `committeeMiddleware` + `X-Committee-Slug` header |

---

## 📝 SECTION 7: CODE SNIPPETS — WHAT NEEDS REWRITING

The template provides code snippets that use **Firestore-only patterns** (e.g., `addDoc`, `collection`, `where`). Your actual code uses **PostgreSQL via Express API calls**. Here's what to fix:

| Feature | Template Pattern | Actual Pattern |
|---------|-----------------|----------------|
| Task Creation | `addDoc(collection(db, 'tasks'), {...})` | `axios.post('/api/tasks', taskData)` via `taskService.js` |
| File Upload | `addDoc(collection(db, 'files'), {...})` | `fetch('/api/files/upload', { method: 'POST', body: formData })` via `localDriveAPI.js` |
| User Query | `where('visibleTo', 'array-contains', ...)` | SQL: `WHERE assigned_to = $1 OR created_by = $1` |
| Notifications | `addDoc(collection(db, 'notifications'), {...})` | `axios.post('/api/notifications', ...)` via backend |
| Messaging | Firestore `conversations` collection | Firestore `chats/{id}/messages` subcollection (this one IS Firestore!) |

> **✅ Chat/Messaging snippets CAN use Firestore patterns** — that's accurate for your project.
> **❌ Everything else should use API call patterns** (`axios`/`fetch` → Express → PostgreSQL).

---

## ✅ SECTION 8: SUMMARY — WHAT'S CORRECT IN THE TEMPLATE

These sections from the template are **generally accurate** and can be used with minor edits:

1. ✅ Development Model (Agile/Sprint approach) — adjust sprint descriptions to match actual work
2. ✅ Coding Standards — React functional components, hooks, naming conventions
3. ✅ Version Control — Git/GitHub workflow
4. ✅ Security Implementation — mostly accurate, add Helmet + rate limiting
5. ✅ Testing Strategy structure — levels, types, and approach are standard
6. ✅ Chapter 6 structure — Results, Challenges, Solutions format is good
7. ✅ Chapter 7 structure — Conclusion, Future Enhancements format is good
8. ✅ Chapter 8 — References format is standard

---

## 🚨 SECTION 9: CRITICAL FIXES NEEDED BEFORE WRITING

| Priority | Fix | Details |
|----------|-----|---------|
| 🔴 HIGH | Storage limit | Change all "10 GB" → "5 GB" |
| 🔴 HIGH | Database architecture | Document PostgreSQL + Firestore hybrid, NOT Firestore-only |
| 🔴 HIGH | Version numbers | Update ALL framework/library versions to actual |
| 🔴 HIGH | Code snippets | Rewrite to use actual API patterns (axios → Express → PostgreSQL) |
| 🟡 MEDIUM | User roles | Change "Faculty" → "teacher", add "student" + "volunteer" |
| 🟡 MEDIUM | Dual backend | Document both `server/` and `workspace-backend/` |
| 🟡 MEDIUM | Task statuses | Document all 7 statuses, not just "not_started" |
| 🟡 MEDIUM | Missing features | Add: BlockEditor, emoji picker, typing indicators, file versioning, admin panel |
| 🟢 LOW | File structure | Update directory tree to match actual layout |
| 🟢 LOW | Theme details | Add CSS variable count and accent color system |

---

*End of Report*
