const trackingForm = document.getElementById("tracking-form");
const orderIdField = document.getElementById("tracking-order-id");
const phoneField = document.getElementById("tracking-phone");
const trackingButton = document.getElementById("tracking-button");
const trackingMessage = document.getElementById("tracking-message");
const historyPanel = document.getElementById("tracking-history-panel");
const historyList = document.getElementById("tracking-history");
const historyEmpty = document.getElementById("tracking-history-empty");
const detailPanel = document.getElementById("tracking-detail-panel");
const progressList = document.getElementById("tracking-progress");
const cancelledNote = document.getElementById("tracking-cancelled");

const trackingStatusLabels = {
  NEW: "Mới nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};
const trackingStatusDescriptions = {
  NEW: "Cửa hàng đã nhận đơn hàng. Đơn đang chờ kiểm tra và xác nhận.",
  CONFIRMED: "Cửa hàng đã xác nhận đơn hàng và đang chuẩn bị sản phẩm để giao.",
  SHIPPING: "Đơn hàng đã được cập nhật sang trạng thái đang giao. Hãy giữ liên lạc qua số điện thoại nhận hàng.",
  COMPLETED: "Cửa hàng đã cập nhật đơn hàng hoàn thành. Nếu cần hỗ trợ về sản phẩm, hãy liên hệ CSKH cùng mã đơn.",
  CANCELLED: "Đơn hàng đã được hủy và không tiếp tục theo tiến trình giao hàng. Liên hệ CSKH nếu cần kiểm tra thêm."
};
const trackingPaymentLabels = { COD: "Thanh toán khi nhận hàng (COD)", BANK_TRANSFER: "Chuyển khoản ngân hàng" };
const trackingDateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh"
});
const trackingMoney = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

let activeLookup = null;

function validOrderNumber(value) {
  return value === undefined || value === null || (typeof value === "string" &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
}

function orderCode(order) {
  return order.orderNumber ?? order.orderId;
}

function trackingDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z" : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function statusDescription(status) {
  return trackingStatusDescriptions[status] || "Trạng thái được cửa hàng ghi nhận cho đơn hàng này.";
}

function renderTime(value, missing = "Chưa ghi nhận thời gian") {
  const date = trackingDate(value);
  const when = document.createElement(date ? "time" : "span");
  if (date) when.dateTime = date.toISOString();
  when.textContent = date ? trackingDateFormat.format(date) : missing;
  return when;
}

function clearLookupResult() {
  trackingMessage.textContent = "";
  historyPanel.hidden = true;
  historyList.replaceChildren();
  historyEmpty.hidden = true;
  detailPanel.hidden = true;
  detailPanel.removeAttribute("data-status");
  for (const id of ["tracking-result-code", "tracking-current-status", "tracking-status-description",
    "tracking-created-at", "tracking-updated-at", "tracking-payment", "tracking-order-total"]) {
    document.getElementById(id).replaceChildren();
  }
  progressList.replaceChildren();
  cancelledNote.hidden = true;
}

function renderHistory(history = []) {
  if (!Array.isArray(history) || !history.every(event => event &&
    typeof event.status === "string" && event.status.trim() !== "" &&
    (event.changedAt === null || trackingDate(event.changedAt) !== null))) {
    throw new Error("Lịch sử đơn hàng chưa hợp lệ");
  }
  const fragment = document.createDocumentFragment();
  for (const event of history) {
    const item = document.createElement("li");
    item.dataset.status = event.status;
    const label = document.createElement("strong");
    label.textContent = Object.hasOwn(trackingStatusLabels, event.status)
      ? trackingStatusLabels[event.status] : event.status;
    const description = document.createElement("p");
    description.textContent = statusDescription(event.status);
    item.append(label, description, renderTime(event.changedAt, "Mốc có trước khi bật lịch sử; chưa ghi nhận thời gian."));
    fragment.append(item);
  }
  historyList.replaceChildren(fragment);
  historyEmpty.hidden = history.length !== 0;
  historyPanel.hidden = false;
}

function renderTrackingDetails(order) {
  const history = order.history || [];
  detailPanel.dataset.status = order.status;
  document.getElementById("tracking-result-code").textContent = "#" + orderCode(order);
  document.getElementById("tracking-current-status").textContent = trackingStatusLabels[order.status] || order.status;
  document.getElementById("tracking-status-description").textContent = statusDescription(order.status);
  document.getElementById("tracking-created-at").replaceChildren(renderTime(order.createdAt));
  const latest = history.map(event => trackingDate(event.changedAt)).filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  document.getElementById("tracking-updated-at").replaceChildren(renderTime(latest?.toISOString(), "Chưa ghi nhận cập nhật"));
  document.getElementById("tracking-payment").textContent = trackingPaymentLabels[order.paymentMethod] || order.paymentMethod;
  document.getElementById("tracking-order-total").textContent = trackingMoney.format(order.total);
  cancelledNote.hidden = order.status !== "CANCELLED";
  progressList.hidden = order.status === "CANCELLED";
  const recorded = new Map();
  for (const event of history) {
    const date = trackingDate(event.changedAt);
    if (!recorded.has(event.status) || date && (!recorded.get(event.status) || date > recorded.get(event.status))) recorded.set(event.status, date);
  }
  const stages = ["NEW", "CONFIRMED", "SHIPPING", "COMPLETED"];
  const fragment = document.createDocumentFragment();
  for (const [index, status] of stages.entries()) {
    const item = document.createElement("li");
    item.dataset.status = status;
    const isRecorded = recorded.has(status);
    const current = order.status === status;
    if (isRecorded) item.classList.add("is-recorded");
    if (current) item.setAttribute("aria-current", "step");
    if (index > 0 && isRecorded && recorded.has(stages[index - 1])) item.classList.add("is-connected");
    const marker = document.createElement("span");
    marker.className = "tracking-stage-marker";
    marker.setAttribute("aria-hidden", "true");
    if (isRecorded) {
      const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      check.setAttribute("viewBox", "0 0 24 24");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "m6 12 4 4 8-8");
      check.append(path);
      marker.append(check);
    }
    const label = document.createElement("strong");
    label.textContent = trackingStatusLabels[status];
    const state = document.createElement("span");
    state.className = "tracking-stage-state";
    state.textContent = current ? "Hiện tại" : isRecorded ? "Đã ghi nhận" : "Chưa ghi nhận";
    item.append(marker, label, state);
    if (isRecorded) item.append(renderTime(recorded.get(status)?.toISOString(), "Chưa có thời gian"));
    fragment.append(item);
  }
  progressList.replaceChildren(fragment);
  detailPanel.hidden = false;
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
      !trackingDate(result.createdAt) ||
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
    renderTrackingDetails(result);
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
