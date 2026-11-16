const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createHash, randomUUID } = require("node:crypto");
const { crc32 } = require("node:zlib");
const { publicDirectory } = require("../../config/paths.cjs");
const { getRuntime } = require("../runtime.cjs");

const maximumImageBytes = 5 * 1024 * 1024;
const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function validJpeg(data) {
  if (data.length < 12 || data.readUInt16BE(0) !== 0xffd8 ||
    data.readUInt16BE(data.length - 2) !== 0xffd9) return false;

  let offset = 2;
  let hasFrame = false;
  while (offset + 4 <= data.length) {
    if (data[offset++] !== 0xff) return false;
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0x01) continue;
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7) || offset + 2 > data.length) return false;

    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length - 2) return false;
    const isFrame = marker >= 0xc0 && marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (length < 11 || ![8, 12, 16].includes(data[offset + 2]) ||
        data.readUInt16BE(offset + 3) === 0 ||
        data.readUInt16BE(offset + 5) === 0 ||
        length !== 8 + 3 * data[offset + 7]) return false;
      hasFrame = true;
    }
    if (marker === 0xda) {
      return hasFrame && length >= 8 && length === 6 + 2 * data[offset + 2] &&
        offset + length < data.length - 2;
    }
    offset += length;
  }
  return false;
}

function validPng(data) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.length < 57 || !data.subarray(0, 8).equals(signature)) return false;

  let offset = 8;
  let hasImageData = false;
  let needsPalette = false;
  let hasPalette = false;
  const bitDepths = {
    0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8],
    4: [8, 16], 6: [8, 16]
  };
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > data.length || !/^[A-Za-z]{4}$/.test(type)) return false;
    if (crc32(data.subarray(offset + 4, end - 4)) !== data.readUInt32BE(end - 4)) return false;
    if (offset === 8 && type !== "IHDR") return false;
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13) return false;
      const width = data.readUInt32BE(offset + 8);
      const height = data.readUInt32BE(offset + 12);
      const depth = data[offset + 16];
      const color = data[offset + 17];
      if (width === 0 || height === 0 || width > 0x7fffffff || height > 0x7fffffff ||
        !bitDepths[color]?.includes(depth) || data[offset + 18] !== 0 ||
        data[offset + 19] !== 0 || data[offset + 20] > 1) return false;
      needsPalette = color === 3;
    }
    if (type === "PLTE") {
      if (hasImageData || length === 0 || length > 768 || length % 3 !== 0) return false;
      hasPalette = true;
    }
    if (type === "IDAT" && length > 0) hasImageData = true;
    if (type === "IEND") {
      return length === 0 && end === data.length && hasImageData &&
        (!needsPalette || hasPalette);
    }
    offset = end;
  }
  return false;
}

function validWebpFrame(type, data) {
  if (type === "VP8L") {
    return data.length > 5 && data[0] === 0x2f && (data[4] & 0xe0) === 0;
  }
  return type === "VP8 " && data.length > 10 && (data[0] & 1) === 0 &&
    data.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a])) &&
    (data.readUInt16LE(6) & 0x3fff) > 0 &&
    (data.readUInt16LE(8) & 0x3fff) > 0;
}

