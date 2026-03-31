/**
 * Password reset email template.
 */

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; html: string; text: string } {
  return {
    subject: 'Reset your Snout OS password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background: #432f21; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 14px;">S</span>
            </div>
            <span style="font-size: 18px; font-weight: bold; color: #432f21;">Snout OS</span>
          </div>
        </div>
        <h2 style="color: #432f21; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #333; line-height: 1.6;">Hi ${params.name || 'there'},</p>
        <p style="color: #333; line-height: 1.6;">We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="margin: 24px 0;">
          <a href="${params.resetUrl}" style="background: #432f21; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">This link expires in ${params.expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${params.resetUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #8c7769; font-size: 13px;">&mdash; Snout Pet Care</p>
      </div>
    `,
    text: `Reset your Snout OS password\n\nHi ${params.name || 'there'},\n\nWe received a request to reset your password. Visit this link to choose a new one:\n\n${params.resetUrl}\n\nThis link expires in ${params.expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.\n\n— Snout Pet Care`,
  };
}
