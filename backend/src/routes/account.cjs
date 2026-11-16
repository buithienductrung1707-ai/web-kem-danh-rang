const express = require("express");
const session = require("express-session");
const { rateLimit } = require("express-rate-limit");
const { randomBytes, scrypt, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");
const { getOrderItems } = require("../services/orders.cjs");
const mailer = require("../services/mailer.cjs");
const { getSessionOptions } = require("../services/session-options.cjs");

const router = express.Router();
const deriveKey = promisify(scrypt);
const dummySalt = randomBytes(16).toString("hex");
const passwordOptions = {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024
};
const cookieName = "shop-customer.sid";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: false,
  path: "/"
};

function requireSameOrigin(req, res, next) {
  res.set("Cache-Control", "no-store");

  const origin = req.get("Origin");
  const ownOrigin = req.protocol + "://" + req.get("Host");
  if ((origin && origin !== ownOrigin) || req.get("Sec-Fetch-Site") === "cross-site") {
    return res.status(403).json({
      error: "Hãy thao tác từ trang tài khoản của cửa hàng."
    });
  }

  next();
}

router.use(requireSameOrigin);
router.use(express.json({ limit: "16kb" }));
const customerSession = session(getSessionOptions(cookieName, cookieOptions));
router.use(customerSession);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Bạn đã thử đăng nhập nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Bạn đã thử đăng ký nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

const profileLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Bạn đã cập nhật thông tin nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã thử thêm đơn nhiều lần. Hãy chờ một phút rồi thử lại." }
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã yêu cầu nhiều lần. Hãy chờ 15 phút rồi thử lại." }
});
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã thử nhiều lần. Hãy chờ 15 phút rồi thử lại." }
});

