const productList = document.getElementById("product-list");
const featuredProductList = document.getElementById("featured-product-list");
const homeProductSections = [
  { list: featuredProductList, kind: "featured", message: document.getElementById("featured-products-empty-message") },
  { list: document.getElementById("best-selling-product-list"), kind: "best-selling",
    message: document.getElementById("best-selling-message") },
  { list: document.getElementById("latest-product-list"), kind: "latest",
    message: document.getElementById("latest-products-message") }
].filter(section => section.list);
const catalogTargets = [productList, ...homeProductSections.map(section => section.list)].filter(Boolean);
const homeProductsRetryButtons = [...document.querySelectorAll("[data-home-products-retry]")];
let homeProductSettings = null;
const productMessage = document.getElementById("product-message");
const reloadCatalogButton = document.getElementById("featured-products-retry");
const productSearchField = document.getElementById("product-search")
  ?? (productList ? document.querySelector("[data-header-search-input]") : null);
const productSortField = document.getElementById("product-sort");
const catalogSearchField = document.getElementById("catalog-search");
const priceFilter = document.getElementById("price-filter");
const brandFilter = document.getElementById("brand-filter");
const catalogPage = document.body.classList.contains("catalog-page");
let requestedCatalogBrand = catalogPage ? new URLSearchParams(window.location.search).get("brand") : null;
const catalogResults = document.getElementById("catalog-results");
const favoritesOnlyFilter = document.getElementById("favorites-only");
const availableOnlyFilter = document.getElementById("available-only");
const clearCatalogFiltersButton = document.getElementById("clear-catalog-filters");
const favoritesMessage = document.getElementById("favorites-message") ?? document.getElementById("featured-products-message")
  ?? document.getElementById("detail-favorite-message");
const activeFilters = document.getElementById("active-filters");
const productPreviewDialog = document.getElementById("product-preview-dialog");
const productPreviewTitle = document.getElementById("product-preview-title");
const productPreviewImage = document.getElementById("product-preview-image");
const productPreviewNoImage = document.getElementById("product-preview-no-image");
const productPreviewPrice = document.getElementById("product-preview-price");
const productPreviewStock = document.getElementById("product-preview-stock");
const productPreviewDescription = document.getElementById("product-preview-description");
const productPreviewCategory = document.querySelector(".preview-category");
const productPreviewAdd = document.getElementById("product-preview-add");
const productPreviewMessage = document.getElementById("product-preview-message");
const cartItems = document.getElementById("cart-items");
const cartMessage = document.getElementById("cart-message");
const clearButton = document.getElementById("clear-cart");
const cartRemoveDialog = document.getElementById("cart-remove-dialog");
const cartRemoveDescription = document.getElementById("cart-remove-description");
const cartRemoveCancel = document.getElementById("cart-remove-cancel");
const cartRemoveConfirm = document.getElementById("cart-remove-confirm");
const quantityLabel = document.getElementById("cart-quantity");
const headerCartCount = document.getElementById("header-cart-count");
const headerCartTotal = document.getElementById("header-cart-total");
const headerSearchForm = document.querySelector("[data-header-search]");
const headerSearchSubmit = headerSearchForm?.querySelector('button[type="submit"]');
const totalLabel = document.getElementById("cart-total");
const cartSubtotalLabel = document.getElementById("cart-subtotal");
const checkoutSelectedQuantity = document.getElementById("checkout-selected-quantity");
const storageMessage = document.getElementById("storage-message");
const checkoutForm = document.getElementById("checkout-form");
const reviewButton = document.getElementById("review-order");
const orderPreview = document.getElementById("order-preview");
const customerNameField = document.getElementById("customer-name");
const customerPhoneField = document.getElementById("customer-phone");
const customerEmailField = document.getElementById("customer-email");
const customerAddressField = document.getElementById("customer-address");
const recipientFields = document.getElementById("checkout-recipient-fields");
const savedRecipient = document.getElementById("checkout-saved-recipient");
const checkoutAccountStatus = document.getElementById("checkout-account-status");
const checkoutAccountRetry = document.getElementById("checkout-account-retry");
const paymentMethodField = document.getElementById("payment-method");
const paymentMethodHelp = document.getElementById("payment-method-help");
const bankTransferGuide = document.getElementById("bank-transfer-guide");
const bankTransferStatus = document.getElementById("bank-transfer-status");
const bankTransferAccount = document.getElementById("bank-transfer-account");
const bankTransferName = document.getElementById("bank-transfer-name");
const bankTransferNumber = document.getElementById("bank-transfer-number");
const bankTransferHolder = document.getElementById("bank-transfer-holder");
const bankTransferReference = document.getElementById("bank-transfer-reference");
const bankTransferTotal = document.getElementById("bank-transfer-total");
const bankTransferRetry = document.getElementById("bank-transfer-retry");
const confirmButton = document.getElementById("confirm-order");
const orderMessage = document.getElementById("order-message");
const receiptActions = document.getElementById("receipt-actions");
const receiptCode = document.getElementById("receipt-code");
const receiptOrdersLink = document.getElementById("receipt-orders");
const checkoutBackLink = document.getElementById("checkout-back-cart");
const recentOrdersList = document.getElementById("recent-orders-list");
const recentOrdersMessage = document.getElementById("recent-orders-message");
const reorderMessage = document.getElementById("reorder-message");
const pendingOrderMessage = document.getElementById("pending-order-message");
const pendingCartLink = document.getElementById("pending-cart-link");
const cartWorkspace = document.querySelector(".account-cart-workspace");
const cartEmptyState = document.getElementById("cart-empty-state");
const cartFilledState = document.getElementById("cart-filled-state");
const cartSelectAll = document.getElementById("cart-select-all");
const removeSelectedButton = document.getElementById("remove-selected-cart");
const cartContinueButton = document.getElementById("cart-continue");
const checkoutReviewItems = document.getElementById("checkout-review-items");
const couponEditors = [...document.querySelectorAll("[data-cart-coupon-form]")].map(form => ({
  form, input: form.querySelector("input"), button: form.querySelector("button"),
  message: document.getElementById(form.querySelector("input").getAttribute("aria-describedby")), controller: null
}));
const cartSelectionStorageKey = "toothpaste-cart-unselected";
const customerFields = [customerNameField, customerPhoneField, customerAddressField, customerEmailField].filter(Boolean);
const storageKey = "toothpaste-cart-items";
const legacyStorageKey = "toothpaste-cart-quantity";
const pendingStorageKey = "toothpaste-pending-order";
const favoritesStorageKey = "toothpaste-favorite-products";
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

let products = new Map();
let catalogCategories = null;
let cart = new Map();
let lastStoredCart = new Map();
let removingCartProductId = null;
let catalogReady = false;
let catalogLoading = false;
let reviewedOrder = null;
let isSubmitting = false;
let orderPending = false;
let pendingOrderStored = false;
let pendingOrderReadFailed = false;
let currentReceipt = null;
let currentReceiptPhone = "";
let appliedReorderId = null;
let appliedReorderIds = [];
let cartPersisted = false;
let cartReadFailed = false;
let copySequence = 0;
let storefrontActive = true;
let quickBuyNavigating = false;
let checkoutAccount = null;
let checkoutAccountState = "loading";
let checkoutAccountChecking = false;
let checkoutAccountController = null;
let reviewedAccountId = null;
let reviewedCustomerContext;
let bankTransferDetails = null;
let bankTransferState = "loading";
let bankTransferController = null;
let bankTransferReceipt = null;
const copyingButtons = new Set();
let favoriteProducts = new Set();
const favoriteChanges = new Map();
let previewProductId = null;
let previewOpener = null;
let unselectedCartProducts = new Set();
let reviewedCartSnapshot = null;
let removingCartQuantity = null;
let currentReceiptItems = null;

if (cartWorkspace) {
  try {
    const savedSelection = JSON.parse(sessionStorage.getItem(cartSelectionStorageKey) ?? "[]");
    if (Array.isArray(savedSelection) && savedSelection.every(id => Number.isSafeInteger(id) && id > 0)) {
      unselectedCartProducts = new Set(savedSelection);
    }
  } catch {
    storageMessage.textContent = "Chưa đọc được lựa chọn trước đó. Các sản phẩm trong giỏ được chọn lại.";
  }
}

function selectedCart() {
  return cartWorkspace ? new Map([...cart].filter(([id]) => !unselectedCartProducts.has(id))) : cart;
}

function saveCartSelection() {
  if (!cartWorkspace) return true;
  try {
    sessionStorage.setItem(cartSelectionStorageKey, JSON.stringify([...unselectedCartProducts]));
    return true;
  } catch {
    storageMessage.textContent = "Chưa lưu được lựa chọn sản phẩm. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.";
    return false;
  }
}

function workspaceRender(view = window.ShopAccountWorkspace?.currentView ?? "cart") {
  if (!cartWorkspace) return;
  const step = view === "checkout" ? "checkout" : "cart";
  for (const panel of cartWorkspace.querySelectorAll("[data-cart-step]")) {
    panel.hidden = panel.dataset.cartStep !== step;
  }
  if (step === "checkout") renderCheckoutVisuals();
}

window.addEventListener("shop-workspace-view", event => workspaceRender(event.detail?.view));

function paymentLabel(method) {
  return method === "BANK_TRANSFER" ? "Chuyển khoản ngân hàng" : "Thanh toán khi nhận hàng (COD)";
}

function productUnit(product) {
  return product?.categoryId === 1 ? "sp" : "sản phẩm";
}

function renderPaymentDetails() {
  if (!paymentMethodField) return;
  const method = orderPending ? reviewedOrder?.paymentMethod ?? "COD"
    : bankTransferReceipt ? "BANK_TRANSFER" : paymentMethodField.value;
  const transfer = method === "BANK_TRANSFER";
  paymentMethodHelp.textContent = transfer
    ? "Chuyển khoản sau khi nhận mã đơn. Dùng mã đơn làm nội dung chuyển khoản."
    : "Thanh toán cho người giao hàng khi nhận sản phẩm.";
  bankTransferGuide.hidden = !transfer;
  bankTransferAccount.hidden = !bankTransferDetails;
  bankTransferStatus.textContent = bankTransferState === "loading" ? "Đang tải thông tin ngân hàng..."
    : bankTransferState === "error" ? "Chưa tải được thông tin ngân hàng. Hãy bấm Tải lại thông tin."
    : bankTransferDetails ? "Dùng tài khoản bên dưới để chuyển khoản cho đơn hàng."
    : "Thông tin tài khoản ngân hàng đang được cập nhật.";
  bankTransferRetry.hidden = bankTransferState !== "error";
  if (bankTransferDetails) {
    bankTransferName.textContent = bankTransferDetails.bankName;
    bankTransferNumber.textContent = bankTransferDetails.accountNumber;
    bankTransferHolder.textContent = bankTransferDetails.accountHolder;
  }
  bankTransferReference.textContent = bankTransferReceipt
    ? "Nội dung chuyển khoản " + orderCode(bankTransferReceipt)
    : "Nội dung chuyển khoản sẽ hiển thị sau khi đặt hàng thành công.";
  bankTransferTotal.hidden = bankTransferReceipt === null;
  bankTransferTotal.textContent = bankTransferReceipt ? "Số tiền " + money.format(bankTransferReceipt.total) : "";
}

async function refreshBankTransferDetails() {
  if (!checkoutForm || bankTransferController || !storefrontActive) return;
  const controller = new AbortController();
  bankTransferController = controller;
  bankTransferDetails = null;
  bankTransferState = "loading";
  renderPaymentDetails();
  try {
    const response = await fetch("/api/payment-options", {
      cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    const result = await response.json();
    if (!storefrontActive || bankTransferController !== controller) return;
    const details = result?.bankTransfer;
    if (!response.ok || (details !== null && (!details ||
      ![details.bankName, details.accountNumber, details.accountHolder].every(value =>
        typeof value === "string" && value.trim() !== "" && value.length <= 120 && !/[\x00-\x1f\x7f]/.test(value)) ||
      details.accountNumber.length > 64))) {
      throw new Error("Thông tin ngân hàng chưa hợp lệ");
    }
    bankTransferDetails = details;
    bankTransferState = "ready";
  } catch {
    if (!storefrontActive || bankTransferController !== controller) return;
    bankTransferDetails = null;
    bankTransferState = "error";
  } finally {
    if (bankTransferController === controller) {
      bankTransferController = null;
      renderPaymentDetails();
    }
  }
}

bankTransferRetry?.addEventListener("click", () => void refreshBankTransferDetails());

function readLatestFavorites() {
  const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) ?? "[]");
  if (!Array.isArray(saved) || !saved.every(id => Number.isSafeInteger(id) && id > 0) ||
    new Set(saved).size !== saved.length) {
    throw new Error("Danh sách yêu thích đã lưu chưa hợp lệ");
  }
  const latest = new Set(saved);
  for (const [id, selected] of favoriteChanges) {
    if (selected) latest.add(id);
    else latest.delete(id);
  }
  return latest;
}

function setFavoriteMessage(text) {
  if (favoritesMessage) favoritesMessage.textContent = text;
}

