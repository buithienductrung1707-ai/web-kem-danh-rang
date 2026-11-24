const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();
const unavailable = { available: false, message: "Mã không khả dụng." };

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/", (req, res) => {
  // No offers have been configured. Do not advertise example codes as usable discounts.
  res.json([]);
});

const validationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    available: false,
    message: "Bạn đã kiểm tra nhiều lần. Hãy chờ một phút rồi thử lại.",
    error: "Bạn đã kiểm tra nhiều lần. Hãy chờ một phút rồi thử lại."
  }
});

router.post("/validate", (req, res, next) => {
  const origin = req.get("Origin");
  const ownOrigin = req.protocol + "://" + req.get("Host");
  if ((origin && origin !== ownOrigin) || req.get("Sec-Fetch-Site") === "cross-site") {
    return res.status(403).json({
      available: false,
      message: "Hãy kiểm tra mã từ website của cửa hàng.",
      error: "Hãy kiểm tra mã từ website của cửa hàng."
    });
  }
  next();
}, validationLimiter, express.json({ limit: "2kb" }), (req, res) => {
  const body = req.body;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!body || typeof body !== "object" || Array.isArray(body)
      || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
    return res.status(400).json(unavailable);
  }
  // Validation does not change checkout totals. A usable offer needs server-side
  // order pricing and an explicit shop promotion before it can become available.
  return res.json(unavailable);
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (["entity.parse.failed", "entity.too.large"].includes(error.type)) {
    return res.status(error.type === "entity.too.large" ? 413 : 400).json(unavailable);
  }
  next(error);
});

module.exports = router;
