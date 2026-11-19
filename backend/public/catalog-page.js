(() => {
  const rail = document.getElementById("category-tabs");
  const previous = document.querySelector('[data-category-scroll="previous"]');
  const next = document.querySelector('[data-category-scroll="next"]');
  if (!rail || !previous || !next) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = null;
  let active = true;
  let currentHref = null;

  function update() {
    frame = null;
    if (!active) return;
    const available = Math.max(0, rail.scrollWidth - rail.clientWidth);
    previous.disabled = rail.scrollLeft <= 1;
    next.disabled = rail.scrollLeft >= available - 1;
  }

  function scheduleUpdate() {
    if (active && frame === null) frame = window.requestAnimationFrame(update);
  }

  function revealCurrent() {
    const current = rail.querySelector('[aria-current="page"]');
    if (!current || current.getAttribute("href") === currentHref) return;
    currentHref = current.getAttribute("href");
    const edge = rail.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    if (item.left < edge.left || item.right > edge.right) {
      rail.scrollBy({ left: item.left - edge.left - 6, behavior: "instant" });
    }
    scheduleUpdate();
  }

  function scroll(direction) {
    rail.scrollBy({
      left: direction * Math.max(160, rail.clientWidth * .75),
      behavior: reducedMotion.matches ? "instant" : "smooth"
    });
  }

  previous.addEventListener("click", () => scroll(-1));
  next.addEventListener("click", () => scroll(1));
  rail.addEventListener("scroll", scheduleUpdate, { passive: true });
  new MutationObserver(() => {
    revealCurrent();
    scheduleUpdate();
  }).observe(rail, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-current"] });
  if (typeof ResizeObserver === "function") new ResizeObserver(scheduleUpdate).observe(rail);
  else window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("pagehide", () => {
    active = false;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
  });
  window.addEventListener("pageshow", () => {
    active = true;
    revealCurrent();
    scheduleUpdate();
  });
  revealCurrent();
  scheduleUpdate();
})();
