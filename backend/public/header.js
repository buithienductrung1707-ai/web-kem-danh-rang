(() => {
  const form = document.querySelector("[data-header-search]");
  const searchField = document.querySelector("[data-header-search-input]");
  const searchButton = form?.querySelector('button[type="submit"]');
  const totalLabel = document.getElementById("header-cart-total");
  const quantityLabel = document.getElementById("header-cart-count");
  const messageLabel = document.getElementById("header-message");
  const productMenus = [...document.querySelectorAll("[data-products-menu]")];
  const scopes = new Set(["all", "available", "favorites", "favorites-available"]);
  const cartKey = "toothpaste-cart-items";
  const legacyCartKey = "toothpaste-cart-quantity";
  const pendingKey = "toothpaste-pending-order";
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  let active = true;
  let navigating = false;
  let priceController = null;
  let searchMessage = "";
  let cartMessage = "";

  const header = document.querySelector(".commerce-header");
  if (header) {
    const bubbles = document.createElement("span");
    bubbles.className = "header-bubbles";
    bubbles.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 5; index += 1) {
      const bubble = document.createElement("span");
      bubble.className = "header-bubble";
      bubbles.append(bubble);
    }
    header.prepend(bubbles);
  }

  function setProductsMenu(menu, open) {
    menu.querySelector("[data-products-toggle]")?.setAttribute("aria-expanded", String(open));
    const options = menu.querySelector(".catalog-nav-menu");
    if (options) options.hidden = !open;
  }

  for (const menu of productMenus) {
    const toggle = menu.querySelector("[data-products-toggle]");
    toggle?.addEventListener("click", () => {
      setProductsMenu(menu, toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("pointerenter", event => {
      if (event.pointerType !== "touch") setProductsMenu(menu, true);
    });
    menu.addEventListener("pointerleave", () => {
      if (!menu.contains(document.activeElement)) setProductsMenu(menu, false);
    });
    menu.addEventListener("focusin", event => {
      if (event.target !== toggle) setProductsMenu(menu, true);
    });
    menu.addEventListener("focusout", event => {
      if (!menu.contains(event.relatedTarget)) setProductsMenu(menu, false);
    });
    menu.addEventListener("keydown", event => {
      if (event.key !== "Escape" || toggle?.getAttribute("aria-expanded") !== "true") return;
      event.preventDefault();
      setProductsMenu(menu, false);
      toggle.focus();
    });
  }

  document.addEventListener("click", event => {
    for (const menu of productMenus) {
      if (!menu.contains(event.target)) setProductsMenu(menu, false);
    }
  });

  function renderMessage() {
    if (messageLabel) messageLabel.textContent = [searchMessage, cartMessage].filter(Boolean).join(" ");
  }

  function setNavigating(value) {
    navigating = value;
    if (searchButton && !window.ShopStorefront?.hasCatalog) searchButton.disabled = value;
    form?.setAttribute("aria-busy", String(value));
  }

  function openSearchResults(query, scope, event) {
    const params = new URLSearchParams({ q: query, scope });
    const target = "/kem-danh-rang.html?" + params.toString() + "#catalog";
    const storefront = window.ShopStorefront;
    if (storefront && !storefront.prepareNavigation(event, target)) {
      searchMessage = "Chưa chuyển sang tìm kiếm. Hãy kiểm tra thông báo lưu giỏ hàng hoặc lần gửi đơn trên trang này.";
      renderMessage();
      return;
    }
    setNavigating(true);
    try {
      window.location.assign(target);
    } catch {
      setNavigating(false);
      searchMessage = "Chưa mở được kết quả tìm kiếm. Hãy thử lại.";
      renderMessage();
    }
  }

  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!active || navigating || !searchField) return;
    const query = searchField.value.trim();
    const storefront = window.ShopStorefront;
    searchMessage = "";
    if (storefront?.hasCatalog) {
      if (!storefront.searchCatalog({ query, scroll: true })) {
        searchMessage = "Hãy hoàn tất lần gửi đơn đang chờ trước khi tìm sản phẩm.";
      }
      renderMessage();
      return;
    }

    openSearchResults(query, "all", event);
  });

  searchField?.addEventListener("input", () => {
    searchMessage = "";
    renderMessage();
  });

  if (!window.ShopStorefront?.hasCatalog && searchField) {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) searchField.value = params.get("q") ?? "";
    if (["/", "/index.html"].includes(window.location.pathname) && (params.has("q") || params.has("scope"))) {
      const scope = scopes.has(params.get("scope")) ? params.get("scope") : "all";
      openSearchResults(searchField.value.trim(), scope, { preventDefault() {} });
    }
  }

  function validItems(items, allowEmpty) {
    return Array.isArray(items) && (allowEmpty || items.length > 0) &&
      items.every(item => item && Number.isSafeInteger(item.productId) && item.productId > 0 &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0) &&
      new Set(items.map(item => item.productId)).size === items.length;
  }

  function cartState(items, pendingTotal = null) {
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (!Number.isSafeInteger(quantity)) throw new Error("Số lượng giỏ chưa hợp lệ");
    return { items, quantity, pendingTotal };
  }

  function readCart() {
    const pending = sessionStorage.getItem(pendingKey);
    if (pending !== null) {
      const record = JSON.parse(pending);
      const order = record?.order;
      if (record?.version !== 1 || !order || !validItems(order.items, false) ||
        (order.paymentMethod !== undefined && !["COD", "BANK_TRANSFER"].includes(order.paymentMethod)) ||
        ![order.requestId, order.customerName, order.customerPhone, order.customerAddress]
          .every(value => typeof value === "string" && value.trim() !== "") ||
        !order.items.every(item => Number.isSafeInteger(item.expectedUnitPrice) && item.expectedUnitPrice >= 0 &&
          typeof item.expectedProductName === "string" && item.expectedProductName.trim() !== "" &&
          Number.isSafeInteger(item.expectedUnitPrice * item.quantity))) {
        throw new Error("Đơn đang chờ chưa hợp lệ");
      }
      const total = order.items.reduce((sum, item) => sum + item.quantity * item.expectedUnitPrice, 0);
      if (!Number.isSafeInteger(total)) throw new Error("Tổng tiền đang chờ chưa hợp lệ");
      return cartState(order.items, total);
    }

    const saved = localStorage.getItem(cartKey);
    if (saved === null) {
      const quantity = Number(localStorage.getItem(legacyCartKey));
      return cartState(Number.isSafeInteger(quantity) && quantity > 0 ? [{ productId: 1, quantity }] : []);
    }
    const record = JSON.parse(saved);
    const items = Array.isArray(record) ? record : record?.items;
    if (!validItems(items, true)) throw new Error("Giỏ đã lưu chưa hợp lệ");
    if (!Array.isArray(record)) {
      const last = record?.appliedReorderId;
      const intents = record?.appliedReorderIds;
      if (record?.version !== 2 || !(last === null || (typeof last === "string" && last.trim() !== "")) ||
        (intents !== undefined && (!Array.isArray(intents) ||
          !intents.every(id => typeof id === "string" && id.trim() !== "") ||
          new Set(intents).size !== intents.length || (last !== null && !intents.includes(last))))) {
        throw new Error("Định dạng giỏ đã lưu chưa hợp lệ");
      }
    }
    return cartState(items);
  }

  function renderCart(state, prices = null) {
    if (quantityLabel) {
      quantityLabel.textContent = state ? String(state.quantity) : "—";
      quantityLabel.hidden = state?.quantity === 0;
    }
    if (!totalLabel) return;
    if (!state) {
      totalLabel.textContent = "Xem giỏ";
      return;
    }
    if (state.pendingTotal !== null || state.items.length === 0) {
      totalLabel.textContent = money.format(state.pendingTotal ?? 0);
      return;
    }
    let total = 0;
    for (const item of state.items) {
      const price = prices?.get(item.productId);
      const lineTotal = price * item.quantity;
      total += lineTotal;
      if (price === undefined || !Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total)) {
        totalLabel.textContent = "Xem giỏ";
        return;
      }
    }
    totalLabel.textContent = money.format(total);
  }

  async function refreshCart() {
    if (window.ShopStorefront?.managesCart || !totalLabel || !active) return;
    priceController?.abort();
    const controller = new AbortController();
    priceController = controller;
    cartMessage = "";
    try {
      const state = readCart();
      renderCart(state);
      if (state.pendingTotal !== null || state.items.length === 0) return;
      const response = await fetch("/api/products", {
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || priceController !== controller) return;
      if (!response.ok || !Array.isArray(result) ||
        !result.every(item => item && Number.isSafeInteger(item.id) && item.id > 0 &&
          Number.isSafeInteger(item.price) && item.price >= 0) ||
        new Set(result.map(item => item.id)).size !== result.length) {
        throw new Error("Giá sản phẩm chưa hợp lệ");
      }
      const prices = new Map(result.filter(item => item.active !== false).map(item => [item.id, item.price]));
      renderCart(readCart(), prices);
    } catch {
      if (active && priceController === controller) {
        try { renderCart(readCart()); } catch { renderCart(null); }
        cartMessage = "Chưa đọc được tiền giỏ hàng. Mở giỏ hàng để kiểm tra sản phẩm và số lượng.";
      }
    } finally {
      if (priceController === controller) {
        priceController = null;
        renderMessage();
      }
    }
  }

  window.addEventListener("pagehide", () => {
    active = false;
    for (const menu of productMenus) setProductsMenu(menu, false);
    priceController?.abort();
    priceController = null;
  });

  window.addEventListener("pageshow", event => {
    active = true;
    setNavigating(false);
    if (event.persisted) void refreshCart();
  });

  window.addEventListener("storage", event => {
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    if (event.key === null || [cartKey, legacyCartKey].includes(event.key)) void refreshCart();
  });

  void refreshCart();
})();

