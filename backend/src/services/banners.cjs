const db = require("../db/database.cjs");

const bannerFields = `id, title, description, image_url AS imageUrl, image_alt AS imageAlt,
  button_label AS buttonLabel, button_url AS buttonUrl, enabled, sort_order AS sortOrder, revision`;
const publicBannersQuery = db.prepare(`
  SELECT ${bannerFields} FROM home_banners WHERE enabled = 1 ORDER BY sort_order, id
`);
const adminBannersQuery = db.prepare(`
  SELECT ${bannerFields} FROM home_banners ORDER BY sort_order, id
`);
const bannerByIdQuery = db.prepare(`SELECT ${bannerFields} FROM home_banners WHERE id = ?`);
const updateBannerQuery = db.prepare(`
  UPDATE home_banners SET title = ?, description = ?, image_url = ?, image_alt = ?,
    button_label = ?, button_url = ?, enabled = ?, sort_order = ?, revision = revision + 1
  WHERE id = ? AND revision = ? AND revision < 9007199254740991
  RETURNING ${bannerFields}
`);

function bannerResponse(banner) {
  return { ...banner, enabled: banner.enabled === 1 };
}

function parseBannerUrl(value) {
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://shop.invalid");
    if (url.username || url.password ||
      /%(?:2f|5c|25|2e)/i.test(url.pathname) ||
      /[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(url.pathname))) return null;
    return url;
  } catch {
    return null;
  }
}

function validButtonUrl(value) {
  const url = parseBannerUrl(value);
  if (!url || url.origin !== "https://shop.invalid") return false;
  if (value.startsWith("#")) return value.length > 1;
  return value.startsWith("/") && !value.startsWith("//") && !url.pathname.startsWith("//");
}

function validImageUrl(value) {
  const url = parseBannerUrl(value);
  if (!url) return false;
  const imagePath = decodeURIComponent(url.pathname);
  if (/\.svgz?$/i.test(imagePath)) return false;
  if (/^https:\/\//i.test(value)) return url.protocol === "https:";
  return value.startsWith("/") && !value.startsWith("//") &&
    /^\/(?:assets|uploads\/products)\/.+\.(?:png|jpe?g|webp|gif|avif)$/i.test(imagePath);
}

function validateBanner(body) {
  if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.trim().length > 120) {
    return { error: "Tiêu đề cần có từ 1 đến 120 ký tự.", field: "title" };
  }
  if (typeof body.description !== "string" || body.description.trim().length > 400) {
    return { error: "Mô tả cần có tối đa 400 ký tự.", field: "description" };
  }
  if (typeof body.imageAlt !== "string" || body.imageAlt.trim().length < 1 || body.imageAlt.trim().length > 200) {
    return { error: "Mô tả ảnh cần có từ 1 đến 200 ký tự.", field: "imageAlt" };
  }
  if (typeof body.imageUrl !== "string" || body.imageUrl.trim().length > 2048 || !validImageUrl(body.imageUrl.trim())) {
    return { error: "Hãy dùng ảnh trong /assets/, /uploads/products/ hoặc đường dẫn ảnh HTTPS hợp lệ.", field: "imageUrl" };
  }
  if (typeof body.buttonLabel !== "string" || body.buttonLabel.trim().length > 60) {
    return { error: "Nhãn nút cần có tối đa 60 ký tự.", field: "buttonLabel" };
  }
  if (typeof body.buttonUrl !== "string" || body.buttonUrl.trim().length > 2048) {
    return { error: "Liên kết nút cần có tối đa 2048 ký tự.", field: "buttonUrl" };
  }
  const buttonLabel = body.buttonLabel.trim();
  const buttonUrl = body.buttonUrl.trim();
  if ((buttonLabel === "") !== (buttonUrl === "") || (buttonUrl !== "" && !validButtonUrl(buttonUrl))) {
    return { error: "Điền cả nhãn và liên kết nút trong cửa hàng, hoặc để trống cả hai để ẩn nút.", field: "buttonUrl" };
  }
  if (typeof body.enabled !== "boolean") {
    return { error: "Hãy chọn trạng thái hiển thị của banner.", field: "enabled" };
  }
  if (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 999) {
    return { error: "Thứ tự hiển thị cần là số nguyên từ 0 đến 999.", field: "sortOrder" };
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { error: "Hãy tải lại banner trước khi chỉnh sửa.", field: "revision" };
  }
  return null;
}

function getPublicBanners() {
  return publicBannersQuery.all().map(bannerResponse);
}

function getAdminBanners() {
  return adminBannersQuery.all().map(bannerResponse);
}

function updateBanner(id, body) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 3) {
    return { status: 404, body: { error: "Không tìm thấy banner." } };
  }
  const validation = validateBanner(body);
  if (validation) return { status: 400, body: validation };

  const updated = updateBannerQuery.get(
    body.title.trim(), body.description.trim(), body.imageUrl.trim(), body.imageAlt.trim(),
    body.buttonLabel.trim(), body.buttonUrl.trim(), Number(body.enabled), body.sortOrder, id, body.revision
  );
  if (updated) return { status: 200, body: bannerResponse(updated) };

  const current = bannerByIdQuery.get(id);
  if (!current) return { status: 404, body: { error: "Không tìm thấy banner." } };
  return {
    status: 409,
    body: { error: "Banner đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp.", current: bannerResponse(current) }
  };
}

module.exports = { getPublicBanners, getAdminBanners, updateBanner };