function refreshFavorites() {
  if (!productList && !featuredProductList && !document.getElementById("detail-favorite")) return;
  try {
    favoriteProducts = readLatestFavorites();
    setFavoriteMessage(favoriteChanges.size > 0
      ? "Một số thay đổi yêu thích chưa lưu được. Hãy giữ trang đang mở để tiếp tục sử dụng danh sách này."
      : "");
  } catch {
    setFavoriteMessage("Chưa đọc được danh sách yêu thích đã lưu. Những thay đổi mới được giữ tạm trên trang này.");
  }
  window.dispatchEvent(new CustomEvent("shop-favorites-change"));
}

function toggleFavorite(product, opener = null) {
  if (!catalogReady || orderPending || isSubmitting || quickBuyNavigating || !storefrontActive) return false;
  const selected = !favoriteProducts.has(product.id);
  refreshFavorites();
  favoriteChanges.set(product.id, selected);
  if (selected) favoriteProducts.add(product.id);
  else favoriteProducts.delete(product.id);

  try {
    const latest = readLatestFavorites();
    localStorage.setItem(favoritesStorageKey, JSON.stringify([...latest].sort((a, b) => a - b)));
    favoriteProducts = latest;
    favoriteChanges.clear();
    setFavoriteMessage(selected
      ? "Đã lưu " + product.name + " vào yêu thích trên trình duyệt này."
      : "Đã bỏ " + product.name + " khỏi yêu thích.");
  } catch {
    setFavoriteMessage("Chưa lưu được danh sách yêu thích. Hãy giữ trang đang mở để tiếp tục dùng các thay đổi đang được lưu tạm.");
  }
  renderCatalog();
  window.dispatchEvent(new CustomEvent("shop-favorites-change"));
  const button = opener?.isConnected ? opener
    : document.getElementById(opener?.id || "favorite-" + product.id);
  if (button) button.focus();
  else favoritesOnlyFilter?.focus();
  return true;
}

function trackingHref(orderId) {
  return "/tra-cuu.html?orderId=" + encodeURIComponent(orderId);
}

function validOrderNumber(value) {
  return value === undefined || value === null || (typeof value === "string" &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
}

function orderCode(order) {
  return order.orderNumber ?? order.orderId;
}

async function copyOrderCode(orderId, button, message) {
  if (!storefrontActive || button.disabled) return;
  const sequence = ++copySequence;
  copyingButtons.add(button);
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(orderId);
    if (storefrontActive && sequence === copySequence) {
      message.textContent = "Đã sao chép mã đơn " + orderId + ".";
    }
  } catch {
    if (storefrontActive && sequence === copySequence) {
      message.textContent = "Chọn mã đơn " + orderId + " đang hiển thị rồi sao chép bằng Ctrl + C hoặc giữ để sao chép trên điện thoại.";
    }
  } finally {
    copyingButtons.delete(button);
    if (storefrontActive) button.disabled = false;
  }
}

function renderRecentOrders() {
  if (!recentOrdersList) return;
  copySequence += 1;
  const { receipts, error } = window.ShopMemory?.readReceipts?.() ?? {
    receipts: [], error: "Chưa tải được phần lưu mã đơn. Hãy sao chép mã đơn sau khi đặt hàng và tải lại trang để xem các mã đã lưu."
  };
  const fragment = document.createDocumentFragment();
  for (const receipt of receipts) {
    const displayCode = orderCode(receipt);
    const row = document.createElement("article");
    row.className = "recent-order";
    const code = document.createElement("p");
    code.className = "recent-order-code";
    code.textContent = "Mã đơn " + displayCode;
    const detail = document.createElement("p");
    detail.textContent = "Tiền sản phẩm " + money.format(receipt.total) + " · Lưu trên trình duyệt " +
      new Date(receipt.savedAt).toLocaleString("vi-VN");
    const actions = document.createElement("div");
    actions.className = "receipt-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button";
    copyButton.textContent = "Sao chép mã đơn";
    copyButton.setAttribute("aria-label", "Sao chép mã đơn " + displayCode);
    copyButton.addEventListener("click", () => copyOrderCode(displayCode, copyButton, recentOrdersMessage));
    const link = document.createElement("a");
    link.className = "navigation-link";
    link.href = trackingHref(displayCode);
    link.textContent = "Tra cứu đơn";
    link.setAttribute("aria-label", "Tra cứu đơn " + displayCode);
    link.addEventListener("click", () => {
      const phone = currentReceipt?.orderId === receipt.orderId ? currentReceiptPhone : "";
      window.ShopMemory?.prepareTracking?.(displayCode, phone);
    });
    link.addEventListener("click", event => prepareNavigation(event, link));
    actions.append(copyButton, link);
    row.append(code, detail, actions);
    fragment.append(row);
  }
  if (receipts.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Mã đơn sẽ xuất hiện ở đây sau khi đặt hàng nhận mã thành công.";
    fragment.append(empty);
  }
  recentOrdersList.replaceChildren(fragment);
  recentOrdersMessage.textContent = error;
}

window.addEventListener("pagehide", () => {
  storefrontActive = false;
  for (const editor of couponEditors) {
    editor.controller?.abort();
    editor.controller = null;
  }
  removingCartProductId = null;
  if (cartRemoveDialog?.open) cartRemoveDialog.close();
  if (productPreviewDialog?.open) productPreviewDialog.close();
  bankTransferController?.abort();
  bankTransferController = null;
  checkoutAccountController?.abort();
  checkoutAccountController = null;
  checkoutAccountChecking = false;
  checkoutAccount = null;
  checkoutAccountState = "loading";
  renderCheckoutAccount();
  if (reviewedOrder) renderOrderReview();
  copySequence += 1;
  for (const button of copyingButtons) button.disabled = false;
  copyingButtons.clear();
});

window.addEventListener("pageshow", event => {
  storefrontActive = true;
  quickBuyNavigating = false;
  if (event.persisted) {
    refreshIdleCustomerState();
    refreshFavorites();
    if (homeProductSections.length > 0 && !catalogLoading) void loadCatalog();
    else if ((productList || featuredProductList) && catalogReady) renderCatalog();
    if (checkoutForm) void refreshCheckoutAccount();
    if (checkoutForm) void refreshBankTransferDetails();
  }
});

window.addEventListener("shop-account-change", () => {
  if (checkoutForm && storefrontActive && !checkoutAccountChecking && !isSubmitting) {
    void refreshCheckoutAccount();
  }
});

window.addEventListener("storage", event => {
  if (event.storageArea && event.storageArea !== localStorage) return;
  if (event.key === null || [storageKey, legacyStorageKey, "toothpaste-receipts"].includes(event.key)) {
    refreshIdleCustomerState();
  }
  if (event.key === null || event.key === favoritesStorageKey) {
    refreshFavorites();
    if ((productList || featuredProductList) && catalogReady) renderCatalog();
  }
});

function savePendingOrder() {
  try {
    sessionStorage.setItem(pendingStorageKey, JSON.stringify({ version: 1, order: reviewedOrder,
      ...(reviewedCartSnapshot === null ? {} : {
        cartSnapshot: [...reviewedCartSnapshot].map(([productId, quantity]) => ({ productId, quantity }))
      }),
      ...(reviewedCustomerContext === undefined ? {} : { expectedCustomerId: reviewedCustomerContext }) }));
    pendingOrderStored = true;
    pendingOrderReadFailed = false;
    pendingOrderMessage.textContent = "";
    return true;
  } catch {
    pendingOrderMessage.textContent = "Trình duyệt chưa lưu được lần gửi này. Hãy giữ trang đang mở để có thể thử gửi lại.";
    return false;
  }
}

function clearPendingOrder() {
  pendingOrderStored = false;
  try {
    sessionStorage.removeItem(pendingStorageKey);
    pendingOrderReadFailed = false;
    pendingOrderMessage.textContent = "";
  } catch {
    pendingOrderMessage.textContent = "Xóa lần gửi đã lưu gặp lỗi. Lần mở lại trang có thể hiển thị kết quả đơn này thêm một lần.";
  }
}

function restorePendingOrder() {
  try {
    const saved = sessionStorage.getItem(pendingStorageKey);
    pendingOrderReadFailed = false;
    if (saved === null) {
      if (orderPending) {
        orderPending = false;
        pendingOrderStored = false;
        clearOrderReview();
        pendingOrderMessage.textContent = "";
        if (pendingCartLink) pendingCartLink.hidden = true;
        restoreCart();
        catalogReady = false;
      }
      return;
    }
    const record = JSON.parse(saved);
    const order = record?.order;
    if (record?.version !== 1 || !order ||
      (record.expectedCustomerId !== undefined && record.expectedCustomerId !== "guest" &&
        !(typeof record.expectedCustomerId === "string" && /^[1-9]\d*$/.test(record.expectedCustomerId) &&
          Number.isSafeInteger(Number(record.expectedCustomerId)))) ||
      (order.paymentMethod !== undefined && !["COD", "BANK_TRANSFER"].includes(order.paymentMethod)) ||
      (order.customerEmail !== undefined && (typeof order.customerEmail !== "string" || order.customerEmail.length > 254 ||
        (order.customerEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customerEmail.trim())))) ||
      ![order.requestId, order.customerName, order.customerPhone, order.customerAddress]
        .every(value => typeof value === "string" && value.trim() !== "") ||
      !Array.isArray(order.items) || order.items.length === 0 ||
      !order.items.every(item => item &&
        Number.isSafeInteger(item.productId) && item.productId > 0 &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        Number.isSafeInteger(item.expectedUnitPrice) && item.expectedUnitPrice >= 0 &&
        typeof item.expectedProductName === "string" && item.expectedProductName.trim() !== "" &&
        Number.isSafeInteger(item.quantity * item.expectedUnitPrice)) ||
      new Set(order.items.map(item => item.productId)).size !== order.items.length ||
      !Number.isSafeInteger(order.items.reduce((sum, item) => sum + item.quantity * item.expectedUnitPrice, 0))) {
      throw new Error("Lần gửi đã lưu chưa hợp lệ");
    }
    const snapshot = record.cartSnapshot;
    if (snapshot !== undefined && (!Array.isArray(snapshot) || !snapshot.every(item => item &&
      Number.isSafeInteger(item.productId) && item.productId > 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0) ||
      new Set(snapshot.map(item => item.productId)).size !== snapshot.length ||
      !order.items.every(item => snapshot.some(saved => saved.productId === item.productId && saved.quantity === item.quantity)))) {
      throw new Error("Giỏ hàng của lần gửi đã lưu chưa hợp lệ");
    }
    reviewedOrder = order;
    reviewedCartSnapshot = new Map((snapshot ?? order.items).map(item => [item.productId, item.quantity]));
    reviewedCustomerContext = record.expectedCustomerId;
    orderPending = true;
    pendingOrderStored = true;
    catalogReady = false;
    cart = new Map(reviewedCartSnapshot);
    if (cartWorkspace) unselectedCartProducts = new Set([...cart.keys()].filter(id => !order.items.some(item => item.productId === id)));
    cartPersisted = false;
    cartReadFailed = false;
    products = new Map(order.items.map(item => [item.productId, {
      id: item.productId, name: item.expectedProductName,
      price: item.expectedUnitPrice, description: "", imageUrl: ""
    }]));
    if (checkoutForm) {
      for (const field of customerFields) field.value = "";
      paymentMethodField.value = order.paymentMethod ?? "COD";
      renderOrderReview();
      confirmButton.textContent = "Thử gửi lại";
      orderMessage.textContent = "Đã khôi phục lần gửi chưa có kết quả. Bấm Thử gửi lại để kiểm tra và hoàn tất đơn hàng.";
    } else {
      pendingOrderMessage.textContent = "Bạn có lần gửi đơn đang chờ kết quả. Mở giỏ hàng để kiểm tra và hoàn tất đơn này.";
      if (pendingCartLink) pendingCartLink.hidden = false;
    }
    productMessage.textContent = "Hãy hoàn tất lần gửi đang chờ trước khi mua tiếp.";
    productList?.setAttribute("aria-busy", "false");
  } catch {
    pendingOrderReadFailed = true;
    pendingOrderMessage.textContent = "Đọc lần gửi trước gặp lỗi. Hãy tra cứu đơn đã gửi bằng mã đơn và số điện thoại nếu bạn đã nhận mã đơn.";
  }
}

function saveCart() {
  cartReadFailed = false;
  let readWarning = "";
  try {
    const latest = readStoredCart();
    appliedReorderIds = [...new Set([...latest.appliedReorderIds, ...appliedReorderIds])];
    if (appliedReorderId === null) appliedReorderId = latest.appliedReorderId;
  } catch {
    readWarning = "Chưa đọc được dữ liệu giỏ cũ. Thao tác này lưu giỏ đang hiển thị. Hãy kiểm tra lại số lượng.";
  }
  try {
    const items = [...cart].map(([productId, quantity]) => ({ productId, quantity }));
    localStorage.setItem(storageKey, JSON.stringify({ version: 2, items, appliedReorderId, appliedReorderIds }));
    lastStoredCart = new Map(cart);
    cartPersisted = true;
    storageMessage.textContent = readWarning;
    try {
      localStorage.removeItem(legacyStorageKey);
    } catch {
      storageMessage.textContent = [readWarning, "Giỏ hàng đã lưu. Dọn dữ liệu giỏ hàng cũ gặp lỗi."].filter(Boolean).join(" ");
    }
    return true;
  } catch {
    cartPersisted = false;
    storageMessage.textContent = "Lưu giỏ hàng gặp lỗi. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt.";
    return false;
  }
}

