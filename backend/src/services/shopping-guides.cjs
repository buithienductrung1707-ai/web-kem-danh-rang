const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const guideKeys = ["buying", "unboxing"];
const fields = "key, video_url AS videoUrl, revision";
const guidesQuery = db.prepare(`SELECT ${fields} FROM shopping_guides
  ORDER BY CASE key WHEN 'buying' THEN 0 ELSE 1 END`);
const guideQuery = db.prepare(`SELECT ${fields} FROM shopping_guides WHERE key = ?`);
const updateGuideQuery = db.prepare(`
  UPDATE shopping_guides SET video_url = ?, revision = revision + 1
  WHERE key = ? AND revision = ? AND revision < 9007199254740991 RETURNING ${fields}
`);

function normalizedVideoUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/[\s\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com"];
  const noCookieHosts = ["youtube-nocookie.com", "www.youtube-nocookie.com"];
  let videoId;
  if (url.hostname === "youtu.be") {
    videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (youtubeHosts.includes(url.hostname)) {
    videoId = url.pathname === "/watch" && url.searchParams.getAll("v").length === 1
      ? url.searchParams.get("v")
      : /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (noCookieHosts.includes(url.hostname)) {
    videoId = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (/\.mp4$/i.test(url.pathname)) {
    url.hash = "";
    return url.href.length <= 2048 ? url.href : null;
  }
  return /^[A-Za-z0-9_-]{11}$/.test(videoId || "")
    ? "https://www.youtube.com/watch?v=" + videoId
    : null;
}

function getShoppingGuides() {
  return guidesQuery.all();
}

function updateShoppingGuide(key, body) {
  if (!guideKeys.includes(key)) return { status: 404, body: { error: "Không tìm thấy mục hướng dẫn." } };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, body: { error: "Hãy nhập thông tin video hợp lệ." } };
  }
  const videoUrl = normalizedVideoUrl(body.videoUrl);
  if (videoUrl === null) {
    return { status: 400, body: {
      error: "Dùng đường dẫn YouTube hoặc video MP4 qua HTTPS, tối đa 2048 ký tự. Để trống để gỡ video.",
      field: "videoUrl"
    } };
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: "Hãy tải lại mục hướng dẫn trước khi lưu.", field: "revision" } };
  }
  return runTransaction(db, () => {
    const current = guideQuery.get(key);
    if (!current) return { status: 404, body: { error: "Không tìm thấy mục hướng dẫn." } };
    if (current.videoUrl === videoUrl) return { status: 200, body: current };
    if (current.revision !== body.revision || current.revision === Number.MAX_SAFE_INTEGER) {
      return { status: 409, body: { error: "Video đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp.", current } };
    }
    const updated = updateGuideQuery.get(videoUrl, key, body.revision);
    return updated
      ? { status: 200, body: updated }
      : { status: 409, body: { error: "Video đã được chỉnh sửa. Hãy tải lại trước khi lưu tiếp." } };
  }, { rollbackIf: result => result.status >= 400 });
}

module.exports = { getShoppingGuides, updateShoppingGuide };
