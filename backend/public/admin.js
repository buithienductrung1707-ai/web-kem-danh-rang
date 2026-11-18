const loginPanel = document.getElementById("login-panel");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("admin-login-form");
const usernameField = document.getElementById("admin-username");
const passwordField = document.getElementById("admin-password");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const adminName = document.getElementById("admin-name");
const messageLabel = document.getElementById("admin-message");
const retryButton = document.getElementById("retry-session");

const refreshOrdersButton = document.getElementById("refresh-orders");
const ordersMessage = document.getElementById("orders-message");
const ordersList = document.getElementById("orders-list");
const orderStatusFilter = document.getElementById("order-status-filter");
const orderSearchForm = document.getElementById("order-search-form");
const orderPhoneField = document.getElementById("order-phone");
const orderFromDateField = document.getElementById("order-from-date");
const orderToDateField = document.getElementById("order-to-date");
const searchOrdersButton = document.getElementById("search-orders");
const exportOrdersButton = document.getElementById("export-orders");
const ordersExportMessage = document.getElementById("orders-export-message");
const previousOrdersButton = document.getElementById("previous-orders");
const nextOrdersButton = document.getElementById("next-orders");
const ordersPageLabel = document.getElementById("orders-page");
const refreshSummaryButton = document.getElementById("refresh-summary");
const summaryMessage = document.getElementById("summary-message");
const summaryStats = document.getElementById("orders-summary");

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND"
});
const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng"
};

const productForm = document.getElementById("product-form");
const productNameField = document.getElementById("edit-product-name");
const productPriceField = document.getElementById("edit-product-price");
const productCategoryField = document.getElementById("edit-product-category");
const productDescriptionField = document.getElementById("edit-product-description");
const productImageField = document.getElementById("edit-product-image");
const productImageFileField = document.getElementById("product-image-file");
const uploadProductImageButton = document.getElementById("upload-product-image");
const clearProductImageButton = document.getElementById("clear-product-image");
const productImageMessage = document.getElementById("product-image-message");
const productImagePreview = document.getElementById("product-image-preview");
const productActiveField = document.getElementById("edit-product-active");
const productStockTrackedField = document.getElementById("edit-product-stock-tracked");
const productStockQuantityField = document.getElementById("edit-product-stock-quantity");
const productPicker = document.getElementById("product-picker");
const newProductButton = document.getElementById("new-product");
const productFields = [productNameField, productPriceField,
  productCategoryField, productDescriptionField, productImageField, productActiveField,
  productStockTrackedField, productStockQuantityField];
const saveProductButton = document.getElementById("save-product");
const reloadProductButton = document.getElementById("reload-product");
const productEditorMessage = document.getElementById("product-editor-message");
const bannerPicker = document.getElementById("banner-picker");
const bannerForm = document.getElementById("banner-form");
const bannerFields = {
  title: document.getElementById("edit-banner-title"),
  description: document.getElementById("edit-banner-description"),
  imageUrl: document.getElementById("edit-banner-image"),
  imageAlt: document.getElementById("edit-banner-image-alt"),
  buttonLabel: document.getElementById("edit-banner-button-label"),
  buttonUrl: document.getElementById("edit-banner-button-url"),
  sortOrder: document.getElementById("edit-banner-sort-order"),
  enabled: document.getElementById("edit-banner-enabled")
};
const bannerImageFileField = document.getElementById("banner-image-file");
const uploadBannerImageButton = document.getElementById("upload-banner-image");
const bannerImagePreview = document.getElementById("banner-image-preview");
const bannerImageMessage = document.getElementById("banner-image-message");
const bannerEditorMessage = document.getElementById("banner-editor-message");
const saveBannerButton = document.getElementById("save-banner");
const reloadBannerButton = document.getElementById("reload-banner");
const newBannerButton = document.getElementById("new-banner");
const deleteBannerButton = document.getElementById("delete-banner");
const cancelBannerButton = document.getElementById("cancel-banner");
const bannerGroupTabs = [...document.querySelectorAll(".banner-group-tabs [role='tab']")];
const bannerGroupPanel = document.getElementById("banner-group-panel");
const bannerGroupDescription = document.getElementById("banner-group-description");
const bannerPlacementField = document.getElementById("banner-placement-field");
const bannerPlacement = document.getElementById("edit-banner-placement");
const bannerEmpty = document.getElementById("banner-empty");

let productSnapshot = null;
let managedProducts = [];
let productMode = "loading";
let productCreationKey = null;
let bannerSnapshot = null;
let managedBanners = [];
let bannerMode = "loading";
let bannerGroup = "hero";
let bannerCreationKey = null;
let bannerRequestController = null;
let activeOrderPhone = "";
let activeOrderFromDate = "";
let activeOrderToDate = "";
let orderPageCursors = [""];
let orderPageIndex = 0;
let nextOrderCursor = null;
let busy = false;
let sessionCheckQueued = false;
let productImageUploadController = null;
let ordersExportController = null;
let ordersDownloadUrl = null;
let ordersDownloadTimer = null;
let pageActive = true;
const categoryEditor = window.ShopAdminCategories;

function setBusy(value) {
  busy = value;

  usernameField.disabled = value;
  passwordField.disabled = value;
  loginButton.disabled = value;
  logoutButton.disabled = value;
  retryButton.disabled = value;
  refreshOrdersButton.disabled = value;
  refreshSummaryButton.disabled = value;
  orderStatusFilter.disabled = value;
  orderPhoneField.disabled = value;
  orderFromDateField.disabled = value;
  orderToDateField.disabled = value;
  searchOrdersButton.disabled = value;
  exportOrdersButton.disabled = value;
  orderSearchForm.setAttribute("aria-busy", String(value));
  updateOrderPagination();

  const productReady = ["edit", "new"].includes(productMode) && categoryEditor.ready;
  for (const field of productFields) field.disabled = value || !productReady;
  productStockQuantityField.disabled = value || !productReady || !productStockTrackedField.checked;
  productPicker.disabled = value || !productReady;
  newProductButton.disabled = value || !productReady;
  saveProductButton.disabled = value || !productReady;
  reloadProductButton.disabled = value;
  productImageFileField.disabled = value || !productReady;
  uploadProductImageButton.disabled = value || !productReady ||
    productImageFileField.files.length !== 1;
  clearProductImageButton.disabled = value || !productReady ||
    productImageField.value.trim() === "";

  const bannerEditable = ["edit", "new", "unknown"].includes(bannerMode);
  for (const field of Object.values(bannerFields)) field.disabled = value || !bannerEditable;
  const bannerReady = ["edit", "new", "empty"].includes(bannerMode);
  bannerPlacement.disabled = value || !bannerEditable;
  bannerPicker.disabled = value || !bannerReady || groupedBanners().length === 0;
  saveBannerButton.disabled = value || !["edit", "new"].includes(bannerMode);
  newBannerButton.disabled = value || !bannerReady;
  deleteBannerButton.disabled = value || bannerMode !== "edit";
  cancelBannerButton.hidden = bannerMode !== "new";
  cancelBannerButton.disabled = value;
  for (const tab of bannerGroupTabs) tab.disabled = value || !bannerReady;
  reloadBannerButton.disabled = value;
  bannerImageFileField.disabled = value || !["edit", "new"].includes(bannerMode);
  uploadBannerImageButton.disabled = value || !["edit", "new"].includes(bannerMode) || bannerImageFileField.files.length !== 1;
  bannerForm.setAttribute("aria-busy", String(value));

  for (const control of ordersList.querySelectorAll("button, select")) {
    control.disabled = value;
  }

  productForm.setAttribute("aria-busy", String(value));
  ordersList.setAttribute("aria-busy", String(value));
  loginForm.setAttribute("aria-busy", String(value));
  categoryEditor.setBusy(value);
}

function finishRequest(focusTarget = logoutButton) {
  setBusy(false);
  if (!pageActive) return;

  if (sessionCheckQueued) {
    sessionCheckQueued = false;
    checkSession();
    return;
  }

  if (!retryButton.hidden) {
    retryButton.focus();
  } else if (!loginPanel.hidden) {
    passwordField.focus();
  } else {
    focusTarget.focus();
  }
}

