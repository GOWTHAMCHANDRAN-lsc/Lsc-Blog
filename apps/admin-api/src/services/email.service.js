const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    const host = process.env.SMTP_HOST;
    const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)');
    }

    const secure =
      String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
      port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.verify();
    logger.info('SMTP transporter verified');
    return transporter;
  })();

  return transporterPromise;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const from =
    process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('MAIL_FROM is not configured');
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };
