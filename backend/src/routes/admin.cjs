const express = require("express");
const session = require("express-session");
const { rateLimit } = require("express-rate-limit");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const db = require("../db/database.cjs");
const { getOrderItems, getOrderHistory, changeOrderStatus, deleteOrder } = require("../services/orders.cjs");
const { createProductImageUpload } = require("../services/product-images.cjs");
const { parseOrderFilters, orderFilterSql, orderFilterParameters } = require("../utils/order-filters.cjs");
const { ordersToCsv } = require("../utils/order-export.cjs");
const { getAdminBanners, createBanner, updateBanner, deleteBanner } = require("../services/banners.cjs");
const { outboxSummary, retryFailedEmails } = require("../services/email-outbox.cjs");
const { getSessionOptions } = require("../services/session-options.cjs");
const {
  getSupportConversations, getAdminMessages, sendAdminMessage
} = require("../services/support.cjs");
const {
  requireSupportOrigin, createSupportLimiter, supportErrorHandler
} = require("./support.cjs");

const router = express.Router();
const deriveKey = promisify(scrypt);
const dummySalt = randomBytes(16).toString("hex");

const cookieName = "shop-admin.sid";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: false,
  path: "/"
};

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  const origin = req.get("Origin");
  const ownOrigin = req.protocol + "://" + req.get("Host");

  if (origin && origin !== ownOrigin) {
    return res.status(403).json({
      error: "Hãy thao tác từ trang quản trị của cửa hàng."
    });
  }

  next();
});

router.use(session(getSessionOptions(cookieName, cookieOptions)));
router.use("/support", requireSupportOrigin, express.json({ limit: "16kb" }));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Bạn đã thử nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

const findAdminByUsername = db.prepare(`
  SELECT id, username, password_salt, password_hash
  FROM admins WHERE username = ?
`);

const findAdminById = db.prepare(`
  SELECT id, username FROM admins WHERE id = ?
`);

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== "string" ||
    username.trim().length === 0 ||
    username.length > 64 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error: "Hãy điền tên đăng nhập và mật khẩu hợp lệ."
    });
  }

  const admin = findAdminByUsername.get(username.trim());
  const salt = admin ? admin.password_salt : dummySalt;

  const actualHash = await deriveKey(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024
  });

  const expectedHash = admin
    ? Buffer.from(admin.password_hash, "hex")
    : Buffer.alloc(64);

  if (
    !admin ||
    expectedHash.length !== actualHash.length ||
    !timingSafeEqual(expectedHash, actualHash)
  ) {
    return res.status(401).json({
      error: "Tên đăng nhập hoặc mật khẩu chưa đúng."
    });
  }

  await promisify(req.session.regenerate).call(req.session);
  req.session.adminId = admin.id;
  await promisify(req.session.save).call(req.session);

  res.json({ id: admin.id, username: admin.username });
});

// Lấy thêm một đơn để xác định có trang tiếp theo sau 20 đơn đang hiển thị.
const recentOrdersQuery = db.prepare(`
  SELECT
    rowid AS cursor_rowid,
    id, CAST(order_number AS TEXT) AS orderNumber,
    customer_name, customer_phone, customer_address,
    product_id, product_name, quantity, unit_price, total,
    payment_method, status, created_at
  FROM orders
  WHERE ${orderFilterSql}
    AND (
      ? = 0 OR created_at < ? OR
      (created_at = ? AND rowid < ?)
    )
  ORDER BY created_at DESC, rowid DESC
  LIMIT 21
`);

function requireAdmin(req, res, next) {
  const admin = findAdminById.get(req.session.adminId ?? null);

  if (!admin) {
    return res.status(401).json({
      error: "Hãy đăng nhập quản trị."
    });
  }

  res.locals.admin = admin;
  next();
}

router.get("/me", requireAdmin, (req, res) => {
  res.json(res.locals.admin);
});

const supportReadLimiter = createSupportLimiter(120);
const supportWriteLimiter = createSupportLimiter(10);

router.get("/support/conversations", requireAdmin, supportReadLimiter, (req, res) => {
  res.json(getSupportConversations());
});

router.get("/support/conversations/:id/messages", requireAdmin, supportReadLimiter, (req, res) => {
  const result = getAdminMessages(req.params.id, req.query.after);
  res.status(result.status).json(result.body);
});

router.post("/support/conversations/:id/messages", requireAdmin, supportWriteLimiter, (req, res) => {
  const result = sendAdminMessage(req.params.id, req.body);
  res.status(result.status).json(result.body);
});

router.use("/support", supportErrorHandler);

router.get("/email-outbox", requireAdmin, (req, res) => {
  res.json(outboxSummary());
});

router.post("/email-outbox/retry", requireAdmin, (req, res) => {
  res.json({ queued: retryFailedEmails() });
});

router.post("/product-images", requireAdmin, ...createProductImageUpload());

router.get("/banners", requireAdmin, (req, res) => {
  res.json(getAdminBanners());
});

router.post("/banners", requireAdmin, (req, res) => {
  const result = createBanner(req.body || {});
  res.status(result.status).json(result.body);
});

router.patch("/banners/:id", requireAdmin, (req, res) => {
  const result = updateBanner(Number(req.params.id), req.body || {});
  res.status(result.status).json(result.body);
});

router.delete("/banners/:id", requireAdmin, (req, res) => {
  const result = deleteBanner(Number(req.params.id), req.body || {});
  res.status(result.status).json(result.body);
});

const orderTransitions = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

function getNextStatuses(status) {
  return Object.hasOwn(orderTransitions, status)
    ? orderTransitions[status]
    : [];
}

function adminOrder(order) {
  return {
    ...order,
    items: getOrderItems(order),
    history: getOrderHistory(order.id),
    nextStatuses: getNextStatuses(order.status)
  };
}

router.get("/orders", requireAdmin, (req, res) => {
  const { filters, error } = parseOrderFilters(req.query, Object.keys(orderTransitions));
  const cursor = req.query.cursor;

  if (error) {
    return res.status(400).json({ error });
  }

  if (cursor !== undefined && typeof cursor !== "string") {
    return res.status(400).json({
      error: "Mốc phân trang chưa hợp lệ."
    });
  }

  let boundary = null;

  if (cursor) {
    try {
      boundary = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

      if (
        !boundary ||
        typeof boundary.createdAt !== "string" ||
        !Number.isSafeInteger(boundary.rowid) ||
        boundary.rowid < 1
      ) {
        throw new Error("Mốc phân trang chưa hợp lệ");
      }
    } catch {
      return res.status(400).json({
        error: "Mốc phân trang chưa hợp lệ."
      });
    }
  }

  const rows = recentOrdersQuery.all(
    ...orderFilterParameters(filters),
    Number(boundary !== null),
    boundary?.createdAt ?? "",
    boundary?.createdAt ?? "",
    boundary?.rowid ?? 0
  );

  const pageRows = rows.slice(0, 20);
  const lastRow = pageRows.at(-1);
  const nextCursor = rows.length > 20
    ? Buffer.from(JSON.stringify({
        createdAt: lastRow.created_at,
        rowid: lastRow.cursor_rowid
      })).toString("base64url")
    : null;

  const orders = pageRows.map(({ cursor_rowid, ...order }) => adminOrder(order));

  if (cursor === undefined) {
    return res.json(orders);
  }

  res.json({ orders, nextCursor });
});

const orderSummaryQuery = db.prepare(`
  SELECT
    COUNT(*) AS total,
    COUNT(CASE WHEN status = 'NEW' THEN 1 END) AS newCount,
    COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) AS confirmedCount,
    COUNT(CASE WHEN status = 'SHIPPING' THEN 1 END) AS shippingCount,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completedCount,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelledCount,
    COUNT(CASE WHEN status NOT IN (
      'NEW', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'
    ) THEN 1 END) AS otherCount
  FROM orders
`);

router.get("/orders/summary", requireAdmin, (req, res) => {
  res.json(orderSummaryQuery.get());
});

const exportOrdersQuery = db.prepare(`
  SELECT id, CAST(order_number AS TEXT) AS orderNumber,
    customer_name, customer_phone, customer_address,
    product_id, product_name, quantity, unit_price, total,
    payment_method, status, created_at, datetime(created_at) AS created_at_utc
  FROM orders
  WHERE ${orderFilterSql}
  ORDER BY created_at DESC, rowid DESC
`);