function showAuth(admin) {
  categoryEditor.clear();
  clearOrdersExport();
  clearOrdersSummary();
  clearOrderSearch();
  clearBannerEditor();
    clearProductEditor();
    clearOrders();
  if (
    admin !== null &&
    (
      !Number.isSafeInteger(admin.id) ||
      admin.id < 1 ||
      typeof admin.username !== "string" ||
      admin.username.length === 0
    )
  ) {
    throw new Error("Thông tin tài khoản chưa hợp lệ");
  }

  const signedIn = admin !== null;
  loginPanel.hidden = signedIn;
  adminPanel.hidden = !signedIn;
  adminName.textContent = signedIn ? admin.username : "";
  passwordField.value = "";
  retryButton.hidden = true;
}

function showUnknown(message) {
  categoryEditor.clear();
  clearOrdersExport();
  clearOrdersSummary();
  clearOrderSearch();
  clearBannerEditor();
    clearProductEditor();
    clearOrders();
  loginPanel.hidden = true;
  adminPanel.hidden = true;
  adminName.textContent = "";
  passwordField.value = "";
  retryButton.hidden = false;
  messageLabel.textContent = message;
}

async function callAdmin(path, options = {}) {
  const response = await fetch("/api/admin" + path, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...options
  });

  const result = await response.json().catch(() => null);
  return { response, result };
}

async function checkSession() {
  if (busy || !pageActive) return;

  setBusy(true);
  showUnknown("Đang kiểm tra phiên đăng nhập...");
  retryButton.hidden = true;

  try {
    const { response, result } = await callAdmin("/me");
    if (sessionCheckQueued || !pageActive) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent = "Hãy đăng nhập để quản trị cửa hàng.";
      return;
    }

    if (!response.ok || result === null) {
      throw new Error("Kiểm tra phiên gặp lỗi");
    }

    showAuth(result);
    messageLabel.textContent = "Phiên đăng nhập đang hoạt động.";
    await loadOrders();

    if (!adminPanel.hidden && !sessionCheckQueued) {
    await loadProductEditor();
    }
    if (!adminPanel.hidden && !sessionCheckQueued) {
      await loadOrdersSummary();
    }
    if (!adminPanel.hidden && !sessionCheckQueued && pageActive) {
      await loadBannerEditor();
    }
  } catch {
    if (sessionCheckQueued || !pageActive) return;
    showUnknown(
      "Kiểm tra phiên gặp lỗi. Kiểm tra máy chủ rồi bấm Kiểm tra lại phiên."
    );
  } finally {
    finishRequest();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  usernameField.value = usernameField.value.trim();
  if (!loginForm.reportValidity()) return;

  const body = JSON.stringify({
    username: usernameField.value,
    password: passwordField.value
  });

  setBusy(true);
  messageLabel.textContent = "Đang đăng nhập...";

  try {
    const { response, result } = await callAdmin("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (sessionCheckQueued || !pageActive) return;

    if (
      [400, 401, 403, 429].includes(response.status) &&
      typeof result?.error === "string"
    ) {
      messageLabel.textContent = result.error;
      return;
    }

    if (!response.ok || result === null) {
      throw new Error("Đăng nhập gặp lỗi");
    }

    showAuth(result);
    messageLabel.textContent = "Đăng nhập thành công.";
    await loadOrders();

    if (!adminPanel.hidden && !sessionCheckQueued) {
    await loadProductEditor();
    }
    if (!adminPanel.hidden && !sessionCheckQueued) {
      await loadOrdersSummary();
    }
    if (!adminPanel.hidden && !sessionCheckQueued && pageActive) {
      await loadBannerEditor();
    }
  } catch {
    if (sessionCheckQueued || !pageActive) return;
    showUnknown(
      "Chưa xác nhận được kết quả đăng nhập. Bấm Kiểm tra lại phiên."
    );
  } finally {
    finishRequest();
  }
});

logoutButton.addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);
  clearOrdersSummary();
  clearOrderSearch();
  clearBannerEditor();
  clearProductEditor();
  categoryEditor.clear();
  clearOrders();
  messageLabel.textContent = "Đang đăng xuất...";

  try {
    const { response, result } = await callAdmin("/logout", {
      method: "POST"
    });

    if (!response.ok || typeof result.message !== "string") {
      throw new Error("Đăng xuất gặp lỗi");
    }

    showAuth(null);
    loginForm.reset();
    messageLabel.textContent = result.message;
  } catch {
    showUnknown(
      "Chưa xác nhận được kết quả đăng xuất. Bấm Kiểm tra lại phiên."
    );
  } finally {
    finishRequest();
  }
});

function clearOrders() {
  ordersList.replaceChildren();
  ordersMessage.textContent = "";
  nextOrderCursor = null;
  updateOrderPagination();
}

function updateOrderPagination() {
  previousOrdersButton.disabled = busy || orderPageIndex === 0;
  nextOrdersButton.disabled = busy || nextOrderCursor === null;
  ordersPageLabel.textContent = "Trang " + (orderPageIndex + 1);
}

function resetOrderPagination() {
  orderPageCursors = [""];
  orderPageIndex = 0;
  nextOrderCursor = null;
  updateOrderPagination();
}

const statusLabels = {
  NEW: "Mới nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};

function getStatusLabel(status) {
  return Object.hasOwn(statusLabels, status)
    ? statusLabels[status]
    : status;
}

function clearOrdersSummary() {
  summaryStats.replaceChildren();
  summaryStats.setAttribute("aria-busy", "false");
  summaryMessage.textContent = "";
}

function renderOrdersSummary(summary) {
  const fields = [
    ["newCount", statusLabels.NEW],
    ["confirmedCount", statusLabels.CONFIRMED],
    ["shippingCount", statusLabels.SHIPPING],
    ["completedCount", statusLabels.COMPLETED],
    ["cancelledCount", statusLabels.CANCELLED],
    ["otherCount", "Trạng thái khác"]
  ];
  const counts = fields.map(([field]) => summary?.[field]);

  if (
    !summary ||
    ![summary.total, ...counts].every(count =>
      Number.isSafeInteger(count) && count >= 0
    ) ||
    summary.total !== counts.reduce((total, count) => total + count, 0)
  ) {
    throw new Error("Thống kê đơn hàng chưa hợp lệ");
  }

  const fragment = document.createDocumentFragment();

  for (const [field, label] of [["total", "Tổng số đơn"], ...fields]) {
    if (field === "otherCount" && summary[field] === 0) continue;

    const item = document.createElement("div");
    const title = document.createElement("dt");
    const count = document.createElement("dd");
    title.textContent = label;
    count.textContent = summary[field].toLocaleString("vi-VN");
    item.append(title, count);
    fragment.append(item);
  }

  summaryStats.replaceChildren(fragment);
}

async function loadOrdersSummary() {
  clearOrdersSummary();
  if (sessionCheckQueued || adminPanel.hidden || !pageActive) return;

  summaryMessage.textContent = "Đang tải thống kê...";
  summaryStats.setAttribute("aria-busy", "true");

  try {
    const { response, result } = await callAdmin("/orders/summary");
    if (sessionCheckQueued || adminPanel.hidden || !pageActive) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (!response.ok) throw new Error("Tải thống kê gặp lỗi");

    renderOrdersSummary(result);
    summaryMessage.textContent = "Đã cập nhật thống kê.";
  } catch {
    if (sessionCheckQueued || adminPanel.hidden || !pageActive) return;
    clearOrdersSummary();
    summaryMessage.textContent =
      "Tải thống kê gặp lỗi. Bấm Tải lại thống kê để thử lại.";
  } finally {
    summaryStats.setAttribute("aria-busy", "false");
  }
}

refreshSummaryButton.addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);

  try {
    await loadOrdersSummary();
  } finally {
    finishRequest(refreshSummaryButton);
  }
});

