(() => {
  const loginForm = document.getElementById("customer-login-form");
  const registerForm = document.getElementById("customer-register-form");
  const form = registerForm || loginForm;
  const formPanel = document.getElementById("account-form-panel");
  const pageTitle = document.getElementById("account-page-title");
  const signedInPanel = document.getElementById("account-signed-in");
  const accountName = document.getElementById("account-customer-name");
  const accountEmail = document.getElementById("account-customer-email");
  const status = document.getElementById("account-status");
  const submitButton = document.getElementById("account-submit");
  const logoutButton = document.getElementById("account-logout");
  const retryButton = document.getElementById("account-retry");
  const continueLink = document.getElementById("account-continue");
  const showPassword = document.getElementById("account-show-password");
  const profileForm = document.getElementById("account-profile-form");
  const saveProfileButton = document.getElementById("account-save-profile");
  const profileMessage = document.getElementById("account-profile-message");
  const fields = {
    name: document.getElementById("account-name"),
    email: document.getElementById("account-email"),
    phone: document.getElementById("account-phone"),
    address: document.getElementById("account-address"),
    password: document.getElementById("account-password"),
    passwordConfirm: document.getElementById("account-password-confirm")
  };
  const profileFields = {
    name: document.getElementById("profile-name"),
    phone: document.getElementById("profile-phone"),
    address: document.getElementById("profile-address")
  };
  const returnTargets = new Set(["/", "/kem-danh-rang.html", "/san-pham.html", "/gio-hang.html", "/tra-cuu.html", "/don-hang.html"]);
  function safeReturnTarget(value) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin && returnTargets.has(url.pathname)
        ? url.pathname + url.search + url.hash : null;
    } catch {
      return null;
    }
  }
  const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = form
    ? (safeReturnTarget(requestedReturn) || "/")
    : (safeReturnTarget(window.location.pathname + window.location.search) || "/");
  let activeRequest = null;
  let busy = false;
  let pageActive = true;
  let knownAccount;
  const avatarColors = [
    ["#164e63", "#cffafe"],
    ["#14532d", "#dcfce7"],
    ["#4c1d95", "#ede9fe"],
    ["#831843", "#fce7f3"],
    ["#7c2d12", "#ffedd5"],
    ["#1e3a8a", "#dbeafe"],
    ["#713f12", "#fef9c3"],
    ["#334155", "#f1f5f9"]
  ];
  const avatarSeed = readAvatarSeed();

  function readAvatarSeed() {
    const key = "toothpaste-avatar-color-seed";
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && /^\d{1,10}$/.test(saved)) {
        const value = Number(saved);
        if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff) return value;
      }
    } catch {}
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    try {
      localStorage.setItem(key, String(value));
    } catch {}
    return value;
  }

  function headerIdentity(name) {
    const words = name.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
    const chosen = words.length > 1 ? [words[0], words[words.length - 1]] : words;
    const initials = chosen.length === 1 ? Array.from(chosen[0]).slice(0, 2).join("")
      : chosen.map(word => Array.from(word)[0]).join("");
    return {
      name: chosen.join(" ") || "Khách hàng",
      initials: initials.toLocaleUpperCase("vi-VN") || "KH"
    };
  }

  function renderHeaderAccount(link, account) {
    const label = link.querySelector("[data-account-label]");
    const greeting = link.querySelector(".header-link-label");
    const identity = account ? headerIdentity(account.name) : null;
    if (label) {
      label.textContent = identity?.name || "Đăng nhập";
    } else {
      link.textContent = identity ? "Xin chào " + identity.name : "Đăng nhập";
    }
    if (greeting) greeting.textContent = identity ? "Xin chào" : "Tài khoản";
    link.classList.toggle("has-account-avatar", account !== null);
    let avatar = link.querySelector(".account-header-avatar");
    if (identity) {
      if (!avatar) {
        avatar = document.createElement("span");
        avatar.className = "account-header-avatar";
        avatar.setAttribute("aria-hidden", "true");
        link.prepend(avatar);
      }
      const colors = avatarColors[(avatarSeed % avatarColors.length + account.id % avatarColors.length) % avatarColors.length];
      avatar.textContent = identity.initials;
      avatar.style.setProperty("--account-avatar-background", colors[0]);
      avatar.style.setProperty("--account-avatar-text", colors[1]);
    } else {
      avatar?.remove();
    }
    const accessibleLabel = identity ? "Xin chào " + identity.name + ", mở tài khoản" : "Tài khoản, Đăng nhập";
    link.setAttribute("aria-label", accessibleLabel);
    link.title = accessibleLabel;
    link.href = authUrl("/dang-nhap.html");
  }

  function authUrl(path) {
    return path + (returnTo === "/" ? "" : "?returnTo=" + encodeURIComponent(returnTo));
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setBusy(value) {
    busy = value;
    for (const control of [...Object.values(fields), ...Object.values(profileFields),
      showPassword, submitButton, logoutButton, retryButton, saveProfileButton]) {
      if (control) control.disabled = value;
    }
    form?.setAttribute("aria-busy", String(value));
    signedInPanel?.setAttribute("aria-busy", String(value));
    profileForm?.setAttribute("aria-busy", String(value));
    if (!value) {
      if (submitButton) submitButton.textContent = registerForm ? "Tạo tài khoản" : "Đăng nhập";
      if (logoutButton) logoutButton.textContent = "Đăng xuất";
      if (saveProfileButton) saveProfileButton.textContent = "Lưu thông tin";
    }
  }

  function validateAccount(account) {
    const phone = account?.phone === undefined ? "" : account.phone;
    const address = account?.address === undefined ? "" : account.address;
    if (!account || !Number.isSafeInteger(account.id) || account.id < 1 ||
      typeof account.name !== "string" || account.name.length > 120 ||
      typeof account.email !== "string" || account.email.trim() === "" || account.email.length > 254 ||
      typeof phone !== "string" || phone.length > 32 ||
      typeof address !== "string" || address.length > 500) {
      throw new Error("Thông tin tài khoản chưa hợp lệ");
    }
    return { id: account.id, name: account.name, email: account.email, phone, address };
  }

  function renderAccount(account, preserveProfile = false) {
    if (account !== null) account = validateAccount(account);
    for (const link of document.querySelectorAll("[data-account-link]")) {
      renderHeaderAccount(link, account);
    }
    if (formPanel) formPanel.hidden = account !== null;
    if (pageTitle) {
      const title = account ? "Tài khoản" : (registerForm ? "Đăng ký" : "Đăng nhập");
      pageTitle.textContent = title;
      document.title = title + " — Cửa hàng kem đánh răng";
    }
    if (signedInPanel) signedInPanel.hidden = account === null;
    if (accountName) accountName.textContent = account?.name || "";
    if (accountEmail) accountEmail.textContent = account?.email || "";
    if (!preserveProfile || account === null) {
      for (const [key, field] of Object.entries(profileFields)) {
        if (field) field.value = account?.[key] || "";
      }
      clearErrors(profileFields);
      if (profileMessage) profileMessage.textContent = "";
    }
    if (retryButton) retryButton.hidden = true;
  }

  function acceptAccount(account, preserveProfile = false) {
    const nextAccount = account === null ? null : validateAccount(account);
    const changed = JSON.stringify(knownAccount) !== JSON.stringify(nextAccount);
    knownAccount = nextAccount === null ? null : { ...nextAccount };
    renderAccount(nextAccount, preserveProfile);
    if (changed) {
      window.dispatchEvent(new CustomEvent("shop-account-change", {
        detail: { account: nextAccount === null ? null : { ...nextAccount } }
      }));
    }
  }

  function clearFieldError(field) {
    if (!field) return;
    field.setCustomValidity("");
    field.removeAttribute("aria-invalid");
    const error = document.getElementById(field.id + "-error");
    if (error) error.textContent = "";
  }

  function clearErrors(group = fields) {
    for (const field of Object.values(group)) clearFieldError(field);
  }

  function showFieldError(field, message) {
    field.setCustomValidity(message);
    field.setAttribute("aria-invalid", "true");
    const error = document.getElementById(field.id + "-error");
    if (error) error.textContent = message;
  }

  function validateShipping(group) {
    const phone = group.phone.value;
    const digits = phone.replace(/\D/g, "").length;
    if (phone.length > 32 || !/^[+\d() -]+$/.test(phone) || digits < 8 || digits > 15) {
      showFieldError(group.phone, "Nhập số điện thoại có từ 8 đến 15 chữ số, tối đa 32 ký tự.");
      return group.phone;
    }
    if (group.address.value.length < 5 || group.address.value.length > 500) {
      showFieldError(group.address, "Nhập địa chỉ nhận hàng có từ 5 đến 500 ký tự.");
      return group.address;
    }
    return null;
  }

  function clearPasswords() {
    for (const field of [fields.password, fields.passwordConfirm]) {
      if (field) {
        field.value = "";
        field.type = "password";
      }
    }
    if (showPassword) showPassword.checked = false;
  }

  function startRequest(message) {
    const controller = new AbortController();
    activeRequest = controller;
    setBusy(true);
    setStatus(message);
    if (retryButton) retryButton.hidden = true;
    return controller;
  }

  function isCurrent(controller) {
    return pageActive && activeRequest === controller && !controller.signal.aborted;
  }

  function finishRequest(controller, focusTarget) {
    if (activeRequest !== controller) return;
    activeRequest = null;
    setBusy(false);
    if (pageActive) focusTarget?.focus();
  }

  async function request(path, options, controller) {
    const response = await fetch("/api/account" + path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      ...options
    });
    const result = await response.json().catch(() => null);
    return { response, result };
  }

  async function readSession(controller) {
    const { response, result } = await request("/me", {}, controller);
    if (response.status === 401) return null;
    if (!response.ok || response.status !== 200) throw new Error("Kiểm tra phiên gặp lỗi");
    return validateAccount(result);
  }

  async function checkSession(focusAfter = false) {
    if (busy || !pageActive) return;
    const controller = startRequest("Đang kiểm tra phiên đăng nhập...");
    let focusTarget;
    try {
      const account = await readSession(controller);
      if (!isCurrent(controller)) return;
      acceptAccount(account);
      setStatus("");
      if (focusAfter) focusTarget = account ? logoutButton : fields.email;
    } catch {
      if (!isCurrent(controller)) return;
      renderAccount(null);
      setStatus("Chưa kiểm tra được phiên. Bạn có thể đăng nhập hoặc bấm Kiểm tra lại phiên.");
      if (retryButton) retryButton.hidden = false;
      if (focusAfter) focusTarget = retryButton;
    } finally {
      finishRequest(controller, focusTarget);
    }
  }

  function finishAuthentication(account, message) {
    acceptAccount(account);
    clearPasswords();
    clearErrors();
    setStatus(message);
    try {
      window.location.assign(returnTo);
      return true;
    } catch {
      setStatus("Đã đăng nhập. Bấm Tiếp tục mua sắm để tiếp tục.");
      return false;
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !pageActive) return;
    clearErrors();
    fields.email.value = fields.email.value.trim();
    if (fields.name) fields.name.value = fields.name.value.trim();
    if (fields.phone) fields.phone.value = fields.phone.value.trim();
    if (fields.address) fields.address.value = fields.address.value.trim();
    if (!form.reportValidity()) return;
    if (registerForm) {
      const invalidField = validateShipping(fields);
      if (invalidField) {
        invalidField.focus();
        return;
      }
    }
    if (registerForm && fields.password.value !== fields.passwordConfirm.value) {
      showFieldError(fields.passwordConfirm, "Mật khẩu nhập lại chưa khớp.");
      fields.passwordConfirm.focus();
      return;
    }

    const creating = registerForm !== null;
    const data = { email: fields.email.value, password: fields.password.value };
    if (creating) {
      data.name = fields.name.value;
      data.phone = fields.phone.value;
      data.address = fields.address.value;
    }
    const controller = startRequest(creating ? "Đang tạo tài khoản..." : "Đang đăng nhập...");
    submitButton.textContent = creating ? "Đang tạo tài khoản..." : "Đang đăng nhập...";
    let navigating = false;
    let serverError = "";
    let focusTarget = submitButton;
    try {
      const { response, result } = await request(creating ? "/register" : "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }, controller);
      if (!isCurrent(controller)) return;
      if (response.status >= 500) {
        serverError = typeof result?.error === "string" && result.error.trim() !== "" ? result.error : "";
        throw new Error("Chưa xác nhận được kết quả đăng nhập");
      }
      if (!response.ok) {
        const message = typeof result?.error === "string" && result.error.trim() !== ""
          ? result.error : "Chưa hoàn tất yêu cầu. Hãy thử lại.";
        const field = typeof result?.field === "string" && Object.hasOwn(fields, result.field)
          ? fields[result.field] : null;
        if (field) {
          showFieldError(field, message);
          setStatus("");
          focusTarget = field;
        } else {
          setStatus(message);
        }
        return;
      }
      if (response.status !== (creating ? 201 : 200)) throw new Error("Kết quả đăng nhập chưa hợp lệ");
      validateAccount(result);
      if (result.email.toLowerCase() !== data.email.toLowerCase()) {
        throw new Error("Tài khoản trả về chưa khớp email đăng nhập");
      }
      navigating = finishAuthentication(result, creating
        ? "Đã tạo tài khoản. Đang mở cửa hàng..." : "Đã đăng nhập. Đang mở cửa hàng...");
      focusTarget = continueLink;
    } catch {
      if (!isCurrent(controller)) return;
      setStatus("Chưa xác nhận được kết quả. Đang kiểm tra phiên đăng nhập...");
      try {
        const account = await readSession(controller);
        if (!isCurrent(controller)) return;
        if (account && account.email.toLowerCase() === data.email.toLowerCase()) {
          navigating = finishAuthentication(account, "Đã đăng nhập. Đang mở cửa hàng...");
          focusTarget = continueLink;
        } else {
          acceptAccount(account);
          setStatus(serverError || "Chưa xác nhận được kết quả. Hãy kiểm tra thông tin và thử lại.");
        }
      } catch {
        if (!isCurrent(controller)) return;
        renderAccount(null);
        setStatus(serverError || "Chưa xác nhận được kết quả. Kiểm tra kết nối rồi thử lại hoặc bấm Kiểm tra lại phiên.");
        retryButton.hidden = false;
      }
    } finally {
      if (!navigating) finishRequest(controller, focusTarget);
    }
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !pageActive || !knownAccount) return;
    clearErrors(profileFields);
    for (const field of Object.values(profileFields)) field.value = field.value.trim();
    if (!profileForm.reportValidity()) return;
    const invalidField = validateShipping(profileFields);
    if (invalidField) {
      invalidField.focus();
      return;
    }

    const data = {
      name: profileFields.name.value,
      phone: profileFields.phone.value,
      address: profileFields.address.value
    };
    const expectedId = knownAccount.id;
    const controller = startRequest("");
    profileMessage.textContent = "Đang lưu thông tin nhận hàng...";
    saveProfileButton.textContent = "Đang lưu thông tin...";
    let focusTarget = saveProfileButton;
    let serverError = "";
    try {
      const { response, result } = await request("/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Customer-Id": String(expectedId) },
        body: JSON.stringify(data)
      }, controller);
      if (!isCurrent(controller)) return;
      if (response.status === 401 || response.status >= 500) {
        serverError = typeof result?.error === "string" && result.error.trim() !== "" ? result.error : "";
        throw new Error("Chưa xác nhận được kết quả lưu hồ sơ");
      }
      if (!response.ok) {
        const message = typeof result?.error === "string" && result.error.trim() !== ""
          ? result.error : "Lưu thông tin gặp lỗi. Hãy thử lại.";
        const field = typeof result?.field === "string" && Object.hasOwn(profileFields, result.field)
          ? profileFields[result.field] : null;
        if (field) {
          showFieldError(field, message);
          profileMessage.textContent = "";
          focusTarget = field;
        } else {
          profileMessage.textContent = message;
        }
        return;
      }
      const account = validateAccount(result);
      if (response.status !== 200 || account.id !== expectedId ||
        !Object.entries(data).every(([key, value]) => account[key] === value)) {
        throw new Error("Kết quả lưu hồ sơ chưa hợp lệ");
      }
      acceptAccount(account);
      profileMessage.textContent = "Đã lưu thông tin nhận hàng.";
    } catch {
      if (!isCurrent(controller)) return;
      profileMessage.textContent = "Chưa xác nhận được kết quả lưu. Đang kiểm tra thông tin tài khoản...";
      try {
        const account = await readSession(controller);
        if (!isCurrent(controller)) return;
        if (account === null) {
          acceptAccount(null);
          setStatus("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
          focusTarget = fields.email;
        } else if (account.id !== expectedId) {
          acceptAccount(account);
          setStatus("Phiên đăng nhập đã thay đổi. Hãy kiểm tra thông tin tài khoản trước khi lưu.");
          focusTarget = logoutButton;
        } else {
          const saved = Object.entries(data).every(([key, value]) => account[key] === value);
          acceptAccount(account, !saved);
          profileMessage.textContent = saved
            ? "Đã lưu thông tin nhận hàng."
            : (serverError || "Chưa xác nhận được kết quả lưu. Thông tin đang nhập được giữ lại. Kiểm tra rồi bấm Lưu thông tin để thử lại.");
        }
      } catch {
        if (!isCurrent(controller)) return;
        profileMessage.textContent = serverError ||
          "Chưa xác nhận được kết quả lưu. Thông tin đang nhập được giữ lại. Kiểm tra kết nối rồi thử lại.";
        retryButton.hidden = false;
      }
    } finally {
      finishRequest(controller, focusTarget);
    }
  });

  logoutButton?.addEventListener("click", async () => {
    if (busy || !pageActive) return;
    const controller = startRequest("Đang đăng xuất...");
    logoutButton.textContent = "Đang đăng xuất...";
    let focusTarget = logoutButton;
    try {
      const { response, result } = await request("/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }, controller);
      if (!isCurrent(controller)) return;
      if ([400, 403, 429].includes(response.status)) {
        setStatus(typeof result?.error === "string" && result.error.trim() !== ""
          ? result.error : "Đăng xuất gặp lỗi. Hãy thử lại.");
        return;
      }
      if (response.status !== 401 && (!response.ok || typeof result?.message !== "string")) {
        throw new Error("Chưa xác nhận được đăng xuất");
      }
      acceptAccount(null);
      clearPasswords();
      clearErrors();
      setStatus("Đã đăng xuất.");
      focusTarget = fields.email;
    } catch {
      if (!isCurrent(controller)) return;
      try {
        const account = await readSession(controller);
        if (!isCurrent(controller)) return;
        acceptAccount(account);
        if (account === null) {
          clearPasswords();
          clearErrors();
          setStatus("Đã đăng xuất.");
          focusTarget = fields.email;
        } else {
          setStatus("Phiên đăng nhập đang hoạt động. Bấm Đăng xuất để thử lại.");
        }
      } catch {
        if (!isCurrent(controller)) return;
        setStatus("Chưa xác nhận được kết quả đăng xuất. Kiểm tra kết nối rồi bấm Đăng xuất để thử lại.");
      }
    } finally {
      finishRequest(controller, focusTarget);
    }
  });

  for (const field of Object.values(fields)) {
    field?.addEventListener("input", () => {
      clearFieldError(field);
      if (field === fields.password) clearFieldError(fields.passwordConfirm);
      if (!busy) setStatus("");
    });
  }
  for (const field of Object.values(profileFields)) {
    field?.addEventListener("input", () => {
      clearFieldError(field);
      if (!busy) profileMessage.textContent = "";
    });
  }
  showPassword?.addEventListener("change", () => {
    for (const field of [fields.password, fields.passwordConfirm]) {
      if (field) field.type = showPassword.checked ? "text" : "password";
    }
  });
  retryButton?.addEventListener("click", () => checkSession(true));
  if (continueLink) continueLink.href = returnTo;
  for (const link of document.querySelectorAll("[data-auth-link]")) {
    link.href = authUrl(link.dataset.authLink === "register" ? "/dang-ky.html" : "/dang-nhap.html");
  }

  window.addEventListener("pagehide", () => {
    pageActive = false;
    activeRequest?.abort();
    activeRequest = null;
    setBusy(false);
    clearPasswords();
    clearErrors();
    renderAccount(null);
    setStatus("");
  });
  window.addEventListener("pageshow", (event) => {
    pageActive = true;
    if (event.persisted) void checkSession();
  });
  renderAccount(null);
  void checkSession();
})();
