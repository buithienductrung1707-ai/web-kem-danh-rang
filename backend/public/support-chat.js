(() => {
  if (document.getElementById("support-chat")) return;

  const tokenKey = "toothpaste-support-token";
  const pendingKey = "toothpaste-support-pending";
  const api = "/api/support/messages";
  const tokenPattern = /^[a-f0-9]{64}$/;
  const requestPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const timeFormat = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
  let open = false;
  let active = true;
  let busy = false;
  let sending = false;
  let storageAvailable = true;
  let controller = null;
  let pollTimer = null;
  let pending = null;
  let lastId = 0;
  let loaded = false;
  let historyFailed = false;
  let conversationStarted = false;
  const messages = new Map();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function icon(paths, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (className) svg.setAttribute("class", className);
    for (const pathData of paths) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      svg.append(path);
    }
    return svg;
  }

  const widget = element("aside", "support-chat");
  widget.id = "support-chat";
  widget.setAttribute("aria-label", "Hỗ trợ khách hàng");
  const bubble = element("button", "support-chat-bubble");
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Mở cửa sổ chăm sóc khách hàng");
  bubble.setAttribute("aria-expanded", "false");
  bubble.setAttribute("aria-controls", "support-chat-panel");
  bubble.title = "Chăm sóc khách hàng";
  bubble.append(icon(["M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z", "M8 11h.01M12 11h.01M16 11h.01"]));

  const panel = element("section", "support-chat-panel");
  panel.id = "support-chat-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "support-chat-title");
  panel.setAttribute("aria-describedby", "support-chat-intro");
  const header = element("header", "support-chat-header");
  const heading = element("div", "support-chat-heading");
  const title = element("h2", "", "Chăm sóc khách hàng");
  title.id = "support-chat-title";
  heading.append(title, element("p", "", "Trao đổi trực tiếp với cửa hàng"));
  const close = element("button", "support-chat-close");
  close.type = "button";
  close.setAttribute("aria-label", "Đóng cửa sổ chăm sóc khách hàng");
  close.append(icon(["m6 6 12 12M18 6 6 18"]));
  header.append(heading, close);

  const body = element("div", "support-chat-body");
  const intro = element("p", "support-chat-intro", "Bạn cần hỗ trợ sản phẩm hoặc đơn hàng? Để lại tin nhắn, cửa hàng sẽ phản hồi tại đây.");
  intro.id = "support-chat-intro";
  const links = element("nav", "support-chat-links");
  links.setAttribute("aria-label", "Liên kết hỗ trợ");
  for (const [href, label] of [["/tra-cuu.html", "Tra cứu đơn hàng"], ["/kem-danh-rang.html", "Xem sản phẩm"]]) {
    const link = element("a", "", label);
    link.href = href;
    link.addEventListener("click", event => window.ShopStorefront?.prepareNavigation(event, link));
    links.append(link);
  }
  const storageWarning = element("p", "support-chat-warning");
  storageWarning.hidden = true;
  storageWarning.setAttribute("role", "status");
  const log = element("ol", "support-chat-messages");
  log.setAttribute("role", "log");
  log.setAttribute("aria-label", "Nội dung cuộc trò chuyện");
  log.setAttribute("aria-live", "off");
  log.setAttribute("aria-relevant", "additions");

  const form = element("form", "support-chat-form");
  const nameDetails = element("details", "support-chat-name");
  const nameSummary = element("summary", "", "Thêm tên của bạn (không bắt buộc)");
  const nameLabel = element("label", "", "Tên của bạn");
  nameLabel.htmlFor = "support-chat-name";
  const nameInput = element("input");
  nameInput.id = "support-chat-name";
  nameInput.name = "name";
  nameInput.type = "text";
  nameInput.autocomplete = "name";
  nameInput.maxLength = 120;
  nameDetails.append(nameSummary, nameLabel, nameInput);
  const textLabel = element("label", "", "Tin nhắn của bạn");
  textLabel.htmlFor = "support-chat-text";
  const textInput = element("textarea");
  textInput.id = "support-chat-text";
  textInput.name = "text";
  textInput.rows = 3;
  textInput.maxLength = 2000;
  textInput.required = true;
  textInput.placeholder = "Nhập nội dung cần hỗ trợ…";
  const send = element("button", "support-chat-send", "Gửi tin nhắn");
  send.type = "submit";
  const status = element("p", "support-chat-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const retry = element("button", "support-chat-retry", "Tải lại cuộc trò chuyện");
  retry.type = "button";
  retry.hidden = true;
  form.append(nameDetails, textLabel, textInput, send);
  body.append(intro, links, storageWarning, log, form, status, retry);
  panel.append(header, body);
  widget.append(panel, bubble);
  document.body.append(widget);
  document.body.classList.add("has-support-chat");

  function showStorageWarning() {
    storageAvailable = false;
    storageWarning.textContent = "Trình duyệt chưa lưu được cuộc trò chuyện. Hãy giữ trang này để xem tin nhắn và phản hồi. Tải lại hoặc rời trang có thể làm mất quyền xem lại.";
    storageWarning.hidden = false;
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      showStorageWarning();
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      if (localStorage.getItem(key) !== value) {
        showStorageWarning();
        return false;
      }
      return true;
    } catch {
      showStorageWarning();
      return false;
    }
  }

  function randomHex() {
    return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, "0")).join("");
  }

  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }

  let token = readStorage(tokenKey);
  try {
    if (!tokenPattern.test(token ?? "")) {
      token = randomHex();
      writeStorage(tokenKey, token);
    }
  } catch {
    token = null;
    status.textContent = "Trình duyệt chưa hỗ trợ kết nối trò chuyện an toàn. Hãy dùng phiên bản trình duyệt mới và mở website bằng HTTPS.";
  }

  function validPending(value) {
    return value && value.version === 1 && value.tokenTag === token?.slice(0, 12)
      && requestPattern.test(value.requestId ?? "")
      && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= 2000
      && typeof value.name === "string" && value.name.length <= 120;
  }

  try {
    const savedPending = readStorage(pendingKey);
    if (savedPending) {
      const value = JSON.parse(savedPending);
      if (validPending(value)) {
        pending = { version: 1, tokenTag: value.tokenTag, requestId: value.requestId, text: value.text, name: value.name };
        textInput.value = pending.text;
        nameInput.value = pending.name;
      } else {
        writeStorage(pendingKey, null);
      }
    }
  } catch {
    writeStorage(pendingKey, null);
  }

  function updateControls() {
    send.disabled = busy || !token;
    send.textContent = sending ? "Đang gửi…" : pending ? "Thử gửi lại" : "Gửi tin nhắn";
    textInput.readOnly = sending || Boolean(pending);
    nameInput.readOnly = sending || Boolean(pending);
    form.setAttribute("aria-busy", String(sending));
    retry.disabled = busy;
    nameDetails.hidden = conversationStarted;
  }

  function setStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle("is-error", error);
  }

  function pendingStatus() {
    return "Chưa xác nhận tin nhắn đã gửi. Nội dung được giữ lại. Bấm Thử gửi lại để kiểm tra và tiếp tục gửi.";
  }

  async function fetchApi(method, payload) {
    const requestController = new AbortController();
    controller = requestController;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, 15000);
    try {
      const response = await fetch(method === "GET" ? `${api}?after=${lastId}` : api, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(payload ? { "Content-Type": "application/json" } : {}) },
        body: payload ? JSON.stringify(payload) : undefined,
        cache: "no-store",
        credentials: "same-origin",
        signal: requestController.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const fallback = {
          400: "Nội dung gửi lên chưa hợp lệ. Hãy kiểm tra tin nhắn và tên của bạn.",
          401: "Phiên trò chuyện chưa hợp lệ. Hãy tải lại trang để kiểm tra.",
          409: "Mã tin nhắn đã tồn tại với nội dung khác. Hãy tải lại cuộc trò chuyện để kiểm tra.",
          413: "Tin nhắn vượt quá kích thước cho phép. Hãy rút ngắn nội dung rồi gửi lại.",
          429: "Bạn gửi quá nhanh. Hãy đợi một chút rồi thử lại."
        };
        const error = new Error(typeof data?.error === "string" && data.error.length <= 500
          ? data.error : fallback[response.status] || "Chưa kết nối được với cửa hàng. Hãy thử lại sau.");
        error.status = response.status;
        error.method = method;
        throw error;
      }
      if (!data || typeof data !== "object") throw new Error("Chưa đọc được phản hồi từ cửa hàng. Hãy thử lại.");
      return data;
    } catch (error) {
      if (timedOut) throw new Error("Kết nối quá thời gian chờ. Hãy kiểm tra mạng và thử lại.");
      if (error instanceof TypeError) throw new Error("Mất kết nối mạng. Hãy kiểm tra kết nối rồi thử lại.");
      throw error;
    } finally {
      clearTimeout(timeout);
      if (controller === requestController) controller = null;
    }
  }

  function validMessage(message) {
    return message && Number.isSafeInteger(message.id) && message.id > 0
      && ["customer", "admin"].includes(message.author)
      && typeof message.text === "string" && message.text.length > 0
      && typeof message.createdAt === "string" && Number.isFinite(Date.parse(message.createdAt));
  }

  function appendMessages(incoming, advanceCursor = false) {
    if (!Array.isArray(incoming) || !incoming.every(validMessage)) {
      throw new Error("Chưa đọc được lịch sử cuộc trò chuyện. Hãy thử tải lại.");
    }
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 140;
    let newReply = false;
    for (const message of incoming) {
      if (advanceCursor) lastId = Math.max(lastId, message.id);
      if (messages.has(message.id)) continue;
      messages.set(message.id, message);
      const item = element("li", `support-chat-message is-${message.author}`);
      item.dataset.messageId = String(message.id);
      const meta = element("div", "support-chat-message-meta");
      const author = element("strong", "", message.author === "customer" ? "Bạn" : "Cửa hàng");
      const time = element("time", "", timeFormat.format(new Date(message.createdAt)));
      time.dateTime = message.createdAt;
      meta.append(author, time);
      item.append(meta, element("p", "", message.text));
      const nextItem = [...log.children].find(child => Number(child.dataset.messageId) > message.id);
      log.insertBefore(item, nextItem ?? null);
      if (message.author === "admin") newReply = true;
    }
    if ((nearBottom || !loaded) && incoming.length) body.scrollTop = body.scrollHeight;
    if (newReply && loaded) setStatus("Bạn có tin nhắn mới từ cửa hàng.");
  }

  function recoverPending() {
    if (!pending) return false;
    const sentMessage = [...messages.values()].find(message => message.requestId === pending.requestId && message.author === "customer" && message.text === pending.text);
    if (!sentMessage) return false;
    pending = null;
    writeStorage(pendingKey, null);
    textInput.value = "";
    setStatus("Đã gửi tin nhắn. Cửa hàng sẽ phản hồi tại đây.");
    updateControls();
    return true;
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (open && active && !document.hidden && token) {
      pollTimer = setTimeout(() => refreshMessages(), 10000);
    }
  }

  async function loadMessages() {
    const data = await fetchApi("GET");
    appendMessages(data.messages, true);
    conversationStarted = Boolean(data.conversationId);
    loaded = true;
    log.setAttribute("aria-live", "polite");
    retry.hidden = true;
    const recovered = recoverPending();
    if (!recovered && pending) setStatus(pendingStatus(), true);
    else if (historyFailed) setStatus("Đã tải lại cuộc trò chuyện.");
    historyFailed = false;
  }

  async function refreshMessages() {
    if (busy || !open || !active || document.hidden || !token) return;
    busy = true;
    updateControls();
    if (!loaded) setStatus("Đang tải cuộc trò chuyện…");
    try {
      await loadMessages();
      if (!pending && status.textContent === "Đang tải cuộc trò chuyện…") setStatus("");
    } catch (error) {
      if (open && active && !document.hidden) {
        historyFailed = true;
        retry.hidden = false;
        setStatus(pending ? pendingStatus() : error.message || "Chưa tải được cuộc trò chuyện. Hãy kiểm tra mạng và thử lại.", true);
      }
    } finally {
      busy = false;
      updateControls();
      schedulePoll();
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !token || !active) return;
    if (!pending) {
      const text = textInput.value.trim();
      if (!text) {
        setStatus("Hãy nhập nội dung cần hỗ trợ trước khi gửi.", true);
        textInput.focus();
        return;
      }
      if (text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(textInput.value)) {
        setStatus("Hãy nhập tin nhắn tối đa 2.000 ký tự và xóa các ký tự điều khiển không hiển thị.", true);
        textInput.focus();
        return;
      }
      const name = conversationStarted ? "" : nameInput.value.trim();
      if (name.length > 120 || (!conversationStarted && /[\u0000-\u001f\u007f]/.test(nameInput.value))) {
        nameDetails.open = true;
        setStatus("Tên của bạn tối đa 120 ký tự. Hãy xóa ký tự xuống dòng, tab hoặc ký tự điều khiển trong tên.", true);
        nameInput.focus();
        return;
      }
      pending = { version: 1, tokenTag: token.slice(0, 12), requestId: requestId(), text, name };
      writeStorage(pendingKey, JSON.stringify(pending));
    }
    clearTimeout(pollTimer);
    busy = true;
    sending = true;
    updateControls();
    setStatus("Đang gửi tin nhắn…");
    try {
      await loadMessages();
      if (pending && open && active && !document.hidden) {
        const data = await fetchApi("POST", { requestId: pending.requestId, text: pending.text, name: pending.name });
        appendMessages([data.message]);
        conversationStarted = Boolean(data.conversationId);
        recoverPending();
        if (pending) throw new Error("Chưa xác nhận tin nhắn đã gửi. Hãy thử lại để kiểm tra.");
        body.scrollTop = body.scrollHeight;
        textInput.focus({ preventScroll: true });
      }
    } catch (error) {
      if (error.method === "POST" && [400, 413].includes(error.status)) {
        pending = null;
        writeStorage(pendingKey, null);
      }
      if (open && active && !document.hidden) {
        setStatus(`${error.message || "Chưa gửi được tin nhắn. Hãy kiểm tra mạng."} ${pending ? pendingStatus() : ""}`.trim(), true);
      }
    } finally {
      busy = false;
      sending = false;
      updateControls();
      schedulePoll();
    }
  });

  function setOpen(value, restoreFocus = true) {
    open = value;
    panel.hidden = !value;
    bubble.setAttribute("aria-expanded", String(value));
    bubble.setAttribute("aria-label", value ? "Đóng cửa sổ chăm sóc khách hàng" : "Mở cửa sổ chăm sóc khách hàng");
    document.body.classList.toggle("has-support-chat-open", value);
    if (value) {
      close.focus({ preventScroll: true });
      refreshMessages();
    } else {
      clearTimeout(pollTimer);
      controller?.abort();
      if (restoreFocus) bubble.focus({ preventScroll: true });
    }
  }

  bubble.addEventListener("click", () => setOpen(!open));
  close.addEventListener("click", () => setOpen(false));
  widget.addEventListener("keydown", event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  });
  retry.addEventListener("click", refreshMessages);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(pollTimer);
    if (document.hidden) controller?.abort();
    else if (open) refreshMessages();
  });
  window.addEventListener("pagehide", () => {
    active = false;
    clearTimeout(pollTimer);
    controller?.abort();
  });
  window.addEventListener("pageshow", () => {
    active = true;
    if (open) refreshMessages();
  });
  window.addEventListener("online", () => {
    if (open) refreshMessages();
  });
  if (!storageAvailable) showStorageWarning();
  updateControls();
})();
