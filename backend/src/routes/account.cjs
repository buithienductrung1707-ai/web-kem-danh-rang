const express = require("express");
const session = require("express-session");
const { rateLimit } = require("express-rate-limit");
const { randomBytes, scrypt, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");
const { getOrderItems, getOrderHistory, deleteCustomerOrder } = require("../services/orders.cjs");
const mailer = require("../services/mailer.cjs");
const { getSessionOptions } = require("../services/session-options.cjs");
const { createProductImageUpload } = require("../services/product-images.cjs");
const addresses = require("../services/customer-addresses.cjs");
const productReviews = require("../services/product-reviews.cjs");
const { parseOrderFilters, orderFilterSql, orderFilterParameters } = require("../utils/order-filters.cjs");

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
const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã gửi đánh giá nhiều lần. Hãy chờ một phút rồi thử lại." }
});

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã thử thêm đơn nhiều lần. Hãy chờ một phút rồi thử lại." }
});
const deleteOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã thử xóa đơn nhiều lần. Hãy chờ một phút rồi thử lại." }
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
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã thử đổi mật khẩu nhiều lần. Hãy chờ 15 phút rồi thử lại." }
});
const addressLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã cập nhật địa chỉ nhiều lần. Hãy chờ một phút rồi thử lại." }
});
const avatarLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Bạn đã cập nhật ảnh nhiều lần. Hãy chờ một phút rồi thử lại." }
});

const findCustomerByEmail = db.prepare(`
  SELECT id, name, email, phone, address, avatar_url, addresses_initialized, password_salt, password_hash
  FROM customers WHERE email = ?
`);
const findCustomerById = db.prepare(`
  SELECT id, name, email, phone, address, avatar_url, addresses_initialized, password_salt
  FROM customers WHERE id = ?
`);
const createCustomer = db.prepare(`
  INSERT INTO customers (name, email, phone, address, password_salt, password_hash)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO NOTHING
  RETURNING id, name, email, phone, address, avatar_url, addresses_initialized
`);
const customerOrderFilterSql = `
  customer_id = ? AND ${orderFilterSql}
  AND (? = '' OR CAST(order_number AS TEXT) LIKE ? ESCAPE '\\'
    OR id LIKE ? ESCAPE '\\' OR product_name LIKE ? ESCAPE '\\'
    OR EXISTS (SELECT 1 FROM order_items
      WHERE order_items.order_id = orders.id AND product_name LIKE ? ESCAPE '\\'))
`;
const countCustomerOrders = db.prepare(`SELECT COUNT(*) AS total FROM orders WHERE ${customerOrderFilterSql}`);
const customerOrdersNewest = db.prepare(`
  SELECT * FROM orders WHERE ${customerOrderFilterSql}
  ORDER BY datetime(created_at) DESC, rowid DESC LIMIT 10 OFFSET ?
`);
const customerOrdersOldest = db.prepare(`
  SELECT * FROM orders WHERE ${customerOrderFilterSql}
  ORDER BY datetime(created_at) ASC, rowid ASC LIMIT 10 OFFSET ?
`);
const customerOrderImage = db.prepare("SELECT image_url AS imageUrl FROM products WHERE id = ?");
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
    statusHistory: getOrderHistory(order.id),
    items: getOrderItems(order).map(item => ({
      ...item, imageUrl: customerOrderImage.get(item.productId)?.imageUrl || ""
    }))
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
  return addresses.customerResponse(customer);
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

router.get("/products/:id/review", requireCustomer, requireCustomerContext, (req, res) => {
  const result = productReviews.getOwnReview(res.locals.customer.id, productReviews.productId(req.params.id));
  res.status(result.status).json(result.body);
});

