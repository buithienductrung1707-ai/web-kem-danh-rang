function validProductImageUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value, "http://localhost");
    const relative = value.startsWith("/") && !value.startsWith("//");
    const absolute = /^https?:\/\//i.test(value);
    return (relative || absolute) && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function galleryImagesData(value, primaryImage) {
  if (!Array.isArray(value) || value.length > 7) return null;
  const images = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const image = entry.trim();
    if (image === "" || !validProductImageUrl(image)) return null;
    if (image !== primaryImage && !images.includes(image)) images.push(image);
  }
  return images;
}

function specificationsData(value) {
  if (!Array.isArray(value) || value.length > 12) return null;
  const specifications = [];
  for (const entry of value) {
    if (!entry || typeof entry.label !== "string" || typeof entry.value !== "string" ||
      /[\u0000-\u001f\u007f]/.test(entry.label + entry.value)) return null;
    const label = entry.label.trim();
    const text = entry.value.trim();
    if (label === "" || label.length > 60 || text === "" || text.length > 200) return null;
    specifications.push({ label, value: text });
  }
  return specifications;
}

function productDetailsData(body) {
  const data = {};
  if (body.detailedDescription !== undefined) {
    if (typeof body.detailedDescription !== "string" || body.detailedDescription.trim().length > 12000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.detailedDescription)) return null;
    data.detailedDescription = body.detailedDescription.trim();
  }
  if (body.galleryImages !== undefined) {
    data.galleryImages = galleryImagesData(body.galleryImages, body.imageUrl?.trim());
    if (data.galleryImages === null) return null;
  }
  if (body.specifications !== undefined) {
    data.specifications = specificationsData(body.specifications);
    if (data.specifications === null) return null;
  }
  return data;
}

function storedArray(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function productBrand(value) {
  const specifications = specificationsData(storedArray(value)) ?? [];
  const entry = specifications.find(item => ["thuong hieu", "brand"].includes(
    item.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  ));
  return entry?.value ?? "";
}

function productDetailsResponse(product) {
  const { galleryImagesJson, specificationsJson, ...fields } = product;
  return {
    ...fields,
    detailedDescription: typeof product.detailedDescription === "string" ? product.detailedDescription : "",
    galleryImages: galleryImagesData(storedArray(galleryImagesJson), product.imageUrl) ?? [],
    specifications: specificationsData(storedArray(specificationsJson)) ?? []
  };
}

module.exports = { validProductImageUrl, productDetailsData, productDetailsResponse, productBrand };
