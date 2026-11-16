(() => {
  const panel = document.getElementById("orders-panel");
  const prompt = document.getElementById("orders-account-prompt");
  const message = document.getElementById("orders-message");
  const retryButton = document.getElementById("orders-account-retry");
  const list = document.getElementById("orders-list");
  const summary = document.getElementById("orders-summary");
  const statusFilter = document.getElementById("orders-status-filter");
  const reloadButton = document.getElementById("orders-reload");
  const previousButton = document.getElementById("orders-previous");
  const nextButton = document.getElementById("orders-next");
  const pageLabel = document.getElementById("orders-page");
  const claimPanel = document.getElementById("orders-claim-panel");
  const claimForm = document.getElementById("orders-claim-form");
  const claimCode = document.getElementById("orders-claim-code");
  const claimPhone = document.getElementById("orders-claim-phone");
  const claimButton = document.getElementById("orders-claim-submit");
  const claimMessage = document.getElementById("orders-claim-message");
  const statuses = {
    NEW: "Mới nhận", CONFIRMED: "Đã xác nhận", SHIPPING: "Đang giao",
    COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy"
  };
  const payments = { COD: "Thanh toán khi nhận hàng (COD)", BANK_TRANSFER: "Chuyển khoản ngân hàng" };
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const dateFormat = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh"
  });
  let active = true;
  let customerId = null;
  let currentPage = 1;
  let totalPages = 1;
  let listController = null;
  let claimController = null;

  function setControls() {
    const busy = !active || listController !== null || claimController !== null || customerId === null;
    for (const control of [statusFilter, reloadButton, claimCode, claimPhone, claimButton]) control.disabled = busy;
    previousButton.disabled = busy || currentPage <= 1;
    nextButton.disabled = busy || currentPage >= totalPages;
    retryButton.disabled = listController !== null;
    list.setAttribute("aria-busy", String(listController !== null));
    claimForm.setAttribute("aria-busy", String(claimController !== null));
    claimButton.textContent = claimController ? "Đang thêm đơn..." : "Thêm vào đơn hàng của tôi";
  }

  function clearPrivateContent() {
    customerId = null;
    panel.hidden = true;
    claimPanel.hidden = true;
    list.replaceChildren();
    summary.textContent = "";
    claimCode.value = "";
    claimPhone.value = "";
    claimMessage.textContent = "";
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

  function renderOrders(orders) {
    const fragment = document.createDocumentFragment();
    for (const order of orders) {
      const code = order.orderNumber ?? order.orderId;
      const card = document.createElement("article");
      card.className = "customer-order-card";
      const header = document.createElement("div");
      header.className = "customer-order-header";
      const title = document.createElement("h2");
      title.textContent = "Đơn #" + code;
      const status = document.createElement("span");
      status.className = "customer-order-status";
      status.dataset.status = order.status;
      status.textContent = Object.hasOwn(statuses, order.status) ? statuses[order.status] : order.status;
      header.append(title, status);
      const meta = document.createElement("p");
      meta.className = "customer-order-meta";
      const payment = Object.hasOwn(payments, order.paymentMethod) ? payments[order.paymentMethod] : order.paymentMethod;
      meta.textContent = dateFormat.format(orderDate(order.createdAt)) + " · " + payment;
      const items = document.createElement("ul");
      items.className = "customer-order-items";
      for (const item of order.items) {
        const row = document.createElement("li");
        row.textContent = item.productName + " × " + item.quantity + " · " + money.format(item.total);
        items.append(row);
      }
      const actions = document.createElement("div");
      actions.className = "customer-order-actions";
      const total = document.createElement("p");
      total.className = "customer-order-total";
      total.textContent = "Tổng tiền " + money.format(order.total);
      const detail = document.createElement("a");
      detail.className = "button-link button-secondary";
      detail.href = "/tra-cuu.html?orderId=" + encodeURIComponent(code);
      detail.textContent = "Xem chi tiết";
      detail.setAttribute("aria-label", "Xem chi tiết đơn " + code);
      detail.addEventListener("click", () => window.ShopMemory?.prepareTracking(code, order.customerPhone));
      actions.append(total, detail);
      card.append(header, meta, items, actions);
      fragment.append(card);
    }
    if (orders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "panel";
      empty.textContent = statusFilter.value === "all"
        ? "Bạn chưa có đơn hàng trong tài khoản. Đơn đã có mã có thể thêm bằng biểu mẫu bên dưới."
        : "Chưa có đơn hàng phù hợp với trạng thái đã chọn.";
      fragment.append(empty);
    }
    list.replaceChildren(fragment);
  }

  async function loadOrders(page = 1) {
    if (!active) return;
    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    const filter = statusFilter.value;
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
      const params = new URLSearchParams({ page: String(page), status: filter });
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
      if (!response.ok || !result || !Array.isArray(result.orders) || result.orders.length > 10 ||
        !result.orders.every(validOrder) || new Set(result.orders.map(order => order.orderId)).size !== result.orders.length ||
        !Number.isSafeInteger(result.page) || result.page < 1 ||
        !Number.isSafeInteger(result.totalOrders) || result.totalOrders < 0 ||
        result.totalPages !== Math.max(1, Math.ceil(result.totalOrders / 10)) || result.page > result.totalPages) {
        throw new Error("Danh sách đơn hàng chưa hợp lệ");
      }
      customerId = account.id;
      currentPage = result.page;
      totalPages = result.totalPages;
      claimPhone.value = account.phone;
      renderOrders(result.orders);
      summary.textContent = result.totalOrders + " đơn hàng";
      pageLabel.textContent = "Trang " + currentPage + " / " + totalPages;
      panel.hidden = false;
      claimPanel.hidden = false;
      message.textContent = "";
    } catch {
      if (!active || listController !== controller) return;
      message.textContent = "Tải đơn hàng gặp lỗi. Bấm Kiểm tra lại tài khoản để thử lại.";
      retryButton.hidden = false;
    } finally {
      if (listController === controller) {
        listController = null;
        setControls();
      }
    }
  }

  claimForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!active || customerId === null || listController || claimController) return;
    claimCode.value = claimCode.value.trim();
    claimPhone.value = claimPhone.value.trim();
    if (!claimForm.reportValidity()) return;
    const expectedCustomerId = customerId;
    const controller = new AbortController();
    claimController = controller;
    claimMessage.textContent = "Đang thêm đơn hàng...";
    setControls();
    let linkedCode = null;
    try {
      const response = await fetch("/api/account/orders/claim", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Customer-Id": String(expectedCustomerId) },
        body: JSON.stringify({ orderId: claimCode.value, customerPhone: claimPhone.value }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || claimController !== controller) return;
      if (response.status === 401) {
        clearPrivateContent();
        prompt.hidden = false;
        retryButton.hidden = false;
        message.textContent = "Phiên tài khoản đã thay đổi. Hãy kiểm tra lại tài khoản.";
        return;
      }
      if (!response.ok) {
        claimMessage.textContent = typeof result?.error === "string" ? result.error : "Chưa thêm được đơn. Hãy thử lại.";
        return;
      }
      if (!validOrder(result)) throw new Error("Đơn hàng chưa hợp lệ");
      linkedCode = result.orderNumber ?? result.orderId;
    } catch {
      if (active && claimController === controller) {
        claimMessage.textContent = "Chưa xác nhận được kết quả thêm đơn. Hãy thử lại với cùng mã đơn và số điện thoại.";
      }
    } finally {
      if (claimController === controller) {
        claimController = null;
        setControls();
      }
    }
    if (linkedCode !== null && active) {
      statusFilter.value = "all";
      await loadOrders(1);
      if (active && customerId === expectedCustomerId) claimMessage.textContent = "Đã thêm đơn " + linkedCode + " vào tài khoản.";
    }
  });

  statusFilter.addEventListener("change", () => {
    if (!claimController) void loadOrders(1);
  });
  reloadButton.addEventListener("click", () => {
    if (!claimController) void loadOrders(currentPage);
  });
  retryButton.addEventListener("click", () => void loadOrders(1));
  previousButton.addEventListener("click", () => {
    if (!listController && !claimController && currentPage > 1) void loadOrders(currentPage - 1);
  });
  nextButton.addEventListener("click", () => {
    if (!listController && !claimController && currentPage < totalPages) void loadOrders(currentPage + 1);
  });
  window.addEventListener("shop-account-change", () => {
    if (!active) return;
    claimController?.abort();
    claimController = null;
    void loadOrders(1);
  });
  window.addEventListener("pagehide", () => {
    active = false;
    listController?.abort();
    claimController?.abort();
    listController = null;
    claimController = null;
    clearPrivateContent();
    message.textContent = "";
    setControls();
  });
  window.addEventListener("pageshow", event => {
    active = true;
    if (event.persisted) void loadOrders(1);
  });
  void loadOrders(1);
})();
