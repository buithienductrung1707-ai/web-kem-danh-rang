const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { publicDirectory } = require("../config/paths.cjs");
const db = require("./db/database.cjs");
const adminRouter = require("./routes/admin.cjs");
const accountRouter = require("./routes/account.cjs");
const { createOrder, getOrderItems, getOrderHistory } = require("./services/orders.cjs");
const { getPublicBanners } = require("./services/banners.cjs");
const { getRuntime } = require("./runtime.cjs");

const app = express();
if (getRuntime()) app.set("trust proxy", 1);

app.use("/api/account", accountRouter);
app.use(["/api/banners", "/api/admin/banners", "/api/orders"], (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({
  type: req => !/^\/api\/admin\/product-images\/?$/i.test(req.path) && req.is("application/json")
}));
app.use("/api/admin", adminRouter);

const productsQuery = db.prepare(`
  SELECT id, name, price, description, image_url AS imageUrl,
    stock_tracked AS stockTracked, stock_quantity AS stockQuantity
  FROM products
  WHERE active = 1
  ORDER BY id
`);

const trackedOrderQuery = db.prepare(`
  SELECT *
  FROM orders
  WHERE (id = ? OR CAST(order_number AS TEXT) = ?) AND customer_phone = ?
`);

app.get("/api/products", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(productsQuery.all().map(product => ({
    ...product,
    stockTracked: product.stockTracked === 1
  })));
});

app.get("/api/banners", (req, res) => {
  res.set("Cache-Control", "no-store");
  const placement = req.query.placement ?? "hero";
  if (!["hero", "side", "all", "left", "right"].includes(placement)) {
    return res.status(400).json({ error: "Vị trí quảng cáo chưa hợp lệ." });
  }
  res.json(getPublicBanners(placement));
});

app.get("/api/payment-options", (req, res) => {
  res.set("Cache-Control", "no-store");
  const bankTransfer = {
    bankName: (process.env.SHOP_BANK_NAME || "").trim(),
    accountNumber: (process.env.SHOP_BANK_ACCOUNT_NUMBER || "").trim(),
    accountHolder: (process.env.SHOP_BANK_ACCOUNT_HOLDER || "").trim()
  };
  const configured = Object.values(bankTransfer).every(value =>
    value !== "" && !/[\u0000-\u001f\u007f]/.test(value)) &&
    bankTransfer.bankName.length <= 120 && bankTransfer.accountNumber.length <= 64 &&
    bankTransfer.accountHolder.length <= 120;
  res.json({ bankTransfer: configured ? bankTransfer : null });
});

app.post("/api/orders", ...accountRouter.orderContext, (req, res) => {
  res.set("Cache-Control", "no-store");
  const result = createOrder(req.body || {}, {
    customerId: res.locals.orderCustomerId,
    expectedCustomerId: req.get("X-Customer-Id")
  });
  res.status(result.status).json(result.body);
});

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Bạn đã tra cứu nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

app.post(
  "/api/orders/track",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  trackingLimiter,
  (req, res) => {
    const { orderId, customerPhone } = req.body || {};

    if (
      typeof orderId !== "string" ||
      orderId.trim() === "" ||
      typeof customerPhone !== "string" ||
      customerPhone.trim() === ""
    ) {
      return res.status(400).json({
        error: "Hãy nhập mã đơn hàng và số điện thoại nhận hàng."
      });
    }

    const order = trackedOrderQuery.get(orderId.trim(), orderId.trim(), customerPhone.trim());

    if (!order) {
      return res.status(404).json({
        error: "Thông tin tra cứu chưa khớp. Hãy kiểm tra mã đơn và số điện thoại."
      });
    }

    res.json({
      orderId: order.id,
      ...(order.order_number == null ? {} : { orderNumber: String(order.order_number) }),
      productName: order.product_name,
      quantity: order.quantity,
      unitPrice: order.unit_price,
      total: order.total,
      items: getOrderItems(order),
      history: getOrderHistory(order.id),
      paymentMethod: order.payment_method,
      status: order.status,
      createdAt: order.created_at
    });
  }
);

app.use("/uploads/products", (req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
if (!getRuntime()) app.use(express.static(publicDirectory));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === "entity.parse.failed" ? 400 : 500;
  if (status === 500) console.error("API cửa hàng gặp lỗi", error.message);
  res.status(status).json({
    error: status === 400 ? "Dữ liệu gửi lên chưa hợp lệ." : "Máy chủ gặp lỗi. Hãy thử lại."
  });
});

module.exports = app;