router.get("/orders/export.csv", requireAdmin, (req, res) => {
  const { filters, error } = parseOrderFilters(req.query, Object.keys(orderTransitions));
  if (error) return res.status(400).json({ error });

  const csv = ordersToCsv(exportOrdersQuery.all(...orderFilterParameters(filters)));
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="don-hang.csv"',
    "X-Content-Type-Options": "nosniff"
  });
  res.send(csv);
});

const orderByIdQuery = db.prepare(`
  SELECT id, CAST(order_number AS TEXT) AS orderNumber,
    customer_name, customer_phone, customer_address,
    product_id, product_name, quantity, unit_price, total,
    payment_method, status, created_at
  FROM orders WHERE id = ? OR CAST(order_number AS TEXT) = ?
`);

router.get("/orders/:id", requireAdmin, (req, res) => {
  const order = orderByIdQuery.get(req.params.id, req.params.id);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  res.json(adminOrder(order));
});

router.delete("/orders/:id", requireAdmin, (req, res) => {
  const { expectedStatus } = req.body || {};

  if (typeof expectedStatus !== "string") {
    return res.status(400).json({ error: "Hãy tải lại đơn hàng trước khi xóa." });
  }

  const result = deleteOrder(req.params.id, expectedStatus);
  res.status(result.status).json(result.body);
});

router.patch("/orders/:id/status", requireAdmin, (req, res) => {
  const { expectedStatus, targetStatus } = req.body || {};

  if (
    typeof expectedStatus !== "string" ||
    typeof targetStatus !== "string" ||
    !getNextStatuses(expectedStatus).includes(targetStatus)
  ) {
    return res.status(400).json({
      error: "Bước chuyển trạng thái chưa hợp lệ."
    });
  }

  const result = changeOrderStatus(
    req.params.id,
    expectedStatus,
    targetStatus,
    res.locals.admin.id
  );
  res.status(result.status).json(result.body);
});

const managedProductQuery = db.prepare(`
  SELECT id, name, price
  FROM products
  WHERE id = 1
`);

const updateProductQuery = db.prepare(`
  UPDATE products
  SET name = ?, price = ?, revision = revision + 1
  WHERE id = 1 AND name = ? AND price = ? AND revision < 9007199254740991
  RETURNING id, name, price
`);

router.get("/product", requireAdmin, (req, res) => {
  const product = managedProductQuery.get();

  if (!product) {
    return res.status(404).json({
      error: "Sản phẩm chưa có trong cửa hàng."
    });
  }

  res.json(product);
});

router.patch("/product", requireAdmin, (req, res) => {
  const { name, price, expectedName, expectedPrice } = req.body || {};

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 200 ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    typeof expectedName !== "string" ||
    !Number.isSafeInteger(expectedPrice) ||
    expectedPrice < 0
  ) {
    return res.status(400).json({
      error: "Tên sản phẩm cần có từ 1 đến 200 ký tự và giá là số nguyên từ 0."
    });
  }

  const newName = name.trim();

  const updated = updateProductQuery.get(
    newName,
    price,
    expectedName,
    expectedPrice
  );

  if (updated) {
    return res.json(updated);
  }

  const current = managedProductQuery.get();

  if (!current) {
    return res.status(404).json({
      error: "Sản phẩm chưa có trong cửa hàng."
    });
  }

  if (current.name === newName && current.price === price) {
    return res.json(current);
  }

  res.status(409).json({
    error: "Thông tin sản phẩm đã thay đổi."
  });
});

const productFields = `id, name, price, description, image_url AS imageUrl, active, revision,
  stock_tracked AS stockTracked, stock_quantity AS stockQuantity`;
const allProductsQuery = db.prepare(`SELECT ${productFields} FROM products ORDER BY id`);
const productByIdQuery = db.prepare(`SELECT ${productFields} FROM products WHERE id = ?`);
const productByCreationQuery = db.prepare(`SELECT ${productFields} FROM products WHERE creation_key = ?`);
const createProductQuery = db.prepare(`
  INSERT INTO products (
    name, price, description, image_url, active, creation_key, stock_tracked, stock_quantity
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
  RETURNING ${productFields}
`);
const editProductQuery = db.prepare(`
  UPDATE products SET name = ?, price = ?, description = ?, image_url = ?,
    active = ?, stock_tracked = COALESCE(?, stock_tracked),
    stock_quantity = COALESCE(?, stock_quantity), revision = revision + 1
  WHERE id = ? AND revision = ? AND revision < 9007199254740991
  RETURNING ${productFields}
`);

