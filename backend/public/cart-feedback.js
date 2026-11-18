(() => {
  const effects = new Set();
  const pulses = new Map();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let layer = null;

  function removeEffect(effect) {
    if (!effects.delete(effect)) return;
    clearTimeout(effect.timeout);
    effect.animation?.cancel();
    effect.node.remove();
    if (effects.size === 0) {
      layer?.remove();
      layer = null;
    }
  }

  function clearFeedback() {
    for (const effect of [...effects]) removeEffect(effect);
    for (const [element, animation] of pulses) {
      animation.cancel();
      element.classList.remove("cart-feedback-highlight");
    }
    pulses.clear();
  }

  function feedbackLayer() {
    const dialog = document.querySelector("dialog[open]");
    if (layer && !layer.hasAttribute("popover") && layer.parentElement !== (dialog ?? document.body)) clearFeedback();
    if (layer) {
      if (dialog && layer.hasAttribute("popover")) {
        try {
          layer.hidePopover();
          layer.showPopover();
        } catch {}
      }
      return layer;
    }
    layer = document.createElement("div");
    layer.className = "cart-feedback-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("popover", "manual");
    document.body.append(layer);
    try {
      layer.showPopover();
    } catch {
      layer.removeAttribute("popover");
      if (dialog) {
        layer.classList.add("cart-feedback-layer-local");
        dialog.append(layer);
      }
    }
    return layer;
  }

  function bounds(element) {
    if (!element?.isConnected) return null;
    const rectangle = element.getBoundingClientRect();
    if (rectangle.width <= 0 || rectangle.height <= 0) return null;
    const style = getComputedStyle(element);
    return style.visibility === "hidden" || style.display === "none" ? null : rectangle;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function pulse(element, keyframes) {
    if (!element || element.hidden || !element.isConnected) return;
    pulses.get(element)?.cancel();
    element.classList.add("cart-feedback-highlight");
    let animation;
    try {
      animation = element.animate(keyframes, { duration: 280, easing: "ease-out" });
    } catch {
      const timeout = setTimeout(() => {
        element.classList.remove("cart-feedback-highlight");
        pulses.delete(element);
      }, 280);
      pulses.set(element, { cancel: () => clearTimeout(timeout) });
      return;
    }
    pulses.set(element, animation);
    animation.finished.then(() => {
      if (pulses.get(element) !== animation) return;
      element.classList.remove("cart-feedback-highlight");
      pulses.delete(element);
    }).catch(() => {});
  }

  function pulseCart(cart) {
    const count = cart?.querySelector("#header-cart-count");
    const icon = cart?.querySelector(".header-icon");
    if (reducedMotion.matches) {
      pulse(count, [{ opacity: 0.65 }, { opacity: 1 }]);
      return;
    }
    pulse(count, [
      { transform: "scale(0.8)" },
      { transform: "scale(1.3)", offset: 0.48 },
      { transform: "scale(1)" }
    ]);
    pulse(icon, [
      { transform: "translateY(0)" },
      { transform: "translateY(-3px)", offset: 0.45 },
      { transform: "translateY(0)" }
    ]);
  }

  function addEffect(node, keyframes, duration, onArrival) {
    while (effects.size >= 6) removeEffect(effects.values().next().value);
    const effect = { node, animation: null, timeout: null };
    feedbackLayer().append(node);
    effects.add(effect);
    let finished = false;
    const finish = () => {
      if (finished || !effects.has(effect)) return;
      finished = true;
      onArrival?.();
      removeEffect(effect);
    };
    effect.timeout = setTimeout(finish, duration + 120);
    try {
      effect.animation = node.animate(keyframes, { duration, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "both" });
      effect.animation.finished.then(finish).catch(() => removeEffect(effect));
    } catch {
      // Keep a brief static acknowledgement when motion APIs are unavailable.
      clearTimeout(effect.timeout);
      effect.timeout = setTimeout(finish, 240);
    }
  }

  function edgeCue(end, destination, viewport) {
    const cue = document.createElement("span");
    cue.className = "cart-feedback-cue";
    cue.style.left = clamp(end.x - 66, 12, viewport.width - 144) + "px";
    cue.style.top = clamp(end.y - 18, 12, viewport.height - 48) + "px";
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.classList.add("cart-feedback-direction");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("fill", "none");
    arrow.setAttribute("stroke", "currentColor");
    arrow.setAttribute("stroke-width", "2");
    arrow.setAttribute("stroke-linecap", "round");
    arrow.setAttribute("stroke-linejoin", "round");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 19V5m-6 6 6-6 6 6");
    arrow.append(path);
    arrow.style.transform = "rotate(" + (Math.atan2(destination.y - end.y, destination.x - end.x) * 180 / Math.PI + 90) + "deg)";
    const label = document.createElement("span");
    label.textContent = "Giỏ hàng +1";
    cue.append(arrow, label);
    return cue;
  }

  function added({ product, source, image } = {}) {
    if (document.hidden) return;
    const viewport = {
      width: document.documentElement.clientWidth,
      height: window.innerHeight
    };
    if (viewport.width < 100 || viewport.height < 100) return;
    const cart = document.querySelector(".commerce-header .header-cart, .header-cart");
    const target = cart?.querySelector(".header-link-icon") ?? cart;
    const targetBounds = bounds(target);
    const sourceBounds = bounds(source) ?? bounds(image);
    const start = {
      x: clamp(sourceBounds ? sourceBounds.left + sourceBounds.width / 2 : viewport.width / 2, 28, viewport.width - 28),
      y: clamp(sourceBounds ? sourceBounds.top + sourceBounds.height / 2 : viewport.height / 2, 28, viewport.height - 28)
    };
    const destination = {
      x: targetBounds ? targetBounds.left + targetBounds.width / 2 : viewport.width - 32,
      y: targetBounds ? targetBounds.top + targetBounds.height / 2 : -32
    };
    const targetVisible = Boolean(targetBounds && destination.x >= 16 && destination.x <= viewport.width - 16 &&
      destination.y >= 16 && destination.y <= viewport.height - 16);
    const end = {
      x: clamp(destination.x, 28, viewport.width - 28),
      y: clamp(destination.y, 28, viewport.height - 28)
    };
    const host = feedbackLayer();
    const localFallback = host.classList.contains("cart-feedback-layer-local");
    if (reducedMotion.matches || localFallback) {
      const acknowledgement = document.createElement("span");
      acknowledgement.className = "cart-feedback-confirmation";
      acknowledgement.textContent = "+1";
      const hostBounds = host.getBoundingClientRect();
      const scaleX = localFallback && host.clientWidth > 0 ? hostBounds.width / host.clientWidth : 1;
      const scaleY = localFallback && host.clientHeight > 0 ? hostBounds.height / host.clientHeight : 1;
      acknowledgement.style.left = (start.x - hostBounds.left) / scaleX - 20 + "px";
      acknowledgement.style.top = (start.y - hostBounds.top) / scaleY - 20 + "px";
      addEffect(acknowledgement, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], 300);
      pulseCart(cart);
      return;
    }
    if (!targetVisible) {
      addEffect(edgeCue(end, destination, viewport), [
        { opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }
      ], 900);
    }
    const particle = document.createElement("span");
    particle.className = "cart-feedback-particle";
    particle.style.left = start.x - 22 + "px";
    particle.style.top = start.y - 22 + "px";
    const imageUrl = image?.currentSrc || image?.src || product?.imageUrl;
    if (imageUrl && !image?.hidden) {
      const thumbnail = document.createElement("img");
      thumbnail.src = imageUrl;
      thumbnail.alt = "";
      thumbnail.draggable = false;
      thumbnail.addEventListener("error", () => particle.replaceChildren(document.createTextNode("+1")), { once: true });
      particle.append(thumbnail);
    } else {
      particle.textContent = "+1";
    }
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const arcY = clamp(Math.min(start.y, end.y) - 64, 24, viewport.height - 24) - start.y;
    addEffect(particle, [
      { transform: "translate(0, 0) scale(0.85)", opacity: 0.7 },
      { transform: "translate(" + deltaX * 0.42 + "px, " + arcY + "px) scale(1)", opacity: 1, offset: 0.45 },
      { transform: "translate(" + deltaX + "px, " + deltaY + "px) scale(0.28)", opacity: 0.1 }
    ], 540, () => pulseCart(cart));
  }

  window.ShopCartFeedback = Object.freeze({ added });
  window.addEventListener("pagehide", clearFeedback);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearFeedback();
  });
  reducedMotion.addEventListener?.("change", clearFeedback);
})();
