(() => {
  const shell = document.querySelector(".account-shell");
  const dashboard = document.getElementById("account-signed-in");
  const commerce = document.getElementById("account-commerce-view");
  if (!shell || !dashboard || !commerce) return;

  const requested = new URLSearchParams(window.location.search).get("view");
  const currentView = ["cart", "checkout", "orders"].includes(requested) ? requested : "profile";
  const isCommerce = currentView !== "profile";
  const title = { profile: "Thông tin tài khoản", cart: "Giỏ hàng", checkout: "Xác nhận đặt hàng", orders: "Đơn hàng của tôi" }[currentView];
  const host = document.getElementById("workspace-commerce-content");
  const loading = document.getElementById("workspace-loading");
  const errorPanel = document.getElementById("workspace-load-error");
  const retry = document.getElementById("workspace-load-retry");
  let fragmentMounted = false;
  let scriptPromise = null;
  let loadingContent = false;
  let reloadRequired = false;

  function open(view) {
    if (!["profile", "cart", "checkout", "orders"].includes(view)) return false;
    const target = "/dang-nhap.html" + (view === "profile" ? "" : "?view=" + view);
    const event = { preventDefault() {} };
    if (window.ShopStorefront?.prepareNavigation(event, target) === false) return false;
    window.location.assign(target);
    return true;
  }

  function renderAccount(account) {
    const visible = Boolean(account) || isCommerce;
    dashboard.hidden = !visible;
    shell.classList.toggle("has-account-dashboard", visible);
    document.getElementById("account-form-panel").hidden = Boolean(account) || isCommerce;
    document.getElementById("account-settings-view").hidden = isCommerce || !account;
    commerce.hidden = !isCommerce;
    document.getElementById("workspace-page-title").textContent = title;
    document.getElementById("workspace-breadcrumb-current").textContent = title;
    document.getElementById("workspace-cart-breadcrumb").hidden = currentView !== "checkout";
    document.getElementById("workspace-cart-separator").hidden = currentView !== "checkout";
    if (visible) document.title = title + " — Cửa hàng kem đánh răng";
    for (const link of dashboard.querySelectorAll("[data-account-view]")) {
      const active = link.dataset.accountView === (currentView === "checkout" ? "cart" : currentView);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    dashboard.querySelector(".account-dashboard-customer-code").hidden = !account;
    document.getElementById("account-logout").hidden = !account;
    const login = document.getElementById("workspace-login");
    login.hidden = Boolean(account);
    login.href = "/dang-nhap.html?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search);
    if (!account && isCommerce) {
      document.getElementById("account-customer-name").textContent = "Khách mua hàng";
      document.getElementById("dashboard-customer-phone").textContent = "Chưa đăng nhập";
      const avatar = dashboard.querySelector(".dashboard-avatar-small");
      avatar.textContent = "KH";
      avatar.style.removeProperty("--account-avatar-background");
      avatar.style.removeProperty("--account-avatar-text");
    }
  }

  function loadController(src) {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      const timeout = window.setTimeout(() => {
        reloadRequired = true;
        reject(new Error("Tải chương trình quá thời gian chờ"));
      }, 15000);
      script.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        if (!reloadRequired) scriptPromise = null;
        reject(new Error("Không tải được chương trình"));
      };
      document.body.append(script);
    });
    return scriptPromise;
  }

  async function loadContent() {
    if (!isCommerce || loadingContent) return;
    loadingContent = true;
    loading.hidden = false;
    errorPanel.hidden = true;
    retry.disabled = true;
    try {
      const orders = currentView === "orders";
      if (!fragmentMounted) {
        const response = await fetch(orders ? "/account-orders.html" : "/account-cart.html", {
          credentials: "same-origin",
          signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error("Không tải được nội dung");
        const documentFragment = new DOMParser().parseFromString(await response.text(), "text/html");
        const panel = documentFragment.querySelector(orders ? "#account-orders-view" : ".account-cart-workspace");
        if (!panel || documentFragment.querySelector("script")) throw new Error("Nội dung chưa hợp lệ");
        const mounted = document.importNode(panel, true);
        mounted.hidden = false;
        host.replaceChildren(mounted);
        fragmentMounted = true;
      }
      await loadController(orders ? "/order-history.js" : "/app.js");
      reloadRequired = orders ? !window.ShopOrders : !window.ShopStorefront?.workspaceRender;
      if (orders) {
        if (!window.ShopOrders) throw new Error("Chưa khởi tạo được đơn hàng");
        window.ShopOrders.setActive(true);
      } else {
        if (!window.ShopStorefront?.workspaceRender) throw new Error("Chưa khởi tạo được giỏ hàng");
        window.ShopStorefront.workspaceRender(currentView);
      }
      window.dispatchEvent(new CustomEvent("shop-workspace-view", { detail: { view: currentView } }));
    } catch {
      document.getElementById("workspace-load-message").textContent = "Chưa tải được nội dung. Kiểm tra kết nối rồi thử lại.";
      retry.textContent = reloadRequired ? "Tải lại trang" : "Thử tải lại";
      errorPanel.hidden = false;
    } finally {
      loading.hidden = true;
      retry.disabled = false;
      loadingContent = false;
    }
  }

  window.ShopAccountWorkspace = { currentView, open, renderAccount };
  retry.addEventListener("click", () => {
    if (reloadRequired) window.location.reload();
    else void loadContent();
  });
  if (isCommerce) {
    renderAccount(null);
    void loadContent();
  }
})();
