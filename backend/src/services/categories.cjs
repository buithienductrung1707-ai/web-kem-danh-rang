const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const DEFAULT_CATEGORY_ID = 1;
const fields = `id, slug, name, description, image_url AS imageUrl, image_alt AS imageAlt,
  enabled, sort_order AS sortOrder, revision, creation_key AS creationKey`;
const publicCategoriesQuery = db.prepare(`
  SELECT ${fields} FROM product_categories WHERE enabled = 1 ORDER BY sort_order, id
`);
const adminCategoriesQuery = db.prepare(`SELECT ${fields} FROM product_categories ORDER BY sort_order, id`);
const categoryByIdQuery = db.prepare(`SELECT ${fields} FROM product_categories WHERE id = ?`);
const categoryBySlugQuery = db.prepare(`SELECT id FROM product_categories WHERE slug = ?`);
const categoryByCreationQuery = db.prepare(`SELECT ${fields} FROM product_categories WHERE creation_key = ?`);
const productCountQuery = db.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ?");
const publicProductCountQuery = db.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ? AND active = 1");
const createCategoryQuery = db.prepare(`
  INSERT INTO product_categories (slug, name, description, image_url, image_alt, enabled, sort_order, creation_key)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${fields}
`);
const updateCategoryQuery = db.prepare(`
  UPDATE product_categories SET slug = ?, name = ?, description = ?, image_url = ?, image_alt = ?,
    enabled = ?, sort_order = ?, revision = revision + 1
  WHERE id = ? AND revision = ? AND revision < 9007199254740991 RETURNING ${fields}
`);
const deleteCategoryQuery = db.prepare("DELETE FROM product_categories WHERE id = ? AND revision = ? RETURNING id");
const deletedCreationQuery = db.prepare("SELECT creation_key FROM deleted_category_requests WHERE creation_key = ?");
const rememberDeletedCreationQuery = db.prepare(`
  INSERT INTO deleted_category_requests (creation_key)
  SELECT creation_key FROM product_categories WHERE id = ? AND creation_key IS NOT NULL
  ON CONFLICT DO NOTHING
`);

function categoryResponse(category, { publicView = false } = {}) {
  const result = {
    ...category,
    enabled: category.enabled === 1,
    productCount: (publicView ? publicProductCountQuery : productCountQuery).get(category.id).count,
    defaultCategory: category.id === DEFAULT_CATEGORY_ID
  };
  if (publicView) delete result.creationKey;
  return result;
}

function validImageUrl(value) {
  if (value === "") return true;
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value, "https://shop.invalid");
    if (url.username || url.password || /%(?:2f|5c|25|2e)/i.test(url.pathname)) return false;
    const path = decodeURIComponent(url.pathname);
    if (/[\\\u0000-\u001f\u007f]/.test(path) || /\.svgz?$/i.test(path)) return false;
    if (/^https:\/\//i.test(value)) return url.protocol === "https:";
    return value.startsWith("/") && !value.startsWith("//") &&
      (path === "/kem-danh-rang.jpg" || /^\/(?:assets|uploads\/products)\/.+\.(?:png|jpe?g|webp|gif|avif)$/i.test(path));
  } catch {
    return false;
  }
}

function validateCategory(body) {
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(body.name)) {
    return { error: "Tên danh mục cần có từ 1 đến 120 ký tự.", field: "name" };
  }
  if (typeof body.slug !== "string" || body.slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) {
    return { error: "Đường dẫn danh mục cần dùng chữ thường không dấu, số và dấu gạch ngang, tối đa 80 ký tự.", field: "slug" };
  }
  if (typeof body.description !== "string" || body.description.trim().length > 400 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.description)) {
    return { error: "Mô tả danh mục cần có tối đa 400 ký tự.", field: "description" };
  }
  if (typeof body.imageUrl !== "string" || body.imageUrl.trim().length > 2048 || !validImageUrl(body.imageUrl.trim())) {
    return { error: "Ảnh có thể để trống, dùng ảnh trong cửa hàng hoặc đường dẫn ảnh HTTPS hợp lệ.", field: "imageUrl" };
  }
  if (typeof body.imageAlt !== "string" || body.imageAlt.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(body.imageAlt)) {
    return { error: "Mô tả ảnh cần có tối đa 200 ký tự.", field: "imageAlt" };
  }
  if (typeof body.enabled !== "boolean") {
    return { error: "Hãy chọn trạng thái hiển thị của danh mục.", field: "enabled" };
  }
  if (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 999) {
    return { error: "Thứ tự danh mục cần là số nguyên từ 0 đến 999.", field: "sortOrder" };
  }
  return null;
}

