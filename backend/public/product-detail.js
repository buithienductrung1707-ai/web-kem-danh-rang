(() => {
  const article = document.getElementById("product-detail");
  if (!article) return;
  const get = id => document.getElementById(id);
  const loading = get("detail-loading");
  const errorPanel = get("detail-error");
  const retry = get("product-detail-retry");
  const quantity = get("detail-quantity");
  const decrease = get("detail-quantity-decrease");
  const increase = get("detail-quantity-increase");
  const addButton = get("detail-add-cart");
  const buyButton = get("detail-buy-now");
  const notice = get("detail-purchase-notice");
  const mainImage = get("detail-main-image");
  const imageFallback = get("detail-image-fallback");
  const thumbnails = get("detail-thumbnails");
  const media = get("detail-main-media");
  const zoomButton = get("detail-image-zoom");
  const favoriteButton = get("detail-favorite");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id") ?? "";
  const productId = params.getAll("id").length === 1 && /^[1-9]\d*$/.test(requestedId) &&
    Number.isSafeInteger(Number(requestedId)) ? Number(requestedId) : null;
  let active = true;
  let controller = null;
  let metadata = null;
  let metadataState = "loading";
  let metadataError = "";
  let product = null;
  let images = [];
  let imageIndex = 0;
  let gallerySignature = "";
  let maximumQuantity = 0;
  let zoomPinned = false;
  let pointerInside = false;
  let zoomFrame = null;
  let pointerPosition = null;

  function updateZoom() {
    const available = !mainImage.hidden && mainImage.complete && mainImage.naturalWidth > 0;
    media.classList.toggle("can-zoom", available);
    media.classList.toggle("is-zoomed", available && (zoomPinned || pointerInside && finePointer.matches));
    zoomButton.hidden = !available;
    zoomButton.setAttribute("aria-pressed", String(zoomPinned));
    zoomButton.setAttribute("aria-label", zoomPinned ? "Thu nhỏ ảnh sản phẩm" : "Phóng to ảnh sản phẩm");
  }

  function resetZoom() {
    zoomPinned = false;
    pointerInside = false;
    pointerPosition = null;
    if (zoomFrame !== null) window.cancelAnimationFrame(zoomFrame);
    zoomFrame = null;
    media.style.removeProperty("--zoom-x");
    media.style.removeProperty("--zoom-y");
    updateZoom();
  }

  function renderFavorite() {
    if (!favoriteButton) return;
    const storefront = window.ShopStorefront;
    const selected = Boolean(product && storefront?.isFavorite?.(productId));
    favoriteButton.setAttribute("aria-pressed", String(selected));
    favoriteButton.setAttribute("aria-label", (selected ? "Bỏ yêu thích " : "Yêu thích ") + (product?.name || "sản phẩm"));
    favoriteButton.title = selected ? "Đã yêu thích" : "Yêu thích";
    favoriteButton.disabled = !active || !product || !storefront?.ready || storefront.loading || storefront.locked;
  }

  function renderReviewSummary(summary = metadata?.reviewSummary) {
    const valid = summary && Number.isSafeInteger(summary.count) && summary.count >= 0 &&
      typeof summary.average === "number" && summary.average >= 0 && summary.average <= 5;
    const average = valid ? summary.average : 0;
    window.ShopProductReviews?.renderStars(get("detail-rating-stars"), average);
    get("detail-rating-value").textContent = valid && summary.count ? average.toFixed(1) : "—";
    get("detail-review-count").textContent = valid ? "(" + summary.count + " đánh giá)" : "Xem đánh giá";
    get("detail-review-link").setAttribute("aria-label", valid && summary.count
      ? "Đọc " + summary.count + " đánh giá, trung bình " + average.toFixed(1) + " trên 5 sao"
      : "Xem đánh giá sản phẩm");
  }

  function validImageUrl(value, allowEmpty = false) {
    if (allowEmpty && value === "") return true;
    if (typeof value !== "string" || value.length > 2048 || value.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) &&
        ((value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value));
    } catch { return false; }
  }

  function validateMetadata(value) {
    const gallery = value?.galleryImages ?? [];
    const specifications = value?.specifications ?? [];
    const detailedDescription = value?.detailedDescription ?? "";
    if (!value || value.id !== productId || typeof value.name !== "string" ||
      value.name.trim() === "" || value.name.length > 200 ||
      !Number.isSafeInteger(value.price) || value.price < 0 ||
      typeof value.description !== "string" || value.description.length > 12000 ||
      !validImageUrl(value.imageUrl, true) || typeof detailedDescription !== "string" ||
      detailedDescription.length > 12000 || !Array.isArray(gallery) || gallery.length > 7 ||
      !gallery.every(url => validImageUrl(url)) || !Array.isArray(specifications) || specifications.length > 12 ||
      !specifications.every(item => item && typeof item.label === "string" &&
        item.label.trim() !== "" && item.label.length <= 60 && typeof item.value === "string" &&
        item.value.trim() !== "" && item.value.length <= 200)) {
      throw new Error("Thông tin sản phẩm chưa hợp lệ.");
    }
    return { ...value, detailedDescription, galleryImages: gallery, specifications };
  }

  function disablePurchase() {
    for (const control of [quantity, decrease, increase, addButton, buyButton]) control.disabled = true;
    if (favoriteButton) favoriteButton.disabled = true;
  }

  function showLoading() {
    loading.hidden = false;
    errorPanel.hidden = true;
    article.hidden = true;
    disablePurchase();
  }

  function showError(title, message, canRetry = true) {
    loading.hidden = true;
    article.hidden = true;
    errorPanel.hidden = false;
    get("detail-error-title").textContent = title;
    get("detail-error-message").textContent = message;
    document.title = title + " — Cửa hàng kem đánh răng";
    retry.hidden = !canRetry;
    retry.disabled = false;
    get("detail-error-cart").hidden = true;
    disablePurchase();
    window.ShopProductReviews?.clear();
    resetZoom();
  }

  function selectImage(index, focusThumbnail = false) {
    resetZoom();
    if (images.length === 0) {
      mainImage.hidden = true;
      mainImage.removeAttribute("src");
      imageFallback.hidden = false;
      return;
    }
    imageIndex = (index + images.length) % images.length;
    imageFallback.hidden = true;
    mainImage.hidden = false;
    mainImage.src = images[imageIndex];
    mainImage.alt = product.name + " — ảnh " + (imageIndex + 1);
    get("detail-image-counter").textContent = (imageIndex + 1) + " / " + images.length;
    for (const [position, button] of [...thumbnails.children].entries()) {
      button.setAttribute("aria-pressed", String(position === imageIndex));
    }
    if (focusThumbnail) {
      thumbnails.children[imageIndex]?.focus();
      thumbnails.children[imageIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    updateZoom();
  }

  function renderGallery() {
    const nextImages = [...new Map([product.imageUrl, ...metadata.galleryImages].filter(Boolean)
      .map(url => [new URL(url, window.location.origin).href, url])).values()].slice(0, 8);
    const signature = JSON.stringify([product.name, nextImages]);
    if (gallerySignature === signature) return;
    gallerySignature = signature;
    images = nextImages;
    imageIndex = 0;
    const fragment = document.createDocumentFragment();
    for (const [index, url] of images.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Xem ảnh " + (index + 1) + " của " + product.name);
      button.setAttribute("aria-pressed", String(index === 0));
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.width = 72;
      image.height = 76;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        button.classList.add("has-image-error");
        const fallback = document.createElement("span");
        fallback.className = "detail-thumbnail-fallback";
        fallback.textContent = "Ảnh " + (index + 1);
        button.replaceChildren(fallback);
      }, { once: true });
      button.append(image);
      button.addEventListener("click", () => selectImage(index));
      fragment.append(button);
    }
    thumbnails.replaceChildren(fragment);
    thumbnails.hidden = images.length === 0;
    get("detail-gallery-controls").hidden = images.length <= 1;
    get("detail-gallery-help").textContent = images.length > 1
      ? "Chọn ảnh thu nhỏ hoặc dùng mũi tên để chuyển ảnh. Rê chuột hoặc bấm phóng to để xem chi tiết."
      : "Rê chuột hoặc bấm biểu tượng phóng to để xem chi tiết ảnh.";
    get("detail-main-media").tabIndex = images.length > 1 ? 0 : -1;
    get("detail-main-media").setAttribute("aria-label", images.length > 1
      ? "Thư viện ảnh sản phẩm. Dùng phím mũi tên để chuyển ảnh." : "Ảnh sản phẩm");
    selectImage(0);
  }

  function renderInformation() {
    get("product-detail-title").textContent = product.name;
    get("detail-current-crumb").textContent = product.name;
    get("detail-product-code").textContent = "Mã sản phẩm #" + product.id;
    get("detail-price").textContent = money.format(product.price);
    get("detail-summary").textContent = product.description;
    get("detail-summary").hidden = !product.description.trim();
    const sold = metadata.soldCount;
    get("detail-sold-count").hidden = !Number.isSafeInteger(sold) || sold < 0;
    get("detail-sold-count").textContent = Number.isSafeInteger(sold) ? sold.toLocaleString("vi-VN") + " đã bán" : "";
    renderReviewSummary();
    renderFavorite();
    window.ShopProductReviews?.setProduct({ id: productId, name: product.name, summary: metadata.reviewSummary });
    get("detail-description").textContent = metadata.detailedDescription.trim() || product.description.trim() ||
      "Cửa hàng đang cập nhật mô tả sản phẩm.";
    const specifications = metadata.specifications.map(specification => {
      const row = document.createElement("div");
      const label = document.createElement("dt");
      label.textContent = specification.label;
      const value = document.createElement("dd");
      value.textContent = specification.value;
      row.append(label, value);
      return row;
    });
    get("detail-specifications").replaceChildren(...specifications);
    get("detail-specifications-card").hidden = specifications.length === 0;
    const categoryLink = get("detail-category-link");
    const hasCategory = typeof product.categoryName === "string" && product.categoryName.trim() !== "";
    get("detail-category-crumb").hidden = !hasCategory;
    if (hasCategory) {
      categoryLink.textContent = product.categoryName;
      categoryLink.href = typeof product.categorySlug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.categorySlug)
        ? "/danh-muc.html?danh-muc=" + encodeURIComponent(product.categorySlug) : "/danh-muc.html";
    }
    document.title = product.name + " — Cửa hàng kem đánh răng";
    document.querySelector('meta[name="description"]').content =
      (product.description.trim() || "Xem thông tin và giá bán " + product.name + " tại cửa hàng.").replace(/\s+/g, " ").slice(0, 160);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = window.location.origin + "/chi-tiet-san-pham.html?id=" + product.id;
  }

  function syncQuantity(normalize = false) {
    const storefront = window.ShopStorefront;
    if (!product || !storefront) return;
    const cartQuantity = storefront.getCartQuantity(productId);
    const stockAvailable = product.stockTracked ? Math.max(0, product.stockQuantity - cartQuantity) : Number.MAX_SAFE_INTEGER;
    const monetaryLimit = product.price > 0 ? Math.floor(Number.MAX_SAFE_INTEGER / product.price) : Number.MAX_SAFE_INTEGER;
    maximumQuantity = Math.min(stockAvailable, monetaryLimit);
    quantity.max = String(Math.max(1, maximumQuantity));
    let count = Number(quantity.value);
    if (normalize || (quantity.value !== "" && Number.isFinite(count) && (count < 1 || count > maximumQuantity))) {
      count = Number.isFinite(count) ? Math.trunc(count) : 1;
      count = Math.max(1, Math.min(count, Math.max(1, maximumQuantity)));
      quantity.value = String(count);
    }
    const valid = quantity.value !== "" && Number.isSafeInteger(count) && count >= 1 && count <= maximumQuantity;
    const locked = storefront.locked || !storefront.ready || storefront.loading || !active;
    quantity.disabled = locked || maximumQuantity === 0;
    decrease.disabled = quantity.disabled || !valid || count <= 1;
    increase.disabled = quantity.disabled || !valid || count >= maximumQuantity;
    const allowed = !locked && valid && storefront.canAddProduct(productId, count);
    addButton.disabled = !allowed;
    buyButton.disabled = !allowed;
    get("detail-subtotal").textContent = valid && Number.isSafeInteger(product.price * count)
      ? money.format(product.price * count) : "—";
    get("detail-stock").dataset.soldOut = String(product.stockTracked && product.stockQuantity === 0);
    get("detail-stock").textContent = product.stockTracked
      ? product.stockQuantity === 0 ? "Hết hàng" : "Có thể thêm " + stockAvailable + " sản phẩm vào giỏ"
      : "Sẵn sàng đặt hàng";
    const soldOut = product.stockTracked && product.stockQuantity === 0;
    get("detail-stock-badge").dataset.soldOut = String(soldOut);
    get("detail-stock-badge").textContent = soldOut ? "Hết hàng" : product.stockTracked ? "Còn hàng" : "Sẵn sàng đặt hàng";
    get("detail-low-stock").hidden = !product.stockTracked || product.stockQuantity < 1 || product.stockQuantity > 5;
    get("detail-low-stock-text").textContent = "Sắp hết hàng — chỉ còn " + product.stockQuantity + " sp";
    get("detail-quantity-help").textContent = cartQuantity > 0 ? "Trong giỏ " + cartQuantity + " sản phẩm" : "";
    if (locked) {
      notice.textContent = "Đang kiểm tra dữ liệu giỏ hàng. Hãy chờ một chút.";
    } else if (maximumQuantity === 0) {
      notice.textContent = product.stockQuantity === 0
        ? "Sản phẩm hiện đang hết hàng." : "Bạn đã thêm toàn bộ số lượng khả dụng vào giỏ.";
    } else if (!valid) {
      notice.textContent = "Nhập số lượng nguyên từ 1 đến " + maximumQuantity + ".";
    } else {
      notice.textContent = allowed ? "" : "Giỏ hàng chưa thể nhận số lượng này. Hãy giảm số lượng hoặc kiểm tra giỏ hàng.";
    }
  }

  function synchronize() {
    if (!active) return;
    if (productId === null) {
      showError("Chưa chọn sản phẩm", "Hãy chọn một sản phẩm trong danh sách để xem thông tin chi tiết.", false);
      return;
    }
    const storefront = window.ShopStorefront;
    if (metadataState === "loading") { showLoading(); return; }
    if (metadataState !== "ready") {
      showError(metadataState === "missing" ? "Không tìm thấy sản phẩm" : "Chưa tải được sản phẩm", metadataError);
      return;
    }
    if (!storefront?.ready) {
      if (storefront?.locked) {
        showError("Bạn có lần đặt hàng đang chờ", "Mở giỏ hàng để kiểm tra và hoàn tất lần đặt hàng trước khi mua tiếp.", false);
        get("detail-error-cart").hidden = false;
      } else if (storefront?.loading) showLoading();
      else showError("Chưa cập nhật được sản phẩm", "Hãy thử tải lại để kiểm tra giá và số lượng hiện có.");
      return;
    }
    product = storefront.getProduct(productId);
    if (!product) {
      showError("Sản phẩm đang được cập nhật", "Sản phẩm này hiện không còn hiển thị trong cửa hàng. Hãy tải lại hoặc khám phá sản phẩm khác.");
      return;
    }
    if (product.name !== metadata.name || product.price !== metadata.price) {
      showError("Thông tin sản phẩm vừa thay đổi", "Hãy tải lại trang để xem giá và thông tin mới nhất trước khi thêm vào giỏ.");
      return;
    }
    loading.hidden = true;
    errorPanel.hidden = true;
    article.hidden = false;
    renderInformation();
    renderGallery();
    syncQuantity();
  }

  async function loadMetadata(refreshCatalog = false) {
    if (productId === null || !active) { synchronize(); return; }
    controller?.abort();
    const request = new AbortController();
    controller = request;
    metadataState = "loading";
    metadataError = "";
    get("detail-error-cart").hidden = true;
    synchronize();
    if (refreshCatalog) void window.ShopStorefront?.reloadCatalog();
    try {
      const response = await fetch("/api/products/" + productId, {
        cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json().catch(() => null);
      if (!active || controller !== request) return;
      if (response.status === 404) {
        metadataState = "missing";
        metadataError = "Sản phẩm không còn hiển thị hoặc đường dẫn chưa đúng. Bạn có thể khám phá các sản phẩm khác trong cửa hàng.";
      } else {
        if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Chưa tải được thông tin sản phẩm.");
        metadata = validateMetadata(result);
        metadataState = "ready";
      }
    } catch (error) {
      if (!active || controller !== request) return;
      metadataState = "error";
      metadataError = error.name === "TypeError" || error.name === "TimeoutError"
        ? "Kết nối gặp lỗi. Hãy kiểm tra mạng rồi thử tải lại sản phẩm."
        : error.message;
    } finally {
      if (controller === request) {
        controller = null;
        synchronize();
      }
    }
  }

  function purchase(event, navigate) {
    event.preventDefault();
    syncQuantity(true);
    const storefront = window.ShopStorefront;
    const count = Number(quantity.value);
    if (addButton.disabled || !product || !storefront?.canAddProduct(productId, count)) return;
    const source = navigate ? buyButton : addButton;
    if (!storefront.addProduct(productId, count, source, mainImage)) { synchronize(); return; }
    synchronize();
    if (!navigate) return;
    const target = "/dang-nhap.html?view=cart";
    if (!storefront.prepareNavigation(event, target)) return;
    try { window.location.assign(target); }
    catch { notice.textContent = "Đã thêm sản phẩm. Bấm Giỏ hàng trên thanh đầu trang để tiếp tục."; }
  }

  mainImage.addEventListener("error", () => { mainImage.hidden = true; imageFallback.hidden = false; resetZoom(); });
  mainImage.addEventListener("load", updateZoom);
  media.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch" || !finePointer.matches) return;
    pointerInside = true;
    updateZoom();
  });
  media.addEventListener("pointerleave", () => { pointerInside = false; updateZoom(); });
  media.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || !finePointer.matches) return;
    pointerInside = true;
    updateZoom();
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (zoomFrame !== null) return;
    zoomFrame = window.requestAnimationFrame(() => {
      zoomFrame = null;
      if (!pointerPosition || !active) return;
      const bounds = media.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, (pointerPosition.x - bounds.left) / bounds.width * 100));
      const y = Math.max(0, Math.min(100, (pointerPosition.y - bounds.top) / bounds.height * 100));
      media.style.setProperty("--zoom-x", x + "%");
      media.style.setProperty("--zoom-y", y + "%");
    });
  });
  zoomButton.addEventListener("click", () => { zoomPinned = !zoomPinned; updateZoom(); });
  media.addEventListener("keydown", event => {
    if (event.key === "Escape") { resetZoom(); zoomButton.focus(); }
  });
  favoriteButton?.addEventListener("click", () => {
    if (favoriteButton.disabled) return;
    window.ShopStorefront?.toggleFavorite?.(productId);
    renderFavorite();
  });
  get("detail-image-previous").addEventListener("click", () => selectImage(imageIndex - 1));
  get("detail-image-next").addEventListener("click", () => selectImage(imageIndex + 1));
  get("detail-gallery").addEventListener("keydown", event => {
    if (images.length < 2 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? images.length - 1
      : imageIndex + (event.key === "ArrowRight" ? 1 : -1);
    selectImage(index, thumbnails.contains(event.target));
  });
  decrease.addEventListener("click", () => { quantity.value = String(Math.max(1, Number(quantity.value) - 1)); syncQuantity(true); });
  increase.addEventListener("click", () => { quantity.value = String(Math.min(maximumQuantity, Number(quantity.value) + 1)); syncQuantity(true); });
  quantity.addEventListener("input", () => syncQuantity());
  quantity.addEventListener("blur", () => syncQuantity(true));
  addButton.addEventListener("click", event => purchase(event, false));
  get("detail-purchase-form").addEventListener("submit", event => purchase(event, true));
  retry.addEventListener("click", () => { void loadMetadata(true); });
  window.addEventListener("shop-catalog-ready", synchronize);
  window.addEventListener("shop-cart-change", synchronize);
  window.addEventListener("shop-favorites-change", renderFavorite);
  window.addEventListener("shop-product-reviews-change", event => {
    if (event.detail?.productId !== productId || !metadata) return;
    metadata.reviewSummary = event.detail.summary;
    renderReviewSummary();
  });
  window.addEventListener("pagehide", () => { active = false; controller?.abort(); controller = null; disablePurchase(); resetZoom(); });
  window.addEventListener("pageshow", event => { active = true; if (event.persisted) void loadMetadata(true); });
  void loadMetadata();
})();