function readStoredCart() {
  const saved = localStorage.getItem(storageKey);
  if (saved === null) {
    const quantity = Number(localStorage.getItem(legacyStorageKey));
    const legacy = Number.isSafeInteger(quantity) && quantity > 0;
    return { items: legacy ? [{ productId: 1, quantity }] : [],
      appliedReorderId: null, appliedReorderIds: [], legacy };
  }
  const record = JSON.parse(saved);
  const items = Array.isArray(record) ? record : record?.items;
  if (!Array.isArray(record) && (record?.version !== 2 ||
    !(record.appliedReorderId === null ||
      (typeof record.appliedReorderId === "string" && record.appliedReorderId.trim() !== "")))) {
    throw new Error("Định dạng giỏ hàng đã lưu chưa hợp lệ");
  }
  if (!Array.isArray(items) || !items.every(item => item &&
    Number.isSafeInteger(item.productId) && item.productId > 0 &&
    Number.isSafeInteger(item.quantity) && item.quantity > 0) ||
    new Set(items.map(item => item.productId)).size !== items.length) {
    throw new Error("Giỏ hàng đã lưu chưa hợp lệ");
  }
  const lastIntentId = Array.isArray(record) ? null : record.appliedReorderId;
  let intentIds = lastIntentId === null ? [] : [lastIntentId];
  if (!Array.isArray(record) && record.appliedReorderIds !== undefined) intentIds = record.appliedReorderIds;
  if (!Array.isArray(intentIds) || !intentIds.every(id => typeof id === "string" && id.trim() !== "") ||
    new Set(intentIds).size !== intentIds.length ||
    (lastIntentId !== null && !intentIds.includes(lastIntentId))) {
    throw new Error("Dấu nhận diện mua lại đã lưu chưa hợp lệ");
  }
  return { items, appliedReorderId: lastIntentId, appliedReorderIds: [...intentIds], legacy: false };
}

function applyStoredCart(record) {
  cart = new Map(record.items.map(item => [item.productId, item.quantity]));
  lastStoredCart = new Map(cart);
  appliedReorderId = record.appliedReorderId;
  appliedReorderIds = [...record.appliedReorderIds];
  cartPersisted = true;
  cartReadFailed = false;
}

function restoreCart() {
  try {
    const record = readStoredCart();
    applyStoredCart(record);
    if (record.legacy) saveCart();
    cartReadFailed = false;
    return true;
  } catch {
    cartPersisted = false;
    cartReadFailed = true;
    storageMessage.textContent = "Đọc giỏ hàng đã lưu gặp lỗi. Giỏ hàng mới sẽ được lưu khi bạn thêm sản phẩm.";
    return false;
  }
}

function cartSignature(items) {
  return JSON.stringify([...items].sort((left, right) => left[0] - right[0]));
}

function refreshPersistedCart() {
  if (!cartPersisted) return false;
  const previous = cartSignature(cart);
  if (!restoreCart()) return false;
  const changed = previous !== cartSignature(cart);
  if (changed) {
    clearOrderReview();
    cartMessage.textContent = "Giỏ hàng đã cập nhật từ tab khác. Hãy kiểm tra lại số lượng trước khi đặt hàng.";
  }
  return changed;
}

function refreshIdleCustomerState() {
  if (isSubmitting) return;
  if (orderPending && !pendingOrderStored) {
    updateControls();
    return;
  }
  restorePendingOrder();
  if (orderPending) {
    updateControls();
    return;
  }
  renderRecentOrders();
  refreshPersistedCart();
  renderCart();
  if (!catalogReady && !catalogLoading) void loadCatalog();
}

function finishSubmittedCart(submittedItems) {
  try {
    const latest = readStoredCart();
    const submitted = new Map(submittedItems.map(item => [item.productId, item.quantity]));
    const saved = new Map(latest.items.map(item => [item.productId, item.quantity]));
    applyStoredCart(latest);
    if (cartSignature(saved) !== cartSignature(reviewedCartSnapshot ?? submitted)) {
      return "Giỏ hiện tại đã thay đổi từ lúc gửi đơn và được giữ lại. Hãy kiểm tra giỏ trước khi mua tiếp.";
    }
    for (const [id, quantity] of submitted) {
      const remaining = (cart.get(id) ?? 0) - quantity;
      if (remaining > 0) cart.set(id, remaining);
      else cart.delete(id);
      unselectedCartProducts.delete(id);
    }
    saveCartSelection();
    saveCart();
    return "";
  } catch {
    cartPersisted = false;
    cartReadFailed = true;
    return "Chưa đọc được giỏ đã lưu nên giỏ đang hiển thị được giữ lại. Hãy kiểm tra mã đơn và giỏ hàng trước khi mua tiếp.";
  }
}

function importReorder() {
  if (orderPending || isSubmitting || !catalogReady) return;
  const { reorder, error } = window.ShopMemory?.readReorder?.() ?? {
    reorder: null, error: "Chưa tải được phần mua lại đơn. Hãy tải lại trang để thử nhận các mặt hàng đã chọn mua lại."
  };
  if (error) reorderMessage.textContent = error;
  if (!reorder) return;
  if ((cartPersisted || cartReadFailed) && !restoreCart()) {
    reorderMessage.textContent = "Chưa đọc được giỏ hàng mới nhất. Hãy tải lại trang để gộp đơn mua lại sau khi quyền lưu dữ liệu hoạt động.";
    return;
  }
  if (!appliedReorderIds.includes(reorder.intentId)) {
    const merged = new Map(cart);
    for (const item of reorder.items) {
      const quantity = (merged.get(item.productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity)) {
        reorderMessage.textContent = "Số lượng sau khi gộp đơn quá lớn. Hãy giảm số lượng trong giỏ rồi tải lại sản phẩm để thử gộp đơn.";
        return;
      }
      merged.set(item.productId, quantity);
    }
    if (!Number.isSafeInteger([...merged.values()].reduce((sum, quantity) => sum + quantity, 0))) {
      reorderMessage.textContent = "Tổng số lượng sau khi gộp đơn quá lớn. Hãy giảm số lượng trong giỏ rồi tải lại sản phẩm để thử gộp đơn.";
      return;
    }
    let mergedTotal = 0;
    for (const [id, quantity] of merged) {
      const product = products.get(id);
      if (!product) continue;
      const lineTotal = product.price * quantity;
      mergedTotal += lineTotal;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(mergedTotal)) {
        reorderMessage.textContent = "Tổng tiền sau khi gộp đơn quá lớn. Hãy giảm số lượng trong giỏ rồi tải lại sản phẩm để thử gộp đơn.";
        return;
      }
    }
    cart = merged;
    appliedReorderId = reorder.intentId;
    appliedReorderIds.push(reorder.intentId);
    cartPersisted = false;
    clearOrderReview();
  }
  if (!cartPersisted && !saveCart()) {
    reorderMessage.textContent = "Đã gộp các mặt hàng từ đơn " + reorder.orderId + " vào giỏ trên trang này. Trình duyệt chưa lưu được giỏ. Hãy giữ trang và kiểm tra số lượng trước khi đặt hàng.";
    return;
  }
  const consumed = window.ShopMemory.clearReorder(reorder.intentId);
  reorderMessage.textContent = "Đã gộp các mặt hàng từ đơn " + reorder.orderId +
    " vào giỏ hiện tại. Hãy kiểm tra giá, tồn kho và số lượng trước khi đặt hàng." +
    (consumed.error ? " " + consumed.error : "");
}

function clearOrderReview() {
  reviewedOrder = null;
  reviewedCartSnapshot = null;
  reviewedAccountId = null;
  reviewedCustomerContext = undefined;
  bankTransferReceipt = null;
  if (orderPreview) orderPreview.textContent = "";
  if (orderMessage) orderMessage.textContent = "";
  renderPaymentDetails();
  renderCheckoutVisuals();
}

function completeCheckoutProfile(account) {
  const digits = account.phone.replace(/\D/g, "");
  return account.name.trim() !== "" && account.name.length <= 120 &&
    account.phone.length <= 32 && /^[+\d() -]+$/.test(account.phone) &&
    digits.length >= 8 && digits.length <= 15 &&
    account.address.trim().length >= 5 && account.address.length <= 500;
}

function pendingContextMatches() {
  if (checkoutAccountChecking || !["guest", "member"].includes(checkoutAccountState)) return false;
  if (reviewedCustomerContext === undefined) return true;
  const currentContext = checkoutAccount ? String(checkoutAccount.id) : "guest";
  return reviewedCustomerContext === currentContext;
}

function renderCheckoutAccount() {
  if (!checkoutForm) return;
  const guest = checkoutAccountState === "guest";
  recipientFields.hidden = !guest || orderPending;
  recipientFields.disabled = !guest || orderPending || isSubmitting;
  const verified = !checkoutAccountChecking && ["guest", "member"].includes(checkoutAccountState);
  const pendingRecipientVisible = orderPending && reviewedCustomerContext !== undefined && pendingContextMatches();
  savedRecipient.hidden = orderPending ? !pendingRecipientVisible : !verified || checkoutAccountState !== "member";
  if (cartWorkspace) {
    const recipient = pendingRecipientVisible && reviewedOrder ? {
      name: reviewedOrder.customerName, phone: reviewedOrder.customerPhone, address: reviewedOrder.customerAddress
    } : !orderPending && verified ? checkoutAccount : null;
    document.getElementById("checkout-recipient-name").textContent = recipient?.name ?? "";
    document.getElementById("checkout-recipient-phone").textContent = recipient?.phone ?? "";
    document.getElementById("checkout-recipient-address").textContent = recipient?.address ?? "";
    const pendingLogin = document.getElementById("checkout-pending-login");
    pendingLogin.hidden = !orderPending || !verified || checkoutAccountState !== "guest" ||
      reviewedCustomerContext === undefined || reviewedCustomerContext === "guest";
    pendingLogin.href = "/dang-nhap.html?returnTo=" + encodeURIComponent("/dang-nhap.html?view=checkout");
  }
  checkoutAccountRetry.hidden = checkoutAccountState !== "error";
  checkoutAccountRetry.disabled = checkoutAccountChecking || isSubmitting;
  if (checkoutAccountChecking || checkoutAccountState === "loading") {
    checkoutAccountStatus.textContent = "Đang kiểm tra tài khoản...";
  } else if (checkoutAccountState === "error") {
    checkoutAccountStatus.textContent = "Chưa kiểm tra được tài khoản. Bấm Kiểm tra lại tài khoản trước khi đặt đơn mới.";
  } else if (orderPending && !pendingContextMatches()) {
    checkoutAccountStatus.textContent = reviewedCustomerContext === "guest"
      ? "Lần gửi này được tạo khi chưa đăng nhập. Hãy đăng xuất để tiếp tục kiểm tra cùng đơn hàng."
      : "Hãy đăng nhập đúng tài khoản đã tạo lần gửi đang chờ để kiểm tra kết quả. Mã lần gửi được giữ lại.";
  } else if (!orderPending && checkoutAccount && !completeCheckoutProfile(checkoutAccount)) {
    checkoutAccountStatus.textContent = "Hãy bổ sung số điện thoại và địa chỉ trong Tài khoản để đặt hàng.";
  } else {
    checkoutAccountStatus.textContent = "";
  }
}

function applyCheckoutAccount(account) {
  if (account) {
    const recipient = account.shippingAddress === undefined
      ? { recipientName: account.name, phone: account.phone, address: account.address }
      : account.shippingAddress;
    if (recipient !== null && (!recipient ||
      typeof recipient.recipientName !== "string" || typeof recipient.phone !== "string" ||
      typeof recipient.address !== "string")) throw new Error("Thông tin nhận hàng chưa hợp lệ");
    account = { id: account.id, email: account.email,
      name: recipient?.recipientName ?? "", phone: recipient?.phone ?? "", address: recipient?.address ?? "" };
  }
  const previous = checkoutAccount;
  const changed = JSON.stringify(previous) !== JSON.stringify(account);
  if (previous !== null || account !== null) {
    for (const field of customerFields) field.value = "";
  }
  checkoutAccount = account;
  checkoutAccountState = account === null ? "guest" : "member";
  if (changed && reviewedOrder && !orderPending && !isSubmitting) {
    clearOrderReview();
    orderMessage.textContent = cartWorkspace
      ? "Tài khoản hoặc thông tin nhận hàng đã thay đổi. Kiểm tra thông tin rồi bấm Xác nhận đơn hàng."
      : "Tài khoản hoặc thông tin nhận hàng đã thay đổi. Hãy bấm Xem lại đơn hàng.";
  }
  renderCheckoutAccount();
  if (reviewedOrder) renderOrderReview();
}

