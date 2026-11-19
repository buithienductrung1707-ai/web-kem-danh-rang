const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const productQuery = db.prepare("SELECT id FROM products WHERE id = ? AND active = 1");
const purchaseQuery = db.prepare(`
  SELECT 1 AS purchased FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.customer_id = ? AND o.status = 'COMPLETED' AND i.product_id = ? LIMIT 1
`);
const soldQuery = db.prepare(`
  SELECT COALESCE(SUM(i.quantity), 0) AS soldCount
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'COMPLETED' AND i.product_id = ?
`);
const fields = `r.id, r.rating, r.comment, r.verified_purchase AS verifiedPurchase,
  r.revision, r.last_request_id AS lastRequestId, r.last_request_payload AS lastRequestPayload,
  r.created_at AS createdAt, r.updated_at AS updatedAt, c.name AS customerName`;
const ownQuery = db.prepare(`
  SELECT ${fields} FROM product_reviews r JOIN customers c ON c.id = r.customer_id
  WHERE r.customer_id = ? AND r.product_id = ?
`);
const summaryQuery = db.prepare(`
  SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average,
    COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0) AS star1,
    COALESCE(SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END), 0) AS star2,
    COALESCE(SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END), 0) AS star3,
    COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0) AS star4,
    COALESCE(SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END), 0) AS star5,
    COALESCE(SUM(CASE WHEN trim(comment) <> '' THEN 1 ELSE 0 END), 0) AS commentCount
  FROM product_reviews WHERE product_id = ?
`);
const filterSql = `r.product_id = ? AND (? = 0 OR r.rating = ?)
  AND (? = 0 OR trim(r.comment) <> '')`;
