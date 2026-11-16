(() => {
  const forgotForm = document.getElementById("forgot-password-form");
  const resetForm = document.getElementById("reset-password-form");
  const form = forgotForm ?? resetForm;
  if (!form) return;
  const emailField = document.getElementById("recovery-email");
  const passwordField = document.getElementById("recovery-password");
  const confirmField = document.getElementById("recovery-confirm");
  const showPassword = document.getElementById("recovery-show-password");
  const submitButton = document.getElementById("recovery-submit");
  const message = document.getElementById("recovery-message");
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  const validToken = /^[a-f0-9]{64}$/.test(token);
  let active = true;
  let controller = null;
  let complete = false;

  function updateControls() {
    const disabled = !active || controller !== null || complete || (resetForm && !validToken);
    for (const field of [emailField, passwordField, confirmField, showPassword, submitButton]) {
      if (field) field.disabled = Boolean(disabled);
    }
    form.setAttribute("aria-busy", String(controller !== null));
    submitButton.textContent = controller ? "Đang xử lý..." : resetForm ? "Đặt lại mật khẩu" : "Gửi yêu cầu";
  }

  function clearPasswords() {
    if (passwordField) passwordField.value = "";
    if (confirmField) confirmField.value = "";
    if (showPassword) showPassword.checked = false;
    if (passwordField) passwordField.type = "password";
    if (confirmField) confirmField.type = "password";
  }

  for (const field of [emailField, passwordField, confirmField]) {
    field?.addEventListener("input", () => {
      field.setCustomValidity("");
      confirmField?.setCustomValidity("");
      if (!controller && !complete) message.textContent = "";
    });
  }
  showPassword?.addEventListener("change", () => {
    for (const field of [passwordField, confirmField]) field.type = showPassword.checked ? "text" : "password";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!active || controller || complete || (resetForm && !validToken)) return;
    if (emailField) emailField.value = emailField.value.trim();
    if (confirmField) {
      confirmField.setCustomValidity(passwordField.value === confirmField.value ? "" : "Hai mật khẩu chưa khớp.");
    }
    if (!form.reportValidity()) return;
    const current = new AbortController();
    controller = current;
    message.textContent = "Đang xử lý yêu cầu...";
    updateControls();
    try {
      const response = await fetch(resetForm ? "/api/account/reset-password" : "/api/account/forgot-password", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetForm ? { token, password: passwordField.value } : { email: emailField.value }),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || controller !== current) return;
      if (!response.ok) {
        message.textContent = typeof result?.error === "string" ? result.error : "Yêu cầu chưa hoàn tất. Hãy thử lại.";
        if (result?.field === "token") complete = true;
        return;
      }
      if (typeof result?.message !== "string" || result.message.trim() === "") {
        throw new Error("Phản hồi khôi phục mật khẩu chưa hợp lệ");
      }
      message.textContent = result.message;
      if (resetForm) {
        complete = true;
        clearPasswords();
        window.history?.replaceState(null, "", window.location.pathname);
      }
    } catch {
      if (active && controller === current) {
        message.textContent = "Chưa nhận được kết quả. Hãy kiểm tra kết nối và thử lại. Nếu vừa đặt lại mật khẩu, bạn có thể thử đăng nhập.";
      }
    } finally {
      if (controller === current) {
        controller = null;
        updateControls();
      }
    }
  });

  window.addEventListener("pagehide", () => {
    active = false;
    controller?.abort();
    controller = null;
    clearPasswords();
    updateControls();
  });
  window.addEventListener("pageshow", event => {
    active = true;
    if (event.persisted) updateControls();
  });
  if (resetForm && !validToken) {
    message.textContent = "Liên kết đặt lại mật khẩu chưa hợp lệ. Hãy mở liên kết trong email hoặc gửi yêu cầu mới.";
  }
  updateControls();
})();