async function refreshCheckoutAccount() {
  if (!checkoutForm) return false;
  checkoutAccountController?.abort();
  const controller = new AbortController();
  checkoutAccountController = controller;
  checkoutAccountChecking = true;
  renderCheckoutAccount();
  updateControls();
  try {
    const response = await fetch("/api/account/me", {
      credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    });
    const account = response.status === 401 ? null : await response.json();
    if (!storefrontActive || checkoutAccountController !== controller) return false;
    if (response.status !== 401 && (response.status !== 200 || !response.ok || !account ||
      !Number.isSafeInteger(account.id) || account.id < 1 ||
      typeof account.name !== "string" || typeof account.email !== "string" ||
      typeof account.phone !== "string" || typeof account.address !== "string")) {
      throw new Error("Thông tin tài khoản chưa hợp lệ");
    }
    applyCheckoutAccount(account);
    return true;
  } catch {
    if (!storefrontActive || checkoutAccountController !== controller) return false;
    checkoutAccount = null;
    checkoutAccountState = "error";
    if (!orderPending && !isSubmitting) clearOrderReview();
    if (reviewedOrder) renderOrderReview();
    return false;
  } finally {
    if (checkoutAccountController === controller) {
      checkoutAccountController = null;
      checkoutAccountChecking = false;
      renderCheckoutAccount();
      updateControls();
    }
  }
}

checkoutAccountRetry?.addEventListener("click", () => {
  if (!isSubmitting && !checkoutAccountChecking) void refreshCheckoutAccount();
});

function cartTotals(items = cart) {
  let total = 0;
  let quantity = 0;
  let valid = catalogReady;
  for (const [id, count] of items) {
    quantity += count;
    const product = products.get(id);
    if (!product) {
      valid = false;
      continue;
    }
    total += product.price * count;
    if (!Number.isSafeInteger(product.price * count)) valid = false;
  }
  return { total, quantity, valid: valid && Number.isSafeInteger(total) && Number.isSafeInteger(quantity) };
}

function stockIssue(items = [...cart].map(([productId, quantity]) => ({ productId, quantity }))) {
  for (const item of items) {
    const product = products.get(item.productId);
    if (product?.stockTracked && item.quantity > product.stockQuantity) {
      return product.name + (product.stockQuantity === 0
        ? " đã hết hàng. Hãy xóa sản phẩm này khỏi giỏ để tiếp tục."
        : " chỉ còn " + product.stockQuantity + " " + productUnit(product) + ". Hãy giảm số lượng hoặc xóa sản phẩm để tiếp tục.");
    }
  }
  return "";
}

function canIncreaseQuantity(id, quantity = 1) {
  const product = products.get(id);
  const next = (cart.get(id) ?? 0) + quantity;
  const totals = cartTotals();
  return catalogReady && Boolean(product) && Number.isSafeInteger(quantity) && quantity > 0 &&
    Number.isSafeInteger(next) && Number.isSafeInteger(next * product.price) &&
    Number.isSafeInteger(totals.quantity + quantity) &&
    Number.isSafeInteger(totals.total + product.price * quantity) &&
    (!product.stockTracked || next <= product.stockQuantity);
}

function renderProductPreview(locked) {
  if (previewProductId === null) return;
  const product = products.get(previewProductId);
  productPreviewAdd.disabled = locked || !canIncreaseQuantity(previewProductId);
  if (!product) {
    productPreviewStock.textContent = "Sản phẩm hiện không còn trong danh mục.";
    return;
  }
  const quantity = cart.get(product.id) ?? 0;
  productPreviewTitle.textContent = product.name;
  productPreviewPrice.textContent = money.format(product.price);
  productPreviewDescription.textContent = product.description || "Cửa hàng đang cập nhật mô tả sản phẩm.";
  if (productPreviewCategory) productPreviewCategory.textContent = product.categoryName || "Sản phẩm";
  productPreviewStock.textContent = product.stockTracked
    ? product.stockQuantity === 0 ? "Hết hàng" : "Có thể thêm " + Math.max(0, product.stockQuantity - quantity) + " " + productUnit(product)
    : "Sẵn sàng đặt hàng";
  if (quantity > 0) productPreviewStock.textContent += " · Trong giỏ " + quantity + " " + productUnit(product);
}

function openProductPreview(product, opener) {
  if (!storefrontActive || !catalogReady || orderPending || isSubmitting || quickBuyNavigating || !products.has(product.id)) return;
  previewProductId = product.id;
  previewOpener = opener;
  productPreviewMessage.textContent = "";
  productPreviewImage.hidden = !product.imageUrl;
  productPreviewNoImage.hidden = Boolean(product.imageUrl);
  productPreviewImage.alt = product.name;
  if (product.imageUrl) productPreviewImage.src = product.imageUrl;
  else productPreviewImage.removeAttribute("src");
  updateControls();
  productPreviewDialog.showModal();
  document.body.classList.add("has-product-preview");
}

document.getElementById("product-preview-close")?.addEventListener("click", () => productPreviewDialog.close());
productPreviewDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  productPreviewDialog.close();
});
productPreviewDialog?.addEventListener("close", () => {
  const opener = previewOpener?.isConnected && !previewOpener.disabled
    ? previewOpener : document.getElementById(previewOpener?.id || "preview-" + previewProductId);
  previewProductId = null;
  previewOpener = null;
  document.body.classList.remove("has-product-preview");
  if (storefrontActive) (opener ?? productSearchField ?? document.getElementById("featured-products-title"))?.focus();
});
productPreviewDialog?.addEventListener("click", event => {
  if (event.target !== productPreviewDialog) return;
  const bounds = productPreviewDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom) productPreviewDialog.close();
});
productPreviewImage?.addEventListener("error", () => {
  productPreviewImage.hidden = true;
  productPreviewNoImage.hidden = false;
});
productPreviewAdd?.addEventListener("click", () => {
  const product = products.get(previewProductId);
  if (product && addProductToCart(product, productPreviewAdd, productPreviewImage)) {
    productPreviewMessage.textContent = cartPersisted
      ? "Đã thêm 1 " + product.name + " vào giỏ."
      : "Đã thêm vào giỏ trên trang này. Giỏ chưa lưu được, hãy kiểm tra quyền lưu dữ liệu trước khi chuyển trang.";
  }
});

function updateControls() {
  const locked = orderPending || isSubmitting || quickBuyNavigating || checkoutAccountChecking;
  const checkingCoupon = couponEditors.some(editor => editor.controller !== null);
  for (const editor of couponEditors) {
    editor.input.disabled = locked || checkingCoupon || !storefrontActive;
    editor.button.disabled = locked || checkingCoupon || !storefrontActive;
    editor.button.textContent = editor.controller ? "Đang kiểm tra…" : "Áp dụng";
    editor.form.setAttribute("aria-busy", String(editor.controller !== null));
  }
  const totals = cartTotals();
  const quantityText = Number.isSafeInteger(totals.quantity) ? String(totals.quantity) : "—";
  if (headerCartCount) {
    headerCartCount.textContent = quantityText;
    headerCartCount.hidden = totals.quantity === 0;
  }
  const pendingTotal = reviewedOrder?.items.reduce((sum, item) => sum + item.quantity * item.expectedUnitPrice, 0);
  if (headerCartTotal) {
    if (orderPending && Number.isSafeInteger(pendingTotal)) headerCartTotal.textContent = money.format(pendingTotal);
    else if (cartReadFailed || pendingOrderReadFailed) headerCartTotal.textContent = "Xem giỏ";
    else if (cart.size === 0) headerCartTotal.textContent = money.format(0);
    else headerCartTotal.textContent = totals.valid ? money.format(totals.total) : "Xem giỏ";
  }
  document.querySelector(".header-cart")?.setAttribute("aria-label",
    "Giỏ hàng, " + quantityText + " sản phẩm, " + (headerCartTotal?.textContent || "Xem giỏ"));
  renderProductPreview(locked);
  if (reloadCatalogButton) reloadCatalogButton.disabled = locked || catalogLoading;
  if (featuredProductList && reloadCatalogButton) {
    reloadCatalogButton.hidden = catalogLoading || orderPending || catalogReady;
  }
  for (const button of homeProductsRetryButtons) {
    button.disabled = locked || catalogLoading;
    button.hidden = catalogLoading || orderPending || catalogReady;
  }
  if (productList) {
    productList.setAttribute("aria-busy", String(catalogLoading || quickBuyNavigating));
    productSearchField.disabled = locked || !catalogReady;
    if (headerSearchSubmit) headerSearchSubmit.disabled = locked || !catalogReady;
    productSortField.disabled = locked || !catalogReady;
    if (catalogSearchField) catalogSearchField.disabled = locked || !catalogReady;
    if (priceFilter) priceFilter.disabled = locked || !catalogReady;
    if (brandFilter) brandFilter.disabled = locked || !catalogReady;
    if (favoritesOnlyFilter) favoritesOnlyFilter.disabled = locked || !catalogReady;
    if (availableOnlyFilter) availableOnlyFilter.disabled = locked || !catalogReady;
    if (clearCatalogFiltersButton) {
      clearCatalogFiltersButton.disabled = locked || !catalogReady ||
        !(productSearchField.value.trim() || productSortField.value !== "default" ||
          favoritesOnlyFilter?.checked || availableOnlyFilter?.checked ||
          priceFilter && priceFilter.value !== "all" || brandFilter && brandFilter.value !== "all");
    }
  }
  for (const catalogTarget of catalogTargets) {
    catalogTarget.setAttribute("aria-busy", String(catalogLoading || quickBuyNavigating));
    for (const button of catalogTarget.querySelectorAll("button")) {
      button.disabled = locked || !catalogReady ||
        (!["favorite", "preview"].includes(button.dataset.action) && !canIncreaseQuantity(Number(button.dataset.productId)));
      if (button.dataset.action === "add") {
        const product = products.get(Number(button.dataset.productId));
        const outOfStock = product?.stockTracked && product.stockQuantity === 0;
        button.textContent = outOfStock ? "Hết hàng" : "Thêm vào giỏ";
        button.setAttribute("aria-label", button.textContent + " · " + (product?.name || "Sản phẩm"));
      }
    }
  }
  for (const button of activeFilters?.querySelectorAll("button") ?? []) button.disabled = locked || !catalogReady;
  if (checkoutForm) {
    const selected = selectedCart();
    const selectedTotals = cartTotals(selected);
    quantityLabel.textContent = cartWorkspace ? String(selectedTotals.quantity) : quantityText;
    totalLabel.textContent = orderPending && Number.isSafeInteger(pendingTotal)
      ? money.format(pendingTotal) : selectedTotals.valid ? money.format(selectedTotals.total) : "—";
    if (cartSubtotalLabel) cartSubtotalLabel.textContent = totalLabel.textContent;
    clearButton.disabled = locked || cart.size === 0;
    const recipientReady = checkoutAccountState === "guest" ||
      (checkoutAccountState === "member" && completeCheckoutProfile(checkoutAccount));
    const selectedItems = [...selected].map(([productId, quantity]) => ({ productId, quantity }));
    const selectionValid = selectedTotals.valid && selected.size > 0 && stockIssue(selectedItems) === "";
    reviewButton.disabled = locked || checkingCoupon || !recipientReady || !selectionValid;
    if (cartWorkspace) {
      cartEmptyState.hidden = cart.size !== 0;
      cartFilledState.hidden = cart.size === 0;
      cartSelectAll.checked = selected.size === cart.size && cart.size > 0;
      cartSelectAll.indeterminate = selected.size > 0 && selected.size < cart.size;
      cartSelectAll.disabled = locked || cart.size === 0;
      removeSelectedButton.disabled = locked || selected.size === 0;
      removeSelectedButton.textContent = "Xóa đã chọn" + (selected.size ? " (" + selected.size + ")" : "");
      document.getElementById("cart-selection-count").textContent = "· " + cart.size + " sản phẩm";
      document.getElementById("cart-selected-lines").textContent = String(selected.size);
      document.getElementById("cart-lines").textContent = String(cart.size);
      cartContinueButton.disabled = orderPending ? isSubmitting || checkoutAccountChecking : locked || checkingCoupon || !selectionValid;
      cartContinueButton.textContent = orderPending ? "Kiểm tra lần đặt hàng đang chờ →" : "Tạo đơn hàng →";
      for (const checkbox of cartItems.querySelectorAll('input[type="checkbox"]')) checkbox.disabled = locked;
      if (checkoutBackLink) {
        checkoutBackLink.hidden = currentReceipt !== null;
        checkoutBackLink.setAttribute("aria-disabled", String(isSubmitting));
        checkoutBackLink.tabIndex = isSubmitting ? -1 : 0;
      }
      reviewButton.hidden = reviewedOrder !== null || currentReceipt !== null;
      renderCheckoutVisuals();
    }
    for (const field of customerFields) field.readOnly = locked;
    paymentMethodField.disabled = locked;
    for (const button of cartItems.querySelectorAll("button")) {
      button.disabled = locked || (button.dataset.action === "increase" &&
        !canIncreaseQuantity(Number(button.dataset.productId)));
    }
    if (cartRemoveConfirm) cartRemoveConfirm.disabled = locked;
    confirmButton.hidden = reviewedOrder === null;
    confirmButton.disabled = reviewedOrder === null || isSubmitting || checkingCoupon ||
      (orderPending ? !pendingContextMatches() : checkoutAccountChecking || !recipientReady);
    checkoutForm.setAttribute("aria-busy", String(isSubmitting || checkoutAccountChecking));
    renderCheckoutAccount();
    renderPaymentDetails();
  }
  window.dispatchEvent(new CustomEvent("shop-cart-change", {
    detail: { ready: catalogReady, loading: catalogLoading, persisted: cartPersisted, locked }
  }));
}