(() => {
  const header = document.querySelector(".commerce-header");
  if (!header) return;
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const desktopPreference = window.matchMedia?.("(min-width: 1280px)");
  const container = document.createElement("div");
  container.className = "side-banners";
  header.after(container);
  let active = true;
  let controller = null;

  function bannerUrl(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.username || url.password || /%(?:2f|5c|25|2e)/i.test(url.pathname) ||
        /[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(url.pathname))) return null;
      return url;
    } catch {
      return null;
    }
  }

  function validLink(value) {
    const url = bannerUrl(value);
    return Boolean(url && url.origin === window.location.origin &&
      ((value.startsWith("#") && value.length > 1) ||
        (value.startsWith("/") && !value.startsWith("//") && !url.pathname.startsWith("//"))));
  }

  function validImage(value) {
    const url = bannerUrl(value);
    if (!url || /\.svgz?$/i.test(decodeURIComponent(url.pathname))) return false;
    return /^https:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//") &&
      /^\/(?:assets|uploads\/products)\/.+\.(?:png|jpe?g|webp|gif|avif)$/i.test(decodeURIComponent(url.pathname)));
  }

  function validBanner(banner) {
    return banner && Number.isSafeInteger(banner.id) && banner.id >= 1 &&
      ["left", "right"].includes(banner.placement) &&
      typeof banner.title === "string" && banner.title.trim() !== "" && banner.title.length <= 120 &&
      typeof banner.description === "string" && banner.description.length <= 400 &&
      validImage(banner.imageUrl) && typeof banner.imageAlt === "string" &&
      banner.imageAlt.trim() !== "" && banner.imageAlt.length <= 200 &&
      typeof banner.buttonLabel === "string" && banner.buttonLabel.length <= 60 &&
      typeof banner.buttonUrl === "string" &&
      ((banner.buttonLabel === "" && banner.buttonUrl === "") ||
        (banner.buttonLabel.trim() !== "" && validLink(banner.buttonUrl))) &&
      typeof banner.enabled === "boolean" && Number.isSafeInteger(banner.sortOrder) &&
      banner.sortOrder >= 0 && banner.sortOrder <= 999 &&
      Number.isSafeInteger(banner.revision) && banner.revision >= 0;
  }

  const rails = ["left", "right"].map(placement => {
    const element = document.createElement("aside");
    element.className = "side-banner-rail side-banner-rail--" + placement;
    element.setAttribute("aria-label", placement === "left" ? "Quảng cáo bên trái" : "Quảng cáo bên phải");
    element.hidden = true;
    container.append(element);
    const rail = { placement, element, banners: [], index: 0, timer: null, pointerWithin: false, animation: null };
    element.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch") return;
      rail.pointerWithin = true;
      updatePlayback(rail);
    });
    element.addEventListener("pointerleave", () => {
      rail.pointerWithin = false;
      updatePlayback(rail);
    });
    element.addEventListener("focusin", () => updatePlayback(rail));
    element.addEventListener("focusout", () => queueMicrotask(() => updatePlayback(rail)));
    return rail;
  });

  function updatePlayback(rail) {
    clearTimeout(rail.timer);
    rail.timer = null;
    if (!active || controller || document.hidden || desktopPreference?.matches === false ||
      rail.banners.length < 2 || rail.pointerWithin || rail.element.contains(document.activeElement)) return;
    rail.timer = setTimeout(() => {
      rail.index = (rail.index + 1) % rail.banners.length;
      renderRail(rail, true);
      updatePlayback(rail);
    }, 5000);
  }

  function renderRail(rail, animate = false) {
    rail.animation?.cancel();
    rail.animation = null;
    const restoreFocus = rail.element.contains(document.activeElement);
    const banner = rail.banners[rail.index];
    rail.element.hidden = !banner;
    if (!banner) {
      rail.element.replaceChildren();
      if (restoreFocus) header.querySelector("[data-header-search-input]")?.focus();
      return;
    }
    const card = document.createElement(banner.buttonUrl ? "a" : "div");
    card.className = "side-banner";
    if (banner.buttonUrl) {
      card.href = banner.buttonUrl;
      card.addEventListener("click", event => window.ShopStorefront?.prepareNavigation(event, card));
    }
    const image = document.createElement("img");
    image.className = "side-banner-image";
    image.src = banner.imageUrl;
    image.alt = banner.imageAlt;
    image.width = 724;
    image.height = 2172;
    image.loading = "lazy";
    image.decoding = "async";
    image.fetchPriority = "low";
    image.addEventListener("error", () => { image.hidden = true; });
    const copy = document.createElement("span");
    copy.className = "side-banner-copy";
    const title = document.createElement("strong");
    title.className = "side-banner-title";
    title.textContent = banner.title;
    const description = document.createElement("span");
    description.className = "side-banner-description";
    description.textContent = banner.description;
    description.hidden = banner.description === "";
    copy.append(title, description);
    card.append(image, copy);
    if (banner.buttonLabel) {
      const action = document.createElement("span");
      action.className = "side-banner-cta";
      action.textContent = banner.buttonLabel;
      card.append(action);
    }
    rail.element.replaceChildren(card);
    if (restoreFocus) {
      const focusTarget = banner.buttonUrl ? card : header.querySelector("[data-header-search-input]");
      focusTarget?.focus();
    }
    if (animate && !motionPreference?.matches && typeof card.animate === "function") {
      rail.animation = card.animate([
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 300, easing: "ease-out" });
    }
  }

  async function loadBanners() {
    if (!active || controller) return;
    const requestController = new AbortController();
    controller = requestController;
    rails.forEach(updatePlayback);
    try {
      const response = await fetch("/api/banners?placement=side", {
        cache: "no-store", signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || controller !== requestController) return;
      if (!response.ok || !Array.isArray(result) || !result.every(validBanner) ||
        new Set(result.map(banner => banner.id)).size !== result.length) {
        throw new Error("Quảng cáo hai bên chưa hợp lệ");
      }
      for (const rail of rails) {
        const currentId = rail.banners[rail.index]?.id;
        rail.banners = result.filter(banner => banner.enabled && banner.placement === rail.placement)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        rail.index = Math.max(0, rail.banners.findIndex(banner => banner.id === currentId));
        document.body.classList.toggle("has-side-banner-" + rail.placement, rail.banners.length > 0);
        renderRail(rail);
      }
      document.body.classList.toggle("has-side-banners", rails.some(rail => rail.banners.length > 0));
    } catch {
      // Side advertisements stay optional when the request is unavailable.
    } finally {
      if (controller === requestController) {
        controller = null;
        rails.forEach(updatePlayback);
      }
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) rails.forEach(rail => rail.animation?.cancel());
    rails.forEach(updatePlayback);
  });
  desktopPreference?.addEventListener("change", () => rails.forEach(updatePlayback));
  motionPreference?.addEventListener("change", () => {
    if (motionPreference.matches) rails.forEach(rail => rail.animation?.cancel());
  });
  window.addEventListener("pagehide", () => {
    active = false;
    controller?.abort();
    controller = null;
    for (const rail of rails) {
      rail.pointerWithin = false;
      rail.animation?.cancel();
      updatePlayback(rail);
    }
  });
  window.addEventListener("pageshow", event => {
    active = true;
    if (event.persisted) void loadBanners();
    else rails.forEach(updatePlayback);
  });
  void loadBanners();
})();
