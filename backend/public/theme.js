(() => {
  const themeKey = "toothpaste-theme";
  const unsavedMessage = "Đã đổi giao diện cho trang này. Trình duyệt chưa lưu được lựa chọn để dùng cho lần mở sau.";
  const root = document.documentElement;
  let activeTheme = "light";
  let unsavedTheme = false;
  let controls = [];
  let persistenceMessage = "";

  function validTheme(value) {
    return value === "light" || value === "dark";
  }

  function readCookieTheme() {
    try {
      const entry = document.cookie.split(";")
        .map(value => value.trimStart())
        .find(value => value.startsWith(themeKey + "="));
      const value = entry?.slice(themeKey.length + 1);
      return validTheme(value) ? value : null;
    } catch {
      return null;
    }
  }

  function readSavedTheme() {
    const cookieTheme = readCookieTheme();
    if (cookieTheme !== null) return cookieTheme;
    try {
      const value = window.localStorage.getItem(themeKey);
      return validTheme(value) ? value : "light";
    } catch {
      return "light";
    }
  }

  function renderControls() {
    const dark = activeTheme === "dark";
    for (const button of controls) {
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "Chuyển sang chế độ sáng" : "Bật chế độ tối";
    }
    const message = document.getElementById("theme-message");
    if (message) message.textContent = persistenceMessage;
  }

  function applyTheme(theme) {
    activeTheme = theme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    renderControls();
  }

  function saveCookie(theme) {
    try {
      document.cookie = themeKey + "=" + theme +
        "; Path=/; SameSite=Lax; Max-Age=31536000";
      return readCookieTheme() === theme;
    } catch {
      return false;
    }
  }

  function saveLocalTheme(theme) {
    try {
      window.localStorage.setItem(themeKey, theme);
      return window.localStorage.getItem(themeKey) === theme;
    } catch {
      return false;
    }
  }

  function persistTheme(theme) {
    const cookieSaved = saveCookie(theme);
    const localSaved = saveLocalTheme(theme);
    const staleCookie = !cookieSaved && readCookieTheme() !== null;
    unsavedTheme = (!cookieSaved && !localSaved) || staleCookie;
    persistenceMessage = unsavedTheme ? unsavedMessage : "";
    renderControls();
  }

  function initializeControls() {
    controls = [...document.querySelectorAll("[data-theme-toggle]")];
    for (const button of controls) {
      button.addEventListener("click", () => {
        const nextTheme = activeTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        persistTheme(nextTheme);
      });
    }
    renderControls();
  }

  applyTheme(readSavedTheme());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeControls, { once: true });
  } else {
    initializeControls();
  }

  window.addEventListener("pageshow", () => {
    if (!unsavedTheme) applyTheme(readSavedTheme());
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== themeKey && event.key !== null) return;
    if (event.key !== null && event.newValue !== null && !validTheme(event.newValue)) return;

    let incomingTheme = event.key === null ? null : event.newValue;
    try {
      const localStore = window.localStorage;
      if (event.storageArea && event.storageArea !== localStore) return;
      const latestTheme = localStore.getItem(themeKey);
      if (latestTheme !== null && !validTheme(latestTheme)) return;
      // Queued events can describe a preference older than the current store.
      incomingTheme = latestTheme;
    } catch {
      // The validated event still supplies a theme when storage cannot be read.
    }

    if (incomingTheme === null) {
      try {
        document.cookie = themeKey + "=; Path=/; SameSite=Lax; Max-Age=0";
      } catch {
        // Keep the current tab aligned with the cleared preference.
      }
      unsavedTheme = readCookieTheme() === "dark";
      persistenceMessage = unsavedTheme ? unsavedMessage : "";
      applyTheme("light");
      return;
    }

    const cookieSaved = saveCookie(incomingTheme);
    unsavedTheme = !cookieSaved && readCookieTheme() !== null;
    persistenceMessage = unsavedTheme ? unsavedMessage : "";
    applyTheme(incomingTheme);
  });
})();
