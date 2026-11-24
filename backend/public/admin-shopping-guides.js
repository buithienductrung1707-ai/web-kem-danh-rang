(() => {
  "use strict";

  const panel = document.getElementById("admin-shopping-guides");
  if (!panel) return;
  const keys = ["buying", "unboxing"];
  const forms = document.getElementById("shopping-guides-forms");
  const reloadButton = document.getElementById("shopping-guides-reload");
  const message = document.getElementById("shopping-guides-message");
  const editors = new Map(keys.map(key => {
    const form = panel.querySelector('[data-shopping-guide-form="' + key + '"]');
    return [key, { key, form, input: form.elements.videoUrl,
      save: form.querySelector("[data-guide-save]"), draft: form.querySelector("[data-guide-draft]"),
      message: form.querySelector("[data-guide-message]"), snapshot: null, conflict: false }];
  }));
  let hooks = null;
  let busy = true;
  let ready = false;
  let generation = 0;
  let controller = null;
  let ownsBusy = false;

  function status(element, text, error = false) {
    element.textContent = text;
    element.dataset.error = String(error);
  }

  function normalizeUrl(value) {
    if (value.length > 2048) throw new Error("Invalid URL");
    const text = value.trim();
    if (text === "") return "";
    if (text.length > 2048 || /[\\\s\u0000-\u001f\u007f]/.test(text)) throw new Error("Invalid URL");
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Invalid URL");
    let id = null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v");
      else id = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    } else if (url.hostname === "youtu.be") {
      id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    } else if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)) {
      id = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    } else if (/\.mp4$/i.test(url.pathname)) {
      url.hash = "";
      if (url.href.length <= 2048) return url.href;
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return "https://www.youtube.com/watch?v=" + id;
    throw new Error("Invalid video URL");
  }

  function validate(item) {
    if (!item || !keys.includes(item.key) || typeof item.videoUrl !== "string"
      || !Number.isSafeInteger(item.revision) || item.revision < 0
      || normalizeUrl(item.videoUrl) !== item.videoUrl) throw new Error("Invalid guide");
  }

  function dirty(editor) {
    if (!editor.snapshot) return false;
    try { return normalizeUrl(editor.input.value) !== editor.snapshot.videoUrl; }
    catch { return true; }
  }

  function controls(value = busy) {
    busy = value;
    const locked = busy || controller !== null || hooks?.isActive() !== true;
    reloadButton.disabled = locked;
    for (const editor of editors.values()) {
      editor.input.disabled = locked || !ready || !editor.snapshot;
      editor.save.disabled = locked || !ready || !editor.snapshot || editor.conflict || !dirty(editor);
      editor.form.setAttribute("aria-busy", String(controller !== null));
      editor.draft.textContent = !editor.snapshot ? "" : dirty(editor) ? "Có thay đổi chưa lưu." : "Đang khớp bản đã lưu.";
    }
  }

  function canEdit(editor) {
    return hooks?.isActive() === true && ready && editor.snapshot !== null && !busy && controller === null;
  }

  function fill(item) {
    const editor = editors.get(item.key);
    editor.snapshot = { ...item };
    editor.conflict = false;
    editor.input.value = item.videoUrl;
    editor.input.removeAttribute("aria-invalid");
    editor.input.setCustomValidity("");
    status(editor.message, "");
  }

  function clear() {
    const release = ownsBusy;
    generation += 1;
    controller?.abort();
    controller = null;
    ownsBusy = false;
    ready = false;
    forms.hidden = true;
    status(message, "");
    for (const editor of editors.values()) {
      editor.form.reset();
      editor.snapshot = null;
      editor.conflict = false;
      editor.save.textContent = "Lưu video";
      editor.input.removeAttribute("aria-invalid");
      editor.input.setCustomValidity("");
      status(editor.message, "");
    }
    controls();
    if (release) hooks.setBusy(false);
  }

  async function request(path, options, version) {
    const result = await hooks.request(path, options);
    if (version !== generation || !hooks.isActive()) throw new DOMException("Replaced request", "AbortError");
    if (result.response.status === 401) {
      hooks.onUnauthorized();
      throw new DOMException("Signed out", "AbortError");
    }
    return result;
  }

  async function load({ manageBusy = false } = {}) {
    if (!hooks?.isActive()) return false;
    const version = ++generation;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    ownsBusy = manageBusy;
    if (manageBusy) hooks.setBusy(true);
    status(message, "Đang tải video hướng dẫn...");
    controls();
    try {
      const { response, result } = await request("/shopping-guides", {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
      }, version);
      if (!response.ok || !Array.isArray(result) || result.length !== keys.length
        || new Set(result.map(item => item?.key)).size !== keys.length) throw new Error("Invalid guides");
      result.forEach(validate);
      result.forEach(fill);
      ready = true;
      forms.hidden = false;
      status(message, "Chọn video cho từng hướng dẫn rồi bấm Lưu video. Tải lại trang chủ để xem thay đổi.");
      return true;
    } catch {
      if (version !== generation || !hooks.isActive()) return false;
      status(message, ready ? "Chưa tải lại được video. Các nội dung đang sửa vẫn được giữ; thử Tải lại video khi kết nối ổn định."
        : "Chưa tải được video hướng dẫn. Bấm Tải lại video để thử lại.", true);
      return false;
    } finally {
      if (version === generation) {
        controller = null;
        ownsBusy = false;
        controls();
        if (manageBusy) hooks.finish(reloadButton);
      }
    }
  }

  reloadButton.addEventListener("click", () => {
    if (busy || controller !== null || !hooks?.isActive()) return;
    if ([...editors.values()].some(dirty)
      && !window.confirm("Tải lại sẽ thay các đường dẫn đang sửa bằng bản đã lưu. Bỏ thay đổi chưa lưu?")) return;
    void load({ manageBusy: true });
  });

  for (const editor of editors.values()) {
    editor.input.addEventListener("input", () => {
      if (!canEdit(editor)) return;
      editor.input.removeAttribute("aria-invalid");
      editor.input.setCustomValidity("");
      status(editor.message, "");
      controls();
    });
    editor.form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!canEdit(editor) || editor.conflict || !dirty(editor)) return;
      let videoUrl;
      try { videoUrl = normalizeUrl(editor.input.value); }
      catch {
        editor.input.setAttribute("aria-invalid", "true");
        status(editor.message, "Dùng link HTTPS của YouTube hoặc đường dẫn kết thúc bằng .mp4. Bạn cũng có thể để trống để gỡ video.", true);
        editor.input.focus();
        return;
      }
      if (!editor.form.reportValidity()) return;
      const payload = { videoUrl, revision: editor.snapshot.revision };
      const version = generation;
      const current = new AbortController();
      controller = current;
      ownsBusy = true;
      hooks.setBusy(true);
      editor.save.textContent = "Đang lưu...";
      status(editor.message, "Đang lưu video...");
      try {
        const { response, result } = await request("/shopping-guides/" + editor.key, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)])
        }, version);
        if (!response.ok) {
          editor.conflict = response.status === 409;
          if (response.status === 400) editor.input.setAttribute("aria-invalid", "true");
          const detail = typeof result?.error === "string" ? result.error : "Chưa lưu được video.";
          status(editor.message, detail + (editor.conflict
            ? " Bản đang sửa được giữ lại. Bấm Tải lại video để lấy phiên bản mới; bạn sẽ được hỏi trước khi bỏ bản đang sửa."
            : " Đường dẫn đang sửa được giữ lại. Kiểm tra thông tin và thử lưu lại."), true);
          return;
        }
        validate(result);
        if (result.key !== editor.key || result.videoUrl !== payload.videoUrl || result.revision <= payload.revision) {
          throw new Error("Save response mismatch");
        }
        fill(result);
        status(editor.message, videoUrl ? "Đã lưu video. Tải lại trang chủ để xem thay đổi."
          : "Đã gỡ video. Trang chủ sẽ hiển thị khung chờ cập nhật.");
      } catch {
        if (version !== generation || !hooks.isActive()) return;
        status(editor.message, "Chưa xác nhận được kết quả lưu. Đường dẫn đang sửa được giữ lại. Bạn có thể Tải lại video để kiểm tra hoặc thử lưu lại.", true);
      } finally {
        if (version === generation) {
          controller = null;
          ownsBusy = false;
          editor.save.textContent = "Lưu video";
          hooks.finish(editor.conflict ? reloadButton : editor.save);
        }
      }
    });
  }

  window.ShopAdminShoppingGuides = {
    configure(value) { hooks = value; controls(); },
    load, clear, setBusy: controls,
    get ready() { return ready; }
  };
})();
