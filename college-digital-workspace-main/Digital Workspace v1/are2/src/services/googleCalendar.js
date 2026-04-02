/**
 * ═══════════════════════════════════════════════════════════════════
 *  Google Calendar Service — Modern GIS OAuth2 Token Client
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Uses google.accounts.oauth2.initTokenClient (GIS) for auth.
 *  Uses raw fetch() for Calendar API — NO gapi dependency at all.
 *
 *  Auto-login: silent token request first (prompt: ''),
 *  popup consent only on first sign-in.
 *
 *  Usage:
 *    import googleCalendar from '../services/googleCalendar';
 *    await googleCalendar.initialize();
 *    const events = await googleCalendar.listEvents(min, max);
 *
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Configuration ───────────────────────────────────────────────────
const CONFIG = {
    GSI_SCRIPT: 'https://accounts.google.com/gsi/client',
    CALENDAR_BASE: 'https://www.googleapis.com/calendar/v3',
    USERINFO_URL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    SCOPE: 'https://www.googleapis.com/auth/calendar',
    SCRIPT_LOAD_TIMEOUT: 10000,
    POLL_INTERVAL: 100,
    MAX_RETRIES: 2,
    RETRY_DELAY: 1500,
};


// ═══════════════════════════════════════════════════════════════════
//  CUSTOM ERROR TYPES
// ═══════════════════════════════════════════════════════════════════

export class ScriptLoadError extends Error {
    constructor(message, detail) {
        super(message);
        this.name = 'ScriptLoadError';
        this.code = 'SCRIPT_LOAD_ERROR';
        this.detail = detail;
    }
}

export class AuthenticationError extends Error {
    constructor(message, detail) {
        super(message);
        this.name = 'AuthenticationError';
        this.code = 'AUTH_ERROR';
        this.detail = detail;
    }
}

export class PopupBlockedError extends Error {
    constructor(message) {
        super(message || 'Sign-in popup was blocked — please allow popups for this site');
        this.name = 'PopupBlockedError';
        this.code = 'POPUP_BLOCKED';
    }
}

export class APIError extends Error {
    constructor(message, status, detail) {
        super(message);
        this.name = 'APIError';
        this.code = 'API_ERROR';
        this.status = status;
        this.detail = detail;
    }
}


// ═══════════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════

class GoogleCalendarService {

    constructor() {
        this._scriptLoaded = false;
        this._tokenClient = null;
        this._accessToken = null;
        this._currentUser = null;
        this._statusCb = null;
        this._initPromise = null;   // dedup guard

        this._clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        this._log('Service instantiated');
    }


    // ─── LOGGING ────────────────────────────────────────────────────
    _log(msg, ...a) { console.log(`%c[GCal] %c${msg}`, 'color:#818cf8;font-weight:bold', 'color:inherit', ...a); }
    _warn(msg, ...a) { console.warn(`%c[GCal] %c${msg}`, 'color:#f59e0b;font-weight:bold', 'color:inherit', ...a); }
    _error(msg, ...a) { console.error(`%c[GCal] %c${msg}`, 'color:#ef4444;font-weight:bold', 'color:inherit', ...a); }

    onStatus(cb) { this._statusCb = cb; }
    _report(msg) { this._log(msg); this._statusCb?.(msg); }


    // ═════════════════════════════════════════════════════════════════
    //  1. LOAD GSI SCRIPT
    // ═════════════════════════════════════════════════════════════════

    async _loadGsiScript() {
        if (this._scriptLoaded) return;
        this._report('Loading Google Identity Services…');

        await this._injectScript(CONFIG.GSI_SCRIPT, 'google', CONFIG.MAX_RETRIES);
        this._scriptLoaded = true;
        this._report('GIS script loaded');
    }

    _injectScript(src, globalName, retriesLeft) {
        return new Promise((resolve, reject) => {
            // Already available
            if (window[globalName]?.accounts?.oauth2) {
                this._log(`${globalName}.accounts.oauth2 already available`);
                return resolve();
            }

            // Existing tag — wait for it
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                return this._waitForGlobal(globalName)
                    .then(resolve)
                    .catch((err) => {
                        existing.remove();
                        if (retriesLeft > 0) {
                            setTimeout(() => this._injectScript(src, globalName, retriesLeft - 1).then(resolve, reject), CONFIG.RETRY_DELAY);
                        } else {
                            reject(new ScriptLoadError(`Failed to load ${globalName}`, err));
                        }
                    });
            }

            // Inject new script
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                this._waitForGlobal(globalName).then(resolve).catch((err) => {
                    script.remove();
                    if (retriesLeft > 0) {
                        setTimeout(() => this._injectScript(src, globalName, retriesLeft - 1).then(resolve, reject), CONFIG.RETRY_DELAY);
                    } else {
                        reject(new ScriptLoadError(`${globalName} loaded but oauth2 not found`, err));
                    }
                });
            };

            script.onerror = () => {
                script.remove();
                if (retriesLeft > 0) {
                    setTimeout(() => this._injectScript(src, globalName, retriesLeft - 1).then(resolve, reject), CONFIG.RETRY_DELAY);
                } else {
                    reject(new ScriptLoadError('Failed to load GIS script — check your internet'));
                }
            };

            document.head.appendChild(script);
        });
    }

    _waitForGlobal(name) {
        return new Promise((resolve, reject) => {
            const t0 = Date.now();
            const check = () => {
                if (window[name]?.accounts?.oauth2) { resolve(); return; }
                if (Date.now() - t0 > CONFIG.SCRIPT_LOAD_TIMEOUT) {
                    reject(new ScriptLoadError(`Timed out waiting for ${name}.accounts.oauth2`));
                } else {
                    setTimeout(check, CONFIG.POLL_INTERVAL);
                }
            };
            check();
        });
    }


    // ═════════════════════════════════════════════════════════════════
    //  2. TOKEN CLIENT
    // ═════════════════════════════════════════════════════════════════

    _initTokenClient() {
        if (this._tokenClient) return;

        if (!this._clientId) {
            throw new AuthenticationError('VITE_GOOGLE_CLIENT_ID is not set — add it to your .env file');
        }

        this._report('Creating GIS token client…');

        this._tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this._clientId,
            scope: CONFIG.SCOPE,
            callback: () => { }, // overridden per-call
        });

        this._report('Token client ready ✓');
    }


    // ═════════════════════════════════════════════════════════════════
    //  3. TOKEN REQUEST (silent or popup)
    // ═════════════════════════════════════════════════════════════════

    /**
     * Try silent token request first (prompt: '').
     * If it fails, fall back to consent popup.
     * @returns {Promise<string>} access_token
     */
    _requestToken() {
        return new Promise((resolve, reject) => {
            this._report('Requesting token silently…');

            // 1. Try silent first
            this._tokenClient.callback = async (response) => {
                if (response.error) {
                    // Silent failed — try with consent popup
                    this._log('Silent request failed, opening consent popup…');
                    this._tokenClient.callback = async (resp2) => {
                        if (resp2.error) {
                            return reject(new AuthenticationError(
                                resp2.error_description || resp2.error || 'Google sign-in failed'
                            ));
                        }
                        resolve(resp2.access_token);
                    };
                    this._tokenClient.error_callback = (err) => {
                        if (err.type === 'popup_closed' || err.type === 'popup_failed_to_open') {
                            return reject(new PopupBlockedError());
                        }
                        reject(new AuthenticationError(err.message || err.type || 'Sign-in failed', err));
                    };
                    this._tokenClient.requestAccessToken({ prompt: 'consent' });
                    return;
                }
                resolve(response.access_token);
            };

            this._tokenClient.error_callback = (err) => {
                // Silent failed with error_callback — try popup
                this._log('Silent error_callback, opening consent popup…');
                this._tokenClient.callback = async (resp2) => {
                    if (resp2.error) {
                        return reject(new AuthenticationError(
                            resp2.error_description || resp2.error || 'Google sign-in failed'
                        ));
                    }
                    resolve(resp2.access_token);
                };
                this._tokenClient.error_callback = (err2) => {
                    if (err2.type === 'popup_closed' || err2.type === 'popup_failed_to_open') {
                        return reject(new PopupBlockedError());
                    }
                    reject(new AuthenticationError(err2.message || err2.type || 'Sign-in failed', err2));
                };
                this._tokenClient.requestAccessToken({ prompt: 'consent' });
            };

            // Start with silent request
            this._tokenClient.requestAccessToken({ prompt: '' });
        });
    }


    // ═════════════════════════════════════════════════════════════════
    //  4. PUBLIC INITIALIZE — single entry point
    // ═════════════════════════════════════════════════════════════════

    /**
     * Full flow: load GIS → init token client → get token → fetch user.
     * Idempotent — deduplicates concurrent calls.
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this.isAuthenticated) return true;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                this._log('──── INITIALIZE START ────');

                // 1. Load GIS script
                await this._loadGsiScript();

                // 2. Create token client
                this._initTokenClient();

                // 3. Get access token (silent → popup fallback)
                this._report('Authenticating…');
                this._accessToken = await this._requestToken();
                this._report('Access token obtained ✓');

                // 4. Fetch user profile
                await this._fetchUserProfile();

                this._log('──── INITIALIZE COMPLETE ────');
                return true;
            } catch (err) {
                this._error('Initialize failed:', err);
                this._accessToken = null;
                throw err instanceof AuthenticationError ||
                    err instanceof ScriptLoadError ||
                    err instanceof PopupBlockedError
                    ? err
                    : new AuthenticationError(err?.message || 'Google sign-in failed', err);
            } finally {
                this._initPromise = null;
            }
        })();

        return this._initPromise;
    }

    async _fetchUserProfile() {
        try {
            const res = await fetch(CONFIG.USERINFO_URL, {
                headers: { Authorization: `Bearer ${this._accessToken}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const p = await res.json();
            this._currentUser = {
                name: p.name || p.email,
                email: p.email,
                avatar: p.picture || '',
            };
            this._report(`Signed in as ${this._currentUser.email}`);
        } catch (e) {
            this._warn('Profile fetch failed:', e.message);
            this._currentUser = null;
        }
    }


    // ═════════════════════════════════════════════════════════════════
    //  5. AUTH STATE
    // ═════════════════════════════════════════════════════════════════

    get isAuthenticated() { return !!this._accessToken; }
    get currentUser() { return this._currentUser; }

    signOut() {
        if (this._accessToken) {
            try { window.google.accounts.oauth2.revoke(this._accessToken, () => { }); } catch { }
        }
        this._accessToken = null;
        this._currentUser = null;
        this._report('Signed out');
    }

    getState() {
        return {
            scriptLoaded: this._scriptLoaded,
            hasTokenClient: !!this._tokenClient,
            hasClientId: !!this._clientId,
            isAuthenticated: this.isAuthenticated,
            origin: typeof window !== 'undefined' ? window.location.origin : null,
        };
    }


    // ═════════════════════════════════════════════════════════════════
    //  6. CALENDAR API — fetch-based (NO gapi)
    // ═════════════════════════════════════════════════════════════════

    _requireAuth() {
        if (!this._accessToken) {
            throw new AuthenticationError('Not authenticated — call initialize() first');
        }
    }

    /** Auth header helper */
    _authHeaders() {
        return { Authorization: `Bearer ${this._accessToken}` };
    }

    /** Normalise a raw Google Calendar event */
    _normalize(e) {
        return {
            id: e.id,
            title: e.summary || '(No title)',
            description: e.description || '',
            location: e.location || '',
            start: e.start?.dateTime || e.start?.date || '',
            end: e.end?.dateTime || e.end?.date || '',
            allDay: !e.start?.dateTime,
            attendees: (e.attendees || []).map((a) => a.email),
            meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri || '',
            htmlLink: e.htmlLink || '',
            colorId: e.colorId || null,
            status: e.status || 'confirmed',
        };
    }

    /**
     * Fetch events between two dates.
     */
    async listEvents(timeMin, timeMax) {
        this._requireAuth();
        this._log('Fetching events…');

        const params = new URLSearchParams({
            calendarId: 'primary',
            timeMin: timeMin instanceof Date ? timeMin.toISOString() : timeMin,
            timeMax: timeMax instanceof Date ? timeMax.toISOString() : timeMax,
            showDeleted: 'false',
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });

        try {
            const res = await fetch(
                `${CONFIG.CALENDAR_BASE}/calendars/primary/events?${params}`,
                { headers: this._authHeaders() }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new APIError(err.error?.message || `HTTP ${res.status}`, res.status, err);
            }
            const data = await res.json();
            const items = (data.items || []).map((e) => this._normalize(e));
            this._log(`Fetched ${items.length} events`);
            return items;
        } catch (err) {
            if (err instanceof APIError) throw err;
            this._error('listEvents failed:', err);
            throw new APIError('Failed to load events', null, err);
        }
    }

    /**
     * Create a new calendar event.
     */
    async createEvent(data) {
        this._requireAuth();
        this._log('Creating event:', data.title);

        try {
            const qp = new URLSearchParams({ sendUpdates: 'all' });
            if (data.addMeet) qp.set('conferenceDataVersion', '1');
            const res = await fetch(
                `${CONFIG.CALENDAR_BASE}/calendars/primary/events?${qp}`,
                {
                    method: 'POST',
                    headers: { ...this._authHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(this._buildResource(data)),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new APIError(err.error?.message || `HTTP ${res.status}`, res.status, err);
            }
            const result = await res.json();
            this._log('Event created:', result.id);
            return this._normalize(result);
        } catch (err) {
            if (err instanceof APIError) throw err;
            this._error('createEvent failed:', err);
            throw new APIError('Failed to create event', null, err);
        }
    }

    /**
     * Update an existing event.
     */
    async updateEvent(eventId, data) {
        this._requireAuth();
        this._log('Updating event:', eventId);

        try {
            const qp = new URLSearchParams({ sendUpdates: 'all' });
            if (data.addMeet) qp.set('conferenceDataVersion', '1');
            const res = await fetch(
                `${CONFIG.CALENDAR_BASE}/calendars/primary/events/${eventId}?${qp}`,
                {
                    method: 'PUT',
                    headers: { ...this._authHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(this._buildResource(data)),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new APIError(err.error?.message || `HTTP ${res.status}`, res.status, err);
            }
            const result = await res.json();
            this._log('Event updated:', result.id);
            return this._normalize(result);
        } catch (err) {
            if (err instanceof APIError) throw err;
            this._error('updateEvent failed:', err);
            throw new APIError('Failed to update event', null, err);
        }
    }

    /**
     * Delete an event by ID.
     */
    async deleteEvent(eventId) {
        this._requireAuth();
        this._log('Deleting event:', eventId);

        try {
            const res = await fetch(
                `${CONFIG.CALENDAR_BASE}/calendars/primary/events/${eventId}?sendUpdates=all`,
                { method: 'DELETE', headers: this._authHeaders() }
            );
            if (!res.ok && res.status !== 204) {
                const err = await res.json().catch(() => ({}));
                throw new APIError(err.error?.message || `HTTP ${res.status}`, res.status, err);
            }
            this._log('Event deleted');
            return true;
        } catch (err) {
            if (err instanceof APIError) throw err;
            this._error('deleteEvent failed:', err);
            throw new APIError('Failed to delete event', null, err);
        }
    }

    /**
     * Build a Calendar event resource from form data.
     * @private
     */
    _buildResource(d) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const r = {
            summary: d.title,
            description: d.description || '',
            location: d.location || '',
            start: { dateTime: new Date(d.startDateTime).toISOString(), timeZone: tz },
            end: { dateTime: new Date(d.endDateTime).toISOString(), timeZone: tz },
        };
        if (d.attendees?.length) {
            r.attendees = d.attendees.map((email) => ({ email }));
        }
        if (d.addMeet) {
            r.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            };
        }
        return r;
    }

    // ═════════════════════════════════════════════════════════════════
    //  7. CONVENIENCE: Generate Google Meet link
    // ═════════════════════════════════════════════════════════════════

    /**
     * Create a temporary Google Calendar event with Meet, extract the link,
     * then delete the temporary event.
     * @param {string} title - Meeting title
     * @param {string} startISO - Start time as ISO string
     * @param {string} endISO - End time as ISO string
     * @returns {Promise<string>} The Google Meet link (e.g. https://meet.google.com/abc-defg-hij)
     */
    async generateMeetLink(title, startISO, endISO) {
        this._requireAuth();
        this._log('Generating Meet link…');

        try {
            // Create a temporary event with Meet
            const tempEvent = await this.createEvent({
                title: title || 'Meeting',
                startDateTime: startISO,
                endDateTime: endISO,
                addMeet: true,
            });

            const meetLink = tempEvent.meetLink;

            if (!meetLink) {
                throw new Error('Google Meet link could not be generated — try again');
            }

            // Delete the temporary event (keep the Meet link — it stays active)
            try {
                await this.deleteEvent(tempEvent.id);
                this._log('Temporary calendar event cleaned up');
            } catch (delErr) {
                this._warn('Could not delete temp event (Meet link still valid):', delErr.message);
            }

            this._log('Meet link generated:', meetLink);
            return meetLink;
        } catch (err) {
            this._error('generateMeetLink failed:', err);
            if (err instanceof APIError || err instanceof AuthenticationError) throw err;
            throw new Error(`Failed to generate Meet link: ${err.message}`);
        }
    }


    // ═════════════════════════════════════════════════════════════════
    //  8. CONVENIENCE: Sync meeting to Google Calendar
    // ═════════════════════════════════════════════════════════════════

    /**
     * Create a persistent Google Calendar event with attendees.
     * This sends Google Calendar invitation emails automatically via sendUpdates: 'all'.
     * OPTIONAL — never throws. Returns null on failure.
     *
     * @param {Object} meeting - { title, description, startTime, endTime, location, meetingLink, allDay }
     * @param {string[]} attendeeEmails - Email addresses of attendees
     * @returns {Promise<{googleEventId: string, googleLink: string, meetLink: string}|null>}
     */
    async syncMeetingToGoogleCalendar(meeting, attendeeEmails = []) {
        // Don't throw if not connected — this is optional
        if (!this.isAuthenticated) {
            this._warn('Google not connected — skipping calendar sync');
            return null;
        }

        try {
            this._log('Syncing meeting to Google Calendar:', meeting.title);

            const hasMeetLink = (meeting.meetingLink || '').includes('meet.google.com');

            const eventData = {
                title: meeting.title,
                description: meeting.description
                    ? `${meeting.description}${meeting.meetingLink ? '\n\nMeeting Link: ' + meeting.meetingLink : ''}`
                    : (meeting.meetingLink ? 'Meeting Link: ' + meeting.meetingLink : ''),
                location: meeting.location || '',
                startDateTime: meeting.startTime,
                endDateTime: meeting.endTime,
                attendees: attendeeEmails,
                // Only generate Meet if no existing meet link
                addMeet: !hasMeetLink && !meeting.meetingLink,
            };

            const result = await this.createEvent(eventData);

            this._log('Meeting synced to Google Calendar:', result.id);
            return {
                googleEventId: result.id,
                googleLink: result.htmlLink || '',
                meetLink: result.meetLink || '',
            };
        } catch (err) {
            this._error('syncMeetingToGoogleCalendar failed (non-blocking):', err);
            return null;
        }
    }
}


// ═══════════════════════════════════════════════════════════════════
//  SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════
const googleCalendar = new GoogleCalendarService();
export default googleCalendar;
