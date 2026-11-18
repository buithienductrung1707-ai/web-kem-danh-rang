(() => {
  const panel = document.getElementById("account-signed-in");
  if (!panel?.classList.contains("account-dashboard")) return;
  const get = id => document.getElementById(id);
  const profileForm = get("dashboard-profile-form");
  const passwordForm = get("dashboard-password-form");
  const addressForm = get("dashboard-address-form");
  const dialog = get("dashboard-address-dialog");
  const profileFields = {
    familyName: get("dashboard-family-name"),
    givenName: get("dashboard-given-name"),
    phone: get("dashboard-profile-phone")
  };
  const passwordFields = {
    currentPassword: get("dashboard-current-password"),
    newPassword: get("dashboard-new-password"),
    confirmPassword: get("dashboard-confirm-password")
  };
  const addressFields = {
    recipientName: get("dashboard-address-name"),
    phone: get("dashboard-address-phone"),
    address: get("dashboard-address-text"),
    isDefault: get("dashboard-address-default")
  };
  const controllers = new Set();
  let hooks = {};
  let account = null;
  let addresses = [];
  let addressLoaded = false;
  let addressLoading = false;
  let authBusy = false;
  let operationBusy = false;
  let profileDirty = false;
  let editingAddress = null;
  let addressRequestId = null;
  let dialogTrigger = null;
  let lifecycle = 0;

  function message(id, text, error = false) {
    const target = get(id);
    target.textContent = text;
    target.classList.toggle("is-error", error);
  }

  function clearErrors(form) {
    for (const field of form.querySelectorAll("input, textarea")) {
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
      const error = get(field.id + "-error");
      if (error) error.textContent = "";
    }
  }

  function fieldError(field, text) {
    field.setCustomValidity(text);
    field.setAttribute("aria-invalid", "true");
    const target = get(field.id + "-error");
    if (target) target.textContent = text;
    field.focus();
  }

  function syncBusy() {
    const busy = authBusy || operationBusy || addressLoading;
    for (const control of panel.querySelectorAll(`
      #account-settings-view :is(button, input, textarea),
      #dashboard-address-dialog :is(button, input, textarea),
      #account-logout
    `)) {
      control.disabled = busy;
    }
    get("dashboard-add-address").disabled = busy || !addressLoaded || addresses.length >= 5;
    addressFields.isDefault.disabled = busy || Boolean(editingAddress?.isDefault) || addresses.length === 0;
    panel.setAttribute("aria-busy", String(busy));
    hooks.onBusy?.(busy);
  }

  function replaceAccount(next) {
    if (typeof hooks.acceptAccount === "function") hooks.acceptAccount(next);
    else render(next);
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    controllers.add(controller);
    const expectedLifecycle = lifecycle;
    const expectedId = account?.id;
    try {
      const response = await fetch("/api/account" + path, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: { "X-Customer-Id": String(expectedId), ...options.headers },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])
      });
      const result = await response.json().catch(() => null);
      if (expectedLifecycle !== lifecycle || account?.id !== expectedId) {
        throw new DOMException("Phiên tài khoản đã thay đổi", "AbortError");
      }
      if (!response.ok) {
        const error = new Error(typeof result?.error === "string" ? result.error : "Chưa hoàn tất yêu cầu. Hãy thử lại.");
        error.status = response.status;
        error.field = result?.field;
        if (response.status === 401 || result?.passwordChanged) {
          hooks.onUnauthorized?.(result?.passwordChanged ? error.message : undefined);
        }
        throw error;
      }
      return result;
    } finally {
      controllers.delete(controller);
    }
  }

  function jsonOptions(method, body) {
    return {
      method,
      headers: { "Content-Type": "application/json", "X-Customer-Id": String(account.id) },
      body: JSON.stringify(body)
    };
  }

  async function operation(statusId, loading, action, fields) {
    if (!account || authBusy || operationBusy || addressLoading) return;
    const expectedLifecycle = lifecycle;
    operationBusy = true;
    syncBusy();
    message(statusId, loading);
    try {
      await action();
    } catch (error) {
      if (expectedLifecycle !== lifecycle || error.name === "AbortError") return;
      const addressChanged = [404, 409].includes(error.status) && statusId.includes("address");
      const text = addressChanged
        ? error.message + (dialog.open ? " Đóng cửa sổ rồi bấm Tải lại địa chỉ để cập nhật danh sách." : " Bấm Tải lại địa chỉ để cập nhật danh sách.")
        : error.status ? error.message : "Chưa xác nhận được kết quả. Kiểm tra kết nối rồi thử lại.";
      if (fields?.[error.field]) {
        fieldError(fields[error.field], text);
        requestAnimationFrame(() => fields[error.field]?.focus());
      }
      message(statusId, text, true);
      if (addressChanged) {
        get("dashboard-reload-addresses").hidden = false;
      }
    } finally {
      if (expectedLifecycle === lifecycle) {
        operationBusy = false;
        syncBusy();
      }
    }
  }

  function renderIdentity() {
    get("account-customer-name").textContent = account.name;
    get("dashboard-customer-phone").textContent = account.phone || "Chưa có số điện thoại";
    get("dashboard-customer-code").textContent = "KH" + String(account.id).padStart(6, "0");
    const words = account.name.trim().split(/\s+/u).filter(Boolean);
    const identity = hooks.identityFor?.(account);
    const initials = identity?.initials || (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "KH").slice(0, 2));
    const headerAvatar = document.querySelector("[data-account-link] .account-header-avatar");
    const colors = headerAvatar ? getComputedStyle(headerAvatar) : null;
    for (const avatar of panel.querySelectorAll("[data-dashboard-avatar]")) {
      avatar.replaceChildren();
      if (identity || colors) {
        avatar.style.setProperty("--account-avatar-background", identity?.background || colors.getPropertyValue("--account-avatar-background"));
        avatar.style.setProperty("--account-avatar-text", identity?.color || colors.getPropertyValue("--account-avatar-text"));
      }
      if (account.avatarUrl) {
        const image = document.createElement("img");
        image.src = account.avatarUrl;
        image.alt = "";
        image.width = 80;
        image.height = 80;
        image.addEventListener("error", () => {
          if (image.parentElement === avatar) avatar.textContent = initials.toLocaleUpperCase("vi-VN");
        }, { once: true });
        avatar.append(image);
      } else {
        avatar.textContent = initials.toLocaleUpperCase("vi-VN");
      }
    }
    get("dashboard-remove-avatar").hidden = !account.avatarUrl;
  }

  function fillProfile() {
    const words = account.name.trim().split(/\s+/u).filter(Boolean);
    profileFields.familyName.value = words.shift() || "";
    profileFields.givenName.value = words.join(" ");
    profileFields.phone.value = account.phone || "";
    get("account-customer-email").value = account.email;
    profileDirty = false;
    clearErrors(profileForm);
  }

  function render(next) {
    const changedUser = next?.id !== account?.id;
    account = next;
    panel.closest(".account-shell")?.classList.toggle("has-account-dashboard", Boolean(next));
    if (!next || changedUser) {
      lifecycle += 1;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      addresses = [];
      addressLoaded = false;
      addressLoading = false;
      profileDirty = false;
      operationBusy = false;
      dialog.close();
      passwordForm.reset();
      for (const field of Object.values(passwordFields)) field.type = "password";
      for (const status of panel.querySelectorAll(".dashboard-message")) status.textContent = "";
      get("dashboard-addresses").replaceChildren();
      selectTab("profile");
    }
    if (!next) {
      profileForm.reset();
      addressForm.reset();
      editingAddress = null;
      addressRequestId = null;
      for (const id of ["account-customer-name", "dashboard-customer-phone", "dashboard-customer-code"]) {
        get(id).textContent = "";
      }
      for (const avatar of panel.querySelectorAll("[data-dashboard-avatar]")) avatar.replaceChildren();
      for (const form of [profileForm, passwordForm, addressForm]) clearErrors(form);
      return;
    }
    renderIdentity();
    if (!profileDirty || changedUser) fillProfile();
    syncBusy();
    if (changedUser && hooks.isActive?.() !== false) void loadAddresses();
  }

  function acceptBook(result) {
    const entries = result?.addresses;
    if (!Array.isArray(entries) || entries.length > 5 || !result.customer || result.customer.id !== account.id ||
      entries.some(address => !Number.isSafeInteger(address?.id) || address.id < 1 ||
        typeof address.recipientName !== "string" || !address.recipientName.trim() || address.recipientName.length > 120 ||
        typeof address.phone !== "string" || address.phone.length > 32 ||
        typeof address.address !== "string" || address.address.length > 500 ||
        typeof address.isDefault !== "boolean" || !Number.isSafeInteger(address.revision) || address.revision < 0) ||
      new Set(entries.map(address => address.id)).size !== entries.length ||
      (entries.length > 0 && entries.filter(address => address.isDefault).length !== 1)) {
      throw new Error("Danh sách địa chỉ chưa hợp lệ.");
    }
    replaceAccount(result.customer);
    addresses = entries;
    addressLoaded = true;
    renderAddresses();
    get("dashboard-reload-addresses").hidden = true;
    syncBusy();
  }

  async function loadAddresses() {
    if (!account || addressLoading || operationBusy) return;
    const expectedLifecycle = lifecycle;
    addressLoading = true;
    syncBusy();
    message("dashboard-address-message", "Đang tải địa chỉ...");
    get("dashboard-reload-addresses").hidden = true;
    try {
      acceptBook(await request("/addresses"));
      message("dashboard-address-message", "");
    } catch (error) {
      if (expectedLifecycle !== lifecycle || error.name === "AbortError") return;
      message("dashboard-address-message", error.status ? error.message : "Tải địa chỉ gặp lỗi. Hãy thử lại.", true);
      get("dashboard-reload-addresses").hidden = false;
    } finally {
      if (expectedLifecycle === lifecycle) {
        addressLoading = false;
        syncBusy();
      }
    }
  }

  function addressButton(text, action, address) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.dataset.action = action;
    button.dataset.addressId = String(address.id);
    button.setAttribute("aria-label", text + " địa chỉ của " + address.recipientName);
    return button;
  }

  function renderAddresses() {
    const list = get("dashboard-addresses");
    list.replaceChildren();
    get("dashboard-address-help").textContent = "Bạn có thể lưu tối đa 5 địa chỉ (" + addresses.length + "/5). Địa chỉ mặc định được dùng khi đặt hàng.";
    if (!addresses.length) {
      const empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "Bạn chưa có địa chỉ nhận hàng. Thêm địa chỉ để đặt hàng thuận tiện hơn.";
      list.append(empty);
    }
    for (const address of addresses) {
      const item = document.createElement("article");
      item.className = "dashboard-address-item";
      item.classList.toggle("is-default", address.isDefault);
      const info = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = address.recipientName;
      if (address.isDefault) {
        const badge = document.createElement("span");
        badge.className = "dashboard-address-default-badge";
        badge.textContent = "Mặc định";
        title.append(badge);
      }
      const phone = document.createElement("p");
      phone.textContent = address.phone;
      const text = document.createElement("p");
      text.textContent = address.address;
      info.append(title, phone, text);
      const actions = document.createElement("div");
      actions.className = "dashboard-address-actions";
      actions.append(addressButton("Chỉnh sửa", "edit", address), addressButton("Xoá", "delete", address));
      if (!address.isDefault) actions.append(addressButton("Đặt mặc định", "default", address));
      item.append(info, actions);
      list.append(item);
    }
  }

  function selectTab(name, focus = false) {
    for (const value of ["profile", "password"]) {
      const selected = value === name;
      const tab = get("dashboard-" + value + "-tab");
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      get("dashboard-" + value + "-panel").hidden = !selected;
      if (selected && focus) tab.focus();
    }
  }

  for (const name of ["profile", "password"]) {
    const tab = get("dashboard-" + name + "-tab");
    tab.addEventListener("click", () => selectTab(name));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      selectTab(event.key === "Home" ? "profile" : event.key === "End" ? "password" : name === "profile" ? "password" : "profile", true);
    });
  }

  profileForm.addEventListener("input", () => {
    profileDirty = true;
    message("dashboard-profile-message", "");
  });

  get("dashboard-reset-profile").addEventListener("click", () => {
    fillProfile();
    message("dashboard-profile-message", "Đã khôi phục thông tin đã lưu.");
  });

  profileForm.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors(profileForm);
    const name = [profileFields.familyName.value.trim(), profileFields.givenName.value.trim()].filter(Boolean).join(" ");
    if (name.length > 120) {
      fieldError(profileFields.givenName, "Họ và tên cần có tối đa 120 ký tự.");
      return;
    }
    if (!profileForm.reportValidity()) return;
    const data = { name, phone: profileFields.phone.value.trim() };
    void operation("dashboard-profile-message", "Đang cập nhật thông tin...", async () => {
      const result = await request("/profile", jsonOptions("PATCH", data));
      profileDirty = false;
      replaceAccount(result);
      message("dashboard-profile-message", "Đã cập nhật thông tin cá nhân.");
    }, { name: profileFields.familyName, phone: profileFields.phone });
  });

  passwordForm.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors(passwordForm);
    if (!passwordForm.reportValidity()) return;
    if (passwordFields.newPassword.value !== passwordFields.confirmPassword.value) {
      fieldError(passwordFields.confirmPassword, "Mật khẩu nhập lại chưa khớp.");
      return;
    }
    const data = { currentPassword: passwordFields.currentPassword.value, newPassword: passwordFields.newPassword.value };
    void operation("dashboard-password-message", "Đang cập nhật mật khẩu...", async () => {
      const result = await request("/password", jsonOptions("POST", data));
      replaceAccount(result.customer);
      passwordForm.reset();
      for (const field of Object.values(passwordFields)) field.type = "password";
      message("dashboard-password-message", result.message || "Đã cập nhật mật khẩu.");
    }, passwordFields);
  });

  get("dashboard-show-password").addEventListener("change", event => {
    for (const field of Object.values(passwordFields)) field.type = event.target.checked ? "text" : "password";
  });

  function openAddress(address, trigger) {
    if (!account || operationBusy || authBusy || addressLoading) return;
    editingAddress = address || null;
    addressRequestId = crypto.randomUUID();
    dialogTrigger = trigger;
    addressForm.reset();
    clearErrors(addressForm);
    addressFields.recipientName.value = address?.recipientName || account.name;
    addressFields.phone.value = address?.phone || account.phone || "";
    addressFields.address.value = address?.address || "";
    addressFields.isDefault.checked = address?.isDefault || addresses.length === 0;
    get("dashboard-address-dialog-title").textContent = address ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ";
    message("dashboard-address-form-message", "");
    syncBusy();
    dialog.showModal();
    addressFields.recipientName.focus();
  }

  function closeAddress() {
    if (operationBusy) return;
    dialog.close();
  }

  dialog.addEventListener("close", () => {
    addressForm.reset();
    editingAddress = null;
    addressRequestId = null;
    const target = dialogTrigger?.isConnected ? dialogTrigger : get("dashboard-add-address");
    requestAnimationFrame(() => target.focus());
    dialogTrigger = null;
  });
  dialog.addEventListener("cancel", event => {
    if (operationBusy) event.preventDefault();
  });
  get("dashboard-close-address").addEventListener("click", closeAddress);
  get("dashboard-cancel-address").addEventListener("click", closeAddress);
  get("dashboard-add-address").addEventListener("click", event => openAddress(null, event.currentTarget));
  get("dashboard-reload-addresses").addEventListener("click", () => { void loadAddresses(); });

  addressForm.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors(addressForm);
    if (!addressForm.reportValidity()) return;
    const data = {
      recipientName: addressFields.recipientName.value.trim(),
      phone: addressFields.phone.value.trim(),
      address: addressFields.address.value.trim(),
      isDefault: addressFields.isDefault.checked
    };
    if (editingAddress) data.expectedRevision = editingAddress.revision;
    else data.requestId = addressRequestId;
    const path = editingAddress ? "/addresses/" + encodeURIComponent(editingAddress.id) : "/addresses";
    void operation("dashboard-address-form-message", "Đang lưu địa chỉ...", async () => {
      const result = await request(path, jsonOptions(editingAddress ? "PATCH" : "POST", data));
      acceptBook(result);
      dialog.close();
      message("dashboard-address-message", "Đã lưu địa chỉ nhận hàng.");
    }, addressFields);
  });

  get("dashboard-addresses").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || authBusy || operationBusy) return;
    const address = addresses.find(item => String(item.id) === button.dataset.addressId);
    if (!address) return;
    if (button.dataset.action === "edit") {
      openAddress(address, button);
      return;
    }
    if (button.dataset.action === "delete" && !window.confirm("Bạn muốn xoá địa chỉ nhận hàng này?")) return;
    const deleting = button.dataset.action === "delete";
    void operation("dashboard-address-message", deleting ? "Đang xoá địa chỉ..." : "Đang đặt địa chỉ mặc định...", async () => {
      const path = "/addresses/" + encodeURIComponent(address.id);
      const result = deleting
        ? await request(path + "?revision=" + encodeURIComponent(address.revision), { method: "DELETE", headers: { "X-Customer-Id": String(account.id) } })
        : await request(path, jsonOptions("PATCH", {
          recipientName: address.recipientName,
          phone: address.phone,
          address: address.address,
          isDefault: true,
          expectedRevision: address.revision
        }));
      acceptBook(result);
      message("dashboard-address-message", deleting ? "Đã xoá địa chỉ." : "Đã đặt địa chỉ mặc định.");
    });
  });

  async function resizeAvatar(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Chọn ảnh JPG, PNG hoặc WEBP.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Chọn ảnh nhỏ hơn 20 MB để tải lên.");
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 512, 512);
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .88));
      if (!blob) throw new Error("Chưa xử lý được ảnh. Hãy chọn ảnh khác.");
      return blob;
    } finally {
      bitmap.close();
    }
  }

  get("dashboard-change-avatar").addEventListener("click", () => get("dashboard-avatar-file").click());
  get("dashboard-avatar-file").addEventListener("change", event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const expectedLifecycle = lifecycle;
    void operation("dashboard-avatar-message", "Đang xử lý ảnh đại diện...", async () => {
      let blob;
      try { blob = await resizeAvatar(file); }
      catch (error) { error.status = 400; throw error; }
      if (expectedLifecycle !== lifecycle) throw new DOMException("Phiên tài khoản đã thay đổi", "AbortError");
      const result = await request("/avatar", { method: "POST", headers: { "Content-Type": blob.type, "X-Customer-Id": String(account.id) }, body: blob });
      replaceAccount(result);
      message("dashboard-avatar-message", "Đã cập nhật ảnh đại diện.");
    });
  });
  get("dashboard-remove-avatar").addEventListener("click", () => {
    void operation("dashboard-avatar-message", "Đang xoá ảnh đại diện...", async () => {
      replaceAccount(await request("/avatar", { method: "DELETE", headers: { "X-Customer-Id": String(account.id) } }));
      message("dashboard-avatar-message", "Đã dùng lại ảnh đại diện chữ cái.");
    });
  });

  for (const form of [profileForm, passwordForm, addressForm]) {
    form.addEventListener("input", event => {
      if (!event.target.matches("input, textarea")) return;
      event.target.setCustomValidity("");
      event.target.removeAttribute("aria-invalid");
      const error = get(event.target.id + "-error");
      if (error) error.textContent = "";
      if (form === addressForm) addressRequestId = crypto.randomUUID();
    });
  }

  window.ShopAccountDashboard = {
    configure(options) { hooks = options || {}; },
    render,
    setBusy(value) { authBusy = Boolean(value); syncBusy(); }
  };
})();