function categoryValues(body) {
  return [body.slug, body.name.trim(), body.description.trim(), body.imageUrl.trim(),
    body.imageAlt.trim(), Number(body.enabled), body.sortOrder];
}

function categoryMatches(category, body) {
  return category.slug === body.slug && category.name === body.name.trim() &&
    category.description === body.description.trim() && category.imageUrl === body.imageUrl.trim() &&
    category.imageAlt === body.imageAlt.trim() && Boolean(category.enabled) === body.enabled &&
    category.sortOrder === body.sortOrder;
}

function getPublicCategories() {
  return publicCategoriesQuery.all().map(category => categoryResponse(category, { publicView: true }));
}

function getAdminCategories() {
  return adminCategoriesQuery.all().map(category => categoryResponse(category));
}

function categoryExists(id) {
  return Number.isSafeInteger(id) && id > 0 && Boolean(categoryByIdQuery.get(id));
}

function createCategory(body) {
  const validation = validateCategory(body);
  if (validation) return { status: 400, body: validation };
  if (typeof body.creationKey !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(body.creationKey)) {
    return { status: 400, body: { error: "Mã tạo danh mục chưa hợp lệ. Hãy tải lại trang.", field: "creationKey" } };
  }
  return runTransaction(db, () => {
    if (deletedCreationQuery.get(body.creationKey)) {
      return { status: 409, body: { error: "Danh mục của lần tạo này đã được xoá. Hãy tạo danh mục mới.", deleted: true } };
    }
    const current = categoryByCreationQuery.get(body.creationKey);
    if (current) {
      return categoryMatches(current, body)
        ? { status: 200, body: categoryResponse(current) }
        : { status: 409, body: { error: "Lần tạo danh mục này đã có nội dung khác. Hãy tải lại danh sách.", current: categoryResponse(current) } };
    }
    if (categoryBySlugQuery.get(body.slug)) {
      return { status: 409, body: { error: "Đường dẫn này đã được dùng cho một danh mục khác.", field: "slug" } };
    }
    const created = createCategoryQuery.get(...categoryValues(body), body.creationKey);
    return { status: 201, body: categoryResponse(created) };
  });
}

function updateCategory(id, body) {
  if (!Number.isSafeInteger(id) || id < 1) return { status: 404, body: { error: "Không tìm thấy danh mục." } };
  const validation = validateCategory(body);
  if (validation) return { status: 400, body: validation };
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: "Hãy tải lại danh mục trước khi chỉnh sửa.", field: "revision" } };
  }
  return runTransaction(db, () => {
    const current = categoryByIdQuery.get(id);
    if (!current) return { status: 404, body: { error: "Không tìm thấy danh mục." } };
    if (current.revision !== body.revision || current.revision === Number.MAX_SAFE_INTEGER) {
      return { status: 409, body: { error: "Danh mục đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp.", current: categoryResponse(current) } };
    }
    const sameSlug = categoryBySlugQuery.get(body.slug);
    if (sameSlug && sameSlug.id !== id) {
      return { status: 409, body: { error: "Đường dẫn này đã được dùng cho một danh mục khác.", field: "slug" } };
    }
    const updated = updateCategoryQuery.get(...categoryValues(body), id, body.revision);
    return { status: 200, body: categoryResponse(updated) };
  });
}

function deleteCategory(id, body) {
  if (!Number.isSafeInteger(id) || id < 1) return { status: 404, body: { error: "Không tìm thấy danh mục." } };
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: "Hãy tải lại danh mục trước khi xoá.", field: "revision" } };
  }
  return runTransaction(db, () => {
    const current = categoryByIdQuery.get(id);
    if (!current) return { status: 200, body: { id, deleted: true } };
    if (current.revision !== body.revision) {
      return { status: 409, body: { error: "Danh mục đã được chỉnh sửa. Hãy tải lại trước khi xoá.", current: categoryResponse(current) } };
    }
    if (id === DEFAULT_CATEGORY_ID) {
      return { status: 409, body: { error: "Danh mục mặc định được giữ cho sản phẩm cũ. Bạn có thể ẩn danh mục này.", current: categoryResponse(current) } };
    }
    if (productCountQuery.get(id).count > 0) {
      return { status: 409, body: { error: "Danh mục đang có sản phẩm. Hãy chuyển các sản phẩm sang danh mục khác trước khi xoá.", current: categoryResponse(current) } };
    }
    rememberDeletedCreationQuery.run(id);
    deleteCategoryQuery.get(id, body.revision);
    return { status: 200, body: { id, deleted: true } };
  });
}

module.exports = {
  DEFAULT_CATEGORY_ID, getPublicCategories, getAdminCategories, categoryExists,
  createCategory, updateCategory, deleteCategory
};
