export async function sendMail(to: string, subject: string, text: string) {
  const server = process.env.EMAIL_SERVER?.trim();
  if (!server) return;
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(server);
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "noreply@localhost",
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("[signalboard] mail failed", err);
  }
}
