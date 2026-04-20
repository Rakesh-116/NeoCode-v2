import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createCheckoutSession({
    courseId,
    courseName,
    priceAmount,
    currency,
    userId,
    userEmail,
}) {
    return stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["sepa_debit"],
        customer_email: userEmail,
        line_items: [
            {
                price_data: {
                    currency: currency || "eur",
                    unit_amount: priceAmount,
                    product_data: { name: courseName },
                },
                quantity: 1,
            },
        ],
        metadata: { courseId, userId },
        payment_intent_data: {
            metadata: { courseId, userId },
        },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
    });
}

export function constructWebhookEvent(rawBody, signature) {
    return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

export async function getCheckoutSession(sessionId) {
    return stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
}