function refreshQuantityCart() {
  if (cartPersisted) {
    refreshPersistedCart();
    return !cartReadFailed;
  }
  try {
    const previousCart = cartSignature(cart);
    const latest = readStoredCart();
    const stored = new Map(latest.items.map(item => [item.productId, item.quantity]));
    const merged = new Map(stored);
    for (const id of new Set([...lastStoredCart.keys(), ...cart.keys()])) {
      const previous = lastStoredCart.get(id);
      const current = cart.get(id);
      const saved = stored.get(id);
      if (current === previous || (saved !== previous && saved !== current)) continue;
      if (current === undefined) merged.delete(id);
      else merged.set(id, current);
    }
    cart = merged;
    lastStoredCart = stored;
    cartReadFailed = false;
    if (previousCart !== cartSignature(cart)) {
      clearOrderReview();
      cartMessage.textContent = "Giỏ hàng đã cập nhật từ tab khác. Hãy xem lại đơn hàng trước khi xác nhận.";
    }
    return true;
  } catch {
    cartReadFailed = true;
    storageMessage.textContent = "Chưa đọc được giỏ hàng đã lưu. Hãy kiểm tra quyền lưu dữ liệu rồi thử chỉnh số lượng lại.";
    return false;
  }
}

function focusCartQuantity(id, action = "decrease") {
  const target = [document.getElementById("cart-" + id + "-" + action),
    document.getElementById("cart-" + id + "-decrease"), clearButton, reloadCatalogButton]
    .find(button => button && !button.disabled);
  target?.focus();
}

function finishCartRemoval(remove) {
  const id = removingCartProductId;
  const quantity = removingCartQuantity;
  removingCartProductId = null;
  removingCartQuantity = null;
  if (cartRemoveDialog.open) cartRemoveDialog.close();
  if (id === null || !storefrontActive) return;
  if (remove) {
    changeQuantity(id, "remove", quantity);
    return;
  }
  if (!orderPending && !isSubmitting && refreshQuantityCart() && !cartPersisted) saveCart();
  renderCart();
  focusCartQuantity(id);
}

cartRemoveCancel?.addEventListener("click", () => finishCartRemoval(false));
cartRemoveConfirm?.addEventListener("click", () => finishCartRemoval(true));
cartRemoveDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  finishCartRemoval(false);
});
cartRemoveDialog?.addEventListener("close", () => {
  if (removingCartProductId !== null && !cartRemoveDialog.open) finishCartRemoval(false);
});

function changeQuantity(id, action, expectedQuantity = null) {
  if (orderPending || isSubmitting || checkoutAccountChecking || !storefrontActive || cartRemoveDialog?.open) return;
  if (!refreshQuantityCart()) {
    renderCart();
    focusCartQuantity(id, action);
    return;
  }
  const current = cart.get(id);
  if (current === undefined) {
    renderCart();
    focusCartQuantity(id, action);
    return;
  }
  if ((action === "decrease" && current === 1) || action === "delete") {
    removingCartProductId = id;
    removingCartQuantity = current;
    const name = products.get(id)?.name ?? "Sản phẩm #" + id;
    cartRemoveDescription.textContent = "Bạn có muốn xoá " + name + " khỏi giỏ hàng?";
    cartRemoveDialog.showModal();
    cartRemoveCancel.focus();
    return;
  }
  if (action === "remove" && current !== (expectedQuantity ?? 1)) {
    cartMessage.textContent = "Số lượng sản phẩm đã thay đổi ở tab khác. Hãy kiểm tra giỏ hàng và bấm giảm lại nếu muốn xoá.";
    renderCart();
    focusCartQuantity(id);
    return;
  }
  const next = action === "increase" ? current + 1 : action === "decrease" ? current - 1 : 0;
  if (!Number.isSafeInteger(next)) return;
  if (next > (cart.get(id) ?? 0) && !canIncreaseQuantity(id)) {
    renderCart();
    return;
  }
  if (next === 0) {
    cart.delete(id);
    unselectedCartProducts.delete(id);
    saveCartSelection();
  }
  else cart.set(id, next);
  clearOrderReview();
  cartMessage.textContent = "Đã cập nhật giỏ hàng.";
  saveCart();
  renderCart();
  focusCartQuantity(id, action);
}

function cartAction(id, text, action, name) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "cart-" + id + "-" + action;
  button.textContent = text;
  button.dataset.productId = String(id);
  button.dataset.action = action;
  button.className = "cart-quantity-button";
  button.setAttribute("aria-label", (action === "increase" ? "Tăng số lượng " : "Giảm số lượng ") + name);
  button.addEventListener("click", () => changeQuantity(id, action));
  return button;
}

function renderCart() {
  if (!cartItems) {
    updateControls();
    return;
  }
  const fragment = document.createDocumentFragment();
  if (cart.size === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Giỏ hàng đang trống. Hãy chọn sản phẩm để bắt đầu.";
    fragment.append(empty);
  }
  for (const [id, quantity] of cart) {
    const product = products.get(id);
    const name = product?.name ?? "Sản phẩm #" + id;
    const row = document.createElement("article");
    row.className = "cart-item";
    if (cartWorkspace) {
      const selectLabel = document.createElement("label");
      selectLabel.className = "account-cart-item-select";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "cart-" + id + "-selected";
      checkbox.checked = !unselectedCartProducts.has(id);
      checkbox.setAttribute("aria-label", "Chọn " + name);
      checkbox.addEventListener("change", () => {
        if (orderPending || isSubmitting) return;
        if (checkbox.checked) unselectedCartProducts.delete(id);
        else unselectedCartProducts.add(id);
        saveCartSelection();
        clearOrderReview();
        updateControls();
      });
      selectLabel.append(checkbox);
      row.append(selectLabel);
    }
    const media = document.createElement("div");
    media.className = "cart-item-media";
    const fallback = document.createElement("span");
    fallback.className = "cart-item-image-fallback";
    fallback.textContent = "Chưa có ảnh";
    if (product?.imageUrl && validImageUrl(product.imageUrl)) {
      const image = document.createElement("img");
      image.className = "cart-item-image";
      image.src = product.imageUrl;
      image.alt = name;
      image.width = 96;
      image.height = 96;
      image.loading = "lazy";
      image.decoding = "async";
      fallback.hidden = true;
      image.addEventListener("error", () => {
        image.hidden = true;
        fallback.hidden = false;
      });
      media.append(image);
    }
    media.append(fallback);
    const content = document.createElement("div");
    content.className = "cart-item-content";
    const heading = document.createElement("h3");
    heading.textContent = name;
    const detail = document.createElement("p");
    detail.className = "cart-item-detail";
    detail.textContent = product
      ? money.format(product.price) + "/" + productUnit(product) + " · " + quantity + " " + productUnit(product)
      : quantity + " sản phẩm · " + (catalogReady ? "Sản phẩm đã ẩn hoặc ngừng bán. Hãy xóa để tiếp tục." : "Đang chờ thông tin sản phẩm.");
    if (product?.stockTracked) {
      const remaining = Math.max(0, product.stockQuantity - quantity);
      detail.textContent += product.stockQuantity === 0 ? " · Hết hàng" : " · Còn " + remaining + " " + productUnit(product) + " có thể thêm";
    }
    const actions = document.createElement("div");
    actions.className = "cart-quantity-control";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", "Số lượng " + name);
    const count = document.createElement("span");
    count.id = "cart-" + id + "-quantity";
    count.className = "cart-quantity-value";
    count.textContent = String(quantity);
    actions.append(cartAction(id, "−", "decrease", name), count, cartAction(id, "+", "increase", name));
    if (cartWorkspace) {
      const bottom = document.createElement("div");
      bottom.className = "account-cart-item-bottom";
      const price = document.createElement("strong");
      price.className = "account-cart-line-price";
      const total = product ? product.price * quantity : null;
      price.textContent = Number.isSafeInteger(total) ? money.format(total) : "—";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.id = "cart-" + id + "-delete";
      remove.className = "account-cart-delete-item";
      remove.setAttribute("aria-label", "Xóa " + name + " khỏi giỏ");
      remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
      remove.addEventListener("click", () => changeQuantity(id, "delete"));
      bottom.append(actions, price, remove);
      content.append(heading, detail, bottom);
    } else {
      content.append(heading, detail, actions);
    }
    row.append(media, content);
    fragment.append(row);
  }
  cartItems.replaceChildren(fragment);
  const totals = cartTotals();
  const availabilityMessage = catalogReady ? stockIssue() : "";
  if (availabilityMessage) {
    cartMessage.textContent = availabilityMessage;
  } else if (catalogReady && !totals.valid && [...cart.keys()].every(id => products.has(id))) {
    cartMessage.textContent = "Số lượng hoặc tổng tiền quá lớn. Hãy giảm số lượng để tiếp tục.";
  }
  updateControls();
}

function renderCheckoutVisuals() {
  if (!checkoutReviewItems) return;
  document.getElementById("checkout-total-title").textContent = currentReceipt && !reviewedOrder
    ? currentReceipt.status === "CANCELLED" ? "Đơn hàng đã hủy" : "Đặt hàng thành công"
    : "Đơn hàng của bạn";
  const items = reviewedOrder?.items ?? currentReceiptItems ?? [...selectedCart()].map(([productId, quantity]) => ({
    productId, quantity, expectedUnitPrice: products.get(productId)?.price,
    expectedProductName: products.get(productId)?.name ?? "Sản phẩm #" + productId
  }));
  const fragment = document.createDocumentFragment();
  let total = 0;
  let validTotal = true;
  let quantity = 0;
  for (const item of items) {
    const product = products.get(item.productId);
    const row = document.createElement("article");
    row.className = "account-checkout-item";
    const media = document.createElement("div");
    media.className = "account-checkout-item-media";
    const fallback = document.createElement("span");
    fallback.textContent = "Chưa có ảnh";
    media.append(fallback);
    if (product?.imageUrl && validImageUrl(product.imageUrl)) {
      const image = document.createElement("img");
      image.src = product.imageUrl;
      image.alt = "";
      image.width = 68;
      image.height = 80;
      image.loading = "lazy";
      image.decoding = "async";
      fallback.hidden = true;
      image.addEventListener("error", () => { image.hidden = true; fallback.hidden = false; });
      media.append(image);
    }
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.expectedProductName;
    const detail = document.createElement("p");
    detail.textContent = "Số lượng " + item.quantity + (Number.isSafeInteger(item.expectedUnitPrice)
      ? " · " + money.format(item.expectedUnitPrice) + "/" + productUnit(product) : " · Đang cập nhật giá");
    const price = document.createElement("strong");
    const lineTotal = item.quantity * item.expectedUnitPrice;
    price.textContent = Number.isSafeInteger(lineTotal) ? money.format(lineTotal) : "—";
    total += lineTotal;
    quantity += item.quantity;
    validTotal = validTotal && Number.isSafeInteger(lineTotal) && Number.isSafeInteger(total);
    content.append(title, detail, price);
    row.append(media, content);
    fragment.append(row);
  }
  if (items.length === 0 && currentReceipt === null) {
    const empty = document.createElement("p");
    empty.className = "account-checkout-products-note";
    empty.textContent = "Bạn chưa chọn sản phẩm nào. Quay lại giỏ hàng để chọn sản phẩm muốn mua.";
    fragment.append(empty);
  }
  checkoutReviewItems.replaceChildren(fragment);
  document.getElementById("checkout-item-count").textContent = items.length + " sản phẩm · " + quantity + " món";
  if (checkoutSelectedQuantity) checkoutSelectedQuantity.textContent = String(quantity);
  const shownTotal = currentReceipt && !reviewedOrder ? money.format(currentReceipt.total)
    : validTotal && (catalogReady || orderPending || items.length === 0) ? money.format(total) : "—";
  document.getElementById("checkout-subtotal").textContent = shownTotal;
  document.getElementById("checkout-total").textContent = shownTotal;
  document.getElementById("checkout-payment-label").textContent = paymentLabel(reviewedOrder?.paymentMethod ?? currentReceipt?.paymentMethod ?? paymentMethodField.value);
}