router.put("/products/:id/review", requireCustomer, requireCustomerContext, reviewLimiter, (req, res) => {
  if (req.get("X-Customer-Id") !== String(res.locals.customer.id)) {
    return res.status(401).json({ error: "Phiên tài khoản đã thay đổi. Hãy kiểm tra và thử lại." });
  }
  const result = productReviews.saveReview(res.locals.customer.id,
    productReviews.productId(req.params.id), req.body);
  res.status(result.status).json(result.body);
});

router.patch("/profile", requireCustomer, requireCustomerContext, profileLimiter, (req, res) => {
  const result = addresses.updateProfile(res.locals.customer.id, req.session.customerSalt, req.body);
  res.status(result.status).json(result.body);
});

router.get("/addresses", requireCustomer, requireCustomerContext, (req, res) => {
  const result = addresses.getAddresses(res.locals.customer.id, req.session.customerSalt);
  res.status(result.status).json(result.body);
});

router.post("/addresses", requireCustomer, requireCustomerContext, addressLimiter, (req, res) => {
  const result = addresses.createAddress(res.locals.customer.id, req.session.customerSalt, req.body || {});
  res.status(result.status).json(result.body);
});

function addressId(value) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}

router.patch("/addresses/:id", requireCustomer, requireCustomerContext, addressLimiter, (req, res) => {
  const id = addressId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Mã địa chỉ chưa hợp lệ." });
  const result = addresses.updateAddress(res.locals.customer.id, req.session.customerSalt, id, req.body || {});
  res.status(result.status).json(result.body);
});

router.delete("/addresses/:id", requireCustomer, requireCustomerContext, addressLimiter, (req, res) => {
  const id = addressId(req.params.id);
  const revision = req.query.revision;
  if (id === null || typeof revision !== "string" || !/^\d+$/.test(revision) ||
    !Number.isSafeInteger(Number(revision))) {
    return res.status(400).json({ error: "Mã hoặc phiên bản địa chỉ chưa hợp lệ." });
  }
  const result = addresses.deleteAddress(res.locals.customer.id, req.session.customerSalt, id, Number(revision));
  res.status(result.status).json(result.body);
});

router.post("/avatar", requireCustomer, requireCustomerContext, avatarLimiter,
  ...createProductImageUpload({
    onSaved(req, res, { imageUrl }) {
      const updated = db.prepare(`
        UPDATE customers SET avatar_url = ? WHERE id = ? AND password_salt = ? RETURNING id
      `).get(imageUrl, res.locals.customer.id, req.session.customerSalt);
      if (!updated) return res.status(401).json({ error: "Phiên tài khoản đã thay đổi. Hãy đăng nhập lại." });
      res.json(customerResponse(findCustomerById.get(updated.id)));
    }
  })
);

router.delete("/avatar", requireCustomer, requireCustomerContext, avatarLimiter, (req, res) => {
  const updated = db.prepare(`
    UPDATE customers SET avatar_url = '' WHERE id = ? AND password_salt = ? RETURNING id
  `).get(res.locals.customer.id, req.session.customerSalt);
  if (!updated) return res.status(401).json({ error: "Phiên tài khoản đã thay đổi. Hãy đăng nhập lại." });
  res.json(customerResponse(findCustomerById.get(updated.id)));
});

