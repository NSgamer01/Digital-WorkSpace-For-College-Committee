// ============================================
// routes/email.js — Email Notification Routes
// ============================================
// Uses Nodemailer + Gmail SMTP to send meeting
// invitation emails to attendees.
//
// Requires env:
//   EMAIL_USER          — Gmail address
//   EMAIL_APP_PASSWORD  — Gmail App Password
// ============================================

const express = require('express');
const router = express.Router();

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch {
    console.warn('  ⚠️  nodemailer not installed — email sending disabled');
    console.warn('     Run: cd workspace-backend && npm install nodemailer');
}

// ── Create transporter (lazy — fails gracefully) ──
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (!nodemailer) return null;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;

    if (!user || !pass) {
        console.warn('  ⚠️  EMAIL_USER or EMAIL_APP_PASSWORD not set — email disabled');
        return null;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });

    return transporter;
}


// ── HTML Email Template ──────────────────────────
function buildMeetingEmailHtml(meeting, organizerName) {
    const startDate = new Date(meeting.start_time || meeting.startTime);
    const endDate = new Date(meeting.end_time || meeting.endTime);

    const dateStr = startDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const startStr = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
    });
    const endStr = endDate.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
    });

    const meetLink = meeting.meeting_link || meeting.meetingLink || '';
    const loc = meeting.location || '';
    const desc = meeting.description || '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background-color:#f4f5f7;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 16px;">
            <tr>
                <td align="center">
                    <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <!-- Header -->
                        <tr>
                            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:28px 32px;">
                                <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700;">📅 Meeting Invitation</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding:28px 32px;">
                                <h2 style="color:#1a1a2e; margin:0 0 20px 0; font-size:20px; font-weight:700;">${meeting.title}</h2>

                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                                    <tr>
                                        <td style="padding:8px 0;">
                                            <span style="color:#6b7280; font-size:13px; font-weight:600;">📆 Date</span><br>
                                            <span style="color:#1a1a2e; font-size:14px;">${dateStr}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:8px 0;">
                                            <span style="color:#6b7280; font-size:13px; font-weight:600;">🕐 Time</span><br>
                                            <span style="color:#1a1a2e; font-size:14px;">${startStr} — ${endStr}</span>
                                        </td>
                                    </tr>
                                    ${loc ? `
                                    <tr>
                                        <td style="padding:8px 0;">
                                            <span style="color:#6b7280; font-size:13px; font-weight:600;">📍 Location</span><br>
                                            <span style="color:#1a1a2e; font-size:14px;">${loc}</span>
                                        </td>
                                    </tr>` : ''}
                                    <tr>
                                        <td style="padding:8px 0;">
                                            <span style="color:#6b7280; font-size:13px; font-weight:600;">👤 Organized by</span><br>
                                            <span style="color:#1a1a2e; font-size:14px;">${organizerName}</span>
                                        </td>
                                    </tr>
                                </table>

                                ${desc ? `
                                <div style="padding:14px; background-color:#f8f9fb; border-radius:8px; margin-bottom:20px;">
                                    <span style="color:#6b7280; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Description</span>
                                    <p style="color:#374151; font-size:14px; margin:8px 0 0 0; line-height:1.5;">${desc}</p>
                                </div>` : ''}

                                ${meetLink ? `
                                <a href="${meetLink}" style="display:inline-block; padding:12px 28px; background-color:#4285f4; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin-bottom:12px;">
                                    🔗 Join Meeting
                                </a>` : ''}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:16px 32px; background-color:#f8f9fb; border-top:1px solid #e5e7eb;">
                                <p style="color:#9ca3af; font-size:11px; margin:0; text-align:center;">
                                    This invitation was sent from your Digital Workspace.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;
}


// ── Send meeting invite emails (internal function) ─
async function sendMeetingInviteEmails(meeting, attendeeEmails, organizerName) {
    const t = getTransporter();
    if (!t) {
        console.log('  📧 Email transporter not available — skipping email send');
        return { sent: 0, skipped: attendeeEmails.length, errors: [] };
    }

    if (!attendeeEmails || attendeeEmails.length === 0) {
        return { sent: 0, skipped: 0, errors: [] };
    }

    const html = buildMeetingEmailHtml(meeting, organizerName);
    const subject = `📅 Meeting Invitation: ${meeting.title}`;
    const results = { sent: 0, skipped: 0, errors: [] };

    for (const email of attendeeEmails) {
        try {
            await t.sendMail({
                from: `"Digital Workspace" <${process.env.EMAIL_USER}>`,
                to: email,
                subject,
                html,
            });
            results.sent++;
            console.log(`  📧 Invite sent to ${email}`);
        } catch (err) {
            results.errors.push({ email, error: err.message });
            console.error(`  ❌ Failed to send to ${email}:`, err.message);
        }
    }

    console.log(`  📧 Email summary: ${results.sent} sent, ${results.errors.length} failed`);
    return results;
}


// ═══════════════════════════════════════════════
//  POST /api/email/meeting-invite
// ═══════════════════════════════════════════════
router.post('/meeting-invite', async (req, res) => {
    try {
        const { meeting, attendeeEmails, organizerName } = req.body;

        if (!meeting || !attendeeEmails || attendeeEmails.length === 0) {
            return res.status(400).json({ error: 'meeting and attendeeEmails are required' });
        }

        const result = await sendMeetingInviteEmails(
            meeting,
            attendeeEmails,
            organizerName || req.user?.name || 'Someone'
        );

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('  ❌ Email route error:', err.message);
        res.status(500).json({ error: 'Failed to send emails' });
    }
});

module.exports = { router, sendMeetingInviteEmails };
