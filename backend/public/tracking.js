const trackingForm = document.getElementById("tracking-form");
const orderIdField = document.getElementById("tracking-order-id");
const phoneField = document.getElementById("tracking-phone");
const trackingButton = document.getElementById("tracking-button");
const trackingMessage = document.getElementById("tracking-message");
const historyPanel = document.getElementById("tracking-history-panel");
const historyList = document.getElementById("tracking-history");
const historyEmpty = document.getElementById("tracking-history-empty");

const trackingStatusLabels = {
  NEW: "Mới nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};

let activeLookup = null;

function validOrderNumber(value) {
  return value === undefined || value === null || (typeof value === "string" &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
}

function orderCode(order) {
  return order.orderNumber ?? order.orderId;
}

function clearLookupResult() {
  trackingMessage.textContent = "";
  historyPanel.hidden = true;
  historyList.replaceChildren();
  historyEmpty.hidden = true;
}

function renderHistory(history = []) {
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
  historyEmpty.hidden = history.length !== 0;
  historyPanel.hidden = false;
}

function setLookupBusy(value) {
  orderIdField.disabled = value;
  phoneField.disabled = value;
  trackingButton.disabled = value;
  trackingButton.textContent = value ? "Đang tra cứu..." : "Tra cứu";
  trackingForm.setAttribute("aria-busy", String(value));
}

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

    renderHistory(result.history);
    orderIdField.value = orderCode(result);
    trackingMessage.textContent = "";
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

trackingForm.addEventListener("submit", event => {
  event.preventDefault();
  void lookupOrder();
});

trackingForm.addEventListener("input", () => {
  if (!activeLookup) clearLookupResult();
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
  if (error) trackingMessage.textContent = error;
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

setLookupBusy(false);
initializeTracking();