function renderOrders(orders) {
  const fragment = document.createDocumentFragment();
  const textFields = [
    "id", "customer_name", "customer_phone", "customer_address",
    "product_name", "payment_method", "status", "created_at"
  ];

  for (const order of orders) {
    const items = order?.items ?? [{
      productName: order?.product_name, quantity: order?.quantity,
      unitPrice: order?.unit_price, total: order?.total
    }];
    if (
      !order ||
      !textFields.every(field => typeof order[field] === "string") ||
      (order.orderNumber != null &&
        (typeof order.orderNumber !== "string" ||
          !Number.isSafeInteger(Number(order.orderNumber)) ||
          Number(order.orderNumber) < 100001 ||
          String(Number(order.orderNumber)) !== order.orderNumber)) ||
      !Number.isSafeInteger(order.total) || order.total < 0 ||
      !Array.isArray(items) || items.length === 0 ||
      !items.every(item => item && typeof item.productName === "string" &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0 &&
        Number.isSafeInteger(item.total) && item.total >= 0 &&
        item.total === item.quantity * item.unitPrice) ||
      order.total !== items.reduce((sum, item) => sum + item.total, 0)
    ) {
      throw new Error("Thông tin đơn hàng chưa hợp lệ");
    }

    const orderLabel = order.orderNumber ?? order.id;
    const card = document.createElement("article");
    card.className = "order-card";

    const title = document.createElement("h3");
    title.textContent = "Đơn " + orderLabel;

    const details = document.createElement("p");
    details.className = "order-preview";
    details.textContent = [
      "Người nhận " + order.customer_name,
      "Điện thoại " + order.customer_phone,
      "Địa chỉ " + order.customer_address,
      ...items.map(item => item.productName + " × " + item.quantity +
        " sản phẩm · " + money.format(item.unitPrice) + "/sản phẩm · " + money.format(item.total)),
      "Tiền sản phẩm " + money.format(order.total),
      Object.hasOwn(paymentMethodLabels, order.payment_method)
        ? paymentMethodLabels[order.payment_method] : "Thanh toán " + order.payment_method,
      "Thời gian tạo (UTC) " + order.created_at
    ].join("\n");

    const printLink = document.createElement("a");
    printLink.className = "navigation-link";
    printLink.href = "/in-don.html?orderId=" + encodeURIComponent(orderLabel);
    printLink.target = "_blank";
    printLink.rel = "noopener";
    printLink.textContent = "Mở phiếu in đơn " + orderLabel;
    const cardHeading = document.createElement("div");
    cardHeading.className = "order-card-heading";
    const status = document.createElement("span");
    status.className = "order-status";
    status.setAttribute("data-status", order.status);
    status.textContent = "Trạng thái " + getStatusLabel(order.status);
    cardHeading.append(title, status);
    card.append(cardHeading, details, printLink);
    if (order.history !== undefined) {
      if (!Array.isArray(order.history) || !order.history.every(entry => entry &&
        typeof entry.status === "string" &&
        (entry.changedAt === null || typeof entry.changedAt === "string"))) {
        throw new Error("Lịch sử đơn hàng chưa hợp lệ");
      }
      if (order.history.length > 0) {
        const history = document.createElement("details");
        history.className = "order-history-panel";
        const summary = document.createElement("summary");
        summary.textContent = "Lịch sử trạng thái";
        const entries = document.createElement("ol");
        entries.className = "order-history";
        for (const entry of order.history) {
          const item = document.createElement("li");
          const status = document.createElement("strong");
          status.textContent = getStatusLabel(entry.status);
          const timestamp = document.createElement("span");
          timestamp.textContent = entry.changedAt === null
            ? "Trạng thái đã có trước khi lưu lịch sử"
            : "Thời gian (UTC) " + entry.changedAt;
          item.append(status, timestamp);
          entries.append(item);
        }
        history.append(summary, entries);
        card.append(history);
      }
    }

    const nextStatuses = Array.isArray(order.nextStatuses)
    ? order.nextStatuses.filter(status =>
        typeof status === "string" &&
        Object.hasOwn(statusLabels, status)
        )
    : [];

    if (nextStatuses.length > 0) {
    const form = document.createElement("form");
    form.className = "order-actions";

    const label = document.createElement("label");
    label.textContent = "Trạng thái mới";
    label.htmlFor = "order-status-" + order.id;

    const select = document.createElement("select");
    select.id = label.htmlFor;
    select.required = true;
    select.disabled = busy;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Chọn trạng thái mới";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);

    for (const status of nextStatuses) {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = getStatusLabel(status);
        select.append(option);
    }

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.textContent = "Lưu trạng thái";
    saveButton.disabled = busy;

    form.append(label, select, saveButton);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        return updateOrderStatus(order, select.value);
    });

    card.append(form);
    }

    const deleteActions = document.createElement("div");
    deleteActions.className = "order-delete-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button-danger";
    deleteButton.textContent = "Xóa đơn hàng";
    deleteButton.setAttribute("aria-label", "Xóa đơn hàng " + orderLabel);
    deleteButton.disabled = busy;
    deleteButton.addEventListener("click", () => deleteOrder(order));
    deleteActions.append(deleteButton);
    card.append(deleteActions);
    fragment.append(card);
  }

  ordersList.replaceChildren(fragment);
}

async function deleteOrder(order) {
  if (busy || !pageActive) return;

  const orderLabel = order.orderNumber ?? order.id;
  const returnsStock = ["NEW", "CONFIRMED"].includes(order.status);
  const confirmation = [
    "Xóa vĩnh viễn đơn " + orderLabel + "?",
    "Người nhận " + order.customer_name,
    "Trạng thái " + getStatusLabel(order.status),
    "",
    "Đơn hàng, chi tiết và lịch sử trạng thái sẽ được xóa vĩnh viễn.",
    ...(returnsStock ? ["Số lượng hàng đã giữ cho đơn sẽ được hoàn vào kho."] : [])
  ].join("\n");
  if (!window.confirm(confirmation)) return;

  setBusy(true);
  messageLabel.textContent = "Đang xóa đơn " + orderLabel + "...";

  try {
    const { response, result } = await callAdmin(
      "/orders/" + encodeURIComponent(order.id),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedStatus: order.status })
      }
    );

    if (sessionCheckQueued || !pageActive) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (response.status === 404) {
      messageLabel.textContent = "Đơn " + orderLabel + " đã được xóa hoặc không còn tồn tại.";
    } else if (response.status === 409) {
      messageLabel.textContent = (typeof result?.error === "string"
        ? result.error
        : "Trạng thái đơn đã thay đổi.") +
        " Hãy xem lại danh sách trước khi xóa đơn.";
      return;
    } else if (!response.ok) {
      messageLabel.textContent = (typeof result?.error === "string"
        ? result.error
        : "Xóa đơn gặp lỗi.") +
        " Hãy đối chiếu danh sách trước khi thử lại.";
      return;
    } else {
      if (response.status !== 200 || result?.id !== order.id || result.deleted !== true) {
        throw new Error("Kết quả xóa đơn chưa hợp lệ");
      }
      messageLabel.textContent = "Đã xóa vĩnh viễn đơn " + orderLabel + ".";
    }

    if (returnsStock) {
      productEditorMessage.textContent =
        "Kho có thể vừa thay đổi sau khi xóa đơn. Bấm Tải lại sản phẩm để xem số lượng mới trước khi lưu.";
    }
  } catch {
    if (!sessionCheckQueued && pageActive) {
      messageLabel.textContent =
        "Chưa xác nhận được kết quả xóa đơn. Hãy đối chiếu danh sách trước khi thử lại.";
    }
  } finally {
    if (!adminPanel.hidden && !sessionCheckQueued && pageActive) {
      await loadOrders();
    }
    if (!adminPanel.hidden && !sessionCheckQueued && pageActive) {
      await loadOrdersSummary();
    }
    if (pageActive) {
      finishRequest(refreshOrdersButton);
    } else {
      setBusy(false);
    }
  }
}

async function updateOrderStatus(order, targetStatus) {
  if (busy) return;

  const orderLabel = order.orderNumber ?? order.id;
  setBusy(true);
  messageLabel.textContent = "Đang cập nhật trạng thái đơn " + orderLabel + "...";

  try {
    const { response, result } = await callAdmin(
      "/orders/" + encodeURIComponent(order.id) + "/status",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedStatus: order.status,
          targetStatus
        })
      }
    );

    if (sessionCheckQueued) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (!response.ok) {
      messageLabel.textContent = typeof result.error === "string"
        ? result.error
        : "Cập nhật trạng thái gặp lỗi.";
      return;
    }

    if (
      !result ||
      result.id !== order.id ||
      result.status !== targetStatus
    ) {
      throw new Error("Kết quả cập nhật chưa hợp lệ");
    }

    messageLabel.textContent =
      "Đã cập nhật đơn " + orderLabel + " sang " +
      getStatusLabel(result.status) + ".";
  } catch {
    messageLabel.textContent =
      "Chưa xác nhận được kết quả cập nhật. Hãy đối chiếu trạng thái trong danh sách.";
  } finally {
    if (!adminPanel.hidden && !sessionCheckQueued) {
      await loadOrders();
    }

    if (!adminPanel.hidden && !sessionCheckQueued) {
      await loadOrdersSummary();
    }

    finishRequest(refreshOrdersButton);
  }
}

