const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  supportTokenHash, getCustomerMessages, getCustomerSummary, sendCustomerMessage
} = require("../services/support.cjs");

function requireSupportOrigin(req, res, next) {
  res.set("Cache-Control", "no-store");
  const origin = req.get("Origin");
  const ownOrigin = req.protocol + "://" + req.get("Host");
  const fetchSite = req.get("Sec-Fetch-Site");
  if ((origin && origin !== ownOrigin) ||
    (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) {
    return res.status(403).json({ error: "Hãy mở cửa sổ chăm sóc khách hàng từ website cửa hàng." });
  }
  next();
}

function createSupportLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Bạn đã thao tác nhiều lần. Hãy chờ một phút rồi thử lại." }
  });
}

function supportErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Tin nhắn gửi lên vượt quá kích thước cho phép." });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Dữ liệu tin nhắn gửi lên chưa hợp lệ." });
  }
  next(error);
}

const customerSupportRouter = express.Router();
customerSupportRouter.use(requireSupportOrigin);
customerSupportRouter.use((req, res, next) => {
  const tokenHash = supportTokenHash(req.get("Authorization"));
  if (!tokenHash) return res.status(401).json({ error: "Phiên trò chuyện chưa hợp lệ. Hãy tải lại trang." });
  res.locals.supportTokenHash = tokenHash;
  next();
});
customerSupportRouter.use(express.json({ limit: "16kb" }));

const customerReadLimiter = createSupportLimiter(120);

customerSupportRouter.get("/summary", customerReadLimiter, (req, res) => {
  const result = getCustomerSummary(res.locals.supportTokenHash, req.query.readAfter);
  res.status(result.status).json(result.body);
});

customerSupportRouter.get("/messages", customerReadLimiter, (req, res) => {
  const result = getCustomerMessages(res.locals.supportTokenHash, req.query.after);
  res.status(result.status).json(result.body);
});

customerSupportRouter.post("/messages", createSupportLimiter(10), (req, res) => {
  const result = sendCustomerMessage(res.locals.supportTokenHash, req.body);
  res.status(result.status).json(result.body);
});

customerSupportRouter.use(supportErrorHandler);

module.exports = {
  customerSupportRouter,
  requireSupportOrigin,
  createSupportLimiter,
  supportErrorHandler
};
