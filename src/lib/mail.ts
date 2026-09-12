import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  // Sanitize baseUrl: strip any accidental markdown brackets or parentheses
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://finder.uzeetech.com.lk";

  const match = rawUrl.match(/https?:\/\/[^\s\)\>\]'"]+/);
  const cleanBaseUrl = (match ? match[0] : "https://finder.uzeetech.com.lk").replace(/\/$/, "");
  const resetUrl = `${cleanBaseUrl}/reset-password?token=${encodeURIComponent(token.trim())}`;

  console.log("\n=======================================================");
  console.log(`🔑 [PASSWORD RESET LINK for ${toEmail}]:`);
  console.log(`👉 ${resetUrl}`);
  console.log("   (Expires in 1 hour)");
  console.log("=======================================================\n");

  const transporter = getTransporter();
  const emailUser = process.env.EMAIL_USER;

  if (!transporter || !emailUser) {
    console.log(
      "[mail] EMAIL_USER or EMAIL_PASS not configured in environment. Password reset link logged to console above."
    );
    return { success: true };
  }

  try {
    const fromAddress = `"UZEE TECH Support" <${emailUser}>`;
    const recipient = toEmail.trim().toLowerCase();

    await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: "Reset your UZEE TECH ScreenGuard Finder password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset your password</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; color: #1e293b; }
            .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .logo { font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 24px; }
            .logo span { color: #dc2626; }
            h2 { font-size: 18px; font-weight: 700; margin-top: 0; color: #0f172a; }
            p { font-size: 14px; line-height: 1.6; color: #475569; }
            .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo"><span>UZEE</span> TECH</div>
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your <strong>UZEE TECH ScreenGuard Finder</strong> account (<strong>${recipient}</strong>).</p>
            <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 14px 28px; font-weight: bold; border-radius: 8px; text-decoration: none; font-size: 15px;">Reset Password</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px; color: #94a3b8;">Or copy this link into your browser:<br/><a href="${resetUrl}" style="color: #60a5fa;">${resetUrl}</a></p>
            <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <div class="footer">
              <p>UZEE TECH Internal Tool &bull; This is an automated notification.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[mail] Password reset email successfully sent via Gmail to ${recipient}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown mail error";
    console.error("[mail] Gmail SMTP Send error:", msg);
    return { success: false, error: msg };
  }
}
