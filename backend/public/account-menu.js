(() => {
  const trigger = document.querySelector(".commerce-header [data-account-link]");
  if (!trigger) return;

  const wrapper = document.createElement("div");
  wrapper.className = "account-menu-root";
  trigger.before(wrapper);
  wrapper.append(trigger);
  trigger.classList.add("account-menu-toggle");
  trigger.setAttribute("role", "button");
  trigger.removeAttribute("aria-current");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "header-account-menu");
  trigger.dataset.accountMenuTrigger = "";
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.classList.add("account-menu-chevron");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "1.8");
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';
  trigger.append(chevron);

  const panel = document.createElement("section");
  panel.id = "header-account-menu";
  panel.className = "account-menu-panel";
  panel.dataset.accountMenu = "";
  panel.setAttribute("aria-label", "Menu tài khoản");
  panel.hidden = true;
  panel.innerHTML = `
    <div class="account-menu-identity">
      <span class="account-menu-avatar" aria-hidden="true"></span>
      <div>
        <strong class="account-menu-name"></strong>
        <span class="account-menu-phone"></span>
      </div>
    </div>
    <nav class="account-menu-nav" aria-label="Quản lý tài khoản"></nav>
    <p class="account-menu-message" role="status" aria-atomic="true"></p>
    <button class="account-menu-retry button-secondary" type="button" hidden>Kiểm tra lại phiên</button>
  `;
  document.body.append(panel);
  const navigation = panel.querySelector(".account-menu-nav");
  const avatar = panel.querySelector(".account-menu-avatar");
  const message = panel.querySelector(".account-menu-message");
  const retry = panel.querySelector(".account-menu-retry");
  const icons = {
    cart: '<path d="m3 3 2 2 2.4 11.5h11.2L21 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    orders: '<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3H9Z"/>',
    login: '<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 4H4v16h5m6-12 4 4-4 4m4-4H9"/>'
  };
  let hooks = {};
  let currentId = null;
  let logout = null;
  let busy = false;

  function focusableItems() {
    return [...panel.querySelectorAll("a[href], button:not(:disabled)")].filter(item => !item.hidden);
  }

  function position() {
    if (panel.hidden) return;
    const anchor = trigger.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const top = Math.max(12, Math.min(anchor.bottom + 10, viewportHeight - 100));
    const right = Math.max(12, Math.min(window.innerWidth - anchor.right, window.innerWidth - panel.offsetWidth - 12));
    panel.style.setProperty("--account-menu-top", top + "px");
    panel.style.setProperty("--account-menu-right", right + "px");
    panel.style.setProperty("--account-menu-max-height", Math.max(80, viewportHeight - top - 12) + "px");
  }

  function close(restoreFocus = false) {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  }

  function open(focusFirst = false) {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    position();
    if (focusFirst) focusableItems()[0]?.focus();
  }

  function menuLink(label, href, icon) {
    const link = document.createElement("a");
    link.href = href;
    link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[icon] + '</svg><span></span>';
    link.querySelector("span").textContent = label;
    const current = window.location.pathname + window.location.search;
    if (current === href) link.setAttribute("aria-current", "page");
    link.addEventListener("click", event => {
      if (window.ShopStorefront?.prepareNavigation(event, link) === false) return;
      close();
    });
    navigation.append(link);
  }

  function render(account, identity, authUrl) {
    if (currentId !== (account?.id ?? null)) close();
    currentId = account?.id ?? null;
    avatar.replaceChildren();
    avatar.textContent = identity?.initials ?? "KH";
    avatar.style.setProperty("--account-avatar-background", identity?.background ?? "var(--primary-dark)");
    avatar.style.setProperty("--account-avatar-text", identity?.color ?? "var(--button-text)");
    if (account?.avatarUrl) {
      const photo = document.createElement("img");
      photo.src = account.avatarUrl;
      photo.alt = "";
      photo.width = 48;
      photo.height = 48;
      photo.addEventListener("error", () => {
        if (photo.parentElement === avatar) avatar.textContent = identity.initials;
      }, { once: true });
      avatar.replaceChildren(photo);
    }
    panel.querySelector(".account-menu-name").textContent = identity?.name ?? "Chào mừng bạn";
    panel.querySelector(".account-menu-phone").textContent = account?.phone ||
      (account ? account.email : "Đăng nhập để quản lý tài khoản");
    navigation.replaceChildren();
    logout = null;
    if (!account) {
      menuLink("Đăng nhập", authUrl("/dang-nhap.html"), "login");
      menuLink("Đăng ký tài khoản", authUrl("/dang-ky.html"), "login");
    }
    menuLink("Giỏ hàng của tôi", "/dang-nhap.html?view=cart", "cart");
    if (account) {
      menuLink("Đơn hàng của tôi", "/dang-nhap.html?view=orders", "orders");
      menuLink("Cài đặt tài khoản", "/dang-nhap.html", "settings");
      logout = document.createElement("button");
      logout.type = "button";
      logout.className = "account-menu-logout";
      logout.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons.logout + '</svg><span>Đăng xuất</span>';
      logout.addEventListener("click", event => { void hooks.onLogout?.(event); });
      navigation.append(logout);
    }
    setBusy(busy);
  }

  function setBusy(value) {
    busy = Boolean(value);
    if (logout) logout.disabled = busy;
    retry.disabled = busy;
    panel.setAttribute("aria-busy", String(busy));
  }

  function setMessage(text, canRetry = false) {
    message.textContent = text;
    retry.hidden = !canRetry;
  }

  trigger.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (panel.hidden) open();
    else close();
  });
  trigger.addEventListener("keydown", event => {
    if (event.key === " ") {
      event.preventDefault();
      if (event.repeat) return;
      if (panel.hidden) open();
      else close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      open(true);
    }
    if (event.key === "Tab" && !panel.hidden) {
      if (event.shiftKey) close();
      else {
        event.preventDefault();
        focusableItems()[0]?.focus();
      }
    }
  });
  panel.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const items = focusableItems();
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault();
      close(true);
    } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
      const candidates = [...document.querySelectorAll("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")]
        .filter(item => !panel.contains(item) && item.getClientRects().length > 0);
      const next = candidates[candidates.indexOf(trigger) + 1];
      event.preventDefault();
      close();
      (next ?? trigger).focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!panel.contains(event.target) && !wrapper.contains(event.target)) close();
  });
  document.addEventListener("focusin", event => {
    if (!panel.contains(event.target) && !wrapper.contains(event.target)) close();
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, { passive: true });
  window.visualViewport?.addEventListener("resize", position);
  retry.addEventListener("click", () => { void hooks.onRetry?.(); });
  window.addEventListener("pagehide", () => { close(); });
  window.ShopAccountMenu = {
    configure(options) { hooks = options; },
    render,
    setBusy,
    setMessage,
    close,
    get trigger() { return trigger; }
  };
})();