async function loadOrders() {
  clearOrders();
  if (sessionCheckQueued || !pageActive) return;

  ordersMessage.textContent = "Đang tải đơn hàng...";

  try {
    const cursor = orderPageCursors[orderPageIndex];
    const params = getAppliedOrderParams();
    params.set("cursor", cursor);

    const { response, result } = await callAdmin(
      "/orders?" + params.toString()
    );

    if (sessionCheckQueued || !pageActive) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (response.ok && Array.isArray(result)) {
      ordersMessage.textContent =
        "Hãy chạy lại backend rồi tải lại trang quản trị để dùng phân trang.";
      return;
    }

    const validNextCursor = result?.nextCursor === null ||
      (
        typeof result?.nextCursor === "string" &&
        result.nextCursor.length > 0 &&
        result.nextCursor !== cursor
      );

    if (
      !response.ok ||
      !result ||
      !Array.isArray(result.orders) ||
      result.orders.length > 20 ||
      !validNextCursor ||
      (result.nextCursor !== null && result.orders.length !== 20)
    ) {
      throw new Error("Tải đơn hàng gặp lỗi");
    }

    if (result.orders.length === 0 && orderPageIndex > 0) {
      resetOrderPagination();
      await loadOrders();
      return;
    }

    renderOrders(result.orders);
    nextOrderCursor = result.nextCursor;
    updateOrderPagination();

    ordersMessage.textContent = result.orders.length === 0
      ? "Chưa có đơn hàng phù hợp."
      : "Trang " + (orderPageIndex + 1) + ", hiển thị " +
        result.orders.length + " đơn phù hợp.";
  } catch {
    if (sessionCheckQueued || !pageActive) return;
    clearOrders();
    ordersMessage.textContent =
      "Tải đơn hàng gặp lỗi. Bấm Tải lại đơn hàng để thử lại.";
  }
}

async function changeOrderPage(direction) {
  if (
    busy ||
    (direction < 0 && orderPageIndex === 0) ||
    (direction > 0 && nextOrderCursor === null)
  ) {
    return;
  }

  if (direction > 0) {
    orderPageCursors = orderPageCursors.slice(0, orderPageIndex + 1);
    orderPageCursors.push(nextOrderCursor);
  }

  orderPageIndex += direction;
  setBusy(true);

  try {
    await loadOrders();
  } finally {
    finishRequest(refreshOrdersButton);
  }
}

previousOrdersButton.addEventListener("click", () => changeOrderPage(-1));
nextOrdersButton.addEventListener("click", () => changeOrderPage(1));

function clearOrderSearch() {
  activeOrderPhone = "";
  activeOrderFromDate = "";
  activeOrderToDate = "";
  orderPhoneField.value = "";
  orderFromDateField.value = "";
  orderToDateField.value = "";
  resetOrderPagination();
}

function getAppliedOrderParams() {
  return new URLSearchParams({
    status: orderStatusFilter.value,
    phone: activeOrderPhone,
    fromDate: activeOrderFromDate,
    toDate: activeOrderToDate
  });
}

function validOrderDate(value) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value;
}

orderSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  if (!orderSearchForm.reportValidity()) return;
  const fromDate = orderFromDateField.value;
  const toDate = orderToDateField.value;
  if (!validOrderDate(fromDate) || !validOrderDate(toDate)) {
    ordersMessage.textContent = "Hãy nhập ngày tạo đơn hợp lệ.";
    return;
  }
  if (fromDate && toDate && fromDate > toDate) {
    ordersMessage.textContent = "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.";
    orderToDateField.focus();
    return;
  }

  orderPhoneField.value = orderPhoneField.value.trim();
  activeOrderPhone = orderPhoneField.value;
  activeOrderFromDate = fromDate;
  activeOrderToDate = toDate;
  ordersExportMessage.textContent = "";
  resetOrderPagination();

  setBusy(true);

  try {
    await loadOrders();
  } finally {
    finishRequest(orderPhoneField);
  }
});

orderStatusFilter.addEventListener("change", async () => {
  if (busy) return;

  ordersExportMessage.textContent = "";
  resetOrderPagination();
  setBusy(true);

  try {
    await loadOrders();
  } finally {
    finishRequest(orderStatusFilter);
  }
});

refreshOrdersButton.addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);

  try {
    await loadOrders();
    if (!adminPanel.hidden && !sessionCheckQueued) {
      await loadOrdersSummary();
    }
  } finally {
    finishRequest(refreshOrdersButton);
  }
});

function revokeOrdersDownload() {
  if (ordersDownloadTimer !== null) clearTimeout(ordersDownloadTimer);
  ordersDownloadTimer = null;
  if (ordersDownloadUrl !== null) URL.revokeObjectURL(ordersDownloadUrl);
  ordersDownloadUrl = null;
}

function clearOrdersExport() {
  ordersExportController?.abort();
  revokeOrdersDownload();
  ordersExportMessage.textContent = "";
}

exportOrdersButton.addEventListener("click", async () => {
  if (busy || adminPanel.hidden || !pageActive) return;

  const controller = new AbortController();
  ordersExportController = controller;
  revokeOrdersDownload();
  const params = getAppliedOrderParams();
  setBusy(true);
  exportOrdersButton.textContent = "Đang xuất CSV...";
  ordersExportMessage.textContent = "Đang tải toàn bộ đơn khớp bộ lọc đã áp dụng...";

  try {
    const response = await fetch("/api/admin/orders/export.csv?" + params.toString(), {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
    });

    if (ordersExportController !== controller || sessionCheckQueued || !pageActive) return;
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      if (ordersExportController !== controller || sessionCheckQueued || !pageActive) return;
      if (response.status === 401) {
        showAuth(null);
        messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      } else {
        ordersExportMessage.textContent = typeof result?.error === "string"
          ? result.error : "Xuất CSV gặp lỗi. Bấm Xuất CSV các đơn đã lọc để thử lại.";
      }
      return;
    }

    if (!/^text\/csv(?:\s*;|$)/i.test(response.headers.get("Content-Type") ?? "")) {
      throw new Error("Định dạng tệp xuất chưa hợp lệ");
    }
    const blob = await response.blob();
    if (ordersExportController !== controller || sessionCheckQueued || !pageActive) return;
    if (blob.size === 0) throw new Error("Tệp xuất trống");

    ordersDownloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = ordersDownloadUrl;
    link.download = "don-hang.csv";
    link.hidden = true;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      ordersDownloadTimer = setTimeout(revokeOrdersDownload, 1000);
    }
    ordersExportMessage.textContent = "Đã tạo tệp don-hang.csv từ toàn bộ đơn khớp bộ lọc đã áp dụng.";
  } catch {
    if (ordersExportController === controller && !sessionCheckQueued && pageActive) {
      ordersExportMessage.textContent = "Xuất CSV gặp lỗi. Bấm Xuất CSV các đơn đã lọc để thử lại.";
    }
  } finally {
    if (ordersExportController === controller) {
      ordersExportController = null;
      exportOrdersButton.textContent = "Xuất CSV các đơn đã lọc";
      if (pageActive) {
        finishRequest(exportOrdersButton);
      } else {
        setBusy(false);
      }
    }
  }
});

function clearProductEditor() {
  clearProductImageUpload();
  productSnapshot = null;
  managedProducts = [];
  productMode = "loading";
  productCreationKey = null;
  productPicker.replaceChildren();
  for (const field of productFields) {
    field.value = "";
    field.disabled = true;
  }
  productActiveField.checked = false;
  productStockTrackedField.checked = false;
  productStockQuantityField.value = "0";
  productEditorMessage.textContent = "";
  productPicker.disabled = true;
  newProductButton.disabled = true;
  saveProductButton.disabled = true;
  productImageFileField.disabled = true;
  uploadProductImageButton.disabled = true;
  clearProductImageButton.disabled = true;
}

function clearProductImageUpload() {
  productImageUploadController?.abort();
  productImageUploadController = null;
  productImageFileField.value = "";
  productImageMessage.textContent = "";
  productImagePreview.hidden = true;
  productImagePreview.removeAttribute("src");
}

