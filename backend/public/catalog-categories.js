(() => {
  for (const nav of document.querySelectorAll(".catalog-nav-inner")) {
    const support = nav.querySelector('a[href="/cskh.html"]');
    if (!support || nav.querySelector('a[href="/coupon.html"]')) continue;
    const group = document.createElement("div");
    group.className = "catalog-support-shortcuts";
    const coupon = document.createElement("a");
    coupon.className = "catalog-nav-link catalog-nav-coupon";
    coupon.href = "/coupon.html";
    if (window.location.pathname === "/coupon.html") coupon.setAttribute("aria-current", "page");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none",
      stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
      "aria-hidden": "true", focusable: "false" })) icon.setAttribute(name, value);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7Zm12 0v2m0 3v2m0 3v2");
    icon.append(path);
    const label = document.createElement("span");
    label.textContent = "Coupon";
    coupon.append(icon, label);
    coupon.addEventListener("click", event => window.ShopStorefront?.prepareNavigation(event, coupon));
    support.before(group);
    group.append(coupon, support);
  }
  const grids = [...document.querySelectorAll("[data-featured-categories]")];
  const menus = [...document.querySelectorAll("[data-products-menu] .catalog-nav-menu")];
  const shortcuts = menus.map(menu => {
    const inner = menu.closest(".catalog-nav-inner");
    if (!inner) return null;
    const list = document.createElement("ul");
    list.className = "catalog-category-shortcuts";
    list.setAttribute("aria-label", "Các danh mục sản phẩm");
    list.hidden = true;
    inner.classList.add("has-category-shortcuts");
    menu.closest("[data-products-menu]").after(list);
    list.addEventListener("focusin", event => {
      const link = event.target.closest("a");
      if (link) revealShortcut(list, link);
    });
    return list;
  }).filter(Boolean);
  const tabs = document.querySelector("[data-category-tabs]");
  const status = document.getElementById("categories-status");
  const retry = document.getElementById("categories-retry");
  const categoryId = Number(document.body.dataset.categoryId) || null;
  const slugs = new URLSearchParams(window.location.search).getAll("danh-muc");
  const slug = slugs.length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugs[0]) ? slugs[0] : null;
  const isCategoryPage = categoryId !== null || (document.body.classList.contains("category-page") && slugs.length > 0);
  const directoryHeading = document.querySelector(".catalog-page .catalog-discovery-heading");
  if (directoryHeading) directoryHeading.hidden = isCategoryPage;
  let request = null;
  let categories = null;
  let active = true;

  function revealShortcut(list, link) {
    const rail = list.getBoundingClientRect();
    const target = link.getBoundingClientRect();
    if (target.left < rail.left + 4) list.scrollLeft -= rail.left + 4 - target.left;
    else if (target.right > rail.right - 4) list.scrollLeft += target.right - rail.right + 4;
  }

  function href(category) {
    const params = new URLSearchParams();
    if (category) params.set("danh-muc", category.slug);
    if (document.body.classList.contains("catalog-page")) {
      const current = new URLSearchParams(window.location.search);
      for (const key of ["q", "scope", "price", "sort", "brand"]) {
        const value = current.get(key);
        if (value) params.set(key, value);
      }
    }
    return "/danh-muc.html" + (params.size ? "?" + params : "");
  }

  function currentCategory(items) {
    return categoryId !== null ? items.find(item => item.id === categoryId)
      : items.find(item => item.slug === slug);
  }

  function navigate(event, link) {
    window.ShopStorefront?.prepareNavigation(event, link);
  }

  function validCategory(category) {
    return category && Number.isSafeInteger(category.id) && category.id > 0
      && typeof category.name === "string" && category.name.trim() !== "" && category.name.length <= 120
      && typeof category.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)
      && category.slug.length <= 80 && typeof category.description === "string"
      && typeof category.imageUrl === "string" && typeof category.imageAlt === "string"
      && category.enabled === true && Number.isSafeInteger(category.sortOrder)
      && (category.productCount === undefined || Number.isSafeInteger(category.productCount) && category.productCount >= 0);
  }

  function categoryImage(category) {
    const image = document.createElement("img");
    image.src = category.imageUrl;
    image.alt = "";
    image.width = 640;
    image.height = 640;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => { image.hidden = true; });
    return image;
  }

  function renderCards(items) {
    for (const grid of grids) {
      const cards = items.map(category => {
        const link = document.createElement("a");
        link.className = "featured-category-card";
        link.href = href(category);
        link.addEventListener("click", event => navigate(event, link));
        const photo = document.createElement("div");
        photo.className = "featured-category-photo";
        if (category.imageUrl) photo.append(categoryImage(category));
        const body = document.createElement("div");
        body.className = "featured-category-body";
        const name = document.createElement("h3");
        name.textContent = category.name;
        const arrow = document.createElement("span");
        arrow.className = "featured-category-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        body.append(name, arrow);
        link.append(photo, body);
        return link;
      });
      grid.replaceChildren(...cards);
      grid.setAttribute("aria-busy", "false");
    }
    if (status) status.textContent = items.length ? "" : "Cửa hàng đang cập nhật danh mục sản phẩm.";
    if (retry) retry.hidden = true;
  }

  function renderMenus(items) {
    const selected = isCategoryPage ? currentCategory(items) : null;
    for (const menu of menus) {
      const options = items.map(category => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = href(category);
        link.textContent = category.name;
        link.dataset.categoryId = String(category.id);
        if (selected?.id === category.id) link.setAttribute("aria-current", "page");
        link.addEventListener("click", event => navigate(event, link));
        item.append(link);
        return item;
      });
      if (options.length === 0) {
        const empty = document.createElement("li");
        empty.className = "category-menu-message";
        empty.textContent = "Danh mục đang cập nhật";
        options.push(empty);
      }
      menu.replaceChildren(...options);
      menu.setAttribute("aria-busy", "false");
      const link = menu.closest("[data-products-menu]")?.querySelector("[data-products-link]");
      if (isCategoryPage) link?.toggleAttribute("data-active-category", Boolean(selected));
    }
    for (const list of shortcuts) {
      const options = items.map(category => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "catalog-nav-link";
        link.href = href(category);
        link.textContent = category.name;
        link.dataset.categoryId = String(category.id);
        if (selected?.id === category.id) link.setAttribute("aria-current", "page");
        link.addEventListener("click", event => navigate(event, link));
        item.append(link);
        return item;
      });
      list.replaceChildren(...options);
      list.hidden = items.length === 0;
      const currentLink = list.querySelector('[aria-current="page"]');
      if (currentLink) revealShortcut(list, currentLink);
    }
  }

  function renderPage(items) {
    if (!document.body.classList.contains("category-page")) return;
    const category = isCategoryPage ? currentCategory(items) : null;
    const name = isCategoryPage ? category?.name || "Danh mục chưa khả dụng" : "Danh mục sản phẩm";
    document.title = name + " — Cửa hàng kem đánh răng";
    const intro = document.getElementById("category-intro");
    if (intro) intro.hidden = !isCategoryPage;
    const title = document.getElementById("category-title");
    if (title) title.textContent = name;
    const breadcrumb = document.getElementById("catalog-breadcrumb-category");
    if (breadcrumb) {
      breadcrumb.hidden = !isCategoryPage;
      breadcrumb.textContent = name;
    }
    const directoryCrumb = document.querySelector('.category-breadcrumb a[href="/danh-muc.html"]');
    if (directoryCrumb) {
      if (isCategoryPage) directoryCrumb.removeAttribute("aria-current");
      else directoryCrumb.setAttribute("aria-current", "page");
    }
    const directory = document.querySelector(".catalog-page .catalog-directory");
    if (directory) directory.setAttribute("aria-labelledby", isCategoryPage ? "category-title" : "catalog-title");
    const description = document.getElementById("category-description");
    if (description) {
      description.textContent = category ? category.description || (category.id === 1
        ? "Khám phá các sản phẩm kem đánh răng cho nhu cầu chăm sóc răng miệng hằng ngày. Xem thông tin, so sánh giá và lựa chọn sản phẩm phù hợp với bạn."
        : category.id === 2
          ? "Lựa chọn bàn chải đánh răng cho nhu cầu chăm sóc răng miệng của bạn. Xem thông tin sản phẩm và tình trạng còn hàng trước khi đặt mua."
          : "Khám phá các sản phẩm trong danh mục " + category.name + ". Sử dụng bộ lọc bên dưới để tìm sản phẩm phù hợp.") : "";
      description.hidden = !description.textContent;
    }
  }

  function renderTabs(items) {
    if (!tabs) return;
    const selected = isCategoryPage ? currentCategory(items) : null;
    const entries = [null, ...items].map(category => {
      const link = document.createElement("a");
      link.className = "catalog-category-pill";
      link.href = href(category);
      link.dataset.categoryId = category ? String(category.id) : "all";
      const name = document.createElement("span");
      name.textContent = category?.name || "Tất cả";
      const count = document.createElement("span");
      count.className = "catalog-category-count";
      count.textContent = String(category?.productCount ?? items.reduce((sum, item) => sum + (item.productCount || 0), 0));
      if (category ? selected?.id === category.id : !isCategoryPage) link.setAttribute("aria-current", "page");
      link.append(name, count);
      link.addEventListener("click", event => navigate(event, link));
      return link;
    });
    tabs.replaceChildren(...entries);
    tabs.setAttribute("aria-busy", "false");
  }

  function renderCatalogCounts(products) {
    if (!tabs || !categories) return;
    const counts = new Map(categories.map(category => [category.id, 0]));
    for (const product of products) {
      if (counts.has(product.categoryId)) counts.set(product.categoryId, counts.get(product.categoryId) + 1);
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    for (const link of tabs.querySelectorAll("[data-category-id]")) {
      const all = link.dataset.categoryId === "all";
      const category = all ? null : categories.find(item => item.id === Number(link.dataset.categoryId));
      const count = link.querySelector(".catalog-category-count");
      if (count) count.textContent = String(all ? total : counts.get(category?.id) ?? 0);
      link.href = href(category);
    }
    for (const menu of [...menus, ...shortcuts]) {
      for (const link of menu.querySelectorAll("[data-category-id]")) {
        const category = categories.find(item => item.id === Number(link.dataset.categoryId));
        if (category) link.href = href(category);
      }
    }
  }

  function renderError() {
    if (status) status.textContent = "Chưa tải được danh mục. Hãy thử tải lại.";
    if (retry) retry.hidden = false;
    grids.forEach(grid => grid.setAttribute("aria-busy", "false"));
    shortcuts.forEach(list => { list.hidden = true; });
    for (const menu of menus) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Tải lại danh mục";
      button.addEventListener("click", () => void load().catch(() => {}));
      item.append(button);
      menu.replaceChildren(item);
      menu.setAttribute("aria-busy", "false");
    }
  }

  function load({ refresh = false } = {}) {
    if (categories && !refresh) return Promise.resolve(categories);
    if (request) return request;
    grids.forEach(grid => grid.setAttribute("aria-busy", "true"));
    menus.forEach(menu => menu.setAttribute("aria-busy", "true"));
    if (retry) retry.disabled = true;
    request = (async () => {
      try {
        const response = await fetch("/api/categories", { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result) || !result.every(validCategory)
          || new Set(result.map(item => item.id)).size !== result.length
          || new Set(result.map(item => item.slug)).size !== result.length) {
          throw new Error("Danh mục chưa hợp lệ");
        }
        categories = result;
        if (active) {
          renderCards(result);
          renderMenus(result);
          renderPage(result);
          renderTabs(result);
        }
        return result;
      } catch (error) {
        if (active) renderError();
        throw error;
      } finally {
        request = null;
        if (retry) retry.disabled = false;
      }
    })();
    return request;
  }

  window.ShopCategories = { load, href, currentCategory, isCategoryPage, renderCatalogCounts };
  retry?.addEventListener("click", () => {
    if (window.ShopStorefront?.reloadCatalog) void window.ShopStorefront.reloadCatalog();
    else void load({ refresh: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => { active = false; });
  window.addEventListener("pageshow", event => {
    active = true;
    if (event.persisted && categories) {
      renderCards(categories);
      renderMenus(categories);
      renderPage(categories);
      renderTabs(categories);
    }
  });
  void load().catch(() => {});
})();
