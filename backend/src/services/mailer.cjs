const { createHash } = require("node:crypto");

let cachedTransport;
let cachedConfiguration;

function normalizeRecipientEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[<>,;:"\\()[\]]/.test(email)) return null;
  return email;
}

function getMailConfiguration() {
  const host = (process.env.SMTP_HOST || "").trim();
  const from = (process.env.SMTP_FROM || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = process.env.SMTP_PASS || "";
  const secureValue = (process.env.SMTP_SECURE || "false").trim().toLowerCase();
  const port = Number(process.env.SMTP_PORT || (secureValue === "true" ? 465 : 587));
  const publicUrl = (process.env.SHOP_PUBLIC_URL || "").trim();
  if (!host || host.length > 253 || /[\s/\\]/.test(host) ||
    !from || from.length > 320 || /[\r\n]/.test(from) || !from.includes("@") ||
    !["true", "false"].includes(secureValue) || !Number.isInteger(port) || port < 1 || port > 65535 ||
    Boolean(user) !== Boolean(pass)) return null;

  try {
    const url = new URL(publicUrl);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash || publicUrl.length > 2048) return null;
    return { host, port, secure: secureValue === "true", from, user, pass, publicUrl: url.origin };
  } catch {
    return null;
  }
}

function isMailConfigured() {
  return getMailConfiguration() !== null;
}

async function sendMessage({ to, subject, text, messageKey }) {
  const configuration = getMailConfiguration();
  if (!configuration) throw new Error("MAIL_NOT_CONFIGURED");
  const recipient = normalizeRecipientEmail(to);
  if (!recipient) throw new Error("MAIL_INVALID_RECIPIENT");
  const configurationKey = JSON.stringify(configuration);
  if (!cachedTransport || cachedConfiguration !== configurationKey) {
    cachedTransport?.close();
    const nodemailer = require("nodemailer");
    cachedTransport = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      requireTLS: !configuration.secure,
      ...(configuration.user ? { auth: { user: configuration.user, pass: configuration.pass } } : {}),
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      dnsTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false
    });
    cachedConfiguration = configurationKey;
  }
  const domain = new URL(configuration.publicUrl).hostname;
  const messageId = "<" + createHash("sha256").update(messageKey).digest("hex") + "@" + domain + ">";
  const result = await cachedTransport.sendMail({ from: configuration.from, to: { address: recipient }, subject, text, messageId });
  if (!Array.isArray(result.accepted) || result.accepted.length === 0) throw new Error("MAIL_RECIPIENT_REJECTED");
  return result;
}

async function sendPasswordReset(email, token) {
  const configuration = getMailConfiguration();
  if (!configuration) throw new Error("MAIL_NOT_CONFIGURED");
  const link = new URL("/dat-lai-mat-khau.html", configuration.publicUrl);
  link.hash = "token=" + token;
  await sendMessage({
    to: email,
    subject: "Đặt lại mật khẩu cửa hàng kem đánh răng",
    text: ["Bạn đã yêu cầu đặt lại mật khẩu.", "Mở liên kết dưới đây trong 30 phút để chọn mật khẩu mới.",
      link.href, "Nếu bạn không yêu cầu, hãy bỏ qua email này."].join("\n\n"),
    messageKey: "password-reset:" + createHash("sha256").update(token).digest("hex")
  });
}

module.exports = { getMailConfiguration, isMailConfigured, normalizeRecipientEmail, sendMessage, sendPasswordReset };