function showProductImagePreview() {
  const imageUrl = productImageField.value.trim();
  let validUrl = imageUrl.startsWith("/") && !imageUrl.startsWith("//");
  if (!validUrl) {
    try {
      validUrl = ["https:", "http:"].includes(new URL(imageUrl).protocol);
    } catch {
      validUrl = false;
    }
  }

  productImagePreview.hidden = !validUrl;
  if (validUrl) {
    productImagePreview.src = imageUrl;
  } else {
    productImagePreview.removeAttribute("src");
  }
}

function validateProductImageFile(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Hãy chọn ảnh JPEG, PNG hoặc WebP.";
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    return "Hãy chọn ảnh có dung lượng từ 1 byte đến 5 MiB.";
  }
  return "";
}

productImageFileField.addEventListener("change", () => {
  const file = productImageFileField.files[0];
  if (!file) {
    productImageMessage.textContent = "";
    setBusy(busy);
    return;
  }
  const error = validateProductImageFile(file);
  if (error) productImageFileField.value = "";
  productImageMessage.textContent = error ||
    "Đã chọn " + file.name + ". Bấm Tải ảnh lên để tiếp tục.";
  setBusy(busy);
});

productImageField.addEventListener("input", () => {
  productImagePreview.hidden = true;
  productImagePreview.removeAttribute("src");
  productImageMessage.textContent = "";
  setBusy(busy);
});

productImageField.addEventListener("change", showProductImagePreview);

productImagePreview.addEventListener("error", () => {
  if (productImagePreview.hidden) return;
  productImagePreview.hidden = true;
  productImageMessage.textContent =
    "Chưa hiển thị được ảnh xem trước. Kiểm tra đường dẫn ảnh.";
});

clearProductImageButton.addEventListener("click", () => {
  if (busy || !["edit", "new"].includes(productMode)) return;
  clearProductImageUpload();
  productImageField.value = "";
  productImageMessage.textContent =
    "Đã gỡ ảnh trong bản chỉnh sửa. Bấm Lưu sản phẩm để áp dụng.";
  setBusy(false);
  productImageField.focus();
});

uploadProductImageButton.addEventListener("click", async () => {
  if (busy || !["edit", "new"].includes(productMode)) return;
  const file = productImageFileField.files[0];
  const error = validateProductImageFile(file);
  if (error) {
    productImageMessage.textContent = error;
    return;
  }

  const controller = new AbortController();
  productImageUploadController = controller;
  setBusy(true);
  uploadProductImageButton.textContent = "Đang tải ảnh...";
  productImageMessage.textContent = "Đang tải " + file.name + " lên máy chủ...";

  try {
    const { response, result } = await callAdmin("/product-images", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
    });

    if (productImageUploadController !== controller || sessionCheckQueued || !pageActive) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }
    if (!response.ok) {
      productImageMessage.textContent = typeof result?.error === "string"
        ? result.error
        : "Tải ảnh gặp lỗi. Bấm Tải ảnh lên để thử lại.";
      return;
    }
    if (typeof result?.imageUrl !== "string" ||
      !/^\/uploads\/products\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(result.imageUrl)) {
      throw new Error("Đường dẫn ảnh tải lên chưa hợp lệ");
    }

    productImageField.value = result.imageUrl;
    productImageFileField.value = "";
    showProductImagePreview();
    productImageMessage.textContent =
      "Đã tải ảnh lên. Bấm Lưu sản phẩm để áp dụng ảnh này.";
    productEditorMessage.textContent = "";
  } catch {
    if (productImageUploadController === controller && !sessionCheckQueued && pageActive) {
      productImageMessage.textContent =
        "Chưa xác nhận được kết quả tải ảnh. Giữ ảnh đã chọn và bấm Tải ảnh lên để thử lại.";
    }
  } finally {
    if (productImageUploadController === controller) productImageUploadController = null;
    uploadProductImageButton.textContent = "Tải ảnh lên";
    if (pageActive) {
      finishRequest(productImageField);
    } else {
      setBusy(false);
    }
  }
});

function validateManagedProduct(product) {
  if (
    !product || !Number.isSafeInteger(product.id) || product.id < 1 ||
    typeof product.name !== "string" || product.name.trim() === "" ||
    !Number.isSafeInteger(product.price) || product.price < 0 ||
    typeof product.description !== "string" || typeof product.imageUrl !== "string" ||
    typeof product.active !== "boolean" ||
    !(product.categoryId === undefined || (Number.isSafeInteger(product.categoryId) && product.categoryId > 0)) ||
    !((product.stockTracked === undefined && product.stockQuantity === undefined) ||
      (typeof product.stockTracked === "boolean" && Number.isSafeInteger(product.stockQuantity) && product.stockQuantity >= 0)) ||
    !Number.isSafeInteger(product.revision) || product.revision < 0
  ) {
    throw new Error("Thông tin sản phẩm chưa hợp lệ");
  }
}

function renderProductPicker() {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Thêm sản phẩm mới";
  placeholder.disabled = true;
  productPicker.replaceChildren(placeholder);
  for (const product of managedProducts) {
    const option = document.createElement("option");
    option.value = String(product.id);
    option.textContent = product.name + (product.active ? "" : " (đang ẩn)");
    productPicker.append(option);
  }
  productPicker.value = productSnapshot ? String(productSnapshot.id) : "";
}

function renderProductCategories(selectedId = productCategoryField.value) {
  const selected = String(selectedId || productSnapshot?.categoryId || 1);
  const fragment = document.createDocumentFragment();
  for (const category of categoryEditor.items) {
    const option = document.createElement("option");
    option.value = String(category.id);
    option.textContent = category.name + (category.enabled ? "" : " (đang ẩn)");
    fragment.append(option);
  }
  if (!categoryEditor.items.some(category => String(category.id) === selected)) {
    const missing = document.createElement("option");
    missing.value = selected;
    missing.textContent = categoryEditor.ready ? "Danh mục #" + selected + " (cần chọn lại)" : "Chưa tải được danh mục";
    missing.disabled = true;
    fragment.append(missing);
  }
  productCategoryField.replaceChildren(fragment);
  productCategoryField.value = selected;
}

function fillProductEditor(product) {
  validateManagedProduct(product);
  clearProductImageUpload();
  productSnapshot = product;
  productMode = "edit";
  productCreationKey = null;
  productNameField.value = product.name;
  productPriceField.value = String(product.price);
  renderProductCategories(product.categoryId ?? 1);
  productDescriptionField.value = product.description;
  productImageField.value = product.imageUrl;
  productActiveField.checked = product.active;
  productStockTrackedField.checked = product.stockTracked ?? false;
  productStockQuantityField.value = String(product.stockQuantity ?? 0);
  showProductImagePreview();
  saveProductButton.textContent = "Lưu sản phẩm";
  renderProductPicker();
}

function startNewProduct() {
  clearProductImageUpload();
  productSnapshot = null;
  productMode = "new";
  productCreationKey = crypto.randomUUID();
  productNameField.value = "";
  productPriceField.value = "";
  renderProductCategories(1);
  productDescriptionField.value = "";
  productImageField.value = "";
  productActiveField.checked = true;
  productStockTrackedField.checked = false;
  productStockQuantityField.value = "0";
  saveProductButton.textContent = "Thêm sản phẩm";
  renderProductPicker();
  productEditorMessage.textContent = "Nhập thông tin sản phẩm mới rồi bấm Thêm sản phẩm trong biểu mẫu. Để quản lý tồn kho, bật Theo dõi tồn kho và nhập số lượng thực tế.";
}

async function loadProductEditor() {
  const selectedId = productSnapshot?.id;
  productMode = "loading";
  productEditorMessage.textContent = "Đang tải danh sách sản phẩm...";

  try {
    if (!categoryEditor.ready && !await categoryEditor.load()) {
      throw new Error("Chưa tải được danh mục sản phẩm");
    }
    if (sessionCheckQueued || adminPanel.hidden || !pageActive) return;
    const { response, result } = await callAdmin("/products");

    if (sessionCheckQueued) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (!response.ok || !Array.isArray(result)) {
      throw new Error("Tải sản phẩm gặp lỗi");
    }

    result.forEach(validateManagedProduct);
    managedProducts = result;
    const selected = result.find(product => product.id === selectedId) ?? result[0];
    if (selected) {
      fillProductEditor(selected);
      productEditorMessage.textContent = "Đã tải " + result.length + " sản phẩm.";
    } else {
      startNewProduct();
    }
  } catch {
    productMode = "unknown";
    productEditorMessage.textContent =
      "Tải sản phẩm gặp lỗi. Bấm Tải lại sản phẩm để thử lại.";
  }
}