function productData(body) {
  if (typeof body.name !== "string" || body.name.trim().length === 0 ||
    body.name.trim().length > 200 || !Number.isSafeInteger(body.price) || body.price < 0 ||
    typeof body.description !== "string" || body.description.trim().length > 2000 ||
    typeof body.imageUrl !== "string" || body.imageUrl.trim().length > 2048 ||
    typeof body.active !== "boolean" ||
    (body.stockTracked !== undefined && typeof body.stockTracked !== "boolean") ||
    (body.stockQuantity !== undefined &&
      (!Number.isSafeInteger(body.stockQuantity) || body.stockQuantity < 0))) return null;

  const imageUrl = body.imageUrl.trim();
  if (imageUrl !== "") {
    try {
      const url = new URL(imageUrl, "http://localhost");
      const relative = imageUrl.startsWith("/") && !imageUrl.startsWith("//");
      const absolute = /^https?:\/\//i.test(imageUrl);
      if ((!relative && !absolute) || imageUrl.includes("\\") ||
        !["http:", "https:"].includes(url.protocol)) return null;
    } catch {
      return null;
    }
  }

  return {
    name: body.name.trim(), price: body.price,
    description: body.description.trim(), imageUrl, active: body.active,
    stockTracked: body.stockTracked, stockQuantity: body.stockQuantity
  };
}

function productMatches(product, data) {
  return product.name === data.name && product.price === data.price &&
    product.description === data.description && product.imageUrl === data.imageUrl &&
    Boolean(product.active) === data.active &&
    (data.stockTracked === undefined || Boolean(product.stockTracked) === data.stockTracked) &&
    (data.stockQuantity === undefined || product.stockQuantity === data.stockQuantity);
}

function productResponse(product) {
  return { ...product, active: product.active === 1, stockTracked: product.stockTracked === 1 };
}

router.get("/products", requireAdmin, (req, res) => {
  res.json(allProductsQuery.all().map(productResponse));
});

router.post("/products", requireAdmin, (req, res) => {
  const body = req.body || {};
  const data = productData(body);
  if (!data || typeof body.requestId !== "string" || body.requestId.trim() === "") {
    return res.status(400).json({
      error: "Kiểm tra tên, giá, mô tả và đường dẫn ảnh. Ảnh có thể để trống hoặc dùng đường dẫn / hay http(s)."
    });
  }

  const key = body.requestId.trim();
  data.stockTracked ??= false;
  data.stockQuantity ??= 0;
  const created = createProductQuery.get(data.name, data.price, data.description,
    data.imageUrl, Number(data.active), key, Number(data.stockTracked), data.stockQuantity);
  if (created) return res.status(201).json(productResponse(created));

  const existing = productByCreationQuery.get(key);
  if (existing && productMatches(existing, data)) {
    return res.json(productResponse(existing));
  }

  res.status(409).json({ error: "Lần thêm này đã được xử lý. Hãy tải lại danh sách sản phẩm." });
});

router.patch("/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const data = productData(body);
  if (!data || !Number.isSafeInteger(id) || id < 1 ||
    !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    return res.status(400).json({ error: "Thông tin sản phẩm hoặc phiên bản chỉnh sửa chưa hợp lệ." });
  }

  const updated = editProductQuery.get(data.name, data.price, data.description,
    data.imageUrl, Number(data.active),
    data.stockTracked === undefined ? null : Number(data.stockTracked),
    data.stockQuantity ?? null, id, body.expectedRevision);
  if (updated) return res.json(productResponse(updated));

  const current = productByIdQuery.get(id);
  if (!current) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  if (productMatches(current, data)) return res.json(productResponse(current));

  res.status(409).json({ error: "Sản phẩm đã được sửa ở nơi khác. Hãy tải lại trước khi chỉnh sửa tiếp." });
});

router.post("/logout", async (req, res) => {
  await promisify(req.session.destroy).call(req.session);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ message: "Đã đăng xuất." });
});

router.use((error, req, res, next) => {
  console.error("API quản trị gặp lỗi", error.message);

  if (res.headersSent) return next(error);

  res.status(500).json({
    error: "Máy chủ gặp lỗi. Hãy thử lại."
  });
});

module.exports = router;
