(() => {
  "use strict";
  const section = document.getElementById("shopping-guides");
  if (!section) return;
  const keys = ["buying", "unboxing"];
  const message = document.getElementById("shopping-guides-message");
  const retry = document.getElementById("shopping-guides-retry");
  const cards = new Map(keys.map(key => {
    const card = section.querySelector('[data-shopping-guide="' + key + '"]');
    return [key, { card, media: card.querySelector("[data-guide-media]"),
      status: card.querySelector("[data-guide-status]"),
      placeholder: card.querySelector(".shopping-guide-placeholder").cloneNode(true),
      title: card.querySelector("h2").textContent, generation: 0 }];
  }));
  let controller = null;
  let generation = 0;

  function parseVideo(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
    let id = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (youtubeHosts.includes(url.hostname)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else id = /^\/(?:embed|shorts)\/([^/]+)$/.exec(url.pathname)?.[1];
    }
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return { type: "youtube", source: "https://www.youtube-nocookie.com/embed/" + id + "?rel=0",
        original: "https://www.youtube.com/watch?v=" + id };
    }
    if (youtubeHosts.includes(url.hostname) || url.hostname === "youtu.be" || !/\.mp4$/i.test(url.pathname)) return null;
    url.hash = "";
    return { type: "mp4", source: url.href, original: url.href };
  }

  function externalLink(video) {
    const link = document.createElement("a");
    link.href = video.original;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Mở video gốc";
    link.setAttribute("aria-label", "Mở video gốc trong tab mới");
    return link;
  }

  function openVideo(entry, video) {
    const current = ++entry.generation;
    entry.status.textContent = "Đang mở video…";
    const player = document.createElement(video.type === "youtube" ? "iframe" : "video");
    const ready = () => {
      if (current !== entry.generation) return;
      entry.status.replaceChildren("Không xem được video? ", externalLink(video));
    };
    if (video.type === "youtube") {
      player.title = entry.title;
      player.allow = "fullscreen; picture-in-picture";
      player.allowFullscreen = true;
      player.referrerPolicy = "strict-origin-when-cross-origin";
      player.addEventListener("load", ready, { once: true });
    } else {
      player.controls = true;
      player.playsInline = true;
      player.preload = "metadata";
      player.setAttribute("aria-label", entry.title);
      player.addEventListener("loadedmetadata", ready, { once: true });
    }
    player.tabIndex = 0;
    player.addEventListener("error", () => {
      if (current !== entry.generation) return;
      entry.status.replaceChildren("Chưa mở được video. ", externalLink(video));
    }, { once: true });
    player.src = video.source;
    entry.media.replaceChildren(player);
    entry.status.replaceChildren("Đang mở video… ", externalLink(video));
    player.focus({ preventScroll: true });
  }

  function render(entry, value) {
    entry.generation += 1;
    entry.status.textContent = "";
    if (!value) {
      entry.media.replaceChildren(entry.placeholder.cloneNode(true));
      return;
    }
    const video = parseVideo(value);
    if (!video) throw new Error("Đường dẫn video chưa hợp lệ.");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shopping-guide-open";
    button.setAttribute("aria-label", "Xem video: " + entry.title);
    const icon = entry.placeholder.querySelector(".shopping-guide-play").cloneNode(true);
    const label = document.createElement("strong");
    label.textContent = "Xem video hướng dẫn";
    const hint = document.createElement("span");
    hint.textContent = "Bấm để mở video · Không tự động phát";
    button.append(icon, label, hint);
    button.addEventListener("click", () => openVideo(entry, video), { once: true });
    entry.media.replaceChildren(button);
  }

  async function load() {
    const current = ++generation;
    controller?.abort();
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    message.textContent = "";
    retry.hidden = true;
    try {
      const response = await fetch("/api/shopping-guides", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Không tải được video hướng dẫn.");
      const guides = await response.json();
      if (current !== generation) return;
      if (!Array.isArray(guides) || guides.length !== keys.length
          || new Set(guides.map(guide => guide?.key)).size !== keys.length
          || guides.some(guide => !keys.includes(guide?.key) || typeof guide.videoUrl !== "string"
            || (guide.videoUrl !== "" && !parseVideo(guide.videoUrl)))) {
        throw new Error("Dữ liệu video chưa hợp lệ.");
      }
      for (const guide of guides) render(cards.get(guide.key), guide.videoUrl);
    } catch {
      if (current !== generation) return;
      message.textContent = "Chưa tải được video. Bạn vẫn có thể tham khảo các bước hướng dẫn ở trên hoặc thử tải lại.";
      retry.hidden = false;
    } finally {
      if (current === generation) controller = null;
    }
  }

  retry.addEventListener("click", () => { void load(); });
  window.addEventListener("pagehide", () => {
    generation += 1;
    controller?.abort();
    controller = null;
    for (const entry of cards.values()) {
      entry.generation += 1;
      entry.media.querySelector("video")?.pause();
    }
  });
  window.addEventListener("pageshow", event => { if (event.persisted) void load(); });
  void load();
})();
