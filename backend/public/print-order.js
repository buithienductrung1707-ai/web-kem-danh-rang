const printMain = document.getElementById("print-main");
const printButton = document.getElementById("print-order-button");
const reloadButton = document.getElementById("reload-print-order");
const printMessage = document.getElementById("print-message");
const orderContent = document.getElementById("print-order-content");
const orderItems = document.getElementById("print-order-items");
const orderIdLabel = document.getElementById("print-order-id");
const createdLabel = document.getElementById("print-order-created");
const statusLabel = document.getElementById("print-order-status");
const customerNameLabel = document.getElementById("print-customer-name");
const customerPhoneLabel = document.getElementById("print-customer-phone");
const customerAddressLabel = document.getElementById("print-customer-address");
const totalLabel = document.getElementById("print-order-total");
const paymentLabel = document.getElementById("print-order-payment");
const privateLabels = [orderIdLabel, createdLabel, statusLabel, customerNameLabel,
  customerPhoneLabel, customerAddressLabel, totalLabel, paymentLabel];
const orderId = new URLSearchParams(window.location.search).get("orderId")?.trim() ?? "";
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const vietnamTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh"
});
const statusLabels = {
  NEW: "Mới nhận", CONFIRMED: "Đã xác nhận", SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy"
};
const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng"
};
let activeRequest = null;
let ready = false;

function validOrderNumber(value) {
  return value === undefined || value === null || (typeof value === "string" &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
}

function clearOrder() {
  ready = false;
  printButton.disabled = true;
  orderContent.hidden = true;
  orderItems.replaceChildren();
  for (const label of privateLabels) label.textContent = "";
}

function renderOrder(order) {
  const textFields = ["id", "customer_name", "customer_phone", "customer_address",
    "created_at", "status", "payment_method"];
  const items = order?.items ?? [{
    productName: order?.product_name, quantity: order?.quantity,
    unitPrice: order?.unit_price, total: order?.total
  }];
  if (!order || !validOrderNumber(order.orderNumber) ||
    (order.id !== orderId && order.orderNumber !== orderId) ||
    !textFields.every(field => typeof order[field] === "string") ||
    !Number.isSafeInteger(order.total) || order.total < 0 ||
    !Array.isArray(items) || items.length === 0 ||
    !items.every(item => item && typeof item.productName === "string" &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
      Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0 &&
      Number.isSafeInteger(item.total) && item.total >= 0 &&
      item.total === item.quantity * item.unitPrice) ||
    order.total !== items.reduce((sum, item) => sum + item.total, 0)) {
    throw new Error("Thông tin phiếu đơn hàng chưa hợp lệ");
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const row = document.createElement("tr");
    for (const value of [item.productName, item.quantity + " tuýp",
      money.format(item.unitPrice), money.format(item.total)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  const createdAt = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(order.created_at)
    ? order.created_at.replace(" ", "T") + "Z" : order.created_at);
  orderIdLabel.textContent = order.orderNumber ?? order.id;
  createdLabel.textContent = Number.isNaN(createdAt.getTime())
    ? order.created_at + " UTC" : vietnamTime.format(createdAt) + " (giờ Việt Nam)";
  statusLabel.textContent = Object.hasOwn(statusLabels, order.status) ? statusLabels[order.status] : order.status;
  customerNameLabel.textContent = order.customer_name;
  customerPhoneLabel.textContent = order.customer_phone;
  customerAddressLabel.textContent = order.customer_address;
  totalLabel.textContent = money.format(order.total);
  paymentLabel.textContent = Object.hasOwn(paymentMethodLabels, order.payment_method)
    ? paymentMethodLabels[order.payment_method] + "." : "Thanh toán " + order.payment_method;
  orderItems.replaceChildren(fragment);
  orderContent.hidden = false;
  ready = true;
}

async function loadOrder() {
  if (activeRequest) return;
  clearOrder();
  if (orderId === "") {
    printMessage.textContent = "Thiếu mã đơn hàng. Hãy mở phiếu từ danh sách đơn trong trang quản trị.";
    printMain.setAttribute("aria-busy", "false");
    reloadButton.disabled = true;
    return;
  }
  const controller = new AbortController();
  activeRequest = controller;
  reloadButton.disabled = true;
  printMain.setAttribute("aria-busy", "true");
  printMessage.textContent = "Đang tải phiếu đơn hàng...";
  try {
    const response = await fetch("/api/admin/orders/" + encodeURIComponent(orderId), {
      credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    const result = await response.json().catch(() => null);
    if (activeRequest !== controller) return;
    if (response.status === 401) {
      printMessage.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập tại trang quản trị rồi tải lại phiếu.";
      return;
    }
    if ([400, 403, 404].includes(response.status) && typeof result?.error === "string") {
      printMessage.textContent = result.error;
      return;
    }
    if (!response.ok) throw new Error("Tải phiếu gặp lỗi");
    renderOrder(result);
    printMessage.textContent = "Đã tải phiếu. Bấm In phiếu / Lưu PDF để mở hộp thoại in.";
  } catch {
    if (activeRequest === controller) {
      clearOrder();
      printMessage.textContent = "Tải phiếu gặp lỗi. Kiểm tra kết nối rồi bấm Tải lại phiếu.";
    }
  } finally {
    if (activeRequest === controller) {
      activeRequest = null;
      printMain.setAttribute("aria-busy", "false");
      printButton.disabled = !ready;
      reloadButton.disabled = false;
      if (ready) printButton.focus();
    }
  }
}

printButton.addEventListener("click", () => {
  if (ready && !activeRequest) window.print();
});
reloadButton.addEventListener("click", loadOrder);
window.addEventListener("pagehide", () => {
  activeRequest?.abort();
  activeRequest = null;
  clearOrder();
  printMessage.textContent = "";
  printMain.setAttribute("aria-busy", "false");
  reloadButton.disabled = true;
});
window.addEventListener("pageshow", event => {
  if (event.persisted) loadOrder();
});

loadOrder();
