const trackingForm = document.getElementById("tracking-form");
const orderIdField = document.getElementById("tracking-order-id");
const phoneField = document.getElementById("tracking-phone");
const trackingButton = document.getElementById("tracking-button");
const trackingMessage = document.getElementById("tracking-message");
const historyPanel = document.getElementById("tracking-history-panel");
const historyList = document.getElementById("tracking-history");
const recentOrdersList = document.getElementById("recent-orders-list");
const recentOrdersMessage = document.getElementById("recent-orders-message");
const forgetRecentOrdersButton = document.getElementById("forget-recent-orders");
const trackingActions = document.getElementById("tracking-actions");
const copyTrackedOrderButton = document.getElementById("copy-tracked-order");
const reorderButton = document.getElementById("reorder-button");
const trackingActionsMessage = document.getElementById("tracking-actions-message");

const trackingMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND"
});
const savedTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short"
});

const trackingStatusLabels = {
  NEW: "Mới nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};

let activeLookup = null;
let lastLookup = null;
let feedbackVersion = 0;
let canForgetRecentOrders = false;

function validOrderNumber(value) {
  return value === undefined || value === null || (typeof value === "string" &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
}

function orderCode(order) {
  return order.orderNumber ?? order.orderId;
}

function clearHistory() {
  historyPanel.hidden = true;
  historyList.replaceChildren();
}

function clearLookupResult() {
  feedbackVersion += 1;
  lastLookup = null;
  trackingMessage.textContent = "";
  trackingActions.hidden = true;
  trackingActionsMessage.textContent = "";
  reorderButton.disabled = true;
  clearHistory();
}

async function copyOrderId(orderId, messageElement) {
  const version = ++feedbackVersion;
  try {
    await navigator.clipboard.writeText(orderId);
    if (feedbackVersion === version) messageElement.textContent = "Đã sao chép mã đơn.";
  } catch {
    if (feedbackVersion === version) {
      messageElement.textContent = "Chưa sao chép được. Bạn có thể chọn mã đơn đang hiển thị và sao chép thủ công.";
    }
  }
}

function renderRecentOrders() {
  recentOrdersList.replaceChildren();
  canForgetRecentOrders = false;
  forgetRecentOrdersButton.disabled = true;
  if (!window.ShopMemory) {
    recentOrdersMessage.textContent = "Chưa đọc được mã đơn đã lưu. Bạn vẫn có thể nhập mã đơn để tra cứu bên dưới.";
    return;
  }

  const { receipts, error } = window.ShopMemory.readReceipts();
  canForgetRecentOrders = receipts.length > 0 || error !== "";
  const fragment = document.createDocumentFragment();
  for (const receipt of receipts) {
    const displayCode = orderCode(receipt);
    const card = document.createElement("article");
    card.className = "recent-order";
    const code = document.createElement("p");
    code.textContent = "Mã đơn " + displayCode;
    const details = document.createElement("p");
    details.textContent = "Tiền sản phẩm " + trackingMoney.format(receipt.total) +
      " · Lưu trên trình duyệt lúc " + savedTime.format(new Date(receipt.savedAt));
    const actions = document.createElement("div");
    actions.className = "receipt-actions";
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.textContent = "Chọn mã đơn để tra cứu";
    selectButton.disabled = Boolean(activeLookup);
    selectButton.addEventListener("click", () => {
      if (activeLookup) return;
      const matchingPhone = [receipt.orderId, displayCode].includes(orderIdField.value.trim())
        ? phoneField.value.trim() : "";
      clearLookupResult();
      orderIdField.value = displayCode;
      phoneField.value = matchingPhone;
      const prepared = window.ShopMemory.prepareTracking(displayCode, matchingPhone);
      let handoffError = prepared.error;
      if (!handoffError) {
        const handoff = window.ShopMemory.takeTracking();
        handoffError = handoff.error;
        if (handoff.tracking?.orderId === displayCode) {
          phoneField.value = handoff.tracking.customerPhone;
        }
      }
      recentOrdersMessage.textContent = handoffError || (phoneField.value
        ? "Đã chọn mã đơn và số điện thoại trong phiên này. Bấm Tra cứu để xem đơn."
        : "Đã chọn mã đơn. Nhập số điện thoại nhận hàng rồi bấm Tra cứu.");
      (phoneField.value ? trackingButton : phoneField).focus();
    });
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Sao chép mã đơn";
    copyButton.disabled = Boolean(activeLookup);
    copyButton.addEventListener("click", () => {
      if (!activeLookup) void copyOrderId(displayCode, recentOrdersMessage);
    });
    actions.append(selectButton, copyButton);
    card.append(code, details, actions);
    fragment.append(card);
  }
  recentOrdersList.replaceChildren(fragment);
  forgetRecentOrdersButton.disabled = Boolean(activeLookup) || !canForgetRecentOrders;
  recentOrdersMessage.textContent = error || (receipts.length === 0
    ? "Chưa có mã đơn được lưu trên trình duyệt này." : "");
}

forgetRecentOrdersButton.addEventListener("click", () => {
  if (activeLookup || !window.ShopMemory) return;
  feedbackVersion += 1;
  const result = window.ShopMemory.forgetReceipts();
  renderRecentOrders();
  if (result.error) {
    canForgetRecentOrders = true;
    forgetRecentOrdersButton.disabled = false;
  }
  recentOrdersMessage.textContent = result.error ||
    "Đã xóa danh sách mã đơn được lưu trên trình duyệt này. Bạn có thể nhập mã đơn để tra cứu khi cần.";
});

function renderHistory(history) {
  if (history === undefined) return;
  if (!Array.isArray(history) || !history.every(event => event &&
    typeof event.status === "string" && event.status.trim() !== "" &&
    (event.changedAt === null || typeof event.changedAt === "string"))) {
    throw new Error("Lịch sử đơn hàng chưa hợp lệ");
  }
  const fragment = document.createDocumentFragment();
  for (const event of history) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = Object.hasOwn(trackingStatusLabels, event.status)
      ? trackingStatusLabels[event.status] : event.status;
    const when = document.createElement("span");
    when.textContent = event.changedAt === null
      ? "Trạng thái trước khi bật lịch sử"
      : event.changedAt + " UTC";
    item.append(label, when);
    fragment.append(item);
  }
  historyList.replaceChildren(fragment);
  historyPanel.hidden = history.length === 0;
}

function setLookupBusy(value) {
  orderIdField.disabled = value;
  phoneField.disabled = value;
  trackingButton.disabled = value;
  trackingButton.textContent = value ? "Đang tra cứu..." : "Tra cứu";
  trackingForm.setAttribute("aria-busy", String(value));
  for (const button of recentOrdersList.querySelectorAll("button")) button.disabled = value;
  forgetRecentOrdersButton.disabled = value || !canForgetRecentOrders;
}

const trackingPaymentLabels = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng"
};

