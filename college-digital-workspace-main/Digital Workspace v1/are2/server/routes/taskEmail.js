// ============================================
// routes/taskEmail.js — Task Email Notifications
// ============================================
// Nodemailer-based email templates for task events.
// Uses the same Gmail SMTP pattern as meeting emails.
//
// Requires env:
//   EMAIL_USER          — Gmail address
//   EMAIL_APP_PASSWORD  — Gmail App Password
// ============================================

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch {
    console.warn('  ⚠️  nodemailer not installed — task email sending disabled');
}

// ── Lazy transporter ────────────────────────────
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (!nodemailer) return null;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_APP_PASSWORD;

    if (!user || !pass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });

    return transporter;
}

// ── Priority formatting ─────────────────────────
const priorityEmoji = {
    urgent: '🔥 Urgent',
    high: '🔴 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
};

const priorityColor = {
    urgent: '#dc2626',
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
};

// ── Format date ─────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return 'No due date set';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'No due date set';
    return d.toLocaleDateString('en-IN', { dateStyle: 'full' });
}


// ══════════════════════════════════════════════════
//  sendTaskAssignmentEmail
// ══════════════════════════════════════════════════
async function sendTaskAssignmentEmail({
    assigneeEmail, assigneeName, taskTitle, taskDescription,
    dueDate, priority, creatorName, committeeName,
}) {
    const t = getTransporter();
    if (!t) return;

    const prio = priority || 'medium';
    const prioLabel = priorityEmoji[prio] || '🟡 Medium';
    const prioClr = priorityColor[prio] || '#f59e0b';
    const dueDateStr = formatDate(dueDate);
    const descBlock = taskDescription
        ? `<div style="padding:14px;background:#f8f9fb;border-radius:8px;margin-bottom:20px;">
               <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</span>
               <p style="color:#374151;font-size:14px;margin:8px 0 0;line-height:1.5;">${taskDescription}</p>
           </div>`
        : '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f5f7;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
            <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
                        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">📋 New Task Assigned</h1>
                    </td></tr>
                    <!-- Body -->
                    <tr><td style="padding:28px 32px;">
                        <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.5;">
                            Hi <strong>${assigneeName || 'there'}</strong>,<br><br>
                            <strong>${creatorName}</strong> has assigned you a new task in <strong>${committeeName || 'your workspace'}</strong>:
                        </p>
                        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;font-weight:700;">${taskTitle}</h2>
                        ${descBlock}
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                            <tr><td style="padding:8px 0;">
                                <span style="color:#6b7280;font-size:13px;font-weight:600;">Priority</span><br>
                                <span style="color:${prioClr};font-size:14px;font-weight:600;">${prioLabel}</span>
                            </td></tr>
                            <tr><td style="padding:8px 0;">
                                <span style="color:#6b7280;font-size:13px;font-weight:600;">📆 Due Date</span><br>
                                <span style="color:#1a1a2e;font-size:14px;">${dueDateStr}</span>
                            </td></tr>
                            <tr><td style="padding:8px 0;">
                                <span style="color:#6b7280;font-size:13px;font-weight:600;">👤 Assigned By</span><br>
                                <span style="color:#1a1a2e;font-size:14px;">${creatorName}</span>
                            </td></tr>
                        </table>
                    </td></tr>
                    <!-- Footer -->
                    <tr><td style="padding:16px 32px;background:#f8f9fb;border-top:1px solid #e5e7eb;">
                        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">
                            This is an automated message from Digital Workspace.
                        </p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;

    try {
        await t.sendMail({
            from: `"${creatorName} via Workspace" <${process.env.EMAIL_USER}>`,
            to: assigneeEmail,
            subject: `📋 New Task Assigned: ${taskTitle}`,
            html,
        });
        console.log(`  📧 Task assignment email sent to ${assigneeEmail}`);
    } catch (err) {
        console.error(`  ❌ Task assignment email failed for ${assigneeEmail}:`, err.message);
    }
}


// ══════════════════════════════════════════════════
//  sendTaskUpdateEmail
// ══════════════════════════════════════════════════
async function sendTaskUpdateEmail({
    assigneeEmail, assigneeName, taskTitle,
    changes, updaterName, committeeName,
}) {
    const t = getTransporter();
    if (!t) return;

    const changeLines = Object.entries(changes || {})
        .map(([key, val]) => `<li style="margin-bottom:4px;"><strong>${key}:</strong> ${val}</li>`)
        .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f5f7;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
            <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <tr><td style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:28px 32px;">
                        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">📝 Task Updated</h1>
                    </td></tr>
                    <tr><td style="padding:28px 32px;">
                        <p style="color:#374151;font-size:15px;margin:0 0 16px;line-height:1.5;">
                            Hi <strong>${assigneeName || 'there'}</strong>,<br><br>
                            <strong>${updaterName}</strong> updated your task in <strong>${committeeName || 'your workspace'}</strong>:
                        </p>
                        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:18px;">${taskTitle}</h2>
                        <div style="padding:14px;background:#f8f9fb;border-radius:8px;margin-bottom:16px;">
                            <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Changes</span>
                            <ul style="color:#374151;font-size:14px;margin:8px 0 0;padding-left:20px;line-height:1.6;">${changeLines}</ul>
                        </div>
                    </td></tr>
                    <tr><td style="padding:16px 32px;background:#f8f9fb;border-top:1px solid #e5e7eb;">
                        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">
                            This is an automated message from Digital Workspace.
                        </p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;

    try {
        await t.sendMail({
            from: `"Digital Workspace" <${process.env.EMAIL_USER}>`,
            to: assigneeEmail,
            subject: `📝 Task Updated: ${taskTitle}`,
            html,
        });
        console.log(`  📧 Task update email sent to ${assigneeEmail}`);
    } catch (err) {
        console.error(`  ❌ Task update email failed for ${assigneeEmail}:`, err.message);
    }
}


// ══════════════════════════════════════════════════
//  sendTaskCompletedEmail
// ══════════════════════════════════════════════════
async function sendTaskCompletedEmail({
    creatorEmail, creatorName, taskTitle,
    completedByName, committeeName,
}) {
    const t = getTransporter();
    if (!t) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f5f7;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
            <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <tr><td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:28px 32px;">
                        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">✅ Task Completed</h1>
                    </td></tr>
                    <tr><td style="padding:28px 32px;">
                        <p style="color:#374151;font-size:15px;margin:0 0 16px;line-height:1.5;">
                            Hi <strong>${creatorName || 'there'}</strong>,<br><br>
                            <strong>${completedByName}</strong> has completed the task you created in <strong>${committeeName || 'your workspace'}</strong>:
                        </p>
                        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:18px;">${taskTitle}</h2>
                    </td></tr>
                    <tr><td style="padding:16px 32px;background:#f8f9fb;border-top:1px solid #e5e7eb;">
                        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">
                            This is an automated message from Digital Workspace.
                        </p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;

    try {
        await t.sendMail({
            from: `"Digital Workspace" <${process.env.EMAIL_USER}>`,
            to: creatorEmail,
            subject: `✅ Task Completed: ${taskTitle}`,
            html,
        });
        console.log(`  📧 Task completed email sent to ${creatorEmail}`);
    } catch (err) {
        console.error(`  ❌ Task completed email failed for ${creatorEmail}:`, err.message);
    }
}

module.exports = {
    sendTaskAssignmentEmail,
    sendTaskUpdateEmail,
    sendTaskCompletedEmail,
};
