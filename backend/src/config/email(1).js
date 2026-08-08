const { Resend } = require('resend');

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const resend = getClient();
  // Resend's sandbox sender works out of the box for testing without a verified domain.
  const from = process.env.RESEND_FROM_EMAIL || 'Pulse <onboarding@resend.dev>';

  await resend.emails.send({
    from,
    to: toEmail,
    subject: 'Reset your Pulse password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #14151A; margin-bottom: 4px;">Reset your password</h2>
        <p style="color: #6B7280; font-size: 14px; line-height: 1.5;">
          We received a request to reset the password for your Pulse account. Click the button below to choose a new one. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #6C4CF1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Reset password
        </a>
        <p style="color: #9AA0AC; font-size: 12px; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
        <p style="color: #9AA0AC; font-size: 11px; word-break: break-all;">${resetUrl}</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