async function lookupOrder() {
  if (activeLookup) return;

  orderIdField.value = orderIdField.value.trim();
  phoneField.value = phoneField.value.trim();
  clearLookupResult();
  if (!trackingForm.reportValidity()) return;

  const orderId = orderIdField.value;
  const customerPhone = phoneField.value;
  const body = JSON.stringify({ orderId, customerPhone });
  const controller = new AbortController();
  activeLookup = controller;
  setLookupBusy(true);
  trackingMessage.textContent = "Đang tra cứu đơn hàng...";

  try {
    const response = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body,
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(15000)
      ])
    });
    const result = await response.json().catch(() => null);
    if (activeLookup !== controller) return;

    if (
      [400, 404, 429].includes(response.status) &&
      typeof result?.error === "string"
    ) {
      trackingMessage.textContent = result.error;
      return;
    }

    const items = result?.items ?? [{
      productName: result?.productName, quantity: result?.quantity,
      unitPrice: result?.unitPrice, total: result?.total
    }];
    if (
      !response.ok ||
      !result ||
      typeof result.orderId !== "string" || result.orderId.trim() === "" ||
      !validOrderNumber(result.orderNumber) ||
      (result.orderId !== orderId && result.orderNumber !== orderId) ||
      ![result.productName, result.paymentMethod, result.status, result.createdAt]
        .every(value => typeof value === "string") ||
      !Number.isSafeInteger(result.total) || result.total < 0 ||
      !Array.isArray(items) || items.length === 0 ||
      !items.every(item => item && typeof item.productName === "string" &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0 &&
        Number.isSafeInteger(item.total) && item.total >= 0 &&
        item.total === item.quantity * item.unitPrice) ||
      result.total !== items.reduce((sum, item) => sum + item.total, 0)
    ) {
      throw new Error("Kết quả tra cứu chưa hợp lệ");
    }

    const status = Object.hasOwn(trackingStatusLabels, result.status)
      ? trackingStatusLabels[result.status]
      : result.status;

    renderHistory(result.history);
    orderIdField.value = orderCode(result);
    trackingMessage.textContent = [
      "Mã đơn " + orderCode(result),
      "Trạng thái " + status,
      ...items.map(item => item.productName + " × " + item.quantity +
        " tuýp · " + trackingMoney.format(item.unitPrice) + "/tuýp · " + trackingMoney.format(item.total)),
      "Tiền sản phẩm " + trackingMoney.format(result.total),
      Object.hasOwn(trackingPaymentLabels, result.paymentMethod)
        ? trackingPaymentLabels[result.paymentMethod] : "Thanh toán " + result.paymentMethod,
      "Thời gian tạo (UTC) " + result.createdAt
    ].join("\n");

    const canReorder = items.every(item => Number.isSafeInteger(item.productId) && item.productId > 0) &&
      new Set(items.map(item => item.productId)).size === items.length;
    lastLookup = {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      items: canReorder ? items.map(item => ({ productId: item.productId, quantity: item.quantity })) : null
    };
    trackingActions.hidden = false;
    reorderButton.disabled = !canReorder;
    if (!canReorder) {
      trackingActionsMessage.textContent = "Đơn này chưa có đủ mã sản phẩm để thêm lại vào giỏ. Bạn có thể chọn sản phẩm tại cửa hàng.";
    }
    if (window.ShopMemory) {
      const receipt = { orderId: result.orderId, total: result.total };
      if (typeof result.orderNumber === "string") receipt.orderNumber = result.orderNumber;
      const saved = window.ShopMemory.saveReceipt(receipt, customerPhone);
      renderRecentOrders();
      if (saved.error) recentOrdersMessage.textContent = saved.error;
    }
  } catch {
    if (activeLookup === controller) {
      clearLookupResult();
      trackingMessage.textContent =
        "Tra cứu gặp lỗi. Hãy kiểm tra kết nối và thử lại.";
    }
  } finally {
    if (activeLookup === controller) {
      activeLookup = null;
      setLookupBusy(false);
      trackingButton.focus();
    }
  }
}

trackingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void lookupOrder();
});

trackingForm.addEventListener("input", () => {
  if (!activeLookup) clearLookupResult();
});

copyTrackedOrderButton.addEventListener("click", () => {
  if (lastLookup && !activeLookup) void copyOrderId(orderCode(lastLookup), trackingActionsMessage);
});

reorderButton.addEventListener("click", () => {
  if (!lastLookup?.items || activeLookup || reorderButton.disabled) return;
  if (!window.ShopMemory) {
    trackingActionsMessage.textContent = "Chưa chuyển được sản phẩm sang giỏ. Hãy tải lại trang rồi thử lại.";
    return;
  }
  reorderButton.disabled = true;
  const result = window.ShopMemory.queueReorder(orderCode(lastLookup), lastLookup.items);
  if (result.error) {
    trackingActionsMessage.textContent = result.error;
    reorderButton.disabled = false;
    return;
  }
  window.location.assign("/gio-hang.html");
});

function initializeTracking() {
  let queryOrderId = "";
  try {
    queryOrderId = new URLSearchParams(window.location.search).get("orderId")?.trim() || "";
  } catch {
    queryOrderId = "";
  }
  orderIdField.value = queryOrderId;
  if (!window.ShopMemory) return;

  const { tracking, error } = window.ShopMemory.takeTracking();
  if (error) recentOrdersMessage.textContent = error;
  if (!tracking || (queryOrderId && queryOrderId !== tracking.orderId)) return;
  orderIdField.value = tracking.orderId;
  phoneField.value = tracking.customerPhone;
  if (tracking.customerPhone) void lookupOrder();
}

window.addEventListener("pagehide", () => {
  activeLookup?.abort();
  activeLookup = null;
  orderIdField.value = "";
  phoneField.value = "";
  clearLookupResult();
  setLookupBusy(false);
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) renderRecentOrders();
});

window.addEventListener("storage", () => renderRecentOrders());

setLookupBusy(false);
renderRecentOrders();
initializeTracking();
