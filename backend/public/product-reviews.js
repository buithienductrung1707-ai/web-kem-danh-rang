(() => {
  const root = document.getElementById("reviews");
  if (!root) return;
  const get = id => document.getElementById(id);
  const starPath = "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z";
  const formatDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
  const form = get("review-form");
  const panel = get("review-form-panel");
  const comment = get("review-comment");
  const formMessage = get("review-form-message");
  const eligibilityMessage = get("review-eligibility-message");
  const list = get("reviews-list");
  const ratingButtons = new Map();
  const histogramRows = new Map();
  let product = null;
  let active = true;
  let summary = null;
  let ratingFilter = "all";
  let currentPage = 1;
  let totalPages = 1;
  let listController = null;
  let ownController = null;
  let saveController = null;
  let privateEpoch = 0;
  let ownCustomerId = null;
  let observedAccountId;
  let ownReview = null;
  let canReview = false;
  let formInitialized = false;
  let pendingPayload = null;
  let needsRefresh = false;
  let starSequence = 0;

  function svgStar() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", starPath);
    svg.append(path);
    return svg;
  }

  function renderStars(target, value) {
    if (!target) return;
    const fragment = document.createDocumentFragment();
    for (let index = 1; index <= 5; index++) {
      const star = svgStar();
      const fraction = Math.max(0, Math.min(1, value - index + 1));
      star.classList.toggle("is-filled", fraction === 1);
      if (fraction > 0 && fraction < 1) {
        star.classList.add("is-partial");
        const defs = document.createElementNS(star.namespaceURI, "defs");
        const gradient = document.createElementNS(star.namespaceURI, "linearGradient");
        const id = "review-star-fill-" + (++starSequence);
        gradient.id = id;
        for (const color of ["var(--review-star)", "transparent"]) {
          const stop = document.createElementNS(star.namespaceURI, "stop");
          stop.setAttribute("offset", fraction * 100 + "%");
          stop.setAttribute("stop-color", color);
          gradient.append(stop);
        }
        defs.append(gradient);
        star.prepend(defs);
        star.querySelector("path").setAttribute("fill", "url(#" + id + ")");
      }
      fragment.append(star);
    }
    target.replaceChildren(fragment);
  }

  function validSummary(value) {
    return value && Number.isSafeInteger(value.count) && value.count >= 0 &&
      Number.isFinite(value.average) && value.average >= 0 && value.average <= 5 &&
      Number.isSafeInteger(value.commentCount) && value.commentCount >= 0 && value.commentCount <= value.count &&
      value.distribution && [1, 2, 3, 4, 5].every(star => Number.isSafeInteger(value.distribution[star]) && value.distribution[star] >= 0) &&
      [1, 2, 3, 4, 5].reduce((sum, star) => sum + value.distribution[star], 0) === value.count;
  }

  function dateValue(value) {
    if (typeof value !== "string") return new Date(NaN);
    return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(" ", "T") + "Z" : value);
  }

  function validReview(value, own = false) {
    return value && Number.isSafeInteger(value.id) && value.id > 0 &&
      Number.isInteger(value.rating) && value.rating >= 1 && value.rating <= 5 &&
      typeof value.comment === "string" && value.comment.length <= 2000 &&
      typeof value.displayName === "string" && value.displayName.trim() !== "" && value.displayName.length <= 200 &&
      typeof value.verifiedPurchase === "boolean" && Number.isFinite(dateValue(value.createdAt).getTime()) &&
      Number.isFinite(dateValue(value.updatedAt).getTime()) &&
      (!own || Number.isSafeInteger(value.revision) && value.revision >= 0);
  }

  function applySummary(value) {
    if (!validSummary(value)) return false;
    summary = value;
    get("reviews-average").textContent = value.count ? value.average.toFixed(1) : "—";
    renderStars(get("reviews-stars"), value.average);
    get("reviews-count").textContent = value.count ? "Dựa trên " + value.count + " đánh giá" : "Chưa có đánh giá";
    get("reviews-customer-title").textContent = "Đánh giá từ khách hàng (" + value.count + ")";
    get("reviews-comment-count").textContent = "(" + value.commentCount + ")";
    for (const [rating, button] of ratingButtons) {
      const count = rating === "all" ? value.count : value.distribution[rating];
      button.textContent = (rating === "all" ? "Tất cả" : rating + " sao") + " (" + count + ")";
    }
    for (const [rating, row] of histogramRows) {
      const count = value.distribution[rating];
      row.querySelector(".review-distribution-count").textContent = String(count);
      row.style.setProperty("--review-bar", (value.count ? count / value.count * 100 : 0) + "%");
      row.setAttribute("aria-label", rating + " sao, " + count + " đánh giá. Lọc theo " + rating + " sao");
    }
    if (product) window.dispatchEvent(new CustomEvent("shop-product-reviews-change", { detail: { productId: product.id, summary: value } }));
    return true;
  }

  function setPublicControls() {
    const busy = !active || !product || listController !== null;
    for (const [rating, button] of ratingButtons) {
      button.disabled = busy;
      button.setAttribute("aria-pressed", String(ratingFilter === rating));
    }
    for (const row of histogramRows.values()) row.disabled = busy;
    get("reviews-comments-only").disabled = busy;
    get("reviews-sort").disabled = busy;
    get("reviews-previous").disabled = busy || currentPage <= 1;
    get("reviews-next").disabled = busy || currentPage >= totalPages;
    get("reviews-write").disabled = !active || !product;
    get("reviews-retry").disabled = busy;
    list.setAttribute("aria-busy", String(listController !== null));
  }

  function renderList(reviews) {
    const cards = reviews.map(review => {
      const card = document.createElement("article");
      card.className = "review-card";
      const head = document.createElement("div");
      head.className = "review-card-heading";
      const avatar = document.createElement("span");
      avatar.className = "review-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = review.displayName.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase("vi-VN");
      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = review.displayName;
      identity.append(name);
      if (review.verifiedPurchase) {
        const badge = document.createElement("span");
        badge.className = "review-verified";
        badge.textContent = "✓ Đã mua hàng";
        identity.append(badge);
      }
      const meta = document.createElement("div");
      meta.className = "review-card-meta";
      const stars = document.createElement("span");
      stars.className = "review-stars";
      stars.setAttribute("role", "img");
      stars.setAttribute("aria-label", review.rating + " trên 5 sao");
      renderStars(stars, review.rating);
      const time = document.createElement("time");
      time.dateTime = dateValue(review.updatedAt).toISOString();
      time.textContent = formatDate.format(dateValue(review.updatedAt));
      meta.append(stars, time);
      if (review.createdAt !== review.updatedAt) {
        const edited = document.createElement("span");
        edited.textContent = "Đã chỉnh sửa";
        meta.append(edited);
      }
      identity.append(meta);
      head.append(avatar, identity);
      card.append(head);
      if (review.comment) {
        const text = document.createElement("p");
        text.className = "review-comment";
        text.textContent = review.comment;
        card.append(text);
      }
      return card;
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "reviews-empty";
      const title = document.createElement("h4");
      title.textContent = summary?.count ? "Chưa có đánh giá phù hợp" : "Sản phẩm chưa có đánh giá";
      const text = document.createElement("p");
      text.textContent = summary?.count ? "Thử chọn số sao khác hoặc bỏ bộ lọc bình luận."
        : "Trải nghiệm của bạn sẽ giúp khách hàng khác lựa chọn sản phẩm.";
      empty.append(title, text);
      cards.push(empty);
    }
    list.replaceChildren(...cards);
  }

  async function loadPublic(page = 1) {
    if (!active || !product) return;
    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    const productId = product.id;
    const params = new URLSearchParams({ page: String(page), rating: ratingFilter,
      comments: get("reviews-comments-only").checked ? "1" : "0", sort: get("reviews-sort").value });
    get("reviews-message").textContent = "Đang tải đánh giá...";
    get("reviews-retry").hidden = true;
    list.replaceChildren();
    setPublicControls();
    try {
      const response = await fetch("/api/products/" + productId + "/reviews?" + params, {
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json();
      if (!active || listController !== controller || product?.id !== productId) return;
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Chưa tải được đánh giá.");
      if (!validSummary(result.summary) || !Array.isArray(result.reviews) || result.reviews.length > 10 ||
        !result.reviews.every(item => validReview(item)) || new Set(result.reviews.map(item => item.id)).size !== result.reviews.length ||
        !Number.isSafeInteger(result.totalReviews) || result.totalReviews < 0 || result.totalReviews > result.summary.count ||
        !Number.isSafeInteger(result.page) || result.page < 1 ||
        result.totalPages !== Math.max(1, Math.ceil(result.totalReviews / 10)) || result.page > result.totalPages) {
        throw new Error("Dữ liệu đánh giá chưa hợp lệ. Hãy thử tải lại.");
      }
      applySummary(result.summary);
      currentPage = result.page;
      totalPages = result.totalPages;
      get("reviews-page").textContent = "Trang " + currentPage + " / " + totalPages;
      renderList(result.reviews);
      get("reviews-message").textContent = "";
    } catch (error) {
      if (!active || listController !== controller || product?.id !== productId) return;
      get("reviews-message").textContent = error.name === "TypeError" || error.name === "TimeoutError"
        ? "Kết nối gặp lỗi. Hãy tải lại đánh giá để thử tiếp." : error.message;
      get("reviews-retry").hidden = false;
    } finally {
      if (listController === controller) { listController = null; setPublicControls(); }
    }
  }

  function clearPrivate(close = true) {
    privateEpoch++;
    ownController?.abort();
    saveController?.abort();
    ownController = null;
    saveController = null;
    ownCustomerId = null;
    ownReview = null;
    canReview = false;
    formInitialized = false;
    pendingPayload = null;
    needsRefresh = false;
    form.reset();
    comment.setCustomValidity("");
    form.hidden = true;
    formMessage.textContent = "";
    eligibilityMessage.textContent = "";
    get("review-login").hidden = true;
    get("review-eligibility-retry").hidden = true;
    get("review-refresh-own").hidden = true;
    if (close) panel.hidden = true;
    renderRatingSelection();
    setPrivateControls();
  }

  function ratingValue() {
    return Number(form.querySelector('input[name="rating"]:checked')?.value || 0);
  }

  function renderRatingSelection() {
    const value = ratingValue();
    for (const label of get("review-rating").querySelectorAll("label")) label.classList.toggle("is-selected", Number(label.dataset.rating) <= value);
    get("review-comment-count").textContent = comment.value.length + " / 2000 ký tự";
  }

  function setPrivateControls() {
    const busy = !active || ownController !== null || saveController !== null;
    const frozen = busy || pendingPayload !== null || !canReview || needsRefresh;
    for (const control of form.querySelectorAll('input[name="rating"], textarea')) control.disabled = frozen;
    get("review-submit").disabled = busy || !canReview || needsRefresh;
    get("review-submit").textContent = saveController ? "Đang gửi đánh giá..." : pendingPayload
      ? "Thử gửi lại" : ownReview ? "Cập nhật đánh giá" : "Gửi đánh giá";
    get("review-refresh-own").disabled = busy;
    get("review-eligibility-retry").disabled = busy;
    form.setAttribute("aria-busy", String(saveController !== null));
  }

  async function loadOwn(preserveDraft = false) {
    if (!active || !product || saveController || pendingPayload) return;
    ownController?.abort();
    const controller = new AbortController();
    ownController = controller;
    const epoch = ++privateEpoch;
    const productId = product.id;
    const draftOwnerId = ownCustomerId;
    const draft = preserveDraft ? { rating: ratingValue(), comment: comment.value } : null;
    form.hidden = true;
    get("review-login").hidden = true;
    get("review-eligibility-retry").hidden = true;
    get("review-refresh-own").hidden = true;
    eligibilityMessage.textContent = "Đang kiểm tra tài khoản và đơn mua hàng...";
    setPrivateControls();
    const options = { credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) };
    let identityConfirmed = false;
    try {
      const me = await fetch("/api/account/me", options);
      if (!active || privateEpoch !== epoch || product?.id !== productId) return;
      if (me.status === 401) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Đăng nhập để gửi đánh giá sau khi đơn hàng của bạn hoàn thành.";
        get("review-login").hidden = false;
        return;
      }
      const account = await me.json();
      if (!me.ok || !Number.isSafeInteger(account?.id) || account.id < 1) throw new Error("Chưa xác nhận được tài khoản.");
      if (!active || privateEpoch !== epoch || product?.id !== productId) return;
      const customerId = account.id;
      if (draft && customerId !== draftOwnerId) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Tài khoản đã thay đổi. Bản nháp cũ đã được đóng. Kiểm tra lại tài khoản để viết đánh giá mới.";
        get("review-eligibility-retry").hidden = false;
        return;
      }
      identityConfirmed = true;
      ownCustomerId = customerId;
      observedAccountId = customerId;
      const response = await fetch("/api/account/products/" + productId + "/review", { ...options,
        headers: { "X-Customer-Id": String(customerId) } });
      const result = await response.json();
      if (!active || privateEpoch !== epoch || ownCustomerId !== customerId || product?.id !== productId) return;
      if (response.status === 401) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại để đánh giá.";
        get("review-login").hidden = false;
        return;
      }
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Chưa kiểm tra được quyền đánh giá.");
      if (result.customerId !== customerId) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Chưa xác nhận đúng tài khoản. Hãy kiểm tra lại trước khi viết đánh giá.";
        get("review-eligibility-retry").hidden = false;
        return;
      }
      if (typeof result.canReview !== "boolean" ||
        (result.review !== null && !validReview(result.review, true))) throw new Error("Thông tin đánh giá của tài khoản chưa hợp lệ.");
      ownReview = result.review;
      canReview = result.canReview;
      needsRefresh = false;
      formInitialized = true;
      if (!canReview) {
        eligibilityMessage.textContent = "Bạn có thể đánh giá sản phẩm sau khi đã mua và đơn hàng ở trạng thái Hoàn thành.";
        return;
      }
      const selected = draft?.rating || ownReview?.rating || 5;
      form.querySelector('input[name="rating"][value="' + selected + '"]').checked = true;
      comment.value = draft ? draft.comment : ownReview?.comment || "";
      formMessage.textContent = draft ? "Đã tải bản đánh giá hiện tại. Bản nháp của bạn vẫn được giữ để kiểm tra và gửi lại." : "";
      eligibilityMessage.textContent = ownReview ? "Bạn đã đánh giá sản phẩm này. Có thể cập nhật đánh giá của mình."
        : "Đánh giá sẽ được hiển thị cùng tên rút gọn và xác nhận đã mua hàng.";
      form.hidden = false;
      renderRatingSelection();
    } catch (error) {
      if (!active || privateEpoch !== epoch || product?.id !== productId) return;
      if (!identityConfirmed) clearPrivate(false);
      eligibilityMessage.textContent = error.name === "TypeError" || error.name === "TimeoutError"
        ? "Chưa kết nối được để kiểm tra quyền đánh giá. Hãy thử lại." : error.message;
      get("review-eligibility-retry").hidden = false;
    } finally {
      if (ownController === controller) { ownController = null; setPrivateControls(); }
    }
  }

  async function reopenEditor() {
    if (!active || !product || ownController || saveController) return;
    if (!formInitialized && !pendingPayload) { void loadOwn(); return; }
    const controller = new AbortController();
    ownController = controller;
    const epoch = ++privateEpoch;
    const ownerId = ownCustomerId;
    const productId = product.id;
    form.hidden = true;
    eligibilityMessage.textContent = "Đang kiểm tra lại tài khoản...";
    setPrivateControls();
    try {
      const response = await fetch("/api/account/me", { credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const account = await response.json().catch(() => null);
      if (!active || privateEpoch !== epoch || product?.id !== productId) return;
      if (response.status === 401 || response.ok && account?.id !== ownerId) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Tài khoản đã thay đổi. Kiểm tra lại để viết đánh giá cho tài khoản hiện tại.";
        get("review-login").hidden = response.status !== 401;
        get("review-eligibility-retry").hidden = false;
        return;
      }
      if (!response.ok || !Number.isSafeInteger(account?.id) || account.id !== ownerId) throw new Error("Phiên tài khoản chưa xác định.");
      form.hidden = !canReview;
      eligibilityMessage.textContent = canReview
        ? ownReview ? "Bạn có thể cập nhật đánh giá của mình." : "Bản nháp của bạn đã được giữ lại."
        : "Bạn có thể đánh giá sản phẩm sau khi đã mua và đơn hàng ở trạng thái Hoàn thành.";
    } catch {
      if (!active || privateEpoch !== epoch || product?.id !== productId) return;
      clearPrivate(false);
      eligibilityMessage.textContent = "Chưa xác nhận được tài khoản. Hãy kiểm tra kết nối rồi thử lại.";
      get("review-eligibility-retry").hidden = false;
    } finally {
      if (ownController === controller) { ownController = null; setPrivateControls(); }
    }
  }

  async function saveReview(event) {
    event.preventDefault();
    if (!active || !product || !ownCustomerId || !canReview || ownController || saveController || needsRefresh) return;
    comment.setCustomValidity("");
    if (!pendingPayload) {
      if (!form.reportValidity()) return;
      const rating = ratingValue();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
      pendingPayload = { rating, comment: comment.value.trim(), requestId: crypto.randomUUID(),
        ...(ownReview ? { revision: ownReview.revision } : {}) };
    }
    const controller = new AbortController();
    saveController = controller;
    const epoch = privateEpoch;
    const customerId = ownCustomerId;
    const productId = product.id;
    let attempted = false;
    formMessage.textContent = "Đang gửi đánh giá...";
    setPrivateControls();
    try {
      const accountResponse = await fetch("/api/account/me", {
        credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      const account = await accountResponse.json().catch(() => null);
      if (!active || privateEpoch !== epoch || ownCustomerId !== customerId || product?.id !== productId) return;
      if (accountResponse.status === 401 || accountResponse.ok && account?.id !== customerId) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Tài khoản đã thay đổi. Hãy kiểm tra lại trước khi gửi đánh giá.";
        get("review-eligibility-retry").hidden = false;
        get("review-login").hidden = accountResponse.status !== 401;
        return;
      }
      if (!accountResponse.ok || account?.id !== customerId) throw new Error("Chưa xác nhận được phiên tài khoản.");
      attempted = true;
      const response = await fetch("/api/account/products/" + productId + "/review", {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Customer-Id": String(customerId) },
        body: JSON.stringify(pendingPayload), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      const result = await response.json().catch(() => null);
      if (!active || privateEpoch !== epoch || ownCustomerId !== customerId || product?.id !== productId) return;
      if (response.status === 401) {
        clearPrivate(false);
        eligibilityMessage.textContent = "Phiên tài khoản đã thay đổi. Hãy đăng nhập lại trước khi đánh giá.";
        get("review-login").hidden = false;
        return;
      }
      if (response.status === 400 || response.status === 403 || response.status === 404 || response.status === 409 || response.status === 429) {
        pendingPayload = null;
        formMessage.textContent = typeof result?.error === "string" ? result.error : "Chưa gửi được đánh giá. Hãy kiểm tra rồi thử lại.";
        if (response.status === 403 || response.status === 404) canReview = false;
        if (response.status === 409) {
          needsRefresh = true;
          get("review-refresh-own").hidden = false;
          formMessage.textContent += " Bản nháp vẫn được giữ. Tải bản hiện tại trước khi gửi tiếp.";
        }
        if (result?.field === "comment") comment.setCustomValidity(formMessage.textContent);
        return;
      }
      if (!response.ok || result?.customerId !== customerId || !validReview(result.review, true) || !validSummary(result.summary) ||
        result.review.rating !== pendingPayload.rating || result.review.comment !== pendingPayload.comment ||
        result.review.revision !== (pendingPayload.revision === undefined ? 0 : pendingPayload.revision + 1) ||
        ownReview && result.review.id !== ownReview.id) {
        throw new Error("Chưa xác nhận được kết quả gửi đánh giá.");
      }
      ownReview = result.review;
      pendingPayload = null;
      comment.value = ownReview.comment;
      form.querySelector('input[name="rating"][value="' + ownReview.rating + '"]').checked = true;
      formMessage.textContent = response.status === 201 ? "Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ!" : "Đã cập nhật đánh giá của bạn.";
      applySummary(result.summary);
      renderRatingSelection();
      void loadPublic(1);
    } catch {
      if (active && privateEpoch === epoch && ownCustomerId === customerId && product?.id === productId) {
        if (attempted) {
          formMessage.textContent = "Chưa xác nhận được kết quả gửi. Bấm Thử gửi lại để kiểm tra cùng lần đánh giá, tránh gửi trùng.";
        } else {
          clearPrivate(false);
          eligibilityMessage.textContent = "Chưa xác nhận được tài khoản. Kiểm tra kết nối rồi thử lại.";
          get("review-eligibility-retry").hidden = false;
        }
      }
    } finally {
      if (saveController === controller) { saveController = null; setPrivateControls(); }
    }
  }

  for (const rating of ["all", "5", "4", "3", "2", "1"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rating = rating;
    button.className = "button-secondary";
    button.textContent = rating === "all" ? "Tất cả" : rating + " sao";
    button.setAttribute("aria-pressed", String(rating === "all"));
    button.addEventListener("click", () => { ratingFilter = rating; void loadPublic(1); });
    ratingButtons.set(rating, button);
    get("reviews-filters").insertBefore(button, get("reviews-comments-only").closest("label"));
  }
  for (const rating of [5, 4, 3, 2, 1]) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "review-distribution-row";
    row.dataset.rating = String(rating);
    const label = document.createElement("span");
    label.className = "review-distribution-label";
    label.append(String(rating), svgStar());
    const progress = document.createElement("span");
    progress.className = "review-distribution-bar";
    progress.setAttribute("aria-hidden", "true");
    const filled = document.createElement("span");
    progress.append(filled);
    const count = document.createElement("span");
    count.className = "review-distribution-count";
    count.textContent = "0";
    row.append(label, progress, count);
    row.addEventListener("click", () => { ratingFilter = String(rating); void loadPublic(1); });
    histogramRows.set(rating, row);
    get("reviews-distribution").append(row);
  }
  for (const rating of [1, 2, 3, 4, 5]) {
    const label = document.createElement("label");
    label.className = "review-rating-option";
    label.dataset.rating = String(rating);
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "rating";
    input.value = String(rating);
    input.required = true;
    const text = document.createElement("span");
    text.className = "visually-hidden";
    text.textContent = rating + " sao";
    label.append(input, text, svgStar());
    get("review-rating").append(label);
  }
  form.addEventListener("change", renderRatingSelection);
  comment.addEventListener("input", () => { comment.setCustomValidity(""); renderRatingSelection(); });
  form.addEventListener("submit", event => { void saveReview(event); });
  get("reviews-comments-only").addEventListener("change", () => void loadPublic(1));
  get("reviews-sort").addEventListener("change", () => void loadPublic(1));
  get("reviews-retry").addEventListener("click", () => void loadPublic(currentPage));
  get("reviews-previous").addEventListener("click", () => { if (currentPage > 1) void loadPublic(currentPage - 1); });
  get("reviews-next").addEventListener("click", () => { if (currentPage < totalPages) void loadPublic(currentPage + 1); });
  get("reviews-write").addEventListener("click", () => {
    if (!product || !active) return;
    panel.hidden = false;
    void reopenEditor();
    panel.scrollIntoView({ block: "nearest", behavior: "auto" });
    get("review-cancel").focus();
  });
  get("review-cancel").addEventListener("click", () => { panel.hidden = true; get("reviews-write").focus(); });
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    panel.hidden = true;
    get("reviews-write").focus();
  });
  get("review-eligibility-retry").addEventListener("click", () => void loadOwn());
  get("review-refresh-own").addEventListener("click", () => void loadOwn(true));
  window.addEventListener("shop-account-change", event => {
    const account = event.detail?.account;
    const nextId = account && Number.isSafeInteger(account.id) ? account.id : null;
    if (nextId === observedAccountId) return;
    observedAccountId = nextId;
    clearPrivate();
  });

  function clear() {
    listController?.abort();
    listController = null;
    clearPrivate();
    product = null;
    summary = null;
    list.replaceChildren();
    setPublicControls();
  }

  function setProduct(next) {
    if (!next || !Number.isSafeInteger(next.id) || typeof next.name !== "string") { clear(); return; }
    const changed = next.id !== product?.id;
    product = { id: next.id, name: next.name };
    get("reviews-product-title").textContent = "Đánh giá " + next.name;
    const target = "/chi-tiet-san-pham.html?id=" + next.id + "#reviews";
    get("review-login").href = "/dang-nhap.html?returnTo=" + encodeURIComponent(target);
    if (!changed) return;
    clearPrivate();
    ratingFilter = "all";
    currentPage = 1;
    totalPages = 1;
    get("reviews-comments-only").checked = false;
    get("reviews-sort").value = "newest";
    if (!applySummary(next.summary)) {
      renderStars(get("reviews-stars"), 0);
      get("reviews-average").textContent = "—";
      get("reviews-count").textContent = "Đang tải đánh giá...";
    }
    void loadPublic(1);
  }

  window.ShopProductReviews = { setProduct, clear, renderStars };
  window.addEventListener("pagehide", () => { active = false; listController?.abort(); listController = null; clearPrivate(); setPublicControls(); });
  window.addEventListener("pageshow", event => { active = true; if (event.persisted && product) void loadPublic(currentPage); });
  setPublicControls();
})();