function rememberCatalogFilters() {
  if (!catalogPage || !catalogReady) return;
  const url = new URL(window.location.href);
  const scope = favoritesOnlyFilter?.checked
    ? availableOnlyFilter?.checked ? "favorites-available" : "favorites"
    : availableOnlyFilter?.checked ? "available" : "all";
  const values = { q: productSearchField?.value.trim() || "", scope, price: priceFilter?.value || "all",
    brand: brandFilter?.value || "all", sort: productSortField?.value || "default" };
  for (const [key, value] of Object.entries(values)) {
    if (!value || value === "all" || value === "default") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

function renderBrandOptions() {
  if (!brandFilter) return;
  const selected = requestedCatalogBrand ?? brandFilter.value;
  const enabled = catalogCategories && new Set(catalogCategories.map(category => category.id));
  const brands = [...new Set([...products.values()].filter(product => !enabled || enabled.has(product.categoryId))
    .map(product => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  const options = [new Option("Tất cả thương hiệu", "all"), ...brands.map(brand => new Option(brand, brand))];
  brandFilter.replaceChildren(...options);
  brandFilter.value = brands.includes(selected) ? selected : "all";
  requestedCatalogBrand = null;
}

function matchesPrice(product) {
  switch (priceFilter?.value) {
    case "under-50000": return product.price < 50000;
    case "50000-100000": return product.price >= 50000 && product.price <= 100000;
    case "over-100000": return product.price > 100000;
    default: return true;
  }
}

function renderProductCards(target, displayedProducts, singleFeatured = false) {
  const fragment = document.createDocumentFragment();
  for (const product of displayedProducts) {
    const card = document.createElement("article");
    card.className = singleFeatured && product.imageUrl
      ? "product product-featured" : "product";
    card.dataset.productId = String(product.id);
    if (product.imageUrl) {
      const image = document.createElement("img");
      image.className = "product-image";
      image.src = product.imageUrl;
      image.alt = product.name;
      image.width = 640;
      image.height = 480;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.hidden = true;
        card.className = "product";
      });
      const imageLink = document.createElement("a");
      imageLink.href = "/chi-tiet-san-pham.html?id=" + product.id;
      imageLink.className = "product-image-link";
      imageLink.setAttribute("aria-label", "Xem chi tiết " + product.name);
      imageLink.addEventListener("click", event => prepareNavigation(event, imageLink));
      image.addEventListener("error", () => { imageLink.hidden = true; });
      imageLink.append(image);
      card.append(imageLink);
    }
    const heading = document.createElement("h3");
    const detailLink = document.createElement("a");
    detailLink.href = "/chi-tiet-san-pham.html?id=" + product.id;
    detailLink.className = "product-title-link";
    detailLink.textContent = product.name;
    detailLink.addEventListener("click", event => prepareNavigation(event, detailLink));
    heading.append(detailLink);
    const price = document.createElement("p");
    price.className = "price";
    price.textContent = money.format(product.price);
    const hasReviews = product.reviewCount > 0 && product.ratingAverage !== null;
    const ratingAverage = hasReviews ? product.ratingAverage : 0;
    const ratingText = hasReviews
      ? ratingAverage.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "—";
    const ratingLabel = hasReviews
      ? ratingText + " trên 5 sao từ " + product.reviewCount.toLocaleString("vi-VN") + " đánh giá"
      : "Chưa có đánh giá";
    const ratingLink = document.createElement("a");
    ratingLink.className = "product-rating-row";
    ratingLink.href = "/chi-tiet-san-pham.html?id=" + product.id + "#reviews";
    ratingLink.setAttribute("aria-label", ratingLabel + " · " + product.name);
    ratingLink.title = ratingLabel;
    ratingLink.addEventListener("click", event => prepareNavigation(event, ratingLink));
    const stars = document.createElement("span");
    stars.className = "product-rating-stars";
    stars.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 5; index += 1) {
      const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      star.classList.add("product-rating-star");
      star.setAttribute("viewBox", "0 0 24 24");
      star.setAttribute("focusable", "false");
      const fillPercent = Math.round(Math.max(0, Math.min(1, ratingAverage - index)) * 100);
      star.style.setProperty("--star-fill", fillPercent + "%");
      for (const layer of ["fill", "outline"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("product-rating-star-" + layer);
        path.setAttribute("d", "m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z");
        star.append(path);
      }
      stars.append(star);
    }
    const ratingValue = document.createElement("span");
    ratingValue.className = "product-rating-value";
    ratingValue.setAttribute("aria-hidden", "true");
    ratingValue.textContent = ratingText;
    ratingLink.append(stars, ratingValue);
    card.append(heading, ratingLink, price);
    if (product.description) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Mô tả sản phẩm";
      const description = document.createElement("p");
      description.className = "product-description";
      description.textContent = product.description;
      details.append(summary, description);
      card.append(details);
    }
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.dataset.productId = String(product.id);
    addButton.dataset.action = "add";
    addButton.textContent = "Thêm vào giỏ";
    addButton.setAttribute("aria-label", "Thêm vào giỏ · " + product.name);
    addButton.addEventListener("click", () => addProductToCart(product, addButton));
    const salesMeter = document.createElement("div");
    salesMeter.className = "product-sales-meter";
    const salesFill = document.createElement("span");
    salesFill.className = "product-sales-meter-fill";
    salesFill.setAttribute("aria-hidden", "true");
    const flame = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    flame.classList.add("product-sales-meter-flame");
    flame.setAttribute("viewBox", "0 0 24 24");
    flame.setAttribute("aria-hidden", "true");
    for (const d of [
      "M13 2c1 5-3 5-1 9 2-1 3-3 3-5 4 4 6 7 5 11-1 4-4 5-8 5-5 0-8-3-8-7 0-4 4-6 5-10 0 3 1 4 2 5 0-4 1-6 2-8Z",
      "M12 12c1 3-2 3-2 6 0 2 1 3 3 3s4-2 3-4c0-1-1-2-2-3 0 2-1 3-2 3 0-1 1-3 0-5Z"
    ]) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      flame.append(path);
    }
    const salesLabel = document.createElement("span");
    salesLabel.className = "product-sales-meter-label";
    salesLabel.textContent = "Đã bán " + product.soldCount.toLocaleString("vi-VN");
    salesMeter.title = salesLabel.textContent;
    salesMeter.append(salesFill, flame, salesLabel);
    const actions = document.createElement("div");
    actions.className = "product-actions";
    actions.append(salesMeter, addButton);
    card.append(actions);
    fragment.append(card);
  }
  target.replaceChildren(fragment);
}

function renderCatalog() {
  if (catalogTargets.length === 0) return;
  if (catalogSearchField) catalogSearchField.value = productSearchField?.value || "";
  const query = normalizeSearch(productSearchField?.value.trim() ?? "");
  const selectedCategory = catalogCategories && window.ShopCategories?.isCategoryPage
    ? window.ShopCategories.currentCategory(catalogCategories) : null;
  const visibleCategoryIds = catalogCategories ? new Set(catalogCategories.map(category => category.id)) : null;
  const categoryProducts = [...products.values()].filter(product =>
    (!visibleCategoryIds || visibleCategoryIds.has(product.categoryId)) &&
    (!window.ShopCategories?.isCategoryPage || product.categoryId === selectedCategory?.id));
  const visibleProducts = categoryProducts.filter(product =>
    normalizeSearch(product.name + " " + product.description).includes(query) &&
    matchesPrice(product) && (!brandFilter || brandFilter.value === "all" || product.brand === brandFilter.value) &&
    (!favoritesOnlyFilter?.checked || favoriteProducts.has(product.id)) &&
    (!availableOnlyFilter?.checked || !product.stockTracked || product.stockQuantity > 0));
  const sorters = {
    "price-asc": (a, b) => a.price - b.price || a.id - b.id,
    "price-desc": (a, b) => b.price - a.price || a.id - b.id,
    name: (a, b) => a.name.localeCompare(b.name, "vi") || a.id - b.id,
    oldest: (a, b) => a.id - b.id,
    default: (a, b) => catalogPage ? b.id - a.id : a.id - b.id
  };
  const sort = productSortField?.value ?? "default";
  const sorter = Object.hasOwn(sorters, sort) ? sorters[sort] : sorters.default;
  visibleProducts.sort(sorter);
  if (productList) renderProductCards(productList, visibleProducts, !catalogPage && visibleProducts.length === 1);
  for (const section of homeProductSections) {
    const settings = homeProductSettings?.get(section.kind);
    if (!settings?.enabled) {
      section.list.replaceChildren();
      if (section.message) section.message.textContent = "";
      continue;
    }
    const available = new Map(categoryProducts.map(product => [product.id, product]));
    const ordered = settings.mode === "manual"
      ? settings.productIds.map(id => available.get(id)).filter(Boolean)
      : section.kind === "best-selling"
      ? categoryProducts.filter(product => product.soldCount > 0)
        .sort((a, b) => b.soldCount - a.soldCount || b.id - a.id)
      : section.kind === "latest" ? [...categoryProducts].sort((a, b) => b.id - a.id) : visibleProducts;
    renderProductCards(section.list, ordered.slice(0, settings.limit));
    if (section.message) section.message.textContent = ordered.length ? ""
      : settings.mode === "manual" ? "Mục này đang được cập nhật sản phẩm."
      : section.kind === "best-selling" && categoryProducts.length > 0
        ? "Sản phẩm bán chạy sẽ xuất hiện khi có đơn hàng hoàn thành."
        : "Cửa hàng đang cập nhật sản phẩm. Bạn hãy quay lại sau.";
  }
  if (homeProductSections.length > 0) productMessage.textContent = "";
  if (catalogResults) {
    if (categoryProducts.length === 0) catalogResults.textContent = window.ShopCategories?.isCategoryPage && !selectedCategory
      ? "Danh mục này hiện chưa được hiển thị. Hãy chọn danh mục khác trong Danh mục."
      : "Cửa hàng đang cập nhật sản phẩm cho danh mục này.";
    else if (visibleProducts.length === 0) catalogResults.textContent = favoritesOnlyFilter?.checked && favoriteProducts.size === 0
      ? "Bạn chưa lưu sản phẩm yêu thích. Hãy tắt bộ lọc yêu thích để chọn sản phẩm."
      : "Chưa tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác hoặc xóa bộ lọc.";
    else catalogResults.textContent = "Hiển thị " + visibleProducts.length + "/" + categoryProducts.length + " sản phẩm.";
    if (catalogPage) {
      const empty = document.getElementById("catalog-empty-state");
      if (empty) {
        empty.textContent = visibleProducts.length ? "" : catalogResults.textContent;
        empty.hidden = visibleProducts.length > 0 || !catalogReady;
      }
      catalogResults.textContent = visibleProducts.length + " sản phẩm";
    }
  }
  rememberCatalogFilters();
  window.ShopCategories?.renderCatalogCounts?.([...products.values()]);
  renderActiveFilters();
  updateControls();
}

function renderActiveFilters() {
  if (!activeFilters) return;
  const fragment = document.createDocumentFragment();
  function addFilter(label, clear) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip button-secondary";
    button.textContent = label;
    button.setAttribute("aria-label", "Bỏ bộ lọc " + label);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m6 6 12 12M6 18 18 6");
    icon.append(path);
    button.append(icon);
    button.addEventListener("click", () => {
      if (!catalogReady || orderPending || isSubmitting || quickBuyNavigating) return;
      clear();
      renderCatalog();
      (activeFilters.querySelector("button") ?? productSearchField)?.focus();
    });
    fragment.append(button);
  }
  const query = productSearchField.value.trim();
  if (query) addFilter("Tìm “" + query + "”", () => { productSearchField.value = ""; });
  if (favoritesOnlyFilter?.checked) addFilter("Yêu thích", () => { favoritesOnlyFilter.checked = false; });
  if (availableOnlyFilter?.checked) addFilter("Còn hàng", () => { availableOnlyFilter.checked = false; });
  if (priceFilter && priceFilter.value !== "all") {
    addFilter(priceFilter.selectedOptions[0].textContent, () => { priceFilter.value = "all"; });
  }
  if (brandFilter && brandFilter.value !== "all") {
    addFilter("Thương hiệu " + brandFilter.value, () => { brandFilter.value = "all"; });
  }
  if (productSortField.value !== "default") {
    const label = productSortField.selectedOptions[0]?.textContent ?? "Sắp xếp";
    addFilter(label, () => { productSortField.value = "default"; });
  }
  activeFilters.replaceChildren(fragment);
  activeFilters.hidden = activeFilters.childElementCount === 0;
}

function searchCatalog({ query, scope, scroll = true }) {
  if (!productList || orderPending || isSubmitting || quickBuyNavigating || !storefrontActive) return false;
  productSearchField.value = query.trim();
  if (scope !== undefined) {
    if (favoritesOnlyFilter) favoritesOnlyFilter.checked = ["favorites", "favorites-available"].includes(scope);
    if (availableOnlyFilter) availableOnlyFilter.checked = ["available", "favorites-available"].includes(scope);
  }
  renderCatalog();
  if (scroll) document.getElementById("catalog")?.scrollIntoView({ block: "start" });
  return true;
}

function addProductToCart(product, source = null, image = null, quantity = 1) {
  if (orderPending || isSubmitting || quickBuyNavigating || checkoutAccountChecking || !storefrontActive) return false;
  refreshPersistedCart();
  if (!canIncreaseQuantity(product.id, quantity)) {
    cartMessage.textContent = "Kiểm tra số lượng sản phẩm và số lượng còn có thể thêm vào giỏ.";
    renderCart();
    return false;
  }
  const next = (cart.get(product.id) ?? 0) + quantity;
  if (!Number.isSafeInteger(next)) return false;
  cart.set(product.id, next);
  clearOrderReview();
  cartMessage.textContent = "Đã thêm " + product.name + " vào giỏ.";
  saveCart();
  renderCart();
  if (source) {
    try {
      window.ShopCartFeedback?.added({ product, source, image, quantity });
    } catch {
      // Cart updates remain successful when visual feedback is unavailable.
    }
  }
  return true;
}

