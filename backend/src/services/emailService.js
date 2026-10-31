const nodemailer = require('nodemailer');

let testTransportPromise;

async function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    return {
      transport: nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: String(SMTP_SECURE).toLowerCase() === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
      }),
      testInbox: false
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD before sending password reset emails in production.');
  }

  testTransportPromise ??= nodemailer.createTestAccount().then(account => ({
    transport: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass }
    }),
    testInbox: true
  }));
  return testTransportPromise;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const { transport, testInbox } = await getTransport();
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || 'Brightloop <no-reply@brightloop.local>',
    to: email,
    subject: 'Reset your Brightloop password',
    text: `Use this link to reset your Brightloop password. It expires in 30 minutes: ${resetUrl}`,
    html: `<p>Use this link to reset your Brightloop password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`
  });

  if (testInbox) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.info(`Ethereal reset-email preview: ${previewUrl}`);
  }
  return info;
}

module.exports = { sendPasswordResetEmail };