reloadProductButton.addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);

  try {
    await loadProductEditor();
  } finally {
    finishRequest(reloadProductButton);
  }
});

newProductButton.addEventListener("click", () => {
  if (busy || !["edit", "new"].includes(productMode)) return;
  startNewProduct();
  setBusy(false);
  productNameField.focus();
});

productPicker.addEventListener("change", () => {
  if (busy || !["edit", "new"].includes(productMode)) return;
  const product = managedProducts.find(item => String(item.id) === productPicker.value);
  if (!product) return;
  fillProductEditor(product);
  productEditorMessage.textContent = "";
  setBusy(false);
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy || !["edit", "new"].includes(productMode)) return;

  productNameField.value = productNameField.value.trim();

  if (!productForm.reportValidity()) return;

  const name = productNameField.value;
  const price = Number(productPriceField.value);
  const stockQuantity = Number(productStockQuantityField.value);
  const categoryId = Number(productCategoryField.value);

  if (name.length > 200 || !Number.isSafeInteger(price) || price < 0) {
    productEditorMessage.textContent =
      "Kiểm tra tên sản phẩm và nhập giá là số nguyên từ 0.";
    return;
  }
  if (productStockQuantityField.value.trim() === "" || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
    productEditorMessage.textContent = "Nhập số lượng có thể bán là số nguyên từ 0.";
    return;
  }
  if (!categoryEditor.ready || !categoryEditor.items.some(category => category.id === categoryId)) {
    productEditorMessage.textContent = "Hãy tải lại danh mục và chọn danh mục sản phẩm hợp lệ.";
    productCategoryField.focus();
    return;
  }

  const creating = productMode === "new";
  const data = {
    name,
    price,
    categoryId,
    description: productDescriptionField.value.trim(),
    imageUrl: productImageField.value.trim(),
    active: productActiveField.checked,
    stockTracked: productStockTrackedField.checked,
    stockQuantity
  };
  const body = JSON.stringify({ ...data,
    ...(creating ? { requestId: productCreationKey } : { expectedRevision: productSnapshot.revision })
  });
  const path = creating ? "/products" : "/products/" + productSnapshot.id;

  setBusy(true);
  productEditorMessage.textContent = "Đang lưu sản phẩm...";

  try {
    const { response, result } = await callAdmin(path, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (sessionCheckQueued) return;

    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent =
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }

    if (!response.ok) {
      const errorMessage = typeof result?.error === "string"
        ? result.error
        : "Cập nhật sản phẩm gặp lỗi.";

      if ([400, 403].includes(response.status)) {
        productEditorMessage.textContent = errorMessage;
      } else {
        productMode = "unknown";
        productEditorMessage.textContent =
          errorMessage + " Bấm Tải lại sản phẩm để kiểm tra.";
      }

      return;
    }

    validateManagedProduct(result);
    if (!Object.entries(data).every(([field, value]) => result[field] === value)) {
      throw new Error("Kết quả lưu sản phẩm chưa hợp lệ");
    }

    managedProducts = managedProducts.filter(product => product.id !== result.id);
    managedProducts.push(result);
    managedProducts.sort((a, b) => a.id - b.id);
    fillProductEditor(result);
    await categoryEditor.load();
    productEditorMessage.textContent = creating ? "Đã thêm sản phẩm." : "Đã lưu sản phẩm.";
  } catch {
    productMode = "unknown";
    productEditorMessage.textContent =
      "Chưa xác định được kết quả lưu. Bấm Tải lại sản phẩm để kiểm tra.";
  } finally {
    finishRequest(
      productMode === "unknown" ? reloadProductButton : saveProductButton
    );
  }
});

productForm.addEventListener("input", () => {
  productEditorMessage.textContent = "";
});

productStockTrackedField.addEventListener("change", () => {
  setBusy(busy);
  productEditorMessage.textContent = "";
});

function clearBannerImagePreview() {
  bannerImageFileField.value = "";
  bannerImageMessage.textContent = "";
  bannerImagePreview.hidden = true;
  bannerImagePreview.alt = "Ảnh xem trước quảng cáo";
  bannerImagePreview.removeAttribute("src");
}

function clearBannerEditor() {
  bannerRequestController?.abort();
  bannerRequestController = null;
  bannerSnapshot = null;
  managedBanners = [];
  bannerMode = "loading";
  bannerCreationKey = null;
  bannerGroup = "hero";
  bannerForm.hidden = true;
  bannerEmpty.hidden = true;
  cancelBannerButton.hidden = true;
  newBannerButton.disabled = true;
  deleteBannerButton.disabled = true;
  updateBannerGroup();
  bannerPicker.replaceChildren();
  for (const field of Object.values(bannerFields)) {
    field.value = "";
    field.disabled = true;
    field.removeAttribute("aria-invalid");
  }
  bannerFields.enabled.checked = false;
  bannerPicker.disabled = true;
  saveBannerButton.disabled = true;
  bannerImageFileField.disabled = true;
  uploadBannerImageButton.disabled = true;
  uploadBannerImageButton.textContent = "Tải ảnh lên";
  bannerEditorMessage.textContent = "";
  clearBannerImagePreview();
}

function parseBannerLink(value) {
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://shop.invalid");
    if (url.username || url.password || /%(?:2f|5c|25|2e)/i.test(url.pathname) ||
      /[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(url.pathname))) return null;
    return url;
  } catch {
    return null;
  }
}

function validBannerImageUrl(value) {
  const url = parseBannerLink(value);
  if (!url) return false;
  const imagePath = decodeURIComponent(url.pathname);
  if (/\.svgz?$/i.test(imagePath)) return false;
  if (/^https:\/\//i.test(value)) return url.protocol === "https:";
  return value.startsWith("/") && !value.startsWith("//") &&
    /^\/(?:assets|uploads\/products)\/.+\.(?:png|jpe?g|webp|gif|avif)$/i.test(imagePath);
}

function validBannerButtonUrl(value) {
  const url = parseBannerLink(value);
  if (!url || url.origin !== "https://shop.invalid") return false;
  if (value.startsWith("#")) return value.length > 1;
  return value.startsWith("/") && !value.startsWith("//") && !url.pathname.startsWith("//");
}

function validateManagedBanner(banner) {
  if (!banner || !Number.isSafeInteger(banner.id) || banner.id < 1 ||
    !["hero", "left", "right"].includes(banner.placement) ||
    typeof banner.title !== "string" || banner.title.trim() === "" || banner.title.length > 120 ||
    typeof banner.description !== "string" || banner.description.length > 400 ||
    typeof banner.imageUrl !== "string" || banner.imageUrl.length > 2048 || !validBannerImageUrl(banner.imageUrl) ||
    typeof banner.imageAlt !== "string" || banner.imageAlt.trim() === "" || banner.imageAlt.length > 200 ||
    typeof banner.buttonLabel !== "string" || banner.buttonLabel.length > 60 ||
    typeof banner.buttonUrl !== "string" || banner.buttonUrl.length > 2048 ||
    ((banner.buttonLabel === "") !== (banner.buttonUrl === "")) ||
    (banner.buttonUrl !== "" && !validBannerButtonUrl(banner.buttonUrl)) ||
    typeof banner.enabled !== "boolean" ||
    !Number.isSafeInteger(banner.sortOrder) || banner.sortOrder < 0 || banner.sortOrder > 999 ||
    !Number.isSafeInteger(banner.revision) || banner.revision < 0) {
    throw new Error("Thông tin quảng cáo chưa hợp lệ");
  }
}

function showBannerImagePreview() {
  const imageUrl = bannerFields.imageUrl.value.trim();
  bannerImagePreview.hidden = !validBannerImageUrl(imageUrl);
  bannerImagePreview.alt = bannerFields.imageAlt.value.trim() || "Ảnh xem trước quảng cáo";
  if (bannerImagePreview.hidden) {
    bannerImagePreview.removeAttribute("src");
  } else {
    bannerImagePreview.src = imageUrl;
  }
}

function groupedBanners() {
  return managedBanners.filter(banner => bannerGroup === "hero"
    ? banner.placement === "hero" : ["left", "right"].includes(banner.placement));
}

function updateBannerGroup() {
  for (const tab of bannerGroupTabs) {
    const selected = tab.id === "banner-group-" + bannerGroup;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  bannerGroupPanel.setAttribute("aria-labelledby", "banner-group-" + bannerGroup);
  bannerPlacementField.hidden = bannerGroup === "hero";
  bannerGroupDescription.textContent = bannerGroup === "hero"
    ? "Ảnh ngang ở đầu trang chủ, hiển thị theo thứ tự bạn chọn."
    : "Banner dọc ở hai mép website trên màn hình từ 1280px. Chọn bên trái hoặc bên phải cho từng quảng cáo.";
  for (const option of bannerPlacement.options) {
    const available = bannerGroup === "hero" ? option.value === "hero" : option.value !== "hero";
    option.hidden = !available;
    option.disabled = !available;
  }
  bannerImagePreview.classList.toggle("banner-image-preview--side", bannerGroup === "side");
}

function renderBannerPicker(selectedId = "") {
  const options = document.createDocumentFragment();
  const items = groupedBanners();
  if (bannerMode === "new" || items.length === 0) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = bannerMode === "new" ? "Đang thêm quảng cáo mới" : "Chưa có quảng cáo";
    placeholder.disabled = true;
    options.append(placeholder);
  }
  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item.id);
    const position = item.placement === "left" ? "Bên trái · " : item.placement === "right" ? "Bên phải · " : "";
    option.textContent = position + item.title + (item.enabled ? "" : " (đang ẩn)");
    options.append(option);
  }
  bannerPicker.replaceChildren(options);
  bannerPicker.value = String(selectedId);
}

