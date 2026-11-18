(() => {
  const grids = [...document.querySelectorAll("[data-featured-categories]")];
  const menus = [...document.querySelectorAll("[data-products-menu] .catalog-nav-menu")];
  const status = document.getElementById("categories-status");
  const retry = document.getElementById("categories-retry");
  const categoryId = Number(document.body.dataset.categoryId) || null;
  const slug = new URLSearchParams(window.location.search).get("danh-muc");
  const isCategoryPage = categoryId !== null || (document.body.classList.contains("category-page") && slug !== null);
  let request = null;
  let categories = null;
  let active = true;

  function href(category) {
    return category.id === 1 ? "/kem-danh-rang.html"
      : "/san-pham.html?danh-muc=" + encodeURIComponent(category.slug);
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
      && category.enabled === true && Number.isSafeInteger(category.sortOrder);
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
  }

  function renderPage(items) {
    if (!document.body.classList.contains("category-page")) return;
    const category = isCategoryPage ? currentCategory(items) : null;
    const name = isCategoryPage ? category?.name || "Danh mục chưa khả dụng" : "Khám phá sản phẩm";
    document.title = name + " — Cửa hàng kem đánh răng";
    document.getElementById("category-title").textContent = name;
    const breadcrumb = document.querySelector(".category-breadcrumb [aria-current]");
    if (breadcrumb) breadcrumb.textContent = name;
    document.getElementById("catalog-title").textContent = category ? "Sản phẩm " + category.name.toLocaleLowerCase("vi-VN") : "Sản phẩm";
    const description = document.getElementById("category-description");
    if (description) {
      description.textContent = category?.description || "";
      description.hidden = !description.textContent;
    }
    if (document.body.dataset.catalogPage === "dynamic") {
      const media = document.querySelector(".category-intro-media");
      const image = media?.querySelector("img");
      if (media && image) {
        media.hidden = !category?.imageUrl;
        if (category?.imageUrl) {
          image.src = category.imageUrl;
          image.alt = category.imageAlt || category.name;
          image.addEventListener("error", () => { media.hidden = true; }, { once: true });
        }
      }
    }
  }

  function renderError() {
    if (status) status.textContent = "Chưa tải được danh mục. Hãy thử tải lại.";
    if (retry) retry.hidden = false;
    grids.forEach(grid => grid.setAttribute("aria-busy", "false"));
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

  function load() {
    if (categories) return Promise.resolve(categories);
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

  window.ShopCategories = { load, href, currentCategory, isCategoryPage };
  retry?.addEventListener("click", () => void load().catch(() => {}));
  window.addEventListener("pagehide", () => { active = false; });
  window.addEventListener("pageshow", event => {
    active = true;
    if (event.persisted && categories) {
      renderCards(categories);
      renderMenus(categories);
      renderPage(categories);
    }
  });
  void load().catch(() => {});
})();
