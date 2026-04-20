import { pool } from "../database/connect.db.js";
import { sendAdminMessageEmail } from "../services/unosend.service.js";

async function ensureAdmin(userId) {
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
    return result.rows[0]?.role === "admin";
}

export async function sendAdminEmailController(req, res) {
    const { userId, subject, message } = req.body;

    if (!userId || !subject?.trim() || !message?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Recipient, subject, and message are required",
        });
    }

    if (subject.length > 160) {
        return res.status(400).json({
            success: false,
            message: "Subject must be 160 characters or fewer",
        });
    }

    try {
        const isAdmin = await ensureAdmin(req.userId);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: "Admin access required" });
        }

        const userResult = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [userId]);
        if (!userResult.rows.length) {
            return res.status(404).json({ success: false, message: "Recipient not found" });
        }

        const recipient = userResult.rows[0];
        const providerEmailId = await sendAdminMessageEmail({
            toEmail: recipient.email,
            userName: recipient.username,
            subject: subject.trim(),
            message: message.trim(),
        });

        await pool.query(
            `INSERT INTO email_logs (user_id, email_type, recipient, provider_email_id, status)
             VALUES ($1, 'admin_message', $2, $3, 'sent')`,
            [recipient.id, recipient.email, providerEmailId]
        );

        return res.status(200).json({
            success: true,
            message: "Email sent",
            emailId: providerEmailId,
        });
    } catch (error) {
        console.error("[admin emails] send failed:", error.message);

        let recipientEmail = null;
        if (userId) {
            const recipientResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
            recipientEmail = recipientResult.rows[0]?.email || null;
        }

        await pool.query(
            `INSERT INTO email_logs (user_id, email_type, recipient, status, error_message)
             VALUES ($1, 'admin_message', $2, 'failed', $3)`,
            [userId || null, recipientEmail, error.message]
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
