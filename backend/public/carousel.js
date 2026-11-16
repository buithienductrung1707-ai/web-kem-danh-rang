(() => {
  const hero = document.getElementById("hero-carousel");
  if (!hero) return;
  const slide = document.getElementById("hero-slide");
  const title = document.getElementById("hero-title");
  const description = document.getElementById("hero-description");
  const image = document.getElementById("hero-image");
  const link = document.getElementById("hero-link");
  const controls = document.getElementById("hero-carousel-controls");
  const dots = document.getElementById("hero-dots");
  const copy = hero.querySelector(".hero-copy");
  const status = document.getElementById("hero-banner-status");
  const message = document.getElementById("hero-banner-message");
  const retry = document.getElementById("hero-banner-retry");
  const fallbackImage = image.getAttribute("src");
  const fallbackAlt = image.alt;
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const rotationDelay = 2000;
  let banners = [{
    id: null, title: title.textContent.trim(), description: description.textContent.trim(),
    imageUrl: fallbackImage, imageAlt: fallbackAlt,
    buttonLabel: link.textContent.trim(), buttonUrl: link.getAttribute("href"),
    enabled: true, sortOrder: 0, revision: 0
  }];
  let index = 0;
  let active = true;
  let controller = null;
  let rotationTimer = null;
  let pointerWithin = false;
  let focusWithin = hero.contains(document.activeElement);
  let slideAnimations = [];

  function stopTransition() {
    for (const animation of slideAnimations) animation.cancel();
    slideAnimations = [];
  }

  function animateSlide() {
    if (!active || document.hidden || motionPreference?.matches ||
      typeof copy?.animate !== "function" || typeof image.animate !== "function") return;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    try {
      slideAnimations.push(copy.animate([
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 420, easing }));
      slideAnimations.push(image.animate([
        { opacity: 0.35, transform: "scale(1.035)" },
        { opacity: 1, transform: "scale(1)" }
      ], { duration: 620, easing }));
    } catch {
      stopTransition();
    }
  }

  function canRotate() {
    return active && !controller && banners.length > 1 && !document.hidden &&
      !pointerWithin && !focusWithin;
  }

  function updatePlayback() {
    clearTimeout(rotationTimer);
    rotationTimer = null;
    if (!canRotate()) return;
    rotationTimer = setTimeout(() => {
      rotationTimer = null;
      if (canRotate()) selectSlide(index + 1, false);
    }, rotationDelay);
  }

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

  function renderSlide(announce = false) {
    stopTransition();
    const banner = banners[index];
    hero.hidden = !banner;
    controls.hidden = banners.length < 2;
    if (!banner) {
      status.textContent = "";
      if (hero.contains(document.activeElement)) document.getElementById("catalog-title").focus();
      return;
    }
    if (controls.hidden && controls.contains(document.activeElement)) hero.focus();
    title.textContent = banner.title;
    description.textContent = banner.description;
    description.hidden = banner.description === "";
    link.textContent = banner.buttonLabel;
    link.hidden = banner.buttonLabel === "";
    link.href = banner.buttonUrl || "#catalog";
    image.hidden = false;
    image.alt = banner.imageAlt;
    if (image.getAttribute("src") !== banner.imageUrl) image.src = banner.imageUrl;
    slide.setAttribute("aria-label", "Quảng cáo " + (index + 1) + " trên " + banners.length);
    for (const [position, dot] of [...dots.children].entries()) {
      dot.setAttribute("aria-pressed", String(position === index));
    }
    const selectedDot = dots.children[index];
    if (selectedDot && dots.scrollWidth > dots.clientWidth) {
      dots.scrollTo?.({
        left: selectedDot.offsetLeft - (dots.clientWidth - selectedDot.offsetWidth) / 2,
        behavior: motionPreference?.matches ? "auto" : "smooth"
      });
    }
    status.textContent = announce
      ? "Quảng cáo " + (index + 1) + " trên " + banners.length + ". " + banner.title : "";
    animateSlide();
  }

  function selectSlide(position, announce = true) {
    if (!active || banners.length < 2) return;
    index = (position + banners.length) % banners.length;
    renderSlide(announce);
    updatePlayback();
  }

  function renderDots() {
    const restoreFocus = dots.contains(document.activeElement);
    const fragment = document.createDocumentFragment();
    for (let position = 0; position < banners.length; position += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hero-dot";
      dot.setAttribute("aria-label", "Xem quảng cáo " + (position + 1));
      dot.setAttribute("aria-controls", "hero-slide");
      dot.addEventListener("click", () => selectSlide(position));
      fragment.append(dot);
    }
    dots.replaceChildren(fragment);
    if (restoreFocus) (dots.children[index] ?? hero).focus();
  }

  hero.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch") return;
    pointerWithin = true;
    updatePlayback();
  });
  hero.addEventListener("pointerleave", () => {
    pointerWithin = false;
    updatePlayback();
  });
  hero.addEventListener("focusin", () => {
    focusWithin = true;
    updatePlayback();
  });
  hero.addEventListener("focusout", event => {
    focusWithin = hero.contains(event.relatedTarget);
    updatePlayback();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTransition();
    updatePlayback();
  });
  motionPreference?.addEventListener("change", () => {
    if (motionPreference.matches) stopTransition();
  });
  hero.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || banners.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectSlide(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });

  image.addEventListener("error", () => {
    if (!active) return;
    if (image.getAttribute("src") === fallbackImage) image.hidden = true;
    else {
      image.alt = fallbackAlt;
      image.src = fallbackImage;
    }
  });

  async function loadBanners() {
    if (!active || controller) return;
    const requestController = new AbortController();
    controller = requestController;
    retry.disabled = true;
    updatePlayback();
    try {
      const response = await fetch("/api/banners", {
        cache: "no-store", signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || controller !== requestController) return;
      if (!response.ok || !Array.isArray(result) || !result.every(validBanner) ||
        new Set(result.map(banner => banner.id)).size !== result.length) {
        throw new Error("Quảng cáo chưa hợp lệ");
      }
      const currentId = banners[index]?.id;
      banners = result.filter(banner => banner.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      index = Math.max(0, banners.findIndex(banner => banner.id === currentId));
      renderDots();
      renderSlide();
      message.textContent = "";
      retry.hidden = true;
    } catch {
      if (!active || controller !== requestController) return;
      message.textContent = "Chưa cập nhật được quảng cáo. Bạn có thể tải lại để thử tiếp.";
      retry.hidden = false;
    } finally {
      if (controller === requestController) {
        controller = null;
        retry.disabled = false;
        updatePlayback();
      }
    }
  }

  retry.addEventListener("click", () => void loadBanners());
  window.addEventListener("pagehide", () => {
    active = false;
    controller?.abort();
    controller = null;
    pointerWithin = false;
    stopTransition();
    updatePlayback();
  });
  window.addEventListener("pageshow", event => {
    active = true;
    focusWithin = hero.contains(document.activeElement);
    if (event.persisted) void loadBanners();
    else updatePlayback();
  });
  void loadBanners();
})();