router.post("/password", requireCustomer, requireCustomerContext, passwordChangeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || currentPassword.length < 1 || currentPassword.length > 128) {
    return res.status(400).json({ error: "Hãy nhập mật khẩu hiện tại.", field: "currentPassword" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: "Mật khẩu mới cần có từ 8 đến 128 ký tự.", field: "newPassword" });
  }
  const customer = findCustomerByEmail.get(res.locals.customer.email);
  const oldSalt = req.session.customerSalt;
  const currentHash = await deriveKey(currentPassword, customer?.password_salt ?? dummySalt, 64, passwordOptions);
  const expectedHash = customer ? Buffer.from(customer.password_hash, "hex") : Buffer.alloc(64);
  if (!customer || customer.password_salt !== oldSalt || expectedHash.length !== currentHash.length ||
    !timingSafeEqual(expectedHash, currentHash)) {
    return res.status(400).json({ error: "Mật khẩu hiện tại chưa đúng.", field: "currentPassword" });
  }
  const salt = randomBytes(16).toString("hex");
  const hash = await deriveKey(newPassword, salt, 64, passwordOptions);
  const changed = runTransaction(db, () => {
    if (!resetCustomerPassword.get(salt, hash.toString("hex"), customer.id, oldSalt)) return false;
    db.prepare("DELETE FROM password_resets WHERE customer_id = ?").run(customer.id);
    return true;
  }, { rollbackIf: result => !result });
  if (!changed) return res.status(401).json({ error: "Phiên tài khoản đã thay đổi. Hãy đăng nhập lại." });
  try {
    await startCustomerSession(req, res, customer.id, salt);
  } catch {
    return res.status(503).json({
      error: "Mật khẩu đã được đổi. Hãy đăng nhập lại bằng mật khẩu mới để tiếp tục.",
      passwordChanged: true
    });
  }
  const currentCustomer = findCustomerById.get(customer.id);
  if (!currentCustomer || currentCustomer.password_salt !== salt) {
    await promisify(req.session.destroy).call(req.session);
    res.clearCookie(cookieName, cookieOptions);
    return res.status(401).json({ error: "Mật khẩu đã được cập nhật tiếp. Hãy đăng nhập lại." });
  }
  res.json({ message: "Đã đổi mật khẩu thành công.", customer: customerResponse(currentCustomer) });
});

router.get("/orders", requireCustomer, requireCustomerContext, (req, res) => {
  const pageValue = req.query.page ?? "1";
  const status = req.query.status ?? "all";
  const search = req.query.q ?? "";
  const sort = req.query.sort ?? "newest";
  const statuses = ["all", "NEW", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"];
  if (Object.keys(req.query).some(key => !["page", "status", "dateFrom", "dateTo", "q", "sort"].includes(key)) ||
    typeof pageValue !== "string" || !/^[1-9]\d*$/.test(pageValue) ||
    !Number.isSafeInteger(Number(pageValue)) || !statuses.includes(status) ||
    typeof search !== "string" || search.length > 120 || !["newest", "oldest"].includes(sort)) {
    return res.status(400).json({ error: "Trang hoặc bộ lọc đơn hàng chưa hợp lệ." });
  }
  const parsed = parseOrderFilters({
    status: status === "all" ? "" : status,
    fromDate: req.query.dateFrom,
    toDate: req.query.dateTo
  }, statuses.slice(1));
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const customerId = res.locals.customer.id;
  const term = search.trim().replace(/^#/, "");
  const pattern = "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
  const parameters = [customerId, ...orderFilterParameters(parsed.filters), term, pattern, pattern, pattern, pattern];
  const totalOrders = countCustomerOrders.get(...parameters).total;
  const totalPages = Math.max(1, Math.ceil(totalOrders / 10));
  const page = Math.min(Number(pageValue), totalPages);
  const query = sort === "oldest" ? customerOrdersOldest : customerOrdersNewest;
  const orders = query.all(...parameters, (page - 1) * 10)
    .map(customerOrderResponse);
  res.json({ orders, page, totalPages, totalOrders });
});

router.delete("/orders/:id", requireCustomer, requireCustomerContext, deleteOrderLimiter, (req, res) => {
  const id = req.params.id;
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
  const orderNumber = /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  if (!uuid && !orderNumber) {
    return res.status(400).json({ error: "Mã đơn hàng chưa hợp lệ.", field: "orderId" });
  }
  if (req.body?.expectedStatus !== "NEW") {
    return res.status(400).json({ error: "Chỉ có thể xóa đơn hàng ở trạng thái Mới.", field: "expectedStatus" });
  }
  const result = deleteCustomerOrder(uuid ? id.toLowerCase() : id, res.locals.customer.id);
  res.status(result.status).json(result.body);
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

  res.status(201).json(customerResponse(customer));
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
