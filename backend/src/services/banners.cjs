const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const bannerFields = `id, placement, title, description, image_url AS imageUrl, image_alt AS imageAlt,
  button_label AS buttonLabel, button_url AS buttonUrl, enabled, sort_order AS sortOrder, revision,
  creation_key AS creationKey`;
const publicBannersQuery = db.prepare(`
  SELECT ${bannerFields} FROM home_banners WHERE enabled = 1
    AND (? = 'all' OR placement = ? OR (? = 'side' AND placement IN ('left', 'right')))
  ORDER BY sort_order, id
`);
const adminBannersQuery = db.prepare(`
  SELECT ${bannerFields} FROM home_banners ORDER BY sort_order, id
`);
const bannerByIdQuery = db.prepare(`SELECT ${bannerFields} FROM home_banners WHERE id = ?`);
const bannerByCreationQuery = db.prepare(`SELECT ${bannerFields} FROM home_banners WHERE creation_key = ?`);
const createBannerQuery = db.prepare(`
  INSERT INTO home_banners (
    placement, title, description, image_url, image_alt, button_label, button_url,
    enabled, sort_order, creation_key
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${bannerFields}
`);
const updateBannerQuery = db.prepare(`
  UPDATE home_banners SET placement = ?, title = ?, description = ?, image_url = ?, image_alt = ?,
    button_label = ?, button_url = ?, enabled = ?, sort_order = ?, revision = revision + 1
  WHERE id = ? AND revision = ? AND revision < 9007199254740991
  RETURNING ${bannerFields}
`);
const deleteBannerQuery = db.prepare("DELETE FROM home_banners WHERE id = ? AND revision = ? RETURNING id");
const rememberDeletedCreationQuery = db.prepare(`
  INSERT INTO deleted_banner_requests (creation_key)
  SELECT creation_key FROM home_banners WHERE id = ? AND creation_key IS NOT NULL
  ON CONFLICT DO NOTHING
`);
const deletedCreationQuery = db.prepare("SELECT creation_key FROM deleted_banner_requests WHERE creation_key = ?");

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
  if (!["hero", "left", "right"].includes(body.placement)) {
    return { error: "Hãy chọn vị trí đầu trang, bên trái hoặc bên phải.", field: "placement" };
  }
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
    return { error: "Hãy chọn trạng thái hiển thị của quảng cáo.", field: "enabled" };
  }
  if (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 999) {
    return { error: "Thứ tự hiển thị cần là số nguyên từ 0 đến 999.", field: "sortOrder" };
  }
  return null;
}

function getPublicBanners(placement = "hero") {
  return publicBannersQuery.all(placement, placement, placement).map(banner => {
    const { creationKey, ...publicBanner } = bannerResponse(banner);
    return publicBanner;
  });
}

function getAdminBanners() {
  return adminBannersQuery.all().map(bannerResponse);
}

function updateBanner(id, body) {
  if (!Number.isSafeInteger(id) || id < 1) {
    return { status: 404, body: { error: "Không tìm thấy quảng cáo." } };
  }
  if (body.placement === undefined) {
    const current = bannerByIdQuery.get(id);
    if (!current) return { status: 404, body: { error: "Không tìm thấy quảng cáo." } };
    body = { ...body, placement: current.placement };
  }
  const validation = validateBanner(body);
  if (validation) return { status: 400, body: validation };
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: "Hãy tải lại quảng cáo trước khi chỉnh sửa.", field: "revision" } };
  }

  const updated = updateBannerQuery.get(
    body.placement, body.title.trim(), body.description.trim(), body.imageUrl.trim(), body.imageAlt.trim(),
    body.buttonLabel.trim(), body.buttonUrl.trim(), Number(body.enabled), body.sortOrder, id, body.revision
  );
  if (updated) return { status: 200, body: bannerResponse(updated) };

  const current = bannerByIdQuery.get(id);
  if (!current) return { status: 404, body: { error: "Không tìm thấy quảng cáo." } };
  return {
    status: 409,
    body: { error: "Quảng cáo đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp.", current: bannerResponse(current) }
  };
}

function createBanner(body) {
  const validation = validateBanner(body);
  if (validation) return { status: 400, body: validation };
  if (typeof body.creationKey !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(body.creationKey)) {
    return { status: 400, body: { error: "Mã tạo quảng cáo chưa hợp lệ. Hãy tải lại trang.", field: "creationKey" } };
  }

  return runTransaction(db, () => {
    if (deletedCreationQuery.get(body.creationKey)) {
      return { status: 409, body: { error: "Quảng cáo của lần tạo này đã được xoá. Hãy tạo một quảng cáo mới.", deleted: true } };
    }
    const current = bannerByCreationQuery.get(body.creationKey);
    if (current) {
      const currentBanner = bannerResponse(current);
      const expected = {
        placement: body.placement,
        title: body.title.trim(),
        description: body.description.trim(),
        imageUrl: body.imageUrl.trim(),
        imageAlt: body.imageAlt.trim(),
        buttonLabel: body.buttonLabel.trim(),
        buttonUrl: body.buttonUrl.trim(),
        enabled: body.enabled,
        sortOrder: body.sortOrder
      };
      const replay = Object.entries(expected).every(([field, value]) => currentBanner[field] === value);
      return replay
        ? { status: 200, body: currentBanner }
        : { status: 409, body: { error: "Lần tạo quảng cáo này đã có nội dung khác. Hãy tải lại danh sách.", current: currentBanner } };
    }
    const created = createBannerQuery.get(
      body.placement, body.title.trim(), body.description.trim(), body.imageUrl.trim(), body.imageAlt.trim(),
      body.buttonLabel.trim(), body.buttonUrl.trim(), Number(body.enabled), body.sortOrder, body.creationKey
    );
    return { status: 201, body: bannerResponse(created) };
  });
}

function deleteBanner(id, body) {
  if (!Number.isSafeInteger(id) || id < 1) {
    return { status: 404, body: { error: "Không tìm thấy quảng cáo." } };
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: "Hãy tải lại quảng cáo trước khi xoá.", field: "revision" } };
  }
  return runTransaction(db, () => {
    const current = bannerByIdQuery.get(id);
    if (!current) return { status: 200, body: { id, deleted: true } };
    if (current.revision !== body.revision) {
      return { status: 409, body: { error: "Quảng cáo đã được chỉnh sửa. Hãy tải lại trước khi xoá.", current: bannerResponse(current) } };
    }
    rememberDeletedCreationQuery.run(id);
    deleteBannerQuery.get(id, body.revision);
    return { status: 200, body: { id, deleted: true } };
  });
}

module.exports = { getPublicBanners, getAdminBanners, createBanner, updateBanner, deleteBanner };