const findCustomerByEmail = db.prepare(`
  SELECT id, name, email, phone, address, password_salt, password_hash
  FROM customers WHERE email = ?
`);
const findCustomerById = db.prepare(`
  SELECT id, name, email, phone, address, password_salt FROM customers WHERE id = ?
`);
const createCustomer = db.prepare(`
  INSERT INTO customers (name, email, phone, address, password_salt, password_hash)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO NOTHING
  RETURNING id, name, email, phone, address
`);
const updateCustomerProfile = db.prepare(`
  UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ? AND password_salt = ?
  RETURNING id, name, email, phone, address
`);
const countCustomerOrders = db.prepare(`
  SELECT COUNT(*) AS total FROM orders WHERE customer_id = ? AND (? = 'all' OR status = ?)
`);
const customerOrdersQuery = db.prepare(`
  SELECT * FROM orders WHERE customer_id = ? AND (? = 'all' OR status = ?)
  ORDER BY created_at DESC, rowid DESC LIMIT 10 OFFSET ?
`);
const claimOrderQuery = db.prepare(`
  UPDATE orders SET customer_id = ?
  WHERE (id = ? OR CAST(order_number AS TEXT) = ?) AND customer_phone = ?
    AND (customer_id IS NULL OR customer_id = ?)
  RETURNING *
`);
const insertPasswordReset = db.prepare(`
  INSERT INTO password_resets (token_hash, customer_id, password_salt, expires_at, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const findPasswordReset = db.prepare(`
  SELECT resets.customer_id, resets.password_salt FROM password_resets AS resets
  JOIN customers ON customers.id = resets.customer_id AND customers.password_salt = resets.password_salt
  WHERE resets.token_hash = ? AND resets.expires_at > ?
`);
const resetCustomerPassword = db.prepare(`
  UPDATE customers SET password_salt = ?, password_hash = ? WHERE id = ? AND password_salt = ?
  RETURNING id
`);

function customerOrderResponse(order) {
  return {
    orderId: order.id,
    orderNumber: order.order_number == null ? null : String(order.order_number),
    total: order.total,
    paymentMethod: order.payment_method,
    status: order.status,
    createdAt: order.created_at,
    customerPhone: order.customer_phone,
    items: getOrderItems(order)
  };
}

function validateProfile(body) {
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120) {
    return { error: "Họ tên cần có từ 1 đến 120 ký tự.", field: "name" };
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (phone.length > 32 || !/^[+\d() -]+$/.test(phone) || digits.length < 8 || digits.length > 15) {
    return {
      error: "Số điện thoại cần có từ 8 đến 15 chữ số, chỉ thêm dấu +, khoảng trắng, dấu ngoặc hoặc dấu gạch ngang.",
      field: "phone"
    };
  }

  if (typeof body.address !== "string" || body.address.trim().length < 5 || body.address.trim().length > 500) {
    return { error: "Địa chỉ nhận hàng cần có từ 5 đến 500 ký tự.", field: "address" };
  }

  return null;
}

function customerResponse(customer) {
  const { id, name, email, phone, address } = customer;
  return { id, name, email, phone, address };
}

function validateCredentials(body) {
  if (
    typeof body.email !== "string" ||
    body.email.trim().toLowerCase().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return { error: "Hãy nhập địa chỉ email hợp lệ, tối đa 254 ký tự.", field: "email" };
  }

  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
    return { error: "Mật khẩu cần có từ 8 đến 128 ký tự.", field: "password" };
  }

  return null;
}

async function startCustomerSession(req, res, customerId, customerSalt) {
  try {
    await promisify(req.session.regenerate).call(req.session);
    req.session.customerId = customerId;
    req.session.customerSalt = customerSalt;
    await promisify(req.session.save).call(req.session);
  } catch (error) {
    if (req.session) {
      try {
        await promisify(req.session.destroy).call(req.session);
      } catch {
        // The response still expires the browser cookie if the session store is unavailable.
      }
    }
    res.clearCookie(cookieName, cookieOptions);
    throw error;
  }
}

function requireCustomer(req, res, next) {
  const customer = findCustomerById.get(req.session.customerId ?? null);
  if (!customer || customer.password_salt !== req.session.customerSalt) {
    return res.status(401).json({ error: "Hãy đăng nhập tài khoản của bạn." });
  }

  res.locals.customer = customerResponse(customer);
  next();
}

function requireCustomerContext(req, res, next) {
  const expectedCustomerId = req.get("X-Customer-Id");
  if (expectedCustomerId !== undefined && expectedCustomerId !== String(res.locals.customer.id)) {
    return res.status(401).json({ error: "Phiên tài khoản đã thay đổi. Hãy kiểm tra và thử lại." });
  }
  next();
}

router.get("/me", requireCustomer, (req, res) => {
  res.json(res.locals.customer);
});

router.patch("/profile", requireCustomer, requireCustomerContext, profileLimiter, (req, res) => {
  const body = req.body || {};
  const validation = validateProfile(body);
  if (validation) return res.status(400).json(validation);

  const customer = updateCustomerProfile.get(
    body.name.trim(), body.phone.trim(), body.address.trim(),
    res.locals.customer.id, req.session.customerSalt
  );
  if (!customer) {
    return res.status(401).json({ error: "Hãy đăng nhập tài khoản của bạn." });
  }

  res.json(customer);
});

router.get("/orders", requireCustomer, requireCustomerContext, (req, res) => {
  const pageValue = req.query.page ?? "1";
  const status = req.query.status ?? "all";
  const statuses = ["all", "NEW", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"];
  if (Object.keys(req.query).some(key => !["page", "status"].includes(key)) ||
    typeof pageValue !== "string" || !/^[1-9]\d*$/.test(pageValue) ||
    !Number.isSafeInteger(Number(pageValue)) || !statuses.includes(status)) {
    return res.status(400).json({ error: "Trang hoặc trạng thái lọc chưa hợp lệ." });
  }

  const customerId = res.locals.customer.id;
  const totalOrders = countCustomerOrders.get(customerId, status, status).total;
  const totalPages = Math.max(1, Math.ceil(totalOrders / 10));
  const page = Math.min(Number(pageValue), totalPages);
  const orders = customerOrdersQuery.all(customerId, status, status, (page - 1) * 10)
    .map(customerOrderResponse);
  res.json({ orders, page, totalPages, totalOrders });
});

router.post("/orders/claim", requireCustomer, requireCustomerContext, claimLimiter, (req, res) => {
  const { orderId, customerPhone } = req.body || {};
  if (typeof orderId !== "string" || orderId.trim() === "" ||
    typeof customerPhone !== "string" || customerPhone.trim() === "") {
    return res.status(400).json({ error: "Hãy nhập mã đơn hàng và số điện thoại nhận hàng." });
  }

  const customerId = res.locals.customer.id;
  const order = claimOrderQuery.get(customerId, orderId.trim(), orderId.trim(), customerPhone.trim(), customerId);
  if (!order) {
    return res.status(404).json({ error: "Thông tin đơn hàng chưa khớp hoặc đơn đã thuộc tài khoản khác." });
  }
  res.json(customerOrderResponse(order));
});

router.post("/forgot-password", forgotPasswordLimiter, (req, res) => {
  const email = mailer.normalizeRecipientEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Hãy nhập địa chỉ email hợp lệ.", field: "email" });
  if (!mailer.isMailConfigured()) {
    return res.status(503).json({ error: "Chức năng email chưa sẵn sàng. Hãy thử lại sau." });
  }

  const customer = findCustomerByEmail.get(email);
  if (customer) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = Date.now();
    db.prepare("DELETE FROM password_resets WHERE expires_at <= ?").run(now);
    insertPasswordReset.run(tokenHash, customer.id, customer.password_salt, now + 30 * 60 * 1000, now);
    setImmediate(() => {
      void mailer.sendPasswordReset(email, token).catch(() => console.error("Gửi email đặt lại mật khẩu gặp lỗi."));
    });
  }
  res.json({ message: "Nếu email khớp với tài khoản, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác." });
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  const invalidToken = { error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.", field: "token" };
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json(invalidToken);
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Mật khẩu cần có từ 8 đến 128 ký tự.", field: "password" });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (!findPasswordReset.get(tokenHash, Date.now())) return res.status(400).json(invalidToken);
  const salt = randomBytes(16).toString("hex");
  const hash = await deriveKey(password, salt, 64, passwordOptions);

  const passwordChanged = runTransaction(db, () => {
    const reset = findPasswordReset.get(tokenHash, Date.now());
    if (!reset || !resetCustomerPassword.get(salt, hash.toString("hex"), reset.customer_id, reset.password_salt)) {
      return false;
    }
    db.prepare("DELETE FROM password_resets WHERE customer_id = ?").run(reset.customer_id);
    return true;
  }, { rollbackIf: result => !result });
  if (!passwordChanged) return res.status(400).json(invalidToken);
  res.json({ message: "Đã cập nhật mật khẩu. Hãy đăng nhập bằng mật khẩu mới." });
});

router.post("/register", registerLimiter, async (req, res) => {
  const body = req.body || {};
  const validation = validateProfile(body) || validateCredentials(body);
  if (validation) return res.status(400).json(validation);

  const salt = randomBytes(16).toString("hex");
  const hash = await deriveKey(body.password, salt, 64, passwordOptions);
  const customer = createCustomer.get(
    body.name.trim(), body.email.trim().toLowerCase(), body.phone.trim(), body.address.trim(),
    salt, hash.toString("hex")
  );

  if (!customer) {
    return res.status(409).json({
      error: "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
      field: "email"
    });
  }

  try {
    await startCustomerSession(req, res, customer.id, salt);
  } catch (error) {
    console.error("Lưu phiên tài khoản gặp lỗi", error.message);
    return res.status(503).json({
      error: "Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục."
    });
  }

  res.status(201).json(customer);
});

router.post("/login", loginLimiter, async (req, res) => {
  const body = req.body || {};
  const validation = validateCredentials(body);
  if (validation) return res.status(400).json(validation);

  const customer = findCustomerByEmail.get(body.email.trim().toLowerCase());
  const hash = await deriveKey(body.password, customer?.password_salt ?? dummySalt, 64, passwordOptions);
  const expectedHash = customer ? Buffer.from(customer.password_hash, "hex") : Buffer.alloc(64);

  if (!customer || expectedHash.length !== hash.length || !timingSafeEqual(expectedHash, hash)) {
    return res.status(401).json({ error: "Email hoặc mật khẩu chưa đúng." });
  }

  await startCustomerSession(req, res, customer.id, customer.password_salt);
  const currentCustomer = findCustomerById.get(customer.id);
  if (!currentCustomer || currentCustomer.password_salt !== customer.password_salt) {
    await promisify(req.session.destroy).call(req.session);
    res.clearCookie(cookieName, cookieOptions);
    return res.status(401).json({ error: "Hãy đăng nhập tài khoản của bạn." });
  }

  res.json(customerResponse(currentCustomer));
});

router.post("/logout", async (req, res) => {
  await promisify(req.session.destroy).call(req.session);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ message: "Đã đăng xuất tài khoản." });
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Dữ liệu gửi lên chưa hợp lệ." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Dữ liệu gửi lên vượt quá kích thước cho phép." });
  }

  console.error("API tài khoản gặp lỗi", error.message);
  res.status(500).json({ error: "Máy chủ gặp lỗi. Hãy thử lại." });
});

router.orderContext = [requireSameOrigin, customerSession, (req, res, next) => {
  const customer = findCustomerById.get(req.session.customerId ?? null);
  const authenticated = customer && customer.password_salt === req.session.customerSalt;
  res.locals.orderCustomerId = authenticated ? customer.id : null;
  next();
}];

module.exports = router;
