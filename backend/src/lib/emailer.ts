import nodemailer from "nodemailer";

const HOLDER_APP_URL  = process.env.HOLDER_APP_URL  ?? "http://localhost:3002";
const MONITOR_APP_URL = process.env.MONITOR_APP_URL ?? "http://localhost:3003";
const FROM_EMAIL      = process.env.GMAIL_USER ?? "you@gmail.com";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD not set");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: { user, pass },
  } as any);
}

async function sendEmail(to: string, subject: string, html: string) {
  await getTransporter().sendMail({ from: `"ReSurge" <${FROM_EMAIL}>`, to, subject, html });
}

function buildInviteHtml(opts: { toEmail: string; roleLabel: string; loginUrl: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0F16;font-family:'Courier New',Courier,monospace;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <div style="width:38px;height:38px;background:#FF4500;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;">r/</div>
      <span style="font-size:18px;font-weight:800;color:#F9FAFB;vertical-align:middle;margin-left:10px;">ReSurge</span>
    </div>
    <div style="background:#0F1117;border:1px solid #1F2937;border-radius:14px;padding:32px;">
      <div style="font-size:22px;font-weight:800;color:#F9FAFB;margin-bottom:12px;">You're invited!</div>
      <div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:24px;">
        You've been invited to join ReSurge as a <strong style="color:#F9FAFB;">${opts.roleLabel}</strong>.
        Sign in with your Google account (<strong style="color:#F9FAFB;">${opts.toEmail}</strong>) to get started.
      </div>
      <a href="${opts.loginUrl}" style="display:inline-block;background:#A78BFA;color:#fff;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-family:'Courier New',Courier,monospace;">
        Sign in to ReSurge →
      </a>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:11px;color:#374151;">
      If you weren't expecting this, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  role: string;
}): Promise<void> {
  const roleLabels: Record<string, string> = { holder: "Holder", monitor: "Monitor", main: "Admin" };
  const roleLabel = roleLabels[opts.role] ?? opts.role;
  const MAIN_APP_URL = process.env.MAIN_APP_URL ?? "http://localhost:3000";
  const loginUrl = opts.role === "holder" ? HOLDER_APP_URL : opts.role === "main" ? MAIN_APP_URL : MONITOR_APP_URL;
  const subject = `You've been invited to ReSurge as a ${roleLabel}`;
  const html = buildInviteHtml({ toEmail: opts.toEmail, roleLabel, loginUrl });

  await sendEmail(opts.toEmail, subject, html);
  console.log("[invite email] sent via Gmail to", opts.toEmail);
}


export async function sendStack4Notification(opts: {
  toEmail:    string;
  toName:     string;
  token:      string;
  postId:     string;
  postTitle:  string;
  postUrl:    string;
  subreddit:  string;
  growth:     number;
}): Promise<void> {
  const deepLink = `${HOLDER_APP_URL}/?postId=${opts.postId}&token=${encodeURIComponent(opts.token)}&role=holder`;

  await sendEmail(opts.toEmail, `🔥 Viral post in r/${opts.subreddit} — act now`, `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Viral Post Alert</title>
</head>
<body style="margin:0;padding:0;background:#0D0F16;font-family:'Courier New',Courier,monospace;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
      <div style="width:38px;height:38px;background:#FF4500;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;vertical-align:middle;">r/</div>
      <span style="font-size:18px;font-weight:800;color:#F9FAFB;vertical-align:middle;margin-left:10px;">ReSurge</span>
    </div>

    <!-- Alert badge -->
    <div style="margin-bottom:20px;">
      <span style="background:#78350F;color:#FCD34D;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:0.06em;border:1px solid #92400E;">
        🔥 VIRAL ALERT · r/${opts.subreddit}
      </span>
    </div>

    <!-- Post title box -->
    <div style="background:#0F1117;border:1px solid #2A1F00;border-left:4px solid #F59E0B;border-radius:10px;padding:20px 22px;margin-bottom:28px;">
      <div style="font-size:11px;color:#6B7280;margin-bottom:8px;letter-spacing:0.05em;">POST TITLE</div>
      <div style="font-size:16px;color:#F9FAFB;line-height:1.55;font-weight:600;">${opts.postTitle}</div>
    </div>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${deepLink}"
         style="display:inline-block;background:#F59E0B;color:#000;font-weight:800;
                padding:16px 40px;border-radius:10px;text-decoration:none;font-size:14px;
                letter-spacing:0.03em;font-family:'Courier New',Courier,monospace;">
        Open &amp; Respond →
      </a>
    </div>

    <!-- Info row -->
    <div style="display:flex;gap:20px;background:#080A10;border:1px solid #1F2937;border-radius:8px;padding:14px 18px;margin-bottom:28px;">
      <div style="text-align:center;flex:1;">
        <div style="font-size:11px;color:#4B5563;margin-bottom:4px;">SUBREDDIT</div>
        <div style="font-size:13px;color:#9CA3AF;font-weight:600;">r/${opts.subreddit}</div>
      </div>
    </div>

    <!-- Tip -->
    <div style="background:#060A0F;border:1px solid #1E3A5F;border-radius:8px;padding:14px 18px;margin-bottom:32px;">
      <div style="font-size:11px;color:#3B82F6;font-weight:700;margin-bottom:6px;">💡 TIP</div>
      <div style="font-size:12px;color:#4B5563;line-height:1.6;">
        Click <strong style="color:#9CA3AF;">Open &amp; Respond</strong> above to generate a comment with AI and mark it as posted — all in one click. This post stays live for 24 hours.
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1F2937;padding-top:20px;text-align:center;">
      <div style="font-size:11px;color:#374151;line-height:1.7;">
        You received this because your account is subscribed to r/${opts.subreddit}.<br>
        <a href="${HOLDER_APP_URL}" style="color:#4B5563;text-decoration:underline;">Open ReSurge</a>
      </div>
    </div>

  </div>
</body>
</html>`);
}