function validWebp(data) {
  if (data.length < 26 || data.toString("latin1", 0, 4) !== "RIFF" ||
    data.toString("latin1", 8, 12) !== "WEBP" ||
    data.readUInt32LE(4) !== data.length - 8) return false;

  let offset = 12;
  let hasFrame = false;
  while (offset + 8 <= data.length) {
    const type = data.toString("latin1", offset, offset + 4);
    const length = data.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end + (length % 2) > data.length) return false;
    const chunk = data.subarray(offset + 8, end);
    if (offset === 12 && !["VP8 ", "VP8L", "VP8X"].includes(type)) return false;
    if (type === "VP8X" && (offset !== 12 || length !== 10 ||
      (chunk[0] & 0xc1) !== 0 || chunk[1] !== 0 || chunk[2] !== 0 || chunk[3] !== 0)) return false;
    if (type === "VP8 " || type === "VP8L") {
      if (!validWebpFrame(type, chunk)) return false;
      hasFrame = true;
    }
    if (type === "ANMF") {
      if (length < 24) return false;
      let frameOffset = 16;
      let validFrame = false;
      while (frameOffset + 8 <= chunk.length) {
        const frameType = chunk.toString("latin1", frameOffset, frameOffset + 4);
        const frameLength = chunk.readUInt32LE(frameOffset + 4);
        const frameEnd = frameOffset + 8 + frameLength;
        if (frameEnd + (frameLength % 2) > chunk.length) return false;
        if (frameType === "VP8 " || frameType === "VP8L") {
          if (!validWebpFrame(frameType, chunk.subarray(frameOffset + 8, frameEnd))) return false;
          validFrame = true;
        }
        frameOffset = frameEnd + (frameLength % 2);
      }
      if (!validFrame || frameOffset !== chunk.length) return false;
      hasFrame = true;
    }
    offset = end + (length % 2);
  }
  return offset === data.length && hasFrame;
}

async function saveImageToFilesystem(uploadDirectory, filename, data) {
  const target = path.join(uploadDirectory, filename);
  const temporary = path.join(uploadDirectory, `.${filename}-${randomUUID()}.tmp`);
  await fs.mkdir(uploadDirectory, { recursive: true });
  let created = false;
  try {
    await fs.writeFile(temporary, data, { flag: "wx" });
    try {
      // Publish a fully written file without replacing a concurrent upload.
      await fs.link(temporary, target);
      created = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    await fs.unlink(temporary).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return created;
}

function createProductImageUpload({
  uploadDirectory = path.join(publicDirectory, "uploads", "products")
} = {}) {
  const readRawImage = express.raw({
    type: () => true,
    limit: maximumImageBytes,
    inflate: false
  });

  function readImage(req, res, next) {
    const contentType = (req.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!Object.hasOwn(imageExtensions, contentType)) {
      return res.status(415).json({ error: "Hãy chọn ảnh JPG, PNG hoặc WebP." });
    }
    res.locals.productImageType = contentType;
    readRawImage(req, res, error => {
      if (!error) return next();
      if (error.status === 413) {
        return res.status(413).json({ error: "Ảnh vượt quá 5 MiB. Hãy chọn ảnh nhỏ hơn." });
      }
      if (error.status === 415) {
        return res.status(415).json({ error: "Hãy gửi trực tiếp tệp ảnh JPG, PNG hoặc WebP." });
      }
      if (error.status === 400) {
        return res.status(400).json({ error: "Tệp ảnh gửi lên chưa đầy đủ. Hãy chọn lại ảnh." });
      }
      next(error);
    });
  }

  async function saveImage(req, res) {
    const data = req.body;
    const contentType = res.locals.productImageType;
    const validators = { "image/jpeg": validJpeg, "image/png": validPng, "image/webp": validWebp };
    // Check container headers and structure before keeping the original image bytes.
    if (!Buffer.isBuffer(data) || data.length === 0 || !validators[contentType](data)) {
      return res.status(400).json({ error: "Nội dung ảnh chưa hợp lệ. Hãy chọn lại ảnh JPG, PNG hoặc WebP." });
    }

    const hash = createHash("sha256").update(data).digest("hex");
    const filename = `${hash}.${imageExtensions[contentType]}`;
    const runtime = getRuntime();
    const created = runtime?.saveImage
      ? await runtime.saveImage(filename, data, contentType)
      : await saveImageToFilesystem(uploadDirectory, filename, data);

    res.status(created ? 201 : 200).json({ imageUrl: `/uploads/products/${filename}` });
  }

  return [readImage, saveImage];
}

module.exports = { createProductImageUpload };
