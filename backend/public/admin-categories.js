(() => {
  "use strict";

  const form = document.getElementById("category-form");
  if (!form) return;

  const fields = Object.fromEntries(["name", "slug", "description", "image", "image-alt", "sort-order", "enabled"]
    .map(key => [key, document.getElementById("edit-category-" + key)]));
  const picker = document.getElementById("category-picker");
  const newButton = document.getElementById("new-category");
  const reloadButton = document.getElementById("reload-categories");
  const saveButton = document.getElementById("save-category");
  const cancelButton = document.getElementById("cancel-category");
  const deleteButton = document.getElementById("delete-category");
  const deleteHelp = document.getElementById("category-delete-help");
  const empty = document.getElementById("category-empty");
  const message = document.getElementById("category-editor-message");
  const fileField = document.getElementById("category-image-file");
  const uploadButton = document.getElementById("upload-category-image");
  const imageMessage = document.getElementById("category-image-message");
  const preview = document.getElementById("category-image-preview");
  let hooks = null;
  let items = [];
  let snapshot = null;
  let mode = "loading";
  let creationKey = null;
  let ready = false;
  let busy = true;
  let generation = 0;
  let controller = null;

  function status(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  function controls(value = busy) {
    busy = value;
    const active = hooks?.isActive() === true;
    const editable = ["edit", "new"].includes(mode);
    for (const field of Object.values(fields)) field.disabled = busy || !active || !editable;
    picker.disabled = busy || !active || !ready || items.length === 0;
    newButton.disabled = busy || !active || !ready;
    reloadButton.disabled = busy || !active;
    saveButton.disabled = busy || !active || !editable;
    cancelButton.hidden = mode !== "new";
    cancelButton.disabled = busy || !active;
    deleteButton.hidden = mode === "new";
    deleteButton.disabled = busy || !active || mode !== "edit" || snapshot?.defaultCategory || snapshot?.productCount > 0;
    fileField.disabled = busy || !active || !editable;
    uploadButton.disabled = fileField.disabled || fileField.files.length !== 1;
    form.setAttribute("aria-busy", String(busy));
  }

  function validate(item) {
    if (!item || !Number.isSafeInteger(item.id) || item.id < 1 ||
      typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 ||
      typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || item.slug.length > 80 ||
      typeof item.description !== "string" || item.description.length > 400 ||
      typeof item.imageUrl !== "string" || item.imageUrl.length > 2048 ||
      (item.imageUrl !== "" && !hooks.validImage(item.imageUrl)) ||
      typeof item.imageAlt !== "string" || item.imageAlt.length > 200 ||
      typeof item.enabled !== "boolean" || !Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 999 ||
      !Number.isSafeInteger(item.revision) || item.revision < 0 ||
      !Number.isSafeInteger(item.productCount) || item.productCount < 0 || typeof item.defaultCategory !== "boolean") {
      throw new Error("Thông tin danh mục chưa hợp lệ.");
    }
  }

  function renderPicker() {
    const fragment = document.createDocumentFragment();
    if (mode === "new" || items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = mode === "new" ? "Đang thêm danh mục mới" : "Chưa có danh mục";
      option.disabled = true;
      fragment.append(option);
    }
    for (const item of items) {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.name + (item.enabled ? "" : " (đang ẩn)");
      fragment.append(option);
    }
    picker.replaceChildren(fragment);
    picker.value = snapshot ? String(snapshot.id) : "";
  }

  function clearImage() {
    fileField.value = "";
    imageMessage.textContent = "";
    preview.hidden = true;
    preview.removeAttribute("src");
  }

  function showPreview() {
    const url = fields.image.value.trim();
    preview.hidden = !url || !hooks.validImage(url);
    preview.alt = fields["image-alt"].value.trim() || "Ảnh xem trước danh mục";
    if (preview.hidden) preview.removeAttribute("src");
    else preview.src = url;
  }

  function fill(item) {
    for (const field of Object.values(fields)) field.removeAttribute("aria-invalid");
    snapshot = item;
    mode = item ? "edit" : "empty";
    creationKey = null;
    form.hidden = !item;
    empty.hidden = Boolean(item);
    clearImage();
    if (item) {
      fields.name.value = item.name;
      fields.slug.value = item.slug;
      fields.description.value = item.description;
      fields.image.value = item.imageUrl;
      fields["image-alt"].value = item.imageAlt;
      fields["sort-order"].value = String(item.sortOrder);
      fields.enabled.checked = item.enabled;
      deleteHelp.textContent = item.defaultCategory
        ? "Danh mục mặc định được giữ để tiếp nhận các sản phẩm cũ. Bạn có thể sửa nội dung hoặc ẩn danh mục."
        : item.productCount > 0
          ? "Danh mục có " + item.productCount + " sản phẩm. Chuyển các sản phẩm sang danh mục khác rồi tải lại danh mục để xóa."
          : "Danh mục chưa có sản phẩm và có thể xóa.";
      showPreview();
    }
    saveButton.textContent = "Lưu danh mục";
    renderPicker();
  }

  function changed() {
    hooks.onChange();
    controls();
  }

  function clear() {
    const hadRequest = controller !== null;
    generation += 1;
    controller?.abort();
    controller = null;
    items = [];
    snapshot = null;
    mode = "loading";
    creationKey = null;
    ready = false;
    form.reset();
    for (const field of Object.values(fields)) field.removeAttribute("aria-invalid");
    form.hidden = true;
    empty.hidden = true;
    picker.replaceChildren();
    clearImage();
    status("");
    controls();
    if (hadRequest) hooks.setBusy(false);
  }

  async function request(path, options = {}) {
    const { response, result } = await hooks.request(path, options);
    if (response.status === 401) {
      hooks.onUnauthorized();
      throw new Error("Phiên đăng nhập đã hết hạn.");
    }
    return { response, result };
  }

  async function load() {
    if (!hooks.isActive()) return false;
    const selectedId = snapshot?.id;
    const pendingKey = creationKey;
    const version = ++generation;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    mode = "loading";
    ready = false;
    status("Đang tải danh mục...");
    controls();
    try {
      const { response, result } = await request("/categories", {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
      });
      if (version !== generation || !hooks.isActive()) return false;
      if (!response.ok || !Array.isArray(result)) throw new Error("Tải danh mục gặp lỗi.");
      result.forEach(validate);
      if (new Set(result.map(item => item.id)).size !== result.length) throw new Error("Danh mục trùng mã.");
      items = result.toSorted((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      ready = true;
      fill(items.find(item => pendingKey && item.creationKey === pendingKey) || items.find(item => item.id === selectedId) || items[0]);
      status("Đã tải " + items.length + " danh mục.");
      changed();
      return true;
    } catch {
      if (version !== generation || !hooks.isActive()) return false;
      mode = "unknown";
      status("Tải danh mục gặp lỗi. Bấm Tải lại danh mục để thử lại.", true);
      changed();
      return false;
    } finally {
      if (controller === current) controller = null;
    }
  }

  function canEdit() {
    return !busy && hooks?.isActive() && ["edit", "new"].includes(mode);
  }

  newButton.addEventListener("click", () => {
    if (busy || !ready || !hooks.isActive()) return;
    snapshot = null;
    mode = "new";
    creationKey = crypto.randomUUID();
    form.reset();
    for (const field of Object.values(fields)) field.removeAttribute("aria-invalid");
    clearImage();
    form.hidden = false;
    empty.hidden = true;
    fields.enabled.checked = true;
    fields["sort-order"].value = String(Math.min(999, items.reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1));
    deleteHelp.textContent = "";
    saveButton.textContent = "Thêm danh mục";
    renderPicker();
    controls();
    status("");
    fields.name.focus();
  });

  cancelButton.addEventListener("click", () => {
    if (!canEdit() || mode !== "new") return;
    fill(items[0]);
    controls();
    status("Đã hủy thêm danh mục.");
    newButton.focus();
  });

  picker.addEventListener("change", () => {
    if (!canEdit()) return;
    const item = items.find(category => String(category.id) === picker.value);
    if (!item) return;
    fill(item);
    controls();
    status("");
  });

  reloadButton.addEventListener("click", async () => {
    if (busy || !hooks.isActive()) return;
    const version = generation + 1;
    hooks.setBusy(true);
    try {
      await load();
    } finally {
      if (version === generation) hooks.finish(reloadButton);
    }
  });

  function formData() {
    return {
      name: fields.name.value.trim(), slug: fields.slug.value.trim(),
      description: fields.description.value.trim(), imageUrl: fields.image.value.trim(),
      imageAlt: fields["image-alt"].value.trim(), sortOrder: Number(fields["sort-order"].value),
      enabled: fields.enabled.checked
    };
  }

  async function mutate(path, method, data, success) {
    const version = generation;
    const current = new AbortController();
    controller = current;
    hooks.setBusy(true);
    status(method === "DELETE" ? "Đang xóa danh mục..." : "Đang lưu danh mục...");
    try {
      const { response, result } = await request(path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
      });
      if (version !== generation || !hooks.isActive()) return;
      if (!response.ok) {
        const detail = typeof result?.error === "string" ? result.error : "Cập nhật danh mục gặp lỗi.";
        if ([400, 403].includes(response.status) || (response.status === 409 && result?.field === "slug")) {
          status(detail, true);
          const fieldName = { imageUrl: "image", imageAlt: "image-alt", sortOrder: "sort-order" }[result?.field] || result?.field;
          fields[fieldName]?.setAttribute("aria-invalid", "true");
        }
        else {
          mode = "unknown";
          ready = false;
          status(detail + " Bản đang sửa được giữ lại. Bấm Tải lại danh mục để kiểm tra phiên bản hiện tại.", true);
          changed();
        }
        return;
      }
      success(result);
      changed();
    } catch {
      if (version !== generation || !hooks.isActive()) return;
      mode = "unknown";
      ready = false;
      status("Chưa xác nhận được kết quả. Bản đang sửa được giữ lại. Bấm Tải lại danh mục để kiểm tra.", true);
      changed();
    } finally {
      if (controller === current) controller = null;
      if (version === generation) hooks.finish(mode === "unknown" ? reloadButton : newButton);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!canEdit()) return;
    for (const field of Object.values(fields)) {
      if (field.type !== "checkbox") field.value = field.value.trim();
    }
    if (!form.reportValidity()) return;
    const data = formData();
    try {
      validate({ ...data, id: snapshot?.id ?? 1, revision: snapshot?.revision ?? 0, productCount: 0, defaultCategory: false });
    } catch {
      status("Kiểm tra tên, đường dẫn danh mục, ảnh và thứ tự từ 0 đến 999 trước khi lưu.", true);
      return;
    }
    const creating = mode === "new";
    const id = snapshot?.id;
    await mutate(creating ? "/categories" : "/categories/" + id, creating ? "POST" : "PATCH",
      creating ? { ...data, creationKey } : { ...data, revision: snapshot.revision }, result => {
        validate(result);
        if ((!creating && result.id !== id) || !Object.entries(data).every(([key, value]) => result[key] === value)) {
          throw new Error("Kết quả lưu danh mục chưa hợp lệ.");
        }
        items = [...items.filter(item => item.id !== result.id), result].toSorted((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        ready = true;
        fill(result);
        status(creating ? "Đã thêm danh mục." : "Đã lưu danh mục.");
      });
  });

  deleteButton.addEventListener("click", async () => {
    if (!canEdit() || mode !== "edit" || deleteButton.disabled) return;
    const item = snapshot;
    if (!window.confirm('Xóa danh mục "' + item.name + '" khỏi website?')) return;
    await mutate("/categories/" + item.id, "DELETE", { revision: item.revision }, result => {
      if (result?.id !== item.id || result.deleted !== true) throw new Error("Chưa xác nhận kết quả xóa.");
      items = items.filter(category => category.id !== item.id);
      fill(items[0]);
      status("Đã xóa danh mục.");
    });
  });

  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    if (["edit", "new"].includes(mode)) status("");
  });
  fields.image.addEventListener("change", showPreview);
  fields["image-alt"].addEventListener("change", showPreview);
  preview.addEventListener("error", () => {
    if (preview.hidden) return;
    preview.hidden = true;
    imageMessage.textContent = "Chưa hiển thị được ảnh xem trước. Kiểm tra đường dẫn ảnh.";
  });
  fileField.addEventListener("change", () => {
    const file = fileField.files[0];
    const error = file ? hooks.validateImageFile(file) : "";
    if (error) fileField.value = "";
    imageMessage.textContent = error || (file ? "Đã chọn " + file.name + ". Bấm Tải ảnh lên để tiếp tục." : "");
    controls();
  });

  uploadButton.addEventListener("click", async () => {
    if (!canEdit()) return;
    const file = fileField.files[0];
    const error = hooks.validateImageFile(file);
    if (error) {
      imageMessage.textContent = error;
      return;
    }
    const version = generation;
    const current = new AbortController();
    controller = current;
    hooks.setBusy(true);
    uploadButton.textContent = "Đang tải ảnh...";
    imageMessage.textContent = "Đang tải ảnh lên máy chủ...";
    try {
      const { response, result } = await request("/product-images", {
        method: "POST", headers: { "Content-Type": file.type }, body: file,
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(30000)])
      });
      if (version !== generation || !hooks.isActive()) return;
      if (!response.ok || typeof result?.imageUrl !== "string" ||
        !/^\/uploads\/products\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(result.imageUrl)) {
        throw new Error(typeof result?.error === "string" ? result.error : "Tải ảnh gặp lỗi. Hãy thử lại.");
      }
      fields.image.value = result.imageUrl;
      fileField.value = "";
      showPreview();
      imageMessage.textContent = "Đã tải ảnh lên. Bấm Lưu danh mục để áp dụng.";
    } catch (error) {
      if (version === generation && hooks.isActive()) imageMessage.textContent = error.message || "Chưa xác nhận được kết quả tải ảnh. Hãy thử lại.";
    } finally {
      if (controller === current) controller = null;
      uploadButton.textContent = "Tải ảnh lên";
      if (version === generation) hooks.finish(fields.image);
    }
  });

  window.ShopAdminCategories = {
    configure(value) { hooks = value; controls(); },
    load, clear, setBusy: controls,
    get ready() { return ready; },
    get items() { return items.slice(); }
  };
})();