function fillBannerEditor(banner) {
  validateManagedBanner(banner);
  clearBannerImagePreview();
  bannerSnapshot = banner;
  bannerCreationKey = null;
  bannerMode = "edit";
  bannerGroup = banner.placement === "hero" ? "hero" : "side";
  updateBannerGroup();
  bannerPlacement.value = banner.placement;
  for (const [key, field] of Object.entries(bannerFields)) {
    if (key === "enabled") field.checked = banner.enabled;
    else field.value = String(banner[key]);
    field.removeAttribute("aria-invalid");
  }
  bannerForm.hidden = false;
  bannerEmpty.hidden = true;
  cancelBannerButton.hidden = true;
  deleteBannerButton.hidden = false;
  saveBannerButton.textContent = "Lưu quảng cáo";
  renderBannerPicker(banner.id);
  showBannerImagePreview();
}

function selectBannerGroup(selectedId) {
  updateBannerGroup();
  const items = groupedBanners();
  const banner = items.find(item => item.id === selectedId) || items[0];
  if (banner) {
    fillBannerEditor(banner);
    return;
  }
  bannerSnapshot = null;
  bannerCreationKey = null;
  bannerMode = "empty";
  bannerForm.hidden = true;
  bannerEmpty.hidden = false;
  clearBannerImagePreview();
  renderBannerPicker();
}

function isCurrentBannerRequest(controller) {
  return bannerRequestController === controller && !sessionCheckQueued && pageActive && !adminPanel.hidden;
}

