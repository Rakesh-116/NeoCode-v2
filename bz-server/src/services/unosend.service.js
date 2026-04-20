import { Unosend } from "@unosend/node";

const unosend = new Unosend(process.env.UNOSEND_API_KEY);

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export async function sendPaymentReceiptEmail({ toEmail, userName, courseName, amount, currency, courseId }) {
    const safeUserName = escapeHtml(userName);
    const safeCourseName = escapeHtml(courseName);
    const amountFormatted = new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(amount / 100);

    const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <h1 style="font-size: 22px; color: #111;">Payment Confirmed</h1>
      <p style="color: #555;">Hi ${safeUserName},</p>
      <p style="color: #555;">Your SEPA Direct Debit payment for <strong>${safeCourseName}</strong> has been received and your course access is now active.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888; font-size: 14px;">Course</td>
          <td style="padding: 10px 0; font-size: 14px; text-align: right;">${safeCourseName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888; font-size: 14px;">Amount</td>
          <td style="padding: 10px 0; font-size: 14px; text-align: right;">${amountFormatted}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888; font-size: 14px;">Payment method</td>
          <td style="padding: 10px 0; font-size: 14px; text-align: right;">SEPA Direct Debit</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #888; font-size: 14px;">Status</td>
          <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #16a34a;">Confirmed</td>
        </tr>
      </table>
      <a href="${process.env.CLIENT_URL}/courses/${courseId}" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">Start Course</a>
      <p style="margin-top: 32px; font-size: 12px; color: #aaa;">NeoCode · For support contact billing@yourdomain.com</p>
    </div>
  `;

    const { data, error } = await unosend.emails.send({
        from: process.env.UNOSEND_FROM,
        to: [toEmail],
        subject: `Payment confirmed - ${courseName}`,
        html,
        tags: [{ name: "type", value: "payment_receipt" }],
        tracking: { open: true, click: true },
    });

    if (error) {
        throw new Error(`Unosend error: ${error.message}`);
    }

    return data.id;
}
