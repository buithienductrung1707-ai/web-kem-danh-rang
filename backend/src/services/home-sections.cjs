const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const sectionKeys = ["best-selling", "latest", "featured"];
const fields = `key, title, subtitle, enabled, mode, product_limit AS productLimit,
  product_ids AS productIdsJson, revision`;
const allSectionsQuery = db.prepare(`SELECT ${fields} FROM home_sections
  ORDER BY CASE key WHEN 'best-selling' THEN 0 WHEN 'latest' THEN 1 ELSE 2 END`);
const sectionQuery = db.prepare(`SELECT ${fields} FROM home_sections WHERE key = ?`);
const productCountQuery = db.prepare(`
  SELECT COUNT(*) AS total FROM products WHERE id IN (SELECT value FROM json_each(?))
`);
const publicProductsQuery = db.prepare(`
  SELECT p.id FROM products p JOIN product_categories c ON c.id = p.category_id
  WHERE p.active = 1 AND c.enabled = 1 AND p.id IN (SELECT value FROM json_each(?))
`);
const updateSectionQuery = db.prepare(`
  UPDATE home_sections SET title = ?, subtitle = ?, enabled = ?, mode = ?, product_limit = ?,
    product_ids = ?, revision = revision + 1
  WHERE key = ? AND revision = ? AND revision < 9007199254740991 RETURNING ${fields}
`);

function sectionResponse(section) {
  return {
    key: section.key,
    title: section.title,
    subtitle: section.subtitle,
    enabled: section.enabled === 1,
    mode: section.mode,
    limit: section.productLimit,
    productIds: JSON.parse(section.productIdsJson),
    revision: section.revision
  };
}

function getAdminHomeSections() {
  return allSectionsQuery.all().map(sectionResponse);
}

function getPublicHomeSections() {
  const sections = getAdminHomeSections();
  const manualIds = [...new Set(sections.filter(section => section.mode === "manual")
    .flatMap(section => section.productIds))];
  const publicIds = new Set(manualIds.length
    ? publicProductsQuery.all(JSON.stringify(manualIds)).map(product => product.id)
    : []);
  return sections.map(({ revision, ...section }) => ({
    ...section,
    productIds: section.mode === "manual" ? section.productIds.filter(id => publicIds.has(id)) : []
  }));
}

function validationError(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Hãy nhập cấu hình mục sản phẩm hợp lệ." };
  }
  if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(body.title)) {
    return { error: "Tiêu đề cần có từ 1 đến 120 ký tự.", field: "title" };
  }
  if (typeof body.subtitle !== "string" || body.subtitle.trim().length > 240 ||
    /[\u0000-\u001f\u007f]/.test(body.subtitle)) {
    return { error: "Mô tả cần có tối đa 240 ký tự.", field: "subtitle" };
  }
  if (typeof body.enabled !== "boolean") {
    return { error: "Hãy chọn trạng thái hiển thị của mục sản phẩm.", field: "enabled" };
  }
  if (!["auto", "manual"].includes(body.mode)) {
    return { error: "Hãy chọn sản phẩm tự động hoặc thủ công.", field: "mode" };
  }
  if (!Number.isSafeInteger(body.limit) || body.limit < 1 || body.limit > 12) {
    return { error: "Số sản phẩm hiển thị cần là số nguyên từ 1 đến 12.", field: "limit" };
  }
  if (!Array.isArray(body.productIds) || body.productIds.length > 12 ||
    !body.productIds.every(id => Number.isSafeInteger(id) && id > 0) ||
    new Set(body.productIds).size !== body.productIds.length) {
    return { error: "Hãy chọn tối đa 12 sản phẩm khác nhau.", field: "productIds" };
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { error: "Hãy tải lại mục sản phẩm trước khi lưu.", field: "revision" };
  }
  return null;
}

function updateHomeSection(key, body) {
  if (!sectionKeys.includes(key)) return { status: 404, body: { error: "Không tìm thấy mục sản phẩm." } };
  const validation = validationError(body);
  if (validation) return { status: 400, body: validation };
  const expected = {
    key, title: body.title.trim(), subtitle: body.subtitle.trim(), enabled: body.enabled,
    mode: body.mode, limit: body.limit, productIds: body.productIds
  };
  return runTransaction(db, () => {
    const section = sectionQuery.get(key);
    if (!section) return { status: 404, body: { error: "Không tìm thấy mục sản phẩm." } };
    if (productCountQuery.get(JSON.stringify(body.productIds)).total !== body.productIds.length) {
      return { status: 400, body: { error: "Có sản phẩm không còn tồn tại. Hãy tải lại danh sách.", field: "productIds" } };
    }
    const current = sectionResponse(section);
    if (Object.entries(expected).every(([field, value]) =>
      field === "productIds" ? JSON.stringify(current.productIds) === JSON.stringify(value) : current[field] === value)) {
      return { status: 200, body: current };
    }
    if (current.revision !== body.revision || current.revision === Number.MAX_SAFE_INTEGER) {
      return { status: 409, body: { error: "Mục sản phẩm đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp.", current } };
    }
    const updated = updateSectionQuery.get(expected.title, expected.subtitle, Number(expected.enabled),
      expected.mode, expected.limit, JSON.stringify(expected.productIds), key, body.revision);
    return updated
      ? { status: 200, body: sectionResponse(updated) }
      : { status: 409, body: { error: "Mục sản phẩm đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp." } };
  }, { rollbackIf: result => result.status >= 400 });
}

module.exports = { getPublicHomeSections, getAdminHomeSections, updateHomeSection };