async function loadBannerEditor() {
  if (adminPanel.hidden || sessionCheckQueued || !pageActive) return;
  const selectedId = bannerSnapshot?.id;
  const creationKey = bannerCreationKey;
  const controller = new AbortController();
  bannerRequestController = controller;
  bannerMode = "loading";
  bannerEditorMessage.textContent = "Đang tải quảng cáo...";
  try {
    const { response, result } = await callAdmin("/banners", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    if (!isCurrentBannerRequest(controller)) return;
    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }
    if (!response.ok || !Array.isArray(result)) throw new Error("Tải quảng cáo gặp lỗi");
    result.forEach(validateManagedBanner);
    if (new Set(result.map(banner => banner.id)).size !== result.length) {
      throw new Error("Danh sách quảng cáo bị trùng");
    }
    managedBanners = result.toSorted((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const created = creationKey && managedBanners.find(banner => banner.creationKey === creationKey);
    if (created) fillBannerEditor(created);
    else selectBannerGroup(selectedId);
    bannerEditorMessage.textContent = "Đã tải " + managedBanners.length + " quảng cáo.";
  } catch {
    if (!isCurrentBannerRequest(controller)) return;
    bannerMode = "unknown";
    bannerEditorMessage.textContent = "Tải quảng cáo gặp lỗi. Bấm Tải lại quảng cáo để thử lại.";
  } finally {
    if (bannerRequestController === controller) bannerRequestController = null;
  }
}

reloadBannerButton.addEventListener("click", async () => {
  if (busy || adminPanel.hidden || !pageActive) return;
  setBusy(true);
  try {
    await loadBannerEditor();
  } finally {
    finishRequest(reloadBannerButton);
  }
});

for (const tab of bannerGroupTabs) {
  tab.addEventListener("click", () => {
    if (busy || !["edit", "new", "empty"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
    bannerGroup = tab.id === "banner-group-hero" ? "hero" : "side";
    selectBannerGroup();
    bannerEditorMessage.textContent = "";
    setBusy(false);
  });
  tab.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || busy) return;
    event.preventDefault();
    const next = tab === bannerGroupTabs[0] ? bannerGroupTabs[1] : bannerGroupTabs[0];
    const target = event.key === "Home" ? bannerGroupTabs[0] : event.key === "End" ? bannerGroupTabs[1] : next;
    if (!target.disabled) {
      target.click();
      target.focus();
    }
  });
}

newBannerButton.addEventListener("click", () => {
  if (busy || !["edit", "new", "empty"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
  bannerSnapshot = null;
  bannerCreationKey = crypto.randomUUID();
  bannerMode = "new";
  clearBannerImagePreview();
  bannerForm.reset();
  for (const field of Object.values(bannerFields)) field.removeAttribute("aria-invalid");
  const lastSortOrder = groupedBanners().reduce((highest, banner) => Math.max(highest, banner.sortOrder), -1);
  bannerFields.sortOrder.value = String(Math.min(999, lastSortOrder + 1));
  bannerFields.enabled.checked = true;
  bannerPlacement.value = bannerGroup === "hero" ? "hero" : "left";
  bannerForm.hidden = false;
  bannerEmpty.hidden = true;
  deleteBannerButton.hidden = true;
  saveBannerButton.textContent = "Thêm quảng cáo";
  bannerEditorMessage.textContent = "";
  renderBannerPicker();
  setBusy(false);
  bannerFields.title.focus();
});

cancelBannerButton.addEventListener("click", () => {
  if (busy || bannerMode !== "new" || adminPanel.hidden || !pageActive) return;
  selectBannerGroup();
  bannerEditorMessage.textContent = "Đã hủy thêm quảng cáo.";
  setBusy(false);
  newBannerButton.focus();
});

bannerPicker.addEventListener("change", () => {
  if (busy || !["edit", "new"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
  const banner = groupedBanners().find(item => String(item.id) === bannerPicker.value);
  if (!banner) return;
  fillBannerEditor(banner);
  bannerEditorMessage.textContent = "";
  setBusy(false);
});

bannerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !["edit", "new"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
  for (const [key, field] of Object.entries(bannerFields)) {
    if (key !== "enabled") field.value = field.value.trim();
    field.removeAttribute("aria-invalid");
  }
  if (!bannerForm.reportValidity()) return;
  const creating = bannerMode === "new";
  const data = {
    placement: bannerGroup === "hero" ? "hero" : bannerPlacement.value,
    title: bannerFields.title.value,
    description: bannerFields.description.value,
    imageUrl: bannerFields.imageUrl.value,
    imageAlt: bannerFields.imageAlt.value,
    buttonLabel: bannerFields.buttonLabel.value,
    buttonUrl: bannerFields.buttonUrl.value,
    sortOrder: Number(bannerFields.sortOrder.value),
    enabled: bannerFields.enabled.checked
  };
  const bannerId = bannerSnapshot?.id;
  const revision = bannerSnapshot?.revision ?? 0;
  try {
    validateManagedBanner({ id: bannerId ?? 1, ...data, revision });
    if (bannerFields.sortOrder.value === "") throw new Error("Thiếu thứ tự hiển thị");
  } catch {
    bannerEditorMessage.textContent = "Kiểm tra nội dung, vị trí, ảnh, cặp nhãn/liên kết nút và thứ tự từ 0 đến 999 trước khi lưu.";
    return;
  }

  const controller = new AbortController();
  bannerRequestController = controller;
  setBusy(true);
  saveBannerButton.textContent = creating ? "Đang thêm..." : "Đang lưu...";
  bannerEditorMessage.textContent = creating ? "Đang thêm quảng cáo..." : "Đang lưu quảng cáo...";
  try {
    const { response, result } = await callAdmin(creating ? "/banners" : "/banners/" + bannerId, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating ? { ...data, creationKey: bannerCreationKey } : { ...data, revision }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    if (!isCurrentBannerRequest(controller)) return;
    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }
    if (!response.ok) {
      const errorMessage = typeof result?.error === "string" ? result.error : "Lưu quảng cáo gặp lỗi.";
      if ([400, 403].includes(response.status)) {
        bannerEditorMessage.textContent = errorMessage;
        let field = null;
        if (result?.field === "placement") field = bannerPlacement;
        else if (Object.hasOwn(bannerFields, result?.field)) field = bannerFields[result.field];
        field?.setAttribute("aria-invalid", "true");
      } else {
        bannerMode = "unknown";
        bannerEditorMessage.textContent = errorMessage + " Bản đang sửa được giữ lại. Bấm Tải lại quảng cáo để xem phiên bản hiện tại.";
      }
      return;
    }
    validateManagedBanner(result);
    if ((!creating && result.id !== bannerId) || !Object.entries(data).every(([key, value]) => result[key] === value)) {
      throw new Error("Kết quả lưu quảng cáo chưa hợp lệ");
    }
    managedBanners = [...managedBanners.filter(banner => banner.id !== result.id), result]
      .toSorted((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    fillBannerEditor(result);
    bannerEditorMessage.textContent = creating ? "Đã thêm quảng cáo." : "Đã lưu quảng cáo.";
  } catch {
    if (!isCurrentBannerRequest(controller)) return;
    bannerMode = "unknown";
    bannerEditorMessage.textContent = "Chưa xác nhận được kết quả lưu. Bản đang sửa được giữ lại. Bấm Tải lại quảng cáo để kiểm tra.";
  } finally {
    if (bannerRequestController === controller) bannerRequestController = null;
    saveBannerButton.textContent = bannerMode === "new" ? "Thêm quảng cáo" : "Lưu quảng cáo";
    finishRequest(bannerMode === "unknown" ? reloadBannerButton : saveBannerButton);
  }
});

deleteBannerButton.addEventListener("click", async () => {
  if (busy || bannerMode !== "edit" || !bannerSnapshot || adminPanel.hidden || !pageActive) return;
  const banner = bannerSnapshot;
  if (!window.confirm('Xóa quảng cáo "' + banner.title + '" khỏi website?')) return;
  const controller = new AbortController();
  bannerRequestController = controller;
  setBusy(true);
  deleteBannerButton.textContent = "Đang xóa...";
  bannerEditorMessage.textContent = "Đang xóa quảng cáo...";
  try {
    const { response, result } = await callAdmin("/banners/" + banner.id, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: banner.revision }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    if (!isCurrentBannerRequest(controller)) return;
    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }
    if (!response.ok || result?.id !== banner.id || result.deleted !== true) {
      bannerMode = "unknown";
      bannerEditorMessage.textContent = (result?.error || "Chưa xác nhận được kết quả xóa.") + " Bấm Tải lại quảng cáo để kiểm tra.";
      return;
    }
    managedBanners = managedBanners.filter(item => item.id !== banner.id);
    selectBannerGroup();
    bannerEditorMessage.textContent = "Đã xóa quảng cáo.";
  } catch {
    if (!isCurrentBannerRequest(controller)) return;
    bannerMode = "unknown";
    bannerEditorMessage.textContent = "Chưa xác nhận được kết quả xóa. Bấm Tải lại quảng cáo để kiểm tra.";
  } finally {
    if (bannerRequestController === controller) bannerRequestController = null;
    deleteBannerButton.textContent = "Xóa quảng cáo";
    finishRequest(bannerMode === "unknown" ? reloadBannerButton : newBannerButton);
  }
});

bannerImageFileField.addEventListener("change", () => {
  if (busy || !["edit", "new"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
  const file = bannerImageFileField.files[0];
  const error = file ? validateProductImageFile(file) : "";
  if (error) bannerImageFileField.value = "";
  bannerImageMessage.textContent = error || (file ? "Đã chọn " + file.name + ". Bấm Tải ảnh lên để tiếp tục." : "");
  setBusy(false);
});

bannerFields.imageUrl.addEventListener("input", () => {
  bannerImagePreview.hidden = true;
  bannerImagePreview.removeAttribute("src");
  bannerImageMessage.textContent = "";
});
bannerFields.imageUrl.addEventListener("change", showBannerImagePreview);
bannerFields.imageAlt.addEventListener("input", () => {
  bannerImagePreview.alt = bannerFields.imageAlt.value.trim() || "Ảnh xem trước quảng cáo";
});
bannerImagePreview.addEventListener("error", () => {
  if (bannerImagePreview.hidden || adminPanel.hidden || !pageActive) return;
  bannerImagePreview.hidden = true;
  bannerImageMessage.textContent = "Chưa hiển thị được ảnh xem trước. Kiểm tra đường dẫn ảnh.";
});

uploadBannerImageButton.addEventListener("click", async () => {
  if (busy || !["edit", "new"].includes(bannerMode) || adminPanel.hidden || !pageActive) return;
  const file = bannerImageFileField.files[0];
  const error = validateProductImageFile(file);
  if (error) {
    bannerImageMessage.textContent = error;
    return;
  }
  const controller = new AbortController();
  bannerRequestController = controller;
  setBusy(true);
  uploadBannerImageButton.textContent = "Đang tải ảnh...";
  bannerImageMessage.textContent = "Đang tải " + file.name + " lên máy chủ...";
  try {
    const { response, result } = await callAdmin("/product-images", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
    });
    if (!isCurrentBannerRequest(controller)) return;
    if (response.status === 401) {
      showAuth(null);
      messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
      return;
    }
    if (!response.ok) {
      bannerImageMessage.textContent = typeof result?.error === "string" ? result.error : "Tải ảnh gặp lỗi. Hãy thử lại.";
      return;
    }
    if (typeof result?.imageUrl !== "string" ||
      !/^\/uploads\/products\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(result.imageUrl)) {
      throw new Error("Đường dẫn ảnh tải lên chưa hợp lệ");
    }
    bannerFields.imageUrl.value = result.imageUrl;
    bannerImageFileField.value = "";
    showBannerImagePreview();
    bannerImageMessage.textContent = "Đã tải ảnh lên. Bấm Lưu quảng cáo để áp dụng.";
    bannerEditorMessage.textContent = "";
  } catch {
    if (!isCurrentBannerRequest(controller)) return;
    bannerImageMessage.textContent = "Chưa xác nhận được kết quả tải ảnh. Giữ ảnh đã chọn và bấm Tải ảnh lên để thử lại.";
  } finally {
    if (bannerRequestController === controller) bannerRequestController = null;
    uploadBannerImageButton.textContent = "Tải ảnh lên";
    finishRequest(bannerFields.imageUrl);
  }
});

bannerForm.addEventListener("input", () => {
  for (const field of Object.values(bannerFields)) field.removeAttribute("aria-invalid");
  bannerPlacement.removeAttribute("aria-invalid");
  if (["edit", "new"].includes(bannerMode)) bannerEditorMessage.textContent = "";
});

retryButton.addEventListener("click", checkSession);

window.addEventListener("pageshow", (event) => {
  pageActive = true;
  if (!event.persisted) return;

  if (busy) {
    sessionCheckQueued = true;
    showUnknown("Đang kiểm tra lại phiên đăng nhập...");
    return;
  }

  checkSession();
});

window.addEventListener("pagehide", () => { pageActive = false; });
window.addEventListener("pagehide", clearOrders);
window.addEventListener("pagehide", clearOrderSearch);
window.addEventListener("pagehide", clearOrdersExport);
window.addEventListener("pagehide", clearProductEditor);
window.addEventListener("pagehide", clearBannerEditor);
window.addEventListener("pagehide", clearOrdersSummary);
window.addEventListener("pagehide", () => categoryEditor.clear());

categoryEditor.configure({
  request: callAdmin,
  isActive: () => !adminPanel.hidden && pageActive && !sessionCheckQueued,
  setBusy,
  finish: finishRequest,
  validImage: value => value === "/kem-danh-rang.jpg" || validBannerImageUrl(value),
  validateImageFile: validateProductImageFile,
  onUnauthorized() {
    showAuth(null);
    messageLabel.textContent = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  },
  onChange() {
    renderProductCategories();
    setBusy(busy);
  }
});

checkSession();