function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

productSearchField?.addEventListener("input", () => {
  if (!catalogReady || orderPending || isSubmitting) return;
  renderCatalog();
});

catalogSearchField?.addEventListener("input", () => {
  if (!catalogReady || orderPending || isSubmitting) return;
  productSearchField.value = catalogSearchField.value;
  renderCatalog();
});

document.getElementById("catalog-filter-form")?.addEventListener("submit", event => {
  event.preventDefault();
  if (catalogReady && !orderPending && !isSubmitting) renderCatalog();
});

productSortField?.addEventListener("change", () => {
  if (!catalogReady || orderPending || isSubmitting) return;
  renderCatalog();
});

for (const filter of [favoritesOnlyFilter, availableOnlyFilter, priceFilter, brandFilter]) {
  filter?.addEventListener("change", () => {
    if (!catalogReady || orderPending || isSubmitting) return;
    renderCatalog();
  });
}

clearCatalogFiltersButton?.addEventListener("click", () => {
  if (!catalogReady || orderPending || isSubmitting) return;
  productSearchField.value = "";
  productSortField.value = "default";
  if (favoritesOnlyFilter) favoritesOnlyFilter.checked = false;
  if (availableOnlyFilter) availableOnlyFilter.checked = false;
  if (priceFilter) priceFilter.value = "all";
  if (brandFilter) brandFilter.value = "all";
  renderCatalog();
  productSearchField.focus();
});

function validImageUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string" || value.includes("\\")) return false;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) &&
      ((value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value));
  } catch {
    return false;
  }
}

function renderCatalogSkeleton() {
  for (const target of catalogTargets) {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 4; index += 1) {
      const card = document.createElement("article");
      card.className = "product product-skeleton";
      card.setAttribute("aria-hidden", "true");
      for (const className of ["skeleton-media", "skeleton-line", "skeleton-line skeleton-line-short"]) {
        const placeholder = document.createElement("div");
        placeholder.className = className;
        card.append(placeholder);
      }
      fragment.append(card);
    }
    target.replaceChildren(fragment);
  }
}

function validateHomeProductSettings(items) {
  const keys = new Set(homeProductSections.map(section => section.kind));
  if (!Array.isArray(items) || items.length !== keys.size ||
    !items.every(item => item && keys.has(item.key) &&
      typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 120 &&
      typeof item.subtitle === "string" && item.subtitle.length <= 240 &&
      typeof item.enabled === "boolean" && ["auto", "manual"].includes(item.mode) &&
      Number.isSafeInteger(item.limit) && item.limit >= 1 && item.limit <= 12 &&
      Array.isArray(item.productIds) && item.productIds.length <= 12 &&
      item.productIds.every(id => Number.isSafeInteger(id) && id > 0) &&
      new Set(item.productIds).size === item.productIds.length &&
      (item.mode !== "auto" || item.productIds.length === 0)) ||
    new Set(items.map(item => item.key)).size !== items.length) {
    throw new Error("Cấu hình sản phẩm trang chủ chưa hợp lệ.");
  }
  return new Map(items.map(item => [item.key, item]));
}

function updateHomeProductPresentation() {
  for (const section of homeProductSections) {
    const settings = homeProductSettings?.get(section.kind);
    const panel = section.list.closest("section");
    const band = section.list.closest("[data-home-product-section]");
    const divider = document.querySelector('[data-home-product-divider="' + section.kind + '"]');
    if (band) band.hidden = !settings?.enabled;
    if (divider) divider.hidden = !settings?.enabled;
    if (!settings) continue;
    const heading = panel?.querySelector("h2");
    const subtitle = panel?.querySelector(".home-panel-subtitle");
    if (heading) heading.textContent = settings.title;
    if (subtitle) {
      subtitle.textContent = settings.subtitle;
      subtitle.hidden = settings.subtitle.trim() === "";
    }
  }
}

async function loadCatalog() {
  if (catalogLoading || orderPending || isSubmitting) return;
  catalogLoading = true;
  catalogReady = false;
  homeProductSettings = null;
  updateHomeProductPresentation();
  productMessage.textContent = productList || featuredProductList || checkoutForm ? "Đang tải sản phẩm..." : "";
  for (const section of homeProductSections) {
    if (section.message) section.message.textContent = "Đang tải sản phẩm...";
  }
  renderCatalogSkeleton();
  const empty = document.getElementById("catalog-empty-state");
  if (empty) empty.hidden = true;
  updateControls();
  try {
    const [response, categories, sectionsResponse] = await Promise.all([
      fetch("/api/products", { cache: "no-store", signal: AbortSignal.timeout(15000) }),
      (productList || featuredProductList) && window.ShopCategories ? window.ShopCategories.load({ refresh: catalogCategories !== null }) : null,
      homeProductSections.length > 0 ? fetch("/api/home-sections", { cache: "no-store", signal: AbortSignal.timeout(15000) }) : null
    ]);
    const result = await response.json();
    let sectionSettings = null;
    if (sectionsResponse) {
      if (!sectionsResponse.ok) throw new Error("Chưa tải được cấu hình trang chủ.");
      sectionSettings = validateHomeProductSettings(await sectionsResponse.json());
    }
    if (!storefrontActive || orderPending || isSubmitting) return;
    if (!response.ok || !Array.isArray(result) ||
      !result.every(item => item && Number.isSafeInteger(item.id) && item.id > 0 &&
        typeof item.name === "string" && item.name.trim() !== "" &&
        Number.isSafeInteger(item.price) && item.price >= 0 &&
        typeof item.description === "string" && validImageUrl(item.imageUrl) &&
        (item.categoryId === undefined || Number.isSafeInteger(item.categoryId) && item.categoryId > 0) &&
        (item.categoryName === undefined || typeof item.categoryName === "string") &&
        (item.brand === undefined || typeof item.brand === "string" && item.brand.length <= 200) &&
        (item.soldCount === undefined || Number.isSafeInteger(item.soldCount) && item.soldCount >= 0) &&
        ((item.reviewCount === undefined && item.ratingAverage === undefined) ||
          Number.isSafeInteger(item.reviewCount) && item.reviewCount >= 0 &&
          (item.reviewCount === 0 ? item.ratingAverage === null :
            typeof item.ratingAverage === "number" && Number.isFinite(item.ratingAverage) &&
              item.ratingAverage >= 0 && item.ratingAverage <= 5)) &&
        ((item.stockTracked === undefined && item.stockQuantity === undefined) ||
          (typeof item.stockTracked === "boolean" && Number.isSafeInteger(item.stockQuantity) && item.stockQuantity >= 0))) ||
      new Set(result.map(item => item.id)).size !== result.length) {
      throw new Error("Dữ liệu sản phẩm chưa hợp lệ");
    }
    products = new Map(result.map(item => [item.id, {
      stockTracked: false, stockQuantity: 0, categoryId: 1, categoryName: "Kem đánh răng", brand: "", soldCount: 0,
      reviewCount: 0, ratingAverage: null, ...item
    }]));
    catalogCategories = categories;
    homeProductSettings = sectionSettings;
    updateHomeProductPresentation();
    renderBrandOptions();
    catalogReady = true;
    cartMessage.textContent = "";
    importReorder();
    renderCatalog();
    if (homeProductSections.length === 0) productMessage.textContent = (productList || checkoutForm) && result.length === 0
      ? "Cửa hàng đang cập nhật sản phẩm. Bạn hãy quay lại sau." : "";
  } catch {
    if (!storefrontActive || orderPending || isSubmitting) return;
    if (checkoutForm) productMessage.textContent = "Chưa tải được sản phẩm. Hãy kiểm tra kết nối rồi tải lại trang để thử lại.";
    else if (catalogPage) productMessage.textContent = "Tải sản phẩm gặp lỗi. Kiểm tra kết nối rồi tải lại trang để thử lại.";
    else if (productList || featuredProductList) productMessage.textContent = "Tải sản phẩm gặp lỗi. Kiểm tra máy chủ rồi bấm Tải lại sản phẩm.";
    else {
      const queuedReorder = window.ShopMemory?.readReorder?.();
      productMessage.textContent = cart.size > 0 || queuedReorder?.reorder || queuedReorder?.error
        ? "Chưa tải được sản phẩm để cập nhật giỏ hàng. Mở giỏ hàng hoặc trang sản phẩm để thử lại." : "";
    }
    for (const section of homeProductSections) {
      if (section.message) section.message.textContent = "Chưa tải được sản phẩm. Hãy bấm Tải lại sản phẩm để thử lại.";
    }
  } finally {
    catalogLoading = false;
    if (storefrontActive) {
      if (!catalogReady) for (const target of catalogTargets) target.replaceChildren();
      renderCart();
      window.dispatchEvent(new CustomEvent("shop-catalog-ready", { detail: { ready: catalogReady } }));
    }
  }
}

for (const button of new Set([reloadCatalogButton, ...homeProductsRetryButtons].filter(Boolean))) {
  button.addEventListener("click", async () => {
    if (orderPending || isSubmitting) return;
    clearOrderReview();
    await loadCatalog();
  });
}

clearButton?.addEventListener("click", () => {
  if (orderPending || isSubmitting) return;
  refreshPersistedCart();
  cart.clear();
  unselectedCartProducts.clear();
  saveCartSelection();
  clearOrderReview();
  cartMessage.textContent = "Đã xóa giỏ hàng.";
  saveCart();
  renderCart();
});

cartSelectAll?.addEventListener("change", () => {
  if (orderPending || isSubmitting) return;
  for (const id of cart.keys()) {
    if (cartSelectAll.checked) unselectedCartProducts.delete(id);
    else unselectedCartProducts.add(id);
  }
  saveCartSelection();
  clearOrderReview();
  renderCart();
  cartSelectAll.focus();
});

removeSelectedButton?.addEventListener("click", () => {
  if (orderPending || isSubmitting) return;
  const selected = new Map(selectedCart());
  if (!refreshQuantityCart()) return;
  let removed = 0;
  for (const [id, quantity] of selected) {
    if (cart.get(id) !== quantity) continue;
    cart.delete(id);
    unselectedCartProducts.delete(id);
    removed += 1;
  }
  clearOrderReview();
  saveCartSelection();
  saveCart();
  cartMessage.textContent = "Đã xóa " + removed + " sản phẩm đã chọn khỏi giỏ hàng." +
    (removed < selected.size ? " Sản phẩm đã thay đổi ở tab khác được giữ lại. Hãy kiểm tra lại giỏ hàng." : "");
  renderCart();
  if (cart.size === 0) cartEmptyState.querySelector("a")?.focus();
  else cartSelectAll.focus();
});

cartContinueButton?.addEventListener("click", () => {
  if (isSubmitting || !saveCartSelection()) return;
  window.ShopAccountWorkspace?.open("checkout");
});

checkoutBackLink?.addEventListener("click", event => {
  if (isSubmitting) event.preventDefault();
});

for (const editor of couponEditors) {
  editor.input.addEventListener("input", () => {
    editor.input.removeAttribute("aria-invalid");
    editor.input.setCustomValidity("");
    editor.message.textContent = "Nhập mã và bấm Áp dụng để kiểm tra.";
    editor.message.dataset.error = "false";
  });
  editor.form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!storefrontActive || isSubmitting || orderPending || checkoutAccountChecking
        || couponEditors.some(item => item.controller !== null)) return;
    editor.input.value = editor.input.value.trim();
    if (!editor.input.value) {
      editor.input.setCustomValidity("Vui lòng nhập mã giảm giá.");
      editor.input.reportValidity();
      return;
    }
    const controller = new AbortController();
    editor.controller = controller;
    editor.message.textContent = "Đang kiểm tra mã giảm giá…";
    editor.message.dataset.error = "false";
    updateControls();
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editor.input.value }), cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
      });
      const result = await response.json();
      if (!storefrontActive || editor.controller !== controller) return;
      if ([200, 400].includes(response.status) && result?.available === false
          && typeof result.message === "string") {
        editor.message.textContent = "Mã không khả dụng.";
        editor.message.dataset.error = "true";
        editor.input.setAttribute("aria-invalid", "true");
      } else if (response.status === 429) {
        editor.message.textContent = "Bạn đang kiểm tra quá nhiều lần. Hãy đợi một phút rồi thử lại.";
        editor.message.dataset.error = "true";
      } else throw new Error("Kết quả kiểm tra mã chưa hợp lệ.");
    } catch {
      if (!storefrontActive || editor.controller !== controller) return;
      editor.message.textContent = "Chưa kiểm tra được mã. Kiểm tra kết nối và bấm Áp dụng để thử lại.";
      editor.message.dataset.error = "true";
    } finally {
      if (editor.controller === controller) {
        editor.controller = null;
        updateControls();
        if (storefrontActive) editor.input.focus({ preventScroll: true });
      }
    }
  });
}

checkoutForm?.addEventListener("input", () => {
  if (orderPending || isSubmitting) return;
  clearOrderReview();
  updateControls();
});