const countQuery = db.prepare(`SELECT COUNT(*) AS total FROM product_reviews r WHERE ${filterSql}`);
const newestQuery = db.prepare(`
  SELECT ${fields} FROM product_reviews r JOIN customers c ON c.id = r.customer_id
  WHERE ${filterSql} ORDER BY r.created_at DESC, r.id DESC LIMIT 10 OFFSET ?
`);
const oldestQuery = db.prepare(`
  SELECT ${fields} FROM product_reviews r JOIN customers c ON c.id = r.customer_id
  WHERE ${filterSql} ORDER BY r.created_at ASC, r.id ASC LIMIT 10 OFFSET ?
`);
const insertQuery = db.prepare(`
  INSERT INTO product_reviews (product_id, customer_id, rating, comment, last_request_id,
    last_request_payload, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateQuery = db.prepare(`
  UPDATE product_reviews SET rating = ?, comment = ?, last_request_id = ?, last_request_payload = ?,
    updated_at = ?, revision = revision + 1
  WHERE customer_id = ? AND product_id = ? AND revision = ? AND revision < 9007199254740991
  RETURNING id
`);

function productId(value) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value) : null;
}

function reviewResponse(review, own = false) {
  if (!review) return null;
  const parts = review.customerName.trim().split(/\s+/);
  const displayName = (parts.length > 1 ? parts[0] + " " + parts.at(-1) : parts[0]).slice(0, 120);
  return {
    id: review.id, rating: review.rating, comment: review.comment, displayName,
    createdAt: review.createdAt, updatedAt: review.updatedAt, verifiedPurchase: review.verifiedPurchase === 1,
    ...(own ? { revision: review.revision } : {})
  };
}

function getReviewSummary(id) {
  const row = summaryQuery.get(id);
  return {
    average: Math.round(row.average * 10) / 10, count: row.count,
    distribution: { 1: row.star1, 2: row.star2, 3: row.star3, 4: row.star4, 5: row.star5 },
    commentCount: row.commentCount
  };
}

function getProductReviewStats(id) {
  return { soldCount: soldQuery.get(id).soldCount, reviewSummary: getReviewSummary(id) };
}

function missingProduct() {
  return { status: 404, body: { error: "Không tìm thấy sản phẩm." } };
}

function getPublicReviews(id, query = {}) {
  if (!id || !productQuery.get(id)) return missingProduct();
  const rating = query.rating ?? "all";
  const comments = query.comments ?? "0";
  const sort = query.sort ?? "newest";
  const pageValue = query.page ?? "1";
  if (typeof rating !== "string" || !["all", "1", "2", "3", "4", "5"].includes(rating) ||
    typeof comments !== "string" || !["0", "1"].includes(comments) ||
    typeof sort !== "string" || !["newest", "oldest"].includes(sort) ||
    typeof pageValue !== "string" || !/^[1-9]\d*$/.test(pageValue) ||
    !Number.isSafeInteger(Number(pageValue))) {
    return { status: 400, body: { error: "Bộ lọc đánh giá chưa hợp lệ." } };
  }
  const number = rating === "all" ? 0 : Number(rating);
  const parameters = [id, number, number, Number(comments)];
  const totalReviews = countQuery.get(...parameters).total;
  const totalPages = Math.max(1, Math.ceil(totalReviews / 10));
  const page = Math.min(Number(pageValue), totalPages);
  const rows = (sort === "oldest" ? oldestQuery : newestQuery).all(...parameters, (page - 1) * 10);
  return {
    status: 200,
    body: { summary: getReviewSummary(id), reviews: rows.map(row => reviewResponse(row)),
      page, totalPages, totalReviews }
  };
}

function getOwnReview(customerId, id) {
  if (!id || !productQuery.get(id)) return missingProduct();
  return { status: 200, body: { customerId, canReview: Boolean(purchaseQuery.get(customerId, id)),
    review: reviewResponse(ownQuery.get(customerId, id), true) } };
}

function saveReview(customerId, id, body) {
  if (!id || !productQuery.get(id)) return missingProduct();
  if (!body || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return { status: 400, body: { error: "Hãy chọn từ 1 đến 5 sao.", field: "rating" } };
  }
  if (typeof body.comment !== "string" || body.comment.trim().length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.comment)) {
    return { status: 400, body: { error: "Nội dung đánh giá cần có tối đa 2.000 ký tự.", field: "comment" } };
  }
  if (typeof body.requestId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(body.requestId)) {
    return { status: 400, body: { error: "Mã gửi đánh giá chưa hợp lệ. Hãy tải lại trang.", field: "requestId" } };
  }
  if (body.revision !== undefined && (!Number.isSafeInteger(body.revision) || body.revision < 0)) {
    return { status: 400, body: { error: "Phiên bản đánh giá chưa hợp lệ.", field: "revision" } };
  }
  const comment = body.comment.trim();
  const payload = JSON.stringify({ rating: body.rating, comment, revision: body.revision ?? null });
  return runTransaction(db, () => {
    if (!productQuery.get(id)) return missingProduct();
    const current = ownQuery.get(customerId, id);
    if (current?.lastRequestId === body.requestId) {
      if (current.lastRequestPayload !== payload) {
        return { status: 409, body: { error: "Lần gửi này đã có nội dung khác. Hãy tải lại đánh giá.",
          review: reviewResponse(current, true) } };
      }
      return { status: 200, body: { customerId, review: reviewResponse(current, true), summary: getReviewSummary(id) } };
    }
    if (!purchaseQuery.get(customerId, id)) {
      return { status: 403, body: { error: "Bạn có thể đánh giá sau khi đơn mua sản phẩm này đã hoàn thành." } };
    }
    if (current ? body.revision !== current.revision : body.revision !== undefined) {
      return { status: 409, body: { error: "Đánh giá vừa thay đổi. Hãy tải lại trước khi lưu tiếp.",
        review: reviewResponse(current, true) } };
    }
    const now = new Date().toISOString();
    if (current) {
      const updated = updateQuery.get(body.rating, comment, body.requestId, payload, now, customerId, id, body.revision);
      if (!updated) return { status: 409, body: { error: "Chưa cập nhật được đánh giá. Hãy tải lại.",
        review: reviewResponse(ownQuery.get(customerId, id), true) } };
    } else {
      insertQuery.run(id, customerId, body.rating, comment, body.requestId, payload, now, now);
    }
    return { status: current ? 200 : 201, body: { customerId,
      review: reviewResponse(ownQuery.get(customerId, id), true), summary: getReviewSummary(id) } };
  });
}

module.exports = { productId, getProductReviewStats, getPublicReviews, getOwnReview, saveReview };
