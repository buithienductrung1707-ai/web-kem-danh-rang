(() => {
  const form = document.getElementById("product-form");
  if (!form) return;
  const detailed = document.getElementById("edit-product-detailed-description");
  const gallery = document.getElementById("product-gallery-list");
  const galleryUrl = document.getElementById("product-gallery-url");
  const galleryUrlMessage = document.getElementById("product-gallery-url-message");
  const addGallery = document.getElementById("product-gallery-add");
  const galleryFile = document.getElementById("product-gallery-file");
  const uploadGallery = document.getElementById("upload-product-gallery");
  const galleryMessage = document.getElementById("product-gallery-message");
  const specs = document.getElementById("product-spec-list");
  const addSpec = document.getElementById("product-spec-add");
  const preview = document.getElementById("product-detail-preview");
  let disabled = true;
  let sequence = 0;
  let hooks = {};

  function validImage(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) &&
        ((value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value));
    } catch { return false; }
  }

  function sync() {
    const images = [...gallery.children];
    for (const control of document.querySelectorAll("#product-gallery-list input, #product-gallery-list button, #product-spec-list input, #product-spec-list button")) {
      control.disabled = disabled;
    }
    detailed.disabled = disabled;
    galleryUrl.disabled = disabled || images.length >= 7;
    addGallery.disabled = disabled || images.length >= 7;
    galleryFile.disabled = disabled || images.length >= 7;
    uploadGallery.disabled = disabled || images.length >= 7 || galleryFile.files.length !== 1;
    addSpec.disabled = disabled || specs.children.length >= 12;
    document.getElementById("product-gallery-count").textContent = images.length + " / 7 ảnh";
    document.getElementById("product-gallery-empty").hidden = images.length > 0;
    document.getElementById("product-spec-empty").hidden = specs.children.length > 0;
    images.forEach((row, index) => {
      row.querySelector("[data-gallery-up]").disabled = disabled || index === 0;
      row.querySelector("[data-gallery-down]").disabled = disabled || index === images.length - 1;
      row.querySelector("label").textContent = "Ảnh bổ sung " + (index + 1);
    });
  }

  function changed() {
    sync();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function button(text, label, action) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = "button-secondary";
    control.textContent = text;
    control.setAttribute("aria-label", label);
    control.addEventListener("click", () => { if (!disabled) action(control); });
    return control;
  }

  function addImage(url) {
    if (gallery.children.length >= 7) return false;
    const row = document.createElement("div");
    row.className = "admin-product-gallery-row";
    const image = document.createElement("img");
    image.width = 72;
    image.height = 72;
    image.alt = "";
    image.loading = "lazy";
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 2048;
    input.required = true;
    input.id = "product-gallery-image-" + (++sequence);
    input.value = url;
    label.htmlFor = input.id;
    function renderImage() {
      image.src = validImage(input.value.trim()) ? input.value.trim() : "/assets/shop-logo.png";
    }
    image.addEventListener("error", () => {
      if (!image.src.endsWith("/assets/shop-logo.png")) image.src = "/assets/shop-logo.png";
    });
    input.addEventListener("input", () => input.setCustomValidity(""));
    input.addEventListener("change", renderImage);
    renderImage();
    field.append(label, input);
    const actions = document.createElement("div");
    actions.className = "admin-product-row-actions";
    const up = button("↑", "Đưa ảnh lên trước", () => {
      if (row.previousElementSibling) gallery.insertBefore(row, row.previousElementSibling);
      changed();
      row.querySelector("input").focus();
    });
    up.dataset.galleryUp = "";
    const down = button("↓", "Đưa ảnh xuống sau", () => {
      if (row.nextElementSibling) gallery.insertBefore(row.nextElementSibling, row);
      changed();
      row.querySelector("input").focus();
    });
    down.dataset.galleryDown = "";
    actions.append(up, down, button("Xóa", "Xóa ảnh bổ sung", () => {
      row.remove();
      changed();
      addGallery.focus();
    }));
    row.append(image, field, actions);
    gallery.append(row);
    sync();
    return true;
  }

  function addSpecification(value = { label: "", value: "" }) {
    if (specs.children.length >= 12) return;
    const row = document.createElement("div");
    row.className = "admin-product-spec-row";
    for (const [key, text, maxLength] of [["label", "Tên thông số", 60], ["value", "Giá trị", 200]]) {
      const field = document.createElement("div");
      field.className = "field";
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = maxLength;
      input.dataset.specField = key;
      input.id = "product-spec-" + (++sequence);
      input.value = value[key];
      label.htmlFor = input.id;
      label.textContent = text;
      input.addEventListener("input", () => input.setCustomValidity(""));
      field.append(label, input);
      row.append(field);
    }
    row.append(button("Xóa", "Xóa thông số", () => { row.remove(); changed(); addSpec.focus(); }));
    specs.append(row);
    sync();
    return row;
  }

  function read(primaryImageUrl) {
    const galleryImages = [];
    for (const field of gallery.querySelectorAll("input")) {
      const value = field.value.trim();
      if (!validImage(value)) {
        field.setCustomValidity("Nhập đường dẫn ảnh http(s) hoặc bắt đầu bằng /.");
        field.reportValidity();
        return null;
      }
      if (value !== primaryImageUrl && !galleryImages.includes(value)) galleryImages.push(value);
    }
    const specifications = [];
    for (const row of specs.children) {
      const label = row.querySelector('[data-spec-field="label"]');
      const value = row.querySelector('[data-spec-field="value"]');
      if (!label.value.trim() && !value.value.trim()) continue;
      const missing = !label.value.trim() ? label : !value.value.trim() ? value : null;
      if (missing) {
        missing.setCustomValidity("Nhập cả tên thông số và giá trị, hoặc xóa dòng này.");
        missing.reportValidity();
        return null;
      }
      specifications.push({ label: label.value.trim(), value: value.value.trim() });
    }
    return { detailedDescription: detailed.value.trim(), galleryImages, specifications };
  }

  function validate(product) {
    if (product.detailedDescription !== undefined &&
      (typeof product.detailedDescription !== "string" || product.detailedDescription.length > 12000)) return false;
    if (product.galleryImages !== undefined && (!Array.isArray(product.galleryImages) ||
      product.galleryImages.length > 7 || !product.galleryImages.every(validImage))) return false;
    return product.specifications === undefined || (Array.isArray(product.specifications) &&
      product.specifications.length <= 12 && product.specifications.every(spec => spec &&
        typeof spec.label === "string" && spec.label.trim().length > 0 && spec.label.length <= 60 &&
        typeof spec.value === "string" && spec.value.trim().length > 0 && spec.value.length <= 200));
  }

  function fill(product) {
    gallery.replaceChildren();
    specs.replaceChildren();
    galleryUrl.value = "";
    galleryUrl.setCustomValidity("");
    clearGalleryUrlError();
    galleryFile.value = "";
    galleryMessage.textContent = "";
    detailed.value = product?.detailedDescription ?? "";
    for (const url of product?.galleryImages ?? []) addImage(url);
    for (const spec of product?.specifications ?? []) addSpecification(spec);
    preview.hidden = !product?.id;
    preview.href = product?.id ? "/chi-tiet-san-pham.html?id=" + product.id : "#";
    document.getElementById("product-detail-preview-help").textContent = product?.id && !product.active
      ? "Sản phẩm đang ẩn. Bật hiển thị và lưu để khách xem trang sản phẩm."
      : "Lưu sản phẩm để cập nhật nội dung trên website.";
    sync();
  }

  function clearGalleryUrlError() {
    galleryUrl.removeAttribute("aria-invalid");
    galleryUrlMessage.textContent = "";
  }

  function addPendingImage(required = false) {
    clearGalleryUrlError();
    const value = galleryUrl.value.trim();
    if (!value && !required) return true;
    if (!validImage(value)) {
      galleryUrl.setAttribute("aria-invalid", "true");
      galleryUrlMessage.textContent = "Nhập đường dẫn ảnh http(s) hoặc bắt đầu bằng /, hoặc để trống nếu dùng ảnh từ máy tính.";
      galleryUrl.focus();
      return false;
    }
    if (!addImage(value)) return false;
    galleryUrl.value = "";
    changed();
    return true;
  }

  function prepareSave() {
    const pendingCount = Number(Boolean(galleryUrl.value.trim())) + Number(galleryFile.files.length > 0);
    if (gallery.children.length + pendingCount > 7) {
      galleryMessage.textContent = "Bộ sưu tập có tối đa 7 ảnh bổ sung. Xóa bớt ảnh hoặc bỏ ảnh đang chọn trước khi lưu.";
      return false;
    }
    return addPendingImage();
  }

  addGallery.addEventListener("click", () => {
    if (disabled || gallery.children.length >= 7) return;
    if (addPendingImage(true)) gallery.lastElementChild?.querySelector("input").focus();
  });
  galleryUrl.addEventListener("input", clearGalleryUrlError);
  galleryFile.addEventListener("change", () => {
    const file = galleryFile.files[0];
    const error = file ? hooks.validateImageFile?.(file) : "";
    if (error) galleryFile.value = "";
    if (file && !error) clearGalleryUrlError();
    galleryMessage.textContent = error || (file ? "Đã chọn " + file.name + ". Bấm Lưu sản phẩm để tải và lưu ảnh, hoặc Tải ảnh vào bộ sưu tập để xem trước." : "");
    sync();
  });
  uploadGallery.addEventListener("click", () => { if (!disabled) void hooks.upload?.(); });
  addSpec.addEventListener("click", () => {
    if (disabled) return;
    const row = addSpecification();
    changed();
    row?.querySelector("input").focus();
  });

  window.ShopAdminProductDetails = {
    configure(options) { hooks = options; },
    setBusy(value) { disabled = Boolean(value); sync(); },
    fill, read, validate, addImage, prepareSave,
    get galleryFile() { return galleryFile; },
    get galleryMessage() { return galleryMessage; },
    get galleryUploadButton() { return uploadGallery; }
  };
})();