paymentMethodField?.addEventListener("change", () => {
  if (orderPending || isSubmitting) return;
  clearOrderReview();
  updateControls();
});

checkoutForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (orderPending || isSubmitting || checkoutAccountChecking || couponEditors.some(editor => editor.controller !== null)) return;
  if (!await refreshCheckoutAccount()) return;
  if (checkoutAccount && !completeCheckoutProfile(checkoutAccount)) return;
  refreshPersistedCart();
  clearOrderReview();
  updateControls();
  const selected = selectedCart();
  const totals = cartTotals(selected);
  const availabilityMessage = stockIssue([...selected].map(([productId, quantity]) => ({ productId, quantity })));
  if (availabilityMessage) {
    orderMessage.textContent = availabilityMessage;
    return;
  }
  if (!totals.valid || selected.size === 0) {
    orderMessage.textContent = "Kiểm tra sản phẩm, số lượng trong giỏ và tải lại sản phẩm trước khi đặt hàng.";
    return;
  }
  for (const field of customerFields) field.value = field.value.trim();
  if (checkoutAccount === null && !checkoutForm.reportValidity()) return;
  if (!["COD", "BANK_TRANSFER"].includes(paymentMethodField.value)) {
    orderMessage.textContent = "Hãy chọn phương thức thanh toán.";
    paymentMethodField.focus();
    return;
  }
  const items = [...selected].map(([productId, quantity]) => ({
    productId, quantity, expectedUnitPrice: products.get(productId).price,
    expectedProductName: products.get(productId).name
  }));
  reviewedOrder = {
    requestId: crypto.randomUUID(), items, paymentMethod: paymentMethodField.value,
    customerName: checkoutAccount?.name ?? customerNameField.value,
    customerPhone: checkoutAccount?.phone ?? customerPhoneField.value,
    customerAddress: checkoutAccount?.address ?? customerAddressField.value,
    ...(checkoutAccount === null && customerEmailField?.value.trim()
      ? { customerEmail: customerEmailField.value.trim().toLowerCase() } : {})
  };
  reviewedAccountId = checkoutAccount?.id ?? null;
  reviewedCustomerContext = checkoutAccount ? String(checkoutAccount.id) : "guest";
  reviewedCartSnapshot = new Map(cart);
  renderOrderReview();
  confirmButton.textContent = cartWorkspace ? "Xác nhận đơn hàng" : "Xác nhận đặt hàng";
  updateControls();
  if (cartWorkspace) await submitReviewedOrder();
});

function renderOrderReview() {
  if (!orderPreview) return;
  const items = reviewedOrder.items;
  const total = items.reduce((sum, item) => sum + item.quantity * item.expectedUnitPrice, 0);
  orderPreview.textContent = [
    ...(checkoutAccountState === "guest" && !orderPending ? [
      "Người nhận " + reviewedOrder.customerName,
      "Điện thoại " + reviewedOrder.customerPhone,
      ...(reviewedOrder.customerEmail ? ["Email nhận thông báo " + reviewedOrder.customerEmail] : []),
      "Địa chỉ " + reviewedOrder.customerAddress
    ] : [orderPending ? "Giữ thông tin nhận hàng của lần gửi đang chờ." : "Nhận hàng theo thông tin đã lưu trong tài khoản."]),
    ...items.map(item => item.expectedProductName + " × " + item.quantity +
      " " + productUnit(products.get(item.productId)) + " · " + money.format(item.expectedUnitPrice * item.quantity)),
    "Tiền sản phẩm " + money.format(total),
    paymentLabel(reviewedOrder.paymentMethod) + "."
  ].join("\n");
  renderCheckoutVisuals();
}

async function submitReviewedOrder() {
  if (!reviewedOrder || isSubmitting || couponEditors.some(editor => editor.controller !== null)
      || (!orderPending && checkoutAccountChecking)) return;
  if (orderPending) {
    if (!await refreshCheckoutAccount() || !pendingContextMatches()) {
      orderMessage.textContent = "Lần gửi đơn đang được giữ lại. Kiểm tra tài khoản trước khi thử gửi lại.";
      updateControls();
      return;
    }
  } else {
    if (!await refreshCheckoutAccount() || !reviewedOrder) return;
    if (reviewedAccountId !== (checkoutAccount?.id ?? null) ||
      (checkoutAccount && !completeCheckoutProfile(checkoutAccount))) {
      clearOrderReview();
      updateControls();
      return;
    }
    if (refreshPersistedCart()) {
      orderMessage.textContent = cartWorkspace
        ? "Giỏ đã thay đổi từ tab khác. Hãy kiểm tra giỏ trước khi tạo đơn hàng."
        : "Giỏ đã thay đổi từ tab khác. Hãy bấm Xem lại đơn hàng để kiểm tra giỏ mới.";
      renderCart();
      return;
    }
    const availabilityMessage = stockIssue(reviewedOrder.items);
    if (availabilityMessage) {
      clearOrderReview();
      orderMessage.textContent = availabilityMessage;
      renderCart();
      return;
    }
  }
  let orderSucceeded = false;
  let completedCustomerId;
  isSubmitting = true;
  orderPending = true;
  renderOrderReview();
  savePendingOrder();
  confirmButton.textContent = "Đang gửi đơn...";
  orderMessage.textContent = "Đang gửi đơn hàng...";
  updateControls();
  try {
    const response = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json",
        ...(reviewedCustomerContext === undefined ? {} : { "X-Customer-Id": reviewedCustomerContext }) },
      body: JSON.stringify(reviewedOrder), signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (response.status === 401 && typeof result?.error === "string") {
      await refreshCheckoutAccount();
      orderMessage.textContent = result.error;
      return;
    }
    if ([400, 409].includes(response.status) && typeof result?.error === "string") {
      orderPending = false;
      clearPendingOrder();
      clearOrderReview();
      orderMessage.textContent = result.error;
      if (response.status === 409) {
        isSubmitting = false;
        await loadCatalog();
      }
      return;
    }
    const expectedTotal = reviewedOrder.items.reduce((sum, item) =>
      sum + item.quantity * item.expectedUnitPrice, 0);
    if (!response.ok || !result || typeof result.orderId !== "string" || result.orderId === "" ||
      !validOrderNumber(result.orderNumber) ||
      !Number.isSafeInteger(result.total) || result.total !== expectedTotal ||
      result.paymentMethod !== (reviewedOrder.paymentMethod ?? "COD")
      || !["NEW", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"].includes(result.status)) {
      throw new Error("Kết quả đặt hàng chưa hợp lệ");
    }
    const receiptPhone = reviewedOrder.customerPhone;
    completedCustomerId = reviewedCustomerContext === "guest" ? null
      : reviewedCustomerContext === undefined ? undefined : Number(reviewedCustomerContext);
    currentReceiptItems = reviewedOrder.items.map(item => ({ ...item }));
    const cartNotice = finishSubmittedCart(reviewedOrder.items);
    orderPending = false;
    clearPendingOrder();
    clearOrderReview();
    checkoutForm.reset();
    cartMessage.textContent = "";
    currentReceipt = { orderId: result.orderId, total: result.total, paymentMethod: result.paymentMethod, status: result.status };
    if (typeof result.orderNumber === "string") currentReceipt.orderNumber = result.orderNumber;
    currentReceiptPhone = receiptPhone;
    const savedReceipt = window.ShopMemory?.saveReceipt?.(currentReceipt, receiptPhone) ?? {
      error: "Chưa tải được phần lưu mã đơn. Hãy sao chép mã đơn đang hiển thị để tra cứu sau."
    };
    const knownReceipt = window.ShopMemory?.readReceipts?.().receipts.find(receipt => receipt.orderId === result.orderId);
    if (knownReceipt?.orderNumber !== undefined) currentReceipt.orderNumber = knownReceipt.orderNumber;
    const displayCode = orderCode(currentReceipt);
    if (result.paymentMethod === "BANK_TRANSFER" && result.status !== "CANCELLED") {
      bankTransferReceipt = currentReceipt;
    }
    orderMessage.textContent = cartWorkspace ? cartNotice : [result.status === "CANCELLED" ? "Đơn hàng đã được hủy." : "Đặt hàng thành công.", "Mã đơn " + displayCode,
      "Tiền sản phẩm " + money.format(result.total), paymentLabel(result.paymentMethod) + ".", cartNotice].filter(Boolean).join("\n");
    renderPaymentDetails();
    receiptCode.textContent = displayCode;
    receiptActions.hidden = false;
    renderRecentOrders();
    if (savedReceipt.error && recentOrdersMessage) recentOrdersMessage.textContent = savedReceipt.error;
    orderSucceeded = true;
  } catch {
    orderMessage.textContent = "Chưa nhận được kết quả đặt hàng. Giữ trang đang mở và bấm Thử gửi lại.";
  } finally {
    isSubmitting = false;
    confirmButton.textContent = orderPending ? "Thử gửi lại" : cartWorkspace ? "Xác nhận đơn hàng" : "Xác nhận đặt hàng";
    let redirected = false;
    if (orderSucceeded && cartWorkspace && storefrontActive) {
      const target = "/dang-nhap.html?view=orders";
      if (prepareNavigation({ preventDefault() {} }, target)) {
        const handoff = window.ShopMemory?.preparePlacedOrder?.(currentReceipt, completedCustomerId)
          ?? { error: "Chưa chuyển được thông tin đơn hàng. Hãy giữ mã đơn đang hiển thị và bấm Xem đơn hàng của tôi." };
        if (handoff.error) orderMessage.textContent = [orderMessage.textContent, handoff.error].filter(Boolean).join(" ");
        else {
          redirected = true;
          window.location.assign(target);
        }
      }
    }
    if (!redirected) {
      if (!orderPending && (orderSucceeded || !catalogReady)) await loadCatalog();
      renderCart();
      if (orderPending) confirmButton.focus();
      else if (!receiptActions.hidden) receiptOrdersLink?.focus();
    }
  }
}

confirmButton?.addEventListener("click", () => void submitReviewedOrder());

function prepareNavigation(event, link) {
  const href = typeof link === "string" ? link : link.getAttribute?.("href") ?? link.href;
  if (href.startsWith("#")) return true;
  if (orderPending) {
    if (checkoutForm && !savePendingOrder()) {
      event.preventDefault();
      return false;
    }
    return true;
  }
  if (!checkoutForm && href !== "/gio-hang.html" && cartPersisted && !cartReadFailed) return true;
  refreshPersistedCart();
  if (cartReadFailed && !restoreCart()) {
    event.preventDefault();
    storageMessage.textContent = "Chưa đọc được giỏ hàng đã lưu. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt rồi bấm lại liên kết.";
    return false;
  }
  if (!cartPersisted && !saveCart()) {
    event.preventDefault();
    storageMessage.textContent = "Giỏ hàng đang ở trang này và chưa lưu được. Hãy cho phép trình duyệt lưu dữ liệu rồi bấm lại liên kết.";
    return false;
  }
  return true;
}

for (const link of document.querySelectorAll?.("a[href]") ?? []) {
  link.addEventListener("click", event => {
    if (link.hasAttribute("data-account-menu-trigger") && event.button === 0 &&
      !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) return;
    prepareNavigation(event, link);
  });
}

window.ShopStorefront = {
  hasCatalog: Boolean(productList),
  managesCart: true,
  searchCatalog,
  prepareNavigation,
  workspaceRender,
  get ready() { return catalogReady; },
  get loading() { return catalogLoading; },
  get locked() { return orderPending || isSubmitting || quickBuyNavigating || checkoutAccountChecking || !storefrontActive; },
  get persisted() { return cartPersisted; },
  getProduct(id) { return catalogReady && products.has(id) ? { ...products.get(id) } : null; },
  getCartQuantity(id) { return cart.get(id) ?? 0; },
  isFavorite(id) { return favoriteProducts.has(id); },
  toggleFavorite(id) {
    const product = products.get(id);
    return Boolean(product) && toggleFavorite(product, document.getElementById("detail-favorite"));
  },
  canAddProduct(id, quantity = 1) {
    return storefrontActive && !orderPending && !isSubmitting && !quickBuyNavigating &&
      !checkoutAccountChecking && canIncreaseQuantity(id, quantity);
  },
  addProduct(id, quantity = 1, source = null, image = null) {
    const product = products.get(id);
    return Boolean(product) && addProductToCart(product, source, image, quantity);
  },
  reloadCatalog: loadCatalog
};

if (productList) {
  const searchParams = new URLSearchParams(window.location.search);
  if (catalogPage) {
    for (const [key, field] of [["price", priceFilter], ["sort", productSortField]]) {
      const value = searchParams.get(key);
      if (field && [...field.options].some(option => option.value === value)) field.value = value;
    }
  }
  if (searchParams.has("q") || searchParams.has("scope")) {
    searchCatalog({ query: searchParams.get("q") ?? "", scope: searchParams.get("scope") ?? "all", scroll: false });
  }
}

refreshFavorites();
restoreCart();
restorePendingOrder();
renderRecentOrders();
renderCart();
if (checkoutForm) void refreshCheckoutAccount();
if (checkoutForm) void refreshBankTransferDetails();
if (!orderPending) loadCatalog();
workspaceRender();

