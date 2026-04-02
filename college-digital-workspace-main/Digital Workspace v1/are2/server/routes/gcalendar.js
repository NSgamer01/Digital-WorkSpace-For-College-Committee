// ============================================
// routes/gcalendar.js — Google Calendar API
// ============================================
// Uses a service account to access Google Calendar.
// The service account must be shared on the target calendar.
// ============================================

const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// ── Load service account credentials ────────────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'google-calendar-credentials.json');
let credentials;
try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    credentials = JSON.parse(raw);
    console.log('[GCalendar] Service account loaded:', credentials.client_email);
} catch (err) {
    console.error('[GCalendar] Could not load service account credentials:', err.message);
}

// ── Create authenticated Google Calendar client ─────────────────────
function getCalendarClient() {
    if (!credentials) {
        throw new Error('Google Calendar service account credentials not configured');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
}

// The calendar ID to use. 'primary' = the service account's own calendar.
// You can also use a specific calendar ID if the calendar is shared with the service account.
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// ── Helper: normalize Google event to our frontend format ───────────
function normalizeEvent(event) {
    return {
        id: event.id,
        title: event.summary || '(No title)',
        description: event.description || '',
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        location: event.location || '',
        attendees: (event.attendees || []).map(a => a.email),
        meetLink: event.hangoutLink || '',
        status: event.status || 'confirmed',
        htmlLink: event.htmlLink || '',
    };
}

// ══════════════════════════════════════════════════
// GET /events — List events in a date range
// ══════════════════════════════════════════════════
router.get('/events', async (req, res) => {
    try {
        const calendar = getCalendarClient();
        const { timeMin, timeMax, maxResults } = req.query;

        const params = {
            calendarId: CALENDAR_ID,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: parseInt(maxResults) || 100,
        };

        if (timeMin) params.timeMin = new Date(timeMin).toISOString();
        if (timeMax) params.timeMax = new Date(timeMax).toISOString();

        const response = await calendar.events.list(params);

        const events = (response.data.items || []).map(normalizeEvent);

        res.json({
            success: true,
            events,
            total: events.length,
        });
    } catch (err) {
        const detail = err?.response?.data?.error?.message || err.message;
        console.error('[GCalendar] List events error:', detail);
        if (err?.response?.data?.error) console.error('[GCalendar] Full error:', JSON.stringify(err.response.data.error, null, 2));
        res.status(500).json({ error: 'Failed to fetch Google Calendar events', detail });
    }
});

// ══════════════════════════════════════════════════
// POST /events — Create a new event
// ══════════════════════════════════════════════════
router.post('/events', async (req, res) => {
    try {
        const calendar = getCalendarClient();
        const { title, description, startDateTime, endDateTime, location, attendees, addMeet } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Event title is required' });
        }

        const resource = {
            summary: title.trim(),
            description: description || '',
            start: { dateTime: new Date(startDateTime).toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: new Date(endDateTime).toISOString(), timeZone: 'Asia/Kolkata' },
            location: location || '',
        };

        if (attendees && attendees.length > 0) {
            resource.attendees = attendees.map(email => ({ email }));
        }

        if (addMeet) {
            resource.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            };
        }

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource,
            conferenceDataVersion: addMeet ? 1 : 0,
            sendUpdates: attendees && attendees.length > 0 ? 'all' : 'none',
        });

        res.status(201).json({
            success: true,
            event: normalizeEvent(response.data),
        });
    } catch (err) {
        const detail = err?.response?.data?.error?.message || err.message;
        console.error('[GCalendar] Create event error:', detail);
        if (err?.response?.data?.error) console.error('[GCalendar] Full error:', JSON.stringify(err.response.data.error, null, 2));
        res.status(500).json({ error: 'Failed to create event', detail });
    }
});

// ══════════════════════════════════════════════════
// PATCH /events/:eventId — Update an event
// ══════════════════════════════════════════════════
router.patch('/events/:eventId', async (req, res) => {
    try {
        const calendar = getCalendarClient();
        const { eventId } = req.params;
        const { title, description, startDateTime, endDateTime, location, attendees, addMeet } = req.body;

        const resource = {};
        if (title !== undefined) resource.summary = title.trim();
        if (description !== undefined) resource.description = description;
        if (startDateTime) resource.start = { dateTime: new Date(startDateTime).toISOString(), timeZone: 'Asia/Kolkata' };
        if (endDateTime) resource.end = { dateTime: new Date(endDateTime).toISOString(), timeZone: 'Asia/Kolkata' };
        if (location !== undefined) resource.location = location;
        if (attendees) resource.attendees = attendees.map(email => ({ email }));

        if (addMeet) {
            resource.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            };
        }

        const response = await calendar.events.patch({
            calendarId: CALENDAR_ID,
            eventId,
            resource,
            conferenceDataVersion: addMeet ? 1 : 0,
            sendUpdates: 'all',
        });

        res.json({
            success: true,
            event: normalizeEvent(response.data),
        });
    } catch (err) {
        console.error('[GCalendar] Update event error:', err.message);
        res.status(500).json({ error: 'Failed to update event', detail: err.message });
    }
});

// ══════════════════════════════════════════════════
// DELETE /events/:eventId — Delete an event
// ══════════════════════════════════════════════════
router.delete('/events/:eventId', async (req, res) => {
    try {
        const calendar = getCalendarClient();
        const { eventId } = req.params;

        await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId,
            sendUpdates: 'all',
        });

        res.json({ success: true, message: 'Event deleted' });
    } catch (err) {
        console.error('[GCalendar] Delete event error:', err.message);
        res.status(500).json({ error: 'Failed to delete event', detail: err.message });
    }
});

module.exports = router;
