const { randomUUID } = require("node:crypto");
const db = require("../db/database.cjs");
const mailer = require("./mailer.cjs");

const maximumAttempts = 6;
const leaseMilliseconds = 120000;
const insertEmail = db.prepare(`
  INSERT INTO email_outbox (event_key, order_id, recipient, payload) VALUES (?, ?, ?, ?)
  ON CONFLICT(event_key) DO NOTHING
`);
const claimEmail = db.prepare(`
  UPDATE email_outbox SET state = 'SENDING', attempts = attempts + 1, lease_id = ?, locked_until = ?
  WHERE id = (
    SELECT candidate.id FROM email_outbox AS candidate WHERE candidate.attempts < ? AND (
      (candidate.state = 'PENDING' AND candidate.next_attempt_at <= ?) OR
      (candidate.state = 'SENDING' AND candidate.locked_until <= ?)
    ) AND NOT EXISTS (
      SELECT 1 FROM email_outbox AS earlier WHERE earlier.order_id = candidate.order_id
        AND earlier.id < candidate.id AND earlier.state IN ('PENDING', 'SENDING')
    ) ORDER BY candidate.id LIMIT 1
  ) RETURNING *
`);
const renewLease = db.prepare("UPDATE email_outbox SET locked_until = ? WHERE id = ? AND lease_id = ? AND state = 'SENDING'");
const markSent = db.prepare(`
  UPDATE email_outbox SET state = 'SENT', sent_at = CURRENT_TIMESTAMP, lease_id = NULL,
    locked_until = 0, last_error = '' WHERE id = ? AND lease_id = ? AND state = 'SENDING'
`);
const markFailure = db.prepare(`
  UPDATE email_outbox SET state = ?, next_attempt_at = ?, lease_id = NULL, locked_until = 0,
    last_error = 'SMTP_DELIVERY_FAILED' WHERE id = ? AND lease_id = ? AND state = 'SENDING'
`);
const expireFinalLease = db.prepare(`
  UPDATE email_outbox SET state = 'FAILED', lease_id = NULL, locked_until = 0,
    last_error = 'DELIVERY_LEASE_EXPIRED'
  WHERE state = 'SENDING' AND locked_until <= ? AND attempts >= ?
`);
const retryFailed = db.prepare(`
  UPDATE email_outbox SET state = 'PENDING', attempts = 0, next_attempt_at = 0,
    lease_id = NULL, locked_until = 0, last_error = '' WHERE state = 'FAILED'
`);

function enqueueOrderEmail(order, items, historyId) {
  if (!order.customer_email) return;
  const payload = {
    orderId: order.id,
    orderNumber: order.order_number == null ? null : String(order.order_number),
    customerId: order.customer_id,
    customerName: order.customer_name,
    status: order.status,
    total: order.total,
    paymentMethod: order.payment_method,
    items
  };
  insertEmail.run("order:" + order.id + ":history:" + historyId, order.id,
    order.customer_email, JSON.stringify(payload));
}

function orderMessage(job, publicUrl) {
  const order = JSON.parse(job.payload);
  const code = order.orderNumber || order.orderId;
  const statuses = { NEW: "Đã nhận đơn hàng", CONFIRMED: "Đã xác nhận đơn hàng", SHIPPING: "Đơn hàng đang giao",
    COMPLETED: "Đơn hàng đã hoàn thành", CANCELLED: "Đơn hàng đã hủy" };
  const status = statuses[order.status] || order.status;
  const link = new URL(order.customerId == null ? "/tra-cuu.html" : "/don-hang.html", publicUrl);
  if (order.customerId == null) link.searchParams.set("orderId", code);
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  return {
    to: job.recipient,
    subject: status + " #" + code,
    text: ["Xin chào " + order.customerName + ",", status + ". Mã đơn " + code + ".",
      ...order.items.map(item => item.productName + " × " + item.quantity + " — " + money.format(item.total)),
      "Tiền sản phẩm " + money.format(order.total),
      order.paymentMethod === "BANK_TRANSFER" ? "Phương thức chuyển khoản ngân hàng." : "Thanh toán khi nhận hàng (COD).",
      "Xem đơn hàng " + link.href].join("\n\n"),
    messageKey: job.event_key
  };
}

function createOutboxWorker({ sendMessage = mailer.sendMessage, getConfiguration = mailer.getMailConfiguration,
  now = Date.now } = {}) {
  let running = false;
  let stopped = false;
  let timer;
  let initial;

  async function runOnce() {
    if (running || stopped) return false;
    const configuration = getConfiguration();
    if (!configuration) return false;
    running = true;
    let heartbeat;
    try {
      expireFinalLease.run(now(), maximumAttempts);
      const lease = randomUUID();
      const job = claimEmail.get(lease, now() + leaseMilliseconds, maximumAttempts, now(), now());
      if (!job) return false;
      heartbeat = setInterval(() => {
        try { renewLease.run(now() + leaseMilliseconds, job.id, lease); } catch { /* The next lease can recover a stopped worker. */ }
      }, 30000);
      heartbeat.unref();
      try {
        await sendMessage(orderMessage(job, configuration.publicUrl));
        markSent.run(job.id, lease);
      } catch {
        const state = job.attempts >= maximumAttempts ? "FAILED" : "PENDING";
        const delay = Math.min(3600000, 30000 * (2 ** (job.attempts - 1)));
        markFailure.run(state, now() + delay, job.id, lease);
      }
      return true;
    } finally {
      clearInterval(heartbeat);
      running = false;
    }
  }

  function tick() {
    void runOnce().catch(() => console.error("Xử lý hàng đợi email gặp lỗi."));
  }
  function start() {
    if (timer) return;
    stopped = false;
    initial = setTimeout(tick, 0); initial.unref();
    timer = setInterval(tick, 5000); timer.unref();
  }
  function stop() {
    stopped = true;
    clearTimeout(initial); clearInterval(timer); timer = undefined;
  }
  return { runOnce, start, stop };
}

function outboxSummary() {
  const counts = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0 };
  for (const row of db.prepare("SELECT state, COUNT(*) AS count FROM email_outbox GROUP BY state").all()) {
    counts[row.state] = row.count;
  }
  return { configured: mailer.isMailConfigured(), counts };
}

function retryFailedEmails() {
  return Number(retryFailed.run().changes);
}

module.exports = { enqueueOrderEmail, orderMessage, createOutboxWorker, outboxSummary, retryFailedEmails };
