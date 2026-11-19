(() => {
  const panel = document.getElementById("orders-panel");
  if (!panel) return;
  const root = document.getElementById("account-orders-view");
  const prompt = document.getElementById("orders-account-prompt");
  const message = document.getElementById("orders-message");
  const retryButton = document.getElementById("orders-account-retry");
  const list = document.getElementById("orders-list");
  const summary = document.getElementById("orders-summary");
  const statusFilter = document.getElementById("orders-status-filter");
  const filterForm = document.getElementById("orders-filter-form");
  const dateFrom = document.getElementById("orders-date-from");
  const dateTo = document.getElementById("orders-date-to");
  const searchField = document.getElementById("orders-search");
  const sortField = document.getElementById("orders-sort");
  const resetButton = document.getElementById("orders-filter-reset");
  const reloadButton = document.getElementById("orders-reload");
  const previousButton = document.getElementById("orders-previous");
  const nextButton = document.getElementById("orders-next");
  const pageLabel = document.getElementById("orders-page");
  const statuses = {
    NEW: "Mới nhận", CONFIRMED: "Đã xác nhận", SHIPPING: "Đang giao",
    COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy"
  };
  const payments = { COD: "Thanh toán khi nhận hàng (COD)", BANK_TRANSFER: "Chuyển khoản ngân hàng" };
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const dateFormat = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh"
  });
  const milestoneFormat = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
  let active = !root;
  let pageActive = true;
  let customerId = null;
  let currentPage = 1;
  let totalPages = 1;
  let listController = null;
  if (root) {
    const savedFilters = new URLSearchParams(window.location.search);
    for (const [key, control] of [["status", statusFilter], ["sort", sortField],
      ["dateFrom", dateFrom], ["dateTo", dateTo], ["q", searchField]]) {
      const saved = savedFilters.get(key);
      if (!control || saved === null || saved.length > 120) continue;
      if (control.tagName === "SELECT" && !Array.from(control.options).some(option => option.value === saved)) continue;
      control.value = saved;
    }
  }

  function rememberFilters(params) {
    if (!root) return;
    const url = new URL(window.location.href);
    for (const key of ["page", "status", "dateFrom", "dateTo", "q", "sort"]) {
      const value = params.get(key);
      if (value === null || value === "" || (key === "page" && value === "1") ||
        (key === "status" && value === "all") || (key === "sort" && value === "newest")) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  function requestedPage() {
    const value = new URLSearchParams(window.location.search).get("page") || "1";
    return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 1;
  }

  function setControls() {
    const busy = !active || listController !== null || customerId === null;
    for (const control of [statusFilter, reloadButton,
      dateFrom, dateTo, searchField, sortField, resetButton, ...(filterForm?.querySelectorAll("button") || [])]) {
      if (control) control.disabled = busy;
    }
    previousButton.disabled = busy || currentPage <= 1;
    nextButton.disabled = busy || currentPage >= totalPages;
    retryButton.disabled = !active || listController !== null;
    list.setAttribute("aria-busy", String(listController !== null));
  }

  function clearPrivateContent() {
    customerId = null;
    panel.hidden = true;
    prompt.hidden = true;
    list.replaceChildren();
    summary.textContent = "";
  }

  function orderDate(value) {
    const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(" ", "T") + "Z" : value;
    return new Date(timestamp);
  }

  function validOrder(order) {
    return order && typeof order.orderId === "string" && order.orderId.trim() !== "" &&
      (order.orderNumber == null || (typeof order.orderNumber === "string" &&
        Number.isSafeInteger(Number(order.orderNumber)) && Number(order.orderNumber) >= 100001 &&
        String(Number(order.orderNumber)) === order.orderNumber)) &&
      Number.isSafeInteger(order.total) && order.total >= 0 &&
      [order.paymentMethod, order.status, order.customerPhone, order.createdAt]
        .every(value => typeof value === "string" && value.trim() !== "") &&
      Number.isFinite(orderDate(order.createdAt).getTime()) &&
      Array.isArray(order.items) && order.items.length > 0 &&
      order.items.every(item => item && Number.isSafeInteger(item.productId) && item.productId > 0 &&
        typeof item.productName === "string" && item.productName.trim() !== "" &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0 &&
        Number.isSafeInteger(item.total) && item.total === item.quantity * item.unitPrice) &&
      order.items.reduce((sum, item) => sum + item.total, 0) === order.total;
  }

  function imageUrl(value) {
    const fallback = "/assets/shop-logo.png";
    if (typeof value !== "string" || value.includes("\\")) return fallback;
    try {
      const url = new URL(value, window.location.origin);
      const supported = (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value);
      return supported && ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
    } catch { return fallback; }
  }

  function renderProgress(order) {
    if (order.status === "CANCELLED") {
      const cancelled = document.createElement("p");
      cancelled.className = "customer-order-cancelled";
      cancelled.textContent = "Đơn hàng đã hủy. Bạn có thể thêm lại sản phẩm vào giỏ để đặt đơn mới.";
      return cancelled;
    }
    const progress = document.createElement("ol");
    progress.className = "customer-order-progress";
    progress.setAttribute("aria-label", "Tiến trình đơn hàng");
    const history = new Map();
    for (const entry of Array.isArray(order.statusHistory) ? order.statusHistory : []) {
      if (!entry || typeof entry.status !== "string" || typeof entry.changedAt !== "string") continue;
      const changedAt = orderDate(entry.changedAt);
      if (Number.isFinite(changedAt.getTime())) history.set(entry.status, changedAt);
    }
    for (const stage of ["NEW", "CONFIRMED", "SHIPPING", "COMPLETED"]) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.className = "customer-order-stage-label";
      label.textContent = statuses[stage];
      item.append(label);
      if (history.has(stage)) item.classList.add("is-complete");
      if (order.status === stage) item.setAttribute("aria-current", "step");
      const changedAt = history.get(stage);
      if (changedAt) {
        const timestamp = document.createElement("time");
        timestamp.dateTime = changedAt.toISOString();
        const parts = Object.fromEntries(milestoneFormat.formatToParts(changedAt)
          .map(part => [part.type, part.value]));
        timestamp.textContent = parts.day + "/" + parts.month + " " + parts.hour + ":" + parts.minute;
        timestamp.title = dateFormat.format(changedAt);
        item.append(timestamp);
      }
      progress.append(item);
    }
    return progress;
  }

  function renderOrders(orders) {
    const fragment = document.createDocumentFragment();
    for (const order of orders) {
      const code = order.orderNumber ?? order.orderId;
      const card = document.createElement("article");
      card.className = "customer-order-card";
      const header = document.createElement("div");
      header.className = "customer-order-header";
      const heading = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = "Đơn #" + code;
      const status = document.createElement("span");
      status.className = "customer-order-status";
      status.dataset.status = order.status;
      status.textContent = Object.hasOwn(statuses, order.status) ? statuses[order.status] : order.status;
      const meta = document.createElement("p");
      meta.className = "customer-order-meta";
      const payment = Object.hasOwn(payments, order.paymentMethod) ? payments[order.paymentMethod] : order.paymentMethod;
      meta.textContent = dateFormat.format(orderDate(order.createdAt)) + " · " + order.items.length + " sản phẩm";
      heading.append(title, meta);
      header.append(heading, status);
      const items = document.createElement("ul");
      items.className = "customer-order-items";
      for (const item of order.items) {
        const row = document.createElement("li");
        row.className = "customer-order-item";
        const image = document.createElement("img");
        image.className = "customer-order-thumbnail";
        image.src = imageUrl(item.imageUrl);
        image.alt = "";
        image.width = 64;
        image.height = 64;
        image.loading = "lazy";
        image.addEventListener("error", () => { image.src = "/assets/shop-logo.png"; }, { once: true });
        const product = document.createElement("div");
        product.className = "customer-order-product";
        const name = document.createElement("h3");
        name.textContent = item.productName;
        const quantity = document.createElement("p");
        quantity.textContent = "Số lượng " + item.quantity + " · Đơn giá " + money.format(item.unitPrice);
        product.append(name, quantity);
        const itemTotal = document.createElement("p");
        itemTotal.className = "customer-order-item-total";
        itemTotal.textContent = money.format(item.total);
        row.append(image, product, itemTotal);
        items.append(row);
      }
      const actions = document.createElement("div");
      actions.className = "customer-order-actions";
      const total = document.createElement("p");
      total.className = "customer-order-total";
      total.textContent = "Tổng tiền " + money.format(order.total);
      const paymentRow = document.createElement("div");
      paymentRow.className = "customer-order-payment";
      const paymentLabel = document.createElement("p");
      paymentLabel.textContent = payment;
      paymentRow.append(paymentLabel, total);
      const detail = document.createElement("a");
      detail.className = "button-link button-secondary";
      detail.href = "/tra-cuu.html?orderId=" + encodeURIComponent(code);
      detail.textContent = "Xem chi tiết";
      detail.setAttribute("aria-label", "Xem chi tiết đơn " + code);
      detail.addEventListener("click", event => {
        if (window.ShopStorefront && !window.ShopStorefront.prepareNavigation(event, detail)) return;
        window.ShopMemory?.prepareTracking(code, order.customerPhone);
      });
      const reorder = document.createElement("button");
      reorder.type = "button";
      reorder.textContent = "Mua lại";
      reorder.setAttribute("aria-label", "Mua lại đơn " + code);
      const actionMessage = document.createElement("p");
      actionMessage.className = "customer-order-action-message";
      actionMessage.setAttribute("role", "status");
      reorder.addEventListener("click", () => {
        if (!active || customerId === null || reorder.disabled) return;
        reorder.disabled = true;
        const prepared = window.ShopMemory?.queueReorder(code, order.items);
        if (!prepared || prepared.error) {
          actionMessage.textContent = prepared?.error || "Chưa chuyển được sản phẩm vào giỏ. Hãy tải lại trang rồi thử lại.";
          reorder.disabled = false;
          return;
        }
        if (window.ShopAccountWorkspace) window.ShopAccountWorkspace.open("cart");
        else window.location.assign("/dang-nhap.html?view=cart");
      });
      actions.append(detail, reorder);
      card.append(header, items, paymentRow, renderProgress(order), actions, actionMessage);
      fragment.append(card);
    }
    if (orders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "workspace-orders-empty";
      const filtered = statusFilter.value !== "all" || dateFrom?.value || dateTo?.value || searchField?.value.trim();
      const title = document.createElement("h2");
      title.textContent = filtered ? "Chưa có đơn hàng phù hợp" : "Bạn chưa có đơn hàng";
      const text = document.createElement("p");
      text.textContent = filtered ? "Hãy thay đổi bộ lọc hoặc tìm theo mã đơn và tên sản phẩm khác."
        : "Chọn sản phẩm chăm sóc răng miệng và đặt đơn đầu tiên của bạn.";
      const explore = document.createElement("a");
      explore.className = "button-link";
      explore.href = "/danh-muc.html";
      explore.textContent = "Danh mục";
      empty.append(title, text, explore);
      fragment.append(empty);
    }
    list.replaceChildren(fragment);
  }

  async function loadOrders(page = 1) {
    if (!active || !pageActive) return;
    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    const filter = statusFilter.value;
    const params = new URLSearchParams({ page: String(page), status: filter });
    if (dateFrom?.value) params.set("dateFrom", dateFrom.value);
    if (dateTo?.value) params.set("dateTo", dateTo.value);
    if (searchField?.value.trim()) params.set("q", searchField.value.trim());
    if (sortField) params.set("sort", sortField.value);
    clearPrivateContent();
    prompt.hidden = true;
    retryButton.hidden = true;
    message.textContent = "Đang tải đơn hàng...";
    setControls();
    const options = {
      credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    };
    try {
      const accountResponse = await fetch("/api/account/me", options);
      if (!active || listController !== controller) return;
      if (accountResponse.status === 401) {
        prompt.hidden = false;
        message.textContent = "";
        return;
      }
      const account = await accountResponse.json();
      if (!active || listController !== controller) return;
      if (!accountResponse.ok || !account || !Number.isSafeInteger(account.id) || account.id < 1 ||
        typeof account.phone !== "string") throw new Error("Phiên tài khoản chưa hợp lệ");
      const response = await fetch("/api/account/orders?" + params, {
        ...options, headers: { "X-Customer-Id": String(account.id) }
      });
      const result = await response.json();
      if (!active || listController !== controller) return;
      if (response.status === 401) {
        prompt.hidden = false;
        retryButton.hidden = false;
        message.textContent = "Phiên tài khoản đã thay đổi. Hãy kiểm tra lại tài khoản.";
        return;
      }
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Tải đơn hàng gặp lỗi.");
      if (!result || !Array.isArray(result.orders) || result.orders.length > 10 ||
        !result.orders.every(validOrder) || new Set(result.orders.map(order => order.orderId)).size !== result.orders.length ||
        !Number.isSafeInteger(result.page) || result.page < 1 ||
        !Number.isSafeInteger(result.totalOrders) || result.totalOrders < 0 ||
        result.totalPages !== Math.max(1, Math.ceil(result.totalOrders / 10)) || result.page > result.totalPages) {
        throw new Error("Danh sách đơn hàng chưa hợp lệ");
      }
      customerId = account.id;
      currentPage = result.page;
      totalPages = result.totalPages;
      params.set("page", String(currentPage));
      rememberFilters(params);
      renderOrders(result.orders);
      summary.textContent = result.totalOrders + " đơn hàng";
      pageLabel.textContent = "Trang " + currentPage + " / " + totalPages;
      panel.hidden = false;
      message.textContent = "";
    } catch (error) {
      if (!active || listController !== controller) return;
      message.textContent = error.name === "TypeError" || error.name === "TimeoutError"
        ? "Kết nối gặp lỗi. Bấm Kiểm tra lại tài khoản để thử lại." : error.message;
      retryButton.hidden = false;
      panel.hidden = false;
    } finally {
      if (listController === controller) {
        listController = null;
        setControls();
        if (!panel.hidden && customerId === null) {
          for (const control of filterForm?.elements || []) control.disabled = false;
        }
      }
    }
  }

  filterForm?.addEventListener("submit", event => {
    event.preventDefault();
    if (!listController) void loadOrders(1);
  });
  resetButton?.addEventListener("click", () => {
    filterForm.reset();
    void loadOrders(1);
  });
  sortField?.addEventListener("change", () => {
    void loadOrders(1);
  });
  statusFilter.addEventListener("change", () => {
    void loadOrders(1);
  });
  reloadButton.addEventListener("click", () => {
    void loadOrders(currentPage);
  });
  retryButton.addEventListener("click", () => void loadOrders(1));
  previousButton.addEventListener("click", () => {
    if (!listController && currentPage > 1) void loadOrders(currentPage - 1);
  });
  nextButton.addEventListener("click", () => {
    if (!listController && currentPage < totalPages) void loadOrders(currentPage + 1);
  });
  function stopRequests() {
    listController?.abort();
    listController = null;
  }
  function setActive(value) {
    const next = value === true && pageActive;
    if (active === next) return;
    active = next;
    stopRequests();
    clearPrivateContent();
    message.textContent = "";
    retryButton.hidden = true;
    setControls();
    if (active) void loadOrders(requestedPage());
  }
  window.ShopOrders = { setActive };
  window.addEventListener("shop-workspace-view", event => setActive(event.detail?.view === "orders"));
  window.addEventListener("shop-account-change", event => {
    stopRequests();
    clearPrivateContent();
    message.textContent = "";
    retryButton.hidden = true;
    if (event.detail?.account === null) {
      if (active) prompt.hidden = false;
      setControls();
      return;
    }
    if (active) void loadOrders(requestedPage());
  });
  window.addEventListener("pagehide", () => {
    pageActive = false;
    active = false;
    stopRequests();
    clearPrivateContent();
    message.textContent = "";
    setControls();
  });
  window.addEventListener("pageshow", event => {
    pageActive = true;
    if (event.persisted) setActive(!root || window.ShopAccountWorkspace?.currentView === "orders");
  });
  setControls();
  if (active) void loadOrders(1);
})();
