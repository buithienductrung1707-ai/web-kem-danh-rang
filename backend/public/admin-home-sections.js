(() => {
  "use strict";

  const form = document.getElementById("home-section-form");
  if (!form) return;
  const keys = ["best-selling", "latest", "featured"];
  const labels = { "best-selling": "Sản phẩm bán chạy", latest: "Sản phẩm mới nhất", featured: "Sản phẩm nổi bật" };
  const picker = document.getElementById("home-section-picker");
  const reloadButton = document.getElementById("home-sections-reload");
  const message = document.getElementById("home-sections-message");
  const fields = Object.fromEntries(["title", "subtitle", "enabled", "mode", "limit"]
    .map(key => [key, document.getElementById("home-section-" + key)]));
  const modeHelp = document.getElementById("home-section-mode-help");
  const manual = document.getElementById("home-section-manual");
  const productPicker = document.getElementById("home-section-product-picker");
  const addButton = document.getElementById("home-section-add");
  const list = document.getElementById("home-section-products");
  const count = document.getElementById("home-section-count");
  const empty = document.getElementById("home-section-empty");
  const listHelp = document.getElementById("home-section-list-help");
  const saveButton = document.getElementById("home-section-save");
  const draftStatus = document.getElementById("home-section-draft-status");
  let hooks = null;
  let sections = [];
  let products = [];
  let snapshot = null;
  let selectedIds = [];
  let editingIndex = null;
  let ready = false;
  let busy = true;
  let conflict = false;
  let generation = 0;
  let controller = null;
  let ownsBusy = false;

  function status(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  function data() {
    return { title: fields.title.value.trim(), subtitle: fields.subtitle.value.trim(),
      enabled: fields.enabled.checked, mode: fields.mode.value, limit: Number(fields.limit.value),
      productIds: [...selectedIds] };
  }

  function savedData(item) {
    return { title: item.title, subtitle: item.subtitle, enabled: item.enabled,
      mode: item.mode, limit: item.limit, productIds: [...item.productIds] };
  }

  function dirty() {
    return snapshot !== null && JSON.stringify(data()) !== JSON.stringify(savedData(snapshot));
  }

  function canEdit() {
    return hooks?.isActive() === true && ready && snapshot !== null && !busy && controller === null;
  }

  function updateDraft() {
    draftStatus.textContent = dirty() ? "Có thay đổi chưa lưu." : "Nội dung đang khớp bản đã lưu.";
  }

  function controls(value = busy) {
    busy = value;
    const active = hooks?.isActive() === true;
    const locked = busy || controller !== null || !active;
    for (const control of form.querySelectorAll("input, select, textarea, button")) {
      control.disabled = locked || !ready || snapshot === null;
    }
    picker.disabled = locked || !ready;
    reloadButton.disabled = locked;
    saveButton.disabled = locked || !ready || snapshot === null || conflict || !dirty();
    const manualMode = fields.mode.value === "manual";
    productPicker.disabled ||= !manualMode || selectedIds.length >= 12 || productPicker.options.length <= 1;
    addButton.disabled ||= productPicker.disabled || !productPicker.value;
    for (const button of list.querySelectorAll("button")) {
      const index = Number(button.dataset.index);
      button.disabled ||= !manualMode || (button.dataset.homeSectionAction === "up" && index === 0)
        || (button.dataset.homeSectionAction === "down" && index === selectedIds.length - 1);
    }
    for (const select of list.querySelectorAll("select")) select.disabled ||= !manualMode;
    form.setAttribute("aria-busy", String(controller !== null));
  }

  function validateSection(item) {
    if (!item || !keys.includes(item.key) || typeof item.title !== "string" || !item.title.trim()
      || item.title.length > 120 || typeof item.subtitle !== "string" || item.subtitle.length > 240
      || typeof item.enabled !== "boolean" || !["auto", "manual"].includes(item.mode)
      || !Number.isSafeInteger(item.limit) || item.limit < 1 || item.limit > 12
      || !Array.isArray(item.productIds) || item.productIds.length > 12
      || !item.productIds.every(id => Number.isSafeInteger(id) && id > 0)
      || new Set(item.productIds).size !== item.productIds.length
      || !Number.isSafeInteger(item.revision) || item.revision < 0) {
      throw new Error("Thông tin khu vực sản phẩm chưa hợp lệ.");
    }
  }

  function validateProducts(items) {
    if (!Array.isArray(items) || !items.every(product => product && Number.isSafeInteger(product.id) && product.id > 0
      && typeof product.name === "string" && product.name.trim() && product.name.length <= 200
      && typeof product.active === "boolean" && typeof product.imageUrl === "string"
      && (product.imageUrl === "" || validImage(product.imageUrl)))
      || new Set(items.map(product => product.id)).size !== items.length) {
      throw new Error("Danh sách sản phẩm chưa hợp lệ.");
    }
  }

  function validImage(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol)
        && ((value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value));
    } catch { return false; }
  }

  function productHint(product) {
    const category = hooks.categories?.().find(item => item.id === product.categoryId);
    const unavailable = !product.active || category?.enabled === false;
    const detail = !product.active ? "Sản phẩm đang ẩn"
      : category?.enabled === false ? "Danh mục đang ẩn" : "Sản phẩm đang hiển thị";
    return { unavailable, text: [product.categoryName || category?.name, detail].filter(Boolean).join(" · ") };
  }

  function renderProductPicker(select, currentId = null) {
    const previous = select.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Chọn sản phẩm";
    const options = products.filter(product => !selectedIds.includes(product.id) || product.id === currentId)
      .map(product => {
        const option = document.createElement("option");
        option.value = String(product.id);
        option.textContent = product.name + (productHint(product).unavailable ? " (đang ẩn)" : "");
        return option;
      });
    select.replaceChildren(placeholder, ...options);
    select.value = currentId !== null ? String(currentId)
      : options.some(option => option.value === previous) ? previous : "";
  }

  function actionButton(action, text, index, name) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button-secondary";
    button.textContent = text;
    button.dataset.homeSectionAction = action;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", { edit: "Thay sản phẩm", up: "Đưa lên trên", down: "Đưa xuống dưới",
      remove: "Xóa khỏi mục", apply: "Áp dụng sản phẩm thay thế", cancel: "Hủy thay sản phẩm" }[action] + " · " + name);
    if (action === "remove") button.classList.add("home-section-remove");
    return button;
  }

  function renderList() {
    const fragment = document.createDocumentFragment();
    const limit = Number(fields.limit.value);
    let availablePosition = 0;
    selectedIds.forEach((id, index) => {
      const product = products.find(item => item.id === id);
      const name = product?.name || "Sản phẩm #" + id;
      const row = document.createElement("li");
      row.className = "home-section-product-row";
      row.dataset.productId = String(id);
      const number = document.createElement("span");
      number.className = "home-section-product-number";
      number.textContent = String(index + 1);
      const image = document.createElement("img");
      image.className = "home-section-product-image";
      image.width = image.height = 60;
      image.alt = "";
      image.loading = "lazy";
      if (product?.imageUrl) image.src = product.imageUrl;
      else image.hidden = true;
      image.addEventListener("error", () => { image.hidden = true; });
      const body = document.createElement("div");
      body.className = "home-section-product-body";
      const title = document.createElement("strong");
      title.textContent = name;
      const meta = document.createElement("p");
      meta.className = "home-section-product-meta";
      const hint = product ? productHint(product) : { unavailable: true, text: "Sản phẩm không còn khả dụng" };
      const inLimit = !hint.unavailable && availablePosition++ < limit;
      meta.textContent = hint.text + " · " + (hint.unavailable ? "Không xuất hiện trên trang chủ"
        : inLimit ? "Trong giới hạn hiển thị" : "Ngoài giới hạn hiển thị");
      meta.dataset.unavailable = String(hint.unavailable);
      body.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "home-section-product-actions";
      for (const [action, text] of [["edit", "Sửa"], ["up", "↑"], ["down", "↓"], ["remove", "Xóa khỏi mục"]]) {
        actions.append(actionButton(action, text, index, name));
      }
      row.append(number, image, body, actions);
      if (editingIndex === index) {
        const replace = document.createElement("div");
        replace.className = "home-section-replace";
        const label = document.createElement("label");
        label.htmlFor = "home-section-replace-" + index;
        label.textContent = "Sản phẩm thay thế";
        const select = document.createElement("select");
        select.id = label.htmlFor;
        select.className = "home-section-replace-select";
        renderProductPicker(select, id);
        const buttons = document.createElement("div");
        buttons.className = "home-section-replace-actions";
        buttons.append(actionButton("apply", "Áp dụng", index, name), actionButton("cancel", "Hủy", index, name));
        replace.append(label, select, buttons);
        row.append(replace);
      }
      fragment.append(row);
    });
    list.replaceChildren(fragment);
    count.textContent = selectedIds.length + " / 12";
    listHelp.textContent = "Tối đa 12 lựa chọn. Trang chủ hiển thị "
      + (Number.isInteger(limit) && limit >= 1 && limit <= 12 ? "tối đa " + limit : "theo số lượng đã đặt")
      + " sản phẩm khả dụng đầu tiên theo thứ tự này. Xóa khỏi mục chỉ gỡ sản phẩm khỏi khu vực này, không xóa sản phẩm của cửa hàng.";
    empty.hidden = selectedIds.length !== 0;
    renderProductPicker(productPicker);
    updateDraft();
    controls();
  }

  function renderMode() {
    const manualMode = fields.mode.value === "manual";
    manual.hidden = !manualMode;
    modeHelp.textContent = manualMode
      ? "Hiển thị theo danh sách tự chọn bên dưới, tối đa số lượng đã đặt. Sản phẩm hoặc danh mục đang ẩn sẽ không xuất hiện ở cửa hàng. Danh sách trống sẽ giữ khu vực không có sản phẩm."
      : { "best-selling": "Tự động xếp theo số sản phẩm đã bán trong các đơn hàng hoàn thành, từ cao xuống thấp. Chưa có lượt bán thì danh sách giữ trống.",
        latest: "Tự động hiển thị sản phẩm mới được thêm vào cửa hàng trước, theo thứ tự mã sản phẩm mới nhất.",
        featured: "Tự động hiển thị theo thứ tự sản phẩm hiện có của cửa hàng, từ mã nhỏ đến mã lớn." }[snapshot?.key] || "";
  }

  function fill(item) {
    snapshot = { ...item, productIds: [...item.productIds] };
    selectedIds = [...item.productIds];
    editingIndex = null;
    conflict = false;
    picker.value = item.key;
    fields.title.value = item.title;
    fields.subtitle.value = item.subtitle;
    fields.enabled.checked = item.enabled;
    fields.mode.value = item.mode;
    fields.limit.value = String(item.limit);
    for (const field of Object.values(fields)) field.removeAttribute("aria-invalid");
    form.hidden = false;
    renderMode();
    renderList();
  }

  function clear() {
    const release = ownsBusy;
    generation += 1;
    controller?.abort();
    controller = null;
    ownsBusy = false;
    sections = [];
    products = [];
    snapshot = null;
    selectedIds = [];
    editingIndex = null;
    ready = false;
    conflict = false;
    form.reset();
    form.hidden = true;
    saveButton.textContent = "Lưu mục";
    list.replaceChildren();
    productPicker.replaceChildren();
    count.textContent = "0 / 12";
    draftStatus.textContent = "";
    modeHelp.textContent = "";
    status("");
    for (const field of Object.values(fields)) field.removeAttribute("aria-invalid");
    controls();
    if (release) hooks.setBusy(false);
  }

  async function request(path, options, version) {
    const result = await hooks.request(path, options);
    if (version !== generation || !hooks.isActive()) throw new DOMException("Replaced request", "AbortError");
    if (result.response.status === 401) {
      hooks.onUnauthorized();
      throw new DOMException("Signed out", "AbortError");
    }
    return result;
  }

  async function load({ manageBusy = false } = {}) {
    if (!hooks?.isActive()) return false;
    const selectedKey = snapshot?.key || picker.value || keys[0];
    const version = ++generation;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    ownsBusy = manageBusy;
    if (manageBusy) hooks.setBusy(true);
    status("Đang tải các khu vực và danh sách sản phẩm...");
    controls();
    try {
      const options = { signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)]) };
      const [sectionResponse, productResponse] = await Promise.all([
        request("/home-sections", options, version), request("/products", options, version)
      ]);
      if (version !== generation || !hooks.isActive()) return false;
      if (!sectionResponse.response.ok || !productResponse.response.ok) throw new Error("Tải dữ liệu gặp lỗi.");
      const result = sectionResponse.result;
      if (!Array.isArray(result) || result.length !== keys.length) throw new Error("Thiếu khu vực sản phẩm.");
      result.forEach(validateSection);
      if (new Set(result.map(item => item.key)).size !== keys.length) throw new Error("Khu vực sản phẩm trùng lặp.");
      validateProducts(productResponse.result);
      const productIds = new Set(productResponse.result.map(product => product.id));
      if (result.some(item => item.productIds.some(id => !productIds.has(id)))) throw new Error("Danh sách có sản phẩm chưa khả dụng.");
      sections = result;
      products = productResponse.result;
      ready = true;
      fill(sections.find(item => item.key === selectedKey) || sections[0]);
      status("Đã tải các khu vực sản phẩm. Chọn mục để chỉnh sửa.");
      return true;
    } catch {
      if (version !== generation || !hooks.isActive()) return false;
      status(snapshot ? "Chưa tải lại được dữ liệu. Bản đang sửa vẫn được giữ. Hãy thử Tải lại các mục."
        : "Chưa tải được các khu vực sản phẩm. Bấm Tải lại các mục để thử lại.", true);
      return false;
    } finally {
      if (version === generation) {
        controller = null;
        ownsBusy = false;
        controls();
        if (manageBusy) hooks.finish(reloadButton);
      }
    }
  }

  picker.addEventListener("change", () => {
    const key = picker.value;
    if (!canEdit()) { picker.value = snapshot?.key || keys[0]; return; }
    if (key === snapshot.key) return;
    if (dirty() && !window.confirm("Mục hiện tại có thay đổi chưa lưu. Chuyển mục và bỏ các thay đổi này?")) {
      picker.value = snapshot.key;
      return;
    }
    const item = sections.find(section => section.key === key);
    if (!item) return;
    fill(item);
    status("");
  });

  reloadButton.addEventListener("click", () => {
    if (busy || controller !== null || !hooks?.isActive()) return;
    if (dirty() && !window.confirm("Tải lại sẽ thay bản đang sửa bằng nội dung đã lưu trên máy chủ. Bỏ các thay đổi chưa lưu?")) return;
    void load({ manageBusy: true });
  });

  form.addEventListener("input", event => {
    if (!canEdit()) return;
    event.target.removeAttribute("aria-invalid");
    updateDraft();
    controls();
  });
  fields.mode.addEventListener("change", () => {
    if (!canEdit()) return;
    editingIndex = null;
    renderMode();
    renderList();
  });
  fields.limit.addEventListener("change", () => { if (canEdit()) renderList(); });
  productPicker.addEventListener("change", () => controls());
  addButton.addEventListener("click", () => {
    if (!canEdit() || fields.mode.value !== "manual" || selectedIds.length >= 12) return;
    const id = Number(productPicker.value);
    if (!products.some(product => product.id === id) || selectedIds.includes(id)) return;
    selectedIds.push(id);
    editingIndex = null;
    renderList();
    status("Đã thêm vào bản đang sửa. Bấm Lưu mục để áp dụng.");
    productPicker.focus();
  });

  list.addEventListener("click", event => {
    const button = event.target.closest("button[data-home-section-action]");
    if (!button || !canEdit() || fields.mode.value !== "manual") return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= selectedIds.length) return;
    const action = button.dataset.homeSectionAction;
    const product = products.find(item => item.id === selectedIds[index]);
    if (action === "edit") editingIndex = index;
    else if (action === "cancel") editingIndex = null;
    else if (action === "apply") {
      const id = Number(button.closest("li").querySelector("select").value);
      if (!products.some(item => item.id === id) || selectedIds.some((value, position) => position !== index && value === id)) return;
      selectedIds[index] = id;
      editingIndex = null;
    } else if (action === "remove") {
      if (!window.confirm('Xóa "' + (product?.name || "sản phẩm") + '" khỏi mục này? Sản phẩm vẫn được giữ trong cửa hàng.')) return;
      selectedIds.splice(index, 1);
      editingIndex = null;
    } else if (["up", "down"].includes(action)) {
      const next = index + (action === "up" ? -1 : 1);
      if (next < 0 || next >= selectedIds.length) return;
      [selectedIds[index], selectedIds[next]] = [selectedIds[next], selectedIds[index]];
      editingIndex = null;
    } else return;
    renderList();
    if (action === "edit") list.querySelector(".home-section-replace-select")?.focus();
    else if (action === "remove") productPicker.focus();
    else list.querySelector('[data-home-section-action="edit"][data-index="' + Math.min(index, selectedIds.length - 1) + '"]')?.focus();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!canEdit() || conflict || !dirty()) return;
    if (editingIndex !== null) {
      status("Áp dụng hoặc hủy sản phẩm thay thế trước khi lưu mục.", true);
      list.querySelector(".home-section-replace-select")?.focus();
      return;
    }
    fields.title.value = fields.title.value.trim();
    fields.subtitle.value = fields.subtitle.value.trim();
    if (!form.reportValidity()) return;
    const payload = { ...data(), revision: snapshot.revision };
    try {
      validateSection({ ...payload, key: snapshot.key });
    } catch {
      status("Kiểm tra tiêu đề, mô tả và số lượng từ 1 đến 12 trước khi lưu.", true);
      return;
    }
    const key = snapshot.key;
    const version = generation;
    const current = new AbortController();
    controller = current;
    ownsBusy = true;
    hooks.setBusy(true);
    status("Đang lưu khu vực sản phẩm...");
    saveButton.textContent = "Đang lưu...";
    try {
      const { response, result } = await request("/home-sections/" + key, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
      }, version);
      if (version !== generation || !hooks.isActive()) return;
      if (!response.ok) {
        const detail = typeof result?.error === "string" ? result.error : "Chưa lưu được khu vực sản phẩm.";
        conflict = response.status === 409;
        status(detail + (conflict
          ? " Bản đang sửa được giữ nguyên. Bấm Tải lại các mục để lấy phiên bản mới; bạn sẽ được hỏi trước khi bỏ bản đang sửa."
          : " Bản đang sửa được giữ lại. Kiểm tra thông tin rồi thử lưu lại."), true);
        return;
      }
      validateSection(result);
      if (result.key !== key || result.revision < payload.revision
        || JSON.stringify(savedData(result)) !== JSON.stringify(savedData(payload))) {
        throw new Error("Kết quả lưu chưa khớp nội dung đã gửi.");
      }
      sections = sections.map(item => item.key === key ? result : item);
      fill(result);
      status('Đã lưu mục "' + result.title + '". Tải lại trang chủ để xem thay đổi.');
    } catch {
      if (version !== generation || !hooks.isActive()) return;
      status("Chưa xác nhận được kết quả lưu. Bản đang sửa được giữ lại. Bạn có thể thử lưu lại hoặc Tải lại các mục để kiểm tra.", true);
    } finally {
      if (version === generation) {
        controller = null;
        ownsBusy = false;
        saveButton.textContent = "Lưu mục";
        updateDraft();
        hooks.finish(conflict ? reloadButton : saveButton);
      }
    }
  });

  window.ShopAdminHomeSections = {
    configure(value) { hooks = value; controls(); },
    load, clear, setBusy: controls,
    get ready() { return ready; }
  };
})();
