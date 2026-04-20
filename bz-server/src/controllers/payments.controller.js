import { pool } from "../database/connect.db.js";
import { createCheckoutSession, constructWebhookEvent } from "../services/stripe.service.js";
import { sendPaymentReceiptEmail } from "../services/unosend.service.js";

export async function createCheckout(req, res) {
    try {
        const { courseId } = req.body;
        const userId = req.userId;

        if (!courseId) {
            return res.status(400).json({ success: false, error: "Course id is required" });
        }

        const courseResult = await pool.query(
            "SELECT id, title, price_amount, price_currency, is_paid FROM courses WHERE id = $1",
            [courseId]
        );

        if (!courseResult.rows.length) {
            return res.status(404).json({ success: false, error: "Course not found" });
        }

        const course = courseResult.rows[0];
        if (!course.is_paid) {
            return res.status(400).json({ success: false, error: "Course is free" });
        }

        if (!course.price_amount || course.price_amount <= 0) {
            return res.status(400).json({ success: false, error: "Course price is not configured" });
        }

        const existingEnrollment = await pool.query(
            "SELECT 1 FROM course_enrollments WHERE user_id = $1 AND course_id = $2 AND status = $3",
            [userId, courseId, "active"]
        );

        if (existingEnrollment.rows.length) {
            return res.status(409).json({ success: false, error: "Course already unlocked" });
        }

        const userResult = await pool.query("SELECT email, username FROM users WHERE id = $1", [userId]);
        if (!userResult.rows.length) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const user = userResult.rows[0];
        const session = await createCheckoutSession({
            courseId,
            courseName: course.title,
            priceAmount: course.price_amount,
            currency: course.price_currency,
            userId,
            userEmail: user.email,
        });

        await pool.query(
            `INSERT INTO payments (user_id, course_id, stripe_checkout_session_id, amount, currency, status)
             VALUES ($1, $2, $3, $4, $5, 'created')`,
            [userId, courseId, session.id, course.price_amount, course.price_currency]
        );

        return res.json({ success: true, url: session.url });
    } catch (err) {
        console.error("[payments.createCheckout]", err.message);
        return res.status(500).json({ success: false, error: "Failed to create checkout session" });
    }
}

export async function stripeWebhook(req, res) {
    const signature = req.headers["stripe-signature"];
    let event;

    try {
        event = constructWebhookEvent(req.body, signature);
    } catch (err) {
        console.error("[stripe webhook] Invalid signature:", err.message);
        return res.status(400).send("Webhook signature verification failed");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const already = await client.query("SELECT 1 FROM stripe_webhook_events WHERE id = $1", [event.id]);
        if (already.rows.length) {
            await client.query("ROLLBACK");
            return res.json({ received: true });
        }

        await client.query("INSERT INTO stripe_webhook_events (id, event_type) VALUES ($1, $2)", [
            event.id,
            event.type,
        ]);

        if (!["payment_intent.succeeded", "checkout.session.async_payment_succeeded"].includes(event.type)) {
            await client.query("COMMIT");
            return res.json({ received: true });
        }

        const eventObject = event.data.object;
        const isCheckoutSessionEvent = event.type === "checkout.session.async_payment_succeeded";
        const { courseId, userId } = eventObject.metadata || {};
        const paymentIntentId = isCheckoutSessionEvent
            ? eventObject.payment_intent
            : eventObject.id;
        const checkoutSessionId = isCheckoutSessionEvent
            ? eventObject.id
            : null;

        if (!courseId || !userId) {
            throw new Error(`${event.type} is missing courseId or userId metadata`);
        }

        const paymentResult = await client.query(
            `UPDATE payments
             SET status = 'succeeded',
                 stripe_payment_intent_id = $1,
                 stripe_mandate_id = $2,
                 updated_at = now()
             WHERE id = (
                 SELECT id FROM payments
                 WHERE user_id = $3
                   AND course_id = $4
                   AND status = 'created'
                   AND ($5::text IS NULL OR stripe_checkout_session_id = $5)
                 ORDER BY created_at DESC
                 LIMIT 1
             )
             RETURNING id, amount, currency, email_sent_at`,
            [paymentIntentId, eventObject.mandate || null, userId, courseId, checkoutSessionId]
        );

        await client.query(
            `INSERT INTO course_enrollments (user_id, course_id, source)
             VALUES ($1, $2, 'stripe')
             ON CONFLICT (user_id, course_id)
             DO UPDATE SET status = 'active', source = 'stripe', enrolled_at = now()`,
            [userId, courseId]
        );

        const payment = paymentResult.rows[0] || null;
        const shouldSendEmail = payment && !payment.email_sent_at;

        await client.query("COMMIT");

        if (shouldSendEmail) {
            await sendReceiptAndLog({ userId, courseId, paymentId: payment.id, paymentIntentId });
        }
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("[stripe webhook] Handler error:", err.message);
    } finally {
        client.release();
    }

    return res.json({ received: true });
}

async function sendReceiptAndLog({ userId, courseId, paymentId, paymentIntentId }) {
    let recipient = null;

    try {
        const userResult = await pool.query("SELECT email, username FROM users WHERE id = $1", [userId]);
        const courseResult = await pool.query("SELECT title, price_amount, price_currency FROM courses WHERE id = $1", [
            courseId,
        ]);

        if (!userResult.rows.length || !courseResult.rows.length) {
            return;
        }

        const user = userResult.rows[0];
        const course = courseResult.rows[0];
        recipient = user.email;

        const emailId = await sendPaymentReceiptEmail({
            toEmail: user.email,
            userName: user.username,
            courseName: course.title,
            amount: course.price_amount,
            currency: course.price_currency,
            courseId,
        });

        await pool.query(
            `INSERT INTO email_logs (user_id, payment_id, email_type, recipient, provider_email_id)
             VALUES ($1, $2, 'payment_receipt', $3, $4)`,
            [userId, paymentId, user.email, emailId]
        );

        await pool.query("UPDATE payments SET email_sent_at = now() WHERE stripe_payment_intent_id = $1", [
            paymentIntentId,
        ]);
    } catch (err) {
        console.error("[payments.sendReceiptAndLog]", err.message);

        await pool.query(
            `INSERT INTO email_logs (user_id, payment_id, email_type, recipient, status, error_message)
             VALUES ($1, $2, 'payment_receipt', $3, 'failed', $4)`,
            [userId, paymentId, recipient, err.message]
        );
    }
}
