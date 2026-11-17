(() => {
  "use strict";

  const panel = document.getElementById("admin-panel");
  const section = document.getElementById("admin-support");
  if (!panel || !section) return;

  const reloadButton = document.getElementById("support-reload");
  const status = document.getElementById("support-status");
  const empty = document.getElementById("support-empty");
  const list = document.getElementById("support-conversation-list");
  const threadTitle = document.getElementById("support-thread-title");
  const threadState = document.getElementById("support-thread-state");
  const messageList = document.getElementById("support-messages");
  const replyForm = document.getElementById("support-reply-form");
  const replyField = document.getElementById("support-reply");
  const sendButton = document.getElementById("support-send");
  const replyStatus = document.getElementById("support-reply-status");
  const dateFormat = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
  const conversations = new Map();
  const conversationNodes = new Map();
  const messageNodes = new Map();
  const drafts = new Map();
  const pendingReplies = new Map();
  const requests = new Set();
  let selectedId = null;
  let messages = [];
  let lastLoadedId = 0;
  let sectionVisible = false;
  let pageActive = true;
  let active = false;
  let signedIn = !panel.hidden;
  let refreshing = false;
  let threadLoading = false;
  let threadReady = false;
  let sending = false;
  let generation = 0;
  let selectionVersion = 0;
  let pollTimer = null;

  function showStatus(element, text, isError = false) {
    element.textContent = text;
    element.dataset.error = String(isError);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
  }

  function updateControls() {
    reloadButton.disabled = !active || refreshing;
    replyField.disabled = !active || !selectedId || !threadReady || sending;
    replyField.readOnly = pendingReplies.has(selectedId);
    sendButton.disabled = replyField.disabled || replyField.value.trim().length === 0;
    sendButton.textContent = sending ? "Đang gửi..." : pendingReplies.has(selectedId) ? "Kiểm tra và gửi lại" : "Gửi trả lời";
    replyForm.setAttribute("aria-busy", String(sending));
  }

  function stopRequests() {
    if (sending && pendingReplies.has(selectedId)) {
      showStatus(replyStatus, "Lần gửi trước chưa được xác nhận. Bấm Kiểm tra và gửi lại khi quay lại mục này.");
    }
    generation += 1;
    clearTimeout(pollTimer);
    pollTimer = null;
    for (const controller of requests) controller.abort();
    requests.clear();
    refreshing = false;
    threadLoading = false;
    sending = false;
  }

  function clearSession() {
    stopRequests();
    selectedId = null;
    selectionVersion += 1;
    messages = [];
    messageNodes.clear();
    lastLoadedId = 0;
    threadReady = false;
    conversations.clear();
    conversationNodes.clear();
    drafts.clear();
    pendingReplies.clear();
    list.replaceChildren();
    messageList.replaceChildren();
    empty.hidden = false;
    empty.textContent = "Đăng nhập để xem cuộc trò chuyện.";
    threadTitle.textContent = "Chọn một cuộc trò chuyện";
    threadState.textContent = "";
    replyField.value = "";
    showStatus(status, "Đăng nhập để xem tin nhắn chăm sóc khách hàng.");
    showStatus(replyStatus, "");
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    requests.add(controller);
    try {
      const response = await fetch("/api/admin/support/conversations" + path, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        signal: controller.signal
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        active = false;
        clearSession();
        updateControls();
        if (typeof window.checkSession === "function") void window.checkSession();
        throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
      }
      if (!response.ok || body === null) {
        const error = new Error(body?.message || body?.error || "Không thể tải tin nhắn. Hãy thử lại.");
        error.status = response.status;
        throw error;
      }
      return body;
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
    }
  }

  function conversationButton(conversation) {
    let item = conversationNodes.get(conversation.id);
    if (!item) {
      const node = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "support-conversation";
      const name = document.createElement("strong");
      const preview = document.createElement("span");
      preview.className = "support-conversation-preview";
      const meta = document.createElement("span");
      meta.className = "support-conversation-meta";
      const time = document.createElement("time");
      const waiting = document.createElement("span");
      waiting.className = "support-conversation-waiting";
      waiting.textContent = "Chờ phản hồi";
      meta.append(time, waiting);
      button.append(name, preview, meta);
      button.addEventListener("click", () => void selectConversation(conversation.id));
      node.append(button);
      item = { node, button, name, preview, time, waiting };
      conversationNodes.set(conversation.id, item);
    }
    item.name.textContent = conversation.name;
    item.preview.textContent = conversation.preview;
    item.time.dateTime = conversation.updatedAt;
    item.time.textContent = formatDate(conversation.updatedAt);
    item.waiting.hidden = conversation.lastAuthor !== "customer";
    item.button.setAttribute("aria-current", String(conversation.id === selectedId));
    return item;
  }

  function renderConversations(items) {
    conversations.clear();
    const ids = new Set(items.map(item => item.id));
    for (const [id, item] of conversationNodes) {
      if (!ids.has(id)) {
        item.node.remove();
        conversationNodes.delete(id);
      }
    }
    items.forEach((conversation, index) => {
      conversations.set(conversation.id, conversation);
      const item = conversationButton(conversation);
      const current = list.children[index];
      if (current !== item.node) list.insertBefore(item.node, current || null);
    });
    empty.hidden = items.length > 0;
    empty.textContent = "Chưa có tin nhắn từ khách hàng.";
  }

  function appendMessages(incoming, replace = false) {
    const nearBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 72;
    if (replace) {
      messages = [];
      messageNodes.clear();
      messageList.replaceChildren();
    }
    if (incoming.length) messageList.querySelector(".support-placeholder")?.remove();
    const ids = new Set(messages.map(message => message.id));
    for (const message of incoming) {
      if (ids.has(message.id)) continue;
      ids.add(message.id);
      messages.push(message);
      const article = document.createElement("article");
      article.className = "support-message";
      article.dataset.author = message.author;
      const author = document.createElement("strong");
      author.textContent = message.author === "admin" ? "Cửa hàng" : "Khách hàng";
      const text = document.createElement("p");
      text.textContent = message.text;
      const time = document.createElement("time");
      time.dateTime = message.createdAt;
      time.textContent = formatDate(message.createdAt);
      article.append(author, text, time);
      messageNodes.set(message.id, article);
    }
    messages.sort((left, right) => left.id - right.id);
    messages.forEach((message, index) => {
      const article = messageNodes.get(message.id);
      const current = messageList.children[index];
      if (current !== article) messageList.insertBefore(article, current || null);
    });
    if (messages.length === 0) {
      const placeholder = document.createElement("p");
      placeholder.className = "support-placeholder";
      placeholder.textContent = "Cuộc trò chuyện chưa có tin nhắn.";
      messageList.replaceChildren(placeholder);
    }
    if (replace || nearBottom) messageList.scrollTop = messageList.scrollHeight;
    const last = messages[messages.length - 1];
    threadState.textContent = last?.author === "customer" ? "Khách hàng đang chờ phản hồi." : "";
  }

  async function loadThread(replace = false) {
    if (!active || !selectedId || threadLoading) return;
    const id = selectedId;
    const version = selectionVersion;
    const currentGeneration = generation;
    threadLoading = true;
    if (replace) {
      threadState.textContent = "Đang tải tin nhắn...";
      messageList.setAttribute("aria-busy", "true");
    }
    updateControls();
    try {
      const after = replace ? 0 : lastLoadedId;
      const result = await request("/" + encodeURIComponent(id) + "/messages?after=" + after);
      if (!active || generation !== currentGeneration || selectionVersion !== version) return;
      if (!Array.isArray(result.messages)) throw new Error("Dữ liệu tin nhắn chưa hợp lệ.");
      threadTitle.textContent = result.name;
      appendMessages(result.messages, replace);
      lastLoadedId = after;
      for (const message of result.messages) lastLoadedId = Math.max(lastLoadedId, message.id);
      threadReady = true;
    } catch (error) {
      if (active && generation === currentGeneration && selectionVersion === version) {
        showStatus(replyStatus, "Tải tin nhắn gặp lỗi. Bấm Tải lại tin nhắn để thử lại.", true);
      }
    } finally {
      if (generation === currentGeneration && selectionVersion === version) {
        threadLoading = false;
        messageList.setAttribute("aria-busy", "false");
        updateControls();
      }
    }
  }

  async function selectConversation(id) {
    if (!active || selectedId === id || sending) return;
    if (selectedId) drafts.set(selectedId, replyField.value);
    selectedId = id;
    selectionVersion += 1;
    threadLoading = false;
    messages = [];
    messageNodes.clear();
    lastLoadedId = 0;
    threadReady = false;
    messageList.replaceChildren();
    threadTitle.textContent = conversations.get(id)?.name || "Cuộc trò chuyện";
    replyField.value = drafts.get(id) || "";
    showStatus(replyStatus, pendingReplies.has(id) ? "Lần gửi trước chưa được xác nhận. Bấm Gửi trả lời để kiểm tra và thử lại." : "");
    for (const [conversationId, item] of conversationNodes) {
      item.button.setAttribute("aria-current", String(conversationId === id));
    }
    updateControls();
    await loadThread(true);
  }

  function scheduleRefresh() {
    clearTimeout(pollTimer);
    if (active) pollTimer = setTimeout(() => void refresh(), 10000);
  }

  async function refresh() {
    if (!active || refreshing || sending) return;
    const currentGeneration = generation;
    refreshing = true;
    if (conversations.size === 0) showStatus(status, "Đang tải cuộc trò chuyện...");
    updateControls();
    try {
      const result = await request("");
      if (!active || generation !== currentGeneration) return;
      if (!Array.isArray(result)) throw new Error("Danh sách cuộc trò chuyện chưa hợp lệ.");
      renderConversations(result);
      showStatus(status, result.length ? "Tin nhắn tự cập nhật mỗi 10 giây khi bạn xem mục này." : "");
      if (!selectedId && result.length) await selectConversation(result[0].id);
      else if (selectedId) await loadThread(messages.length === 0);
    } catch (error) {
      if (active && generation === currentGeneration) {
        showStatus(status, error.message || "Tải cuộc trò chuyện gặp lỗi. Hãy bấm Tải lại tin nhắn.", true);
        if (conversations.size === 0) empty.textContent = "Chưa tải được cuộc trò chuyện.";
      }
    } finally {
      if (generation === currentGeneration) {
        refreshing = false;
        updateControls();
        scheduleRefresh();
      }
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!active || !selectedId || sending || !threadReady || !replyForm.reportValidity()) return;
    const text = replyField.value.trim();
    if (!text) return;
    const id = selectedId;
    const currentGeneration = generation;
    let pending = pendingReplies.get(id);
    if (pending && pending.text !== text) {
      showStatus(replyStatus, "Hãy gửi lại nội dung trước đó để xác nhận kết quả trước khi soạn tin nhắn mới.", true);
      updateControls();
      return;
    }
    const retrying = Boolean(pending);
    if (!pending) {
      pending = { requestId: crypto.randomUUID(), text };
      pendingReplies.set(id, pending);
    }
    sending = true;
    showStatus(replyStatus, retrying ? "Đang kiểm tra lần gửi trước..." : "Đang gửi trả lời...");
    updateControls();
    try {
      let delivered = null;
      if (retrying) {
        const history = await request("/" + encodeURIComponent(id) + "/messages?after=0");
        if (!active || generation !== currentGeneration) return;
        delivered = history.messages.find(message => message.author === "admin" && message.requestId === pending.requestId);
        appendMessages(history.messages, true);
        lastLoadedId = history.messages[history.messages.length - 1]?.id || 0;
      }
      if (!delivered) {
        const result = await request("/" + encodeURIComponent(id) + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending)
        });
        if (!active || generation !== currentGeneration) return;
        delivered = result.message;
      }
      if (!delivered || !Number.isSafeInteger(delivered.id)) throw new Error("Chưa xác nhận được kết quả gửi.");
      appendMessages([delivered]);
      pendingReplies.delete(id);
      drafts.delete(id);
      replyField.value = "";
      showStatus(replyStatus, "Đã gửi trả lời.");
    } catch (error) {
      if (active && generation === currentGeneration) {
        if (error.status >= 400 && error.status < 500 && error.status !== 408) {
          pendingReplies.delete(id);
          showStatus(replyStatus, error.message, true);
        } else {
          showStatus(replyStatus, "Chưa xác nhận được kết quả gửi. Giữ nội dung và bấm Gửi trả lời để kiểm tra, thử lại.", true);
        }
      }
    } finally {
      if (generation === currentGeneration) {
        sending = false;
        updateControls();
        scheduleRefresh();
      }
    }
  }

  function syncActivity() {
    const sessionAvailable = !panel.hidden;
    if (!sessionAvailable && signedIn) clearSession();
    signedIn = sessionAvailable;
    const shouldBeActive = sessionAvailable && sectionVisible && !document.hidden && pageActive;
    if (active === shouldBeActive) {
      updateControls();
      return;
    }
    active = shouldBeActive;
    if (active) void refresh();
    else stopRequests();
    updateControls();
  }

  new MutationObserver(syncActivity).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  new IntersectionObserver(entries => {
    sectionVisible = entries[0].isIntersecting;
    syncActivity();
  }).observe(section);
  document.addEventListener("visibilitychange", syncActivity);
  window.addEventListener("pagehide", () => {
    pageActive = false;
    syncActivity();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    syncActivity();
  });
  replyField.addEventListener("input", () => {
    if (selectedId) drafts.set(selectedId, replyField.value);
    updateControls();
  });
  reloadButton.addEventListener("click", () => void refresh());
  replyForm.addEventListener("submit", event => void sendReply(event));
  updateControls();
})();
