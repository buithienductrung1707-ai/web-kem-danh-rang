(() => {
  "use strict";
  const form = document.getElementById("coupon-check-form");
  const code = document.getElementById("coupon-check-code");
  const check = document.getElementById("coupon-check-button");
  const result = document.getElementById("coupon-check-message");
  const search = document.getElementById("coupon-search");
  const filters = [...document.querySelectorAll('[name="coupon-filter"]')];
  const list = document.getElementById("coupon-list");
  const count = document.getElementById("coupon-count");
  const empty = document.getElementById("coupon-empty");
  const loadMessage = document.getElementById("coupon-load-message");
  const reload = document.getElementById("coupon-reload");
  let offers = [];
  let loadController = null;
  let checkController = null;
  let active = true;

  function message(text, error = false) {
    result.textContent = text;
    result.dataset.error = String(error);
  }

  function setBusy(busy) {
    code.disabled = busy;
    check.disabled = busy;
    check.textContent = busy ? "Đang kiểm tra…" : "Kiểm tra mã";
    form.setAttribute("aria-busy", String(busy));
  }

  function validOffer(offer) {
    return offer && typeof offer.code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(offer.code)
      && typeof offer.title === "string" && offer.title.trim().length > 0 && offer.title.length <= 160
      && typeof offer.description === "string" && offer.description.length <= 1000
      && typeof offer.available === "boolean";
  }

  function render() {
    const needle = search.value.trim().toLocaleLowerCase("vi-VN");
    const availableOnly = filters.find(filter => filter.checked)?.value === "available";
    const selected = offers.filter(offer => (!availableOnly || offer.available)
      && (offer.title + " " + offer.code + " " + offer.description).toLocaleLowerCase("vi-VN").includes(needle));
    const fragment = document.createDocumentFragment();
    for (const offer of selected) {
      const card = document.createElement("article");
      card.className = "coupon-offer-card";
      const title = document.createElement("h3");
      title.textContent = offer.title;
      const description = document.createElement("p");
      description.textContent = offer.description;
      const value = document.createElement("span");
      value.className = "coupon-offer-code";
      value.textContent = offer.code;
      const state = document.createElement("p");
      state.textContent = offer.available ? "Đang khả dụng" : "Hiện không khả dụng";
      card.append(title, description, value, state);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    count.textContent = selected.length + " coupon";
    empty.hidden = selected.length > 0;
    document.getElementById("coupon-empty-title").textContent = offers.length
      ? "Không tìm thấy coupon phù hợp" : "Chưa có coupon khả dụng";
    document.getElementById("coupon-empty-description").textContent = offers.length
      ? "Thử tìm bằng từ khóa khác hoặc chọn Tất cả để xem các coupon còn lại."
      : "Ưu đãi của cửa hàng sẽ được hiển thị tại đây. Bạn vẫn có thể khám phá các sản phẩm và kiểm tra mã nếu đã có.";
  }

  async function load() {
    if (loadController) return;
    const controller = new AbortController();
    loadController = controller;
    list.setAttribute("aria-busy", "true");
    search.disabled = true;
    filters.forEach(filter => { filter.disabled = true; });
    reload.hidden = true;
    loadMessage.textContent = "Đang tải coupon của cửa hàng…";
    try {
      const response = await fetch("/api/coupons", { cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const data = await response.json();
      if (!active || loadController !== controller) return;
      if (!response.ok || !Array.isArray(data) || !data.every(validOffer)
        || new Set(data.map(offer => offer.code)).size !== data.length) throw new Error("Invalid coupon list");
      offers = data;
      search.disabled = false;
      filters.forEach(filter => { filter.disabled = false; });
      render();
      loadMessage.textContent = "";
    } catch {
      if (!active || loadController !== controller) return;
      offers = [];
      list.replaceChildren();
      empty.hidden = true;
      count.textContent = "Chưa tải được";
      loadMessage.textContent = "Chưa tải được coupon. Kiểm tra kết nối và thử lại.";
      reload.hidden = false;
    } finally {
      if (loadController === controller) {
        loadController = null;
        list.setAttribute("aria-busy", "false");
      }
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (checkController) return;
    code.value = code.value.trim();
    if (!code.value) {
      code.setAttribute("aria-invalid", "true");
      message("Vui lòng nhập mã giảm giá.", true);
      code.focus();
      return;
    }
    const controller = new AbortController();
    checkController = controller;
    code.removeAttribute("aria-invalid");
    message("Đang kiểm tra mã…");
    setBusy(true);
    try {
      const response = await fetch("/api/coupons/validate", { method: "POST",
        headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ code: code.value }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const data = await response.json().catch(() => null);
      if (!active || checkController !== controller) return;
      if ([200, 400].includes(response.status) && data?.available === false && typeof data.message === "string") {
        code.setAttribute("aria-invalid", "true");
        message("Mã không khả dụng.", true);
      } else if (response.status === 429) {
        message("Bạn đã kiểm tra nhiều lần. Vui lòng chờ một lúc rồi thử lại.", true);
      } else {
        throw new Error("Coupon check unavailable");
      }
    } catch {
      if (active && checkController === controller) message("Chưa kiểm tra được mã. Hãy kiểm tra kết nối và thử lại.", true);
    } finally {
      if (checkController === controller) {
        checkController = null;
        setBusy(false);
        if (active) code.focus({ preventScroll: true });
      }
    }
  });
  code.addEventListener("input", () => { code.removeAttribute("aria-invalid"); message(""); });
  search.addEventListener("input", render);
  filters.forEach(filter => filter.addEventListener("change", render));
  reload.addEventListener("click", () => { void load(); });
  window.addEventListener("pagehide", () => {
    active = false;
    loadController?.abort();
    checkController?.abort();
    loadController = null;
    checkController = null;
    setBusy(false);
    message("");
    code.removeAttribute("aria-invalid");
  });
  window.addEventListener("pageshow", event => { if (event.persisted) { active = true; void load(); } });
  void load();
})();
