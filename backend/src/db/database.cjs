const { databasePath } = require("../../config/paths.cjs");
const { Database } = require("node:sqlite");
const { runTransaction } = require("./transaction.cjs");
const { getRuntime } = require("../runtime.cjs");

const db = getRuntime()?.database || new Database(databasePath);

db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

function initializeSchema() {
  const categoriesExist = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'product_categories'
  `).get();
  const bannersExist = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_banners'
  `).get();
  const homeSectionsExist = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_sections'
  `).get();

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      image_alt TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
      creation_key TEXT UNIQUE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS deleted_category_requests (
      creation_key TEXT PRIMARY KEY
    ) STRICT;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      total INTEGER NOT NULL CHECK (total >= 0),
      payment_method TEXT NOT NULL DEFAULT 'COD',
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      request_email TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      addresses_initialized INTEGER NOT NULL DEFAULT 0 CHECK (addresses_initialized IN (0, 1)),
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      password_salt TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
      verified_purchase INTEGER NOT NULL DEFAULT 1 CHECK (verified_purchase = 1),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
      last_request_id TEXT NOT NULL,
      last_request_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (customer_id, product_id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS product_reviews_product
      ON product_reviews(product_id, created_at, id);

    CREATE INDEX IF NOT EXISTS password_resets_customer ON password_resets(customer_id);

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
      request_id TEXT,
      creation_payload TEXT,
      UNIQUE (customer_id, request_id)
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_default
      ON customer_addresses(customer_id) WHERE is_default = 1;

    CREATE TABLE IF NOT EXISTS deleted_customer_address_requests (
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL,
      PRIMARY KEY (customer_id, request_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS email_outbox (
      id INTEGER PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      recipient TEXT NOT NULL,
      payload TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      lease_id TEXT,
      last_error TEXT NOT NULL DEFAULT '',
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox(state, next_attempt_at, locked_until);

    CREATE TABLE IF NOT EXISTS deleted_order_requests (
      request_id TEXT PRIMARY KEY
    ) STRICT;

    CREATE TABLE IF NOT EXISTS order_number_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_number INTEGER NOT NULL CHECK (last_number BETWEEN 100000 AND 9007199254740991)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS home_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
      placement TEXT NOT NULL DEFAULT 'hero' CHECK (placement IN ('hero', 'left', 'right')),
      creation_key TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      image_alt TEXT NOT NULL,
      button_label TEXT NOT NULL DEFAULT '',
      button_url TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS deleted_banner_requests (
      creation_key TEXT PRIMARY KEY
    ) STRICT;

    CREATE TABLE IF NOT EXISTS home_sections (
      key TEXT PRIMARY KEY CHECK (key IN ('best-selling', 'latest', 'featured')),
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
      subtitle TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 240),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      mode TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
      product_limit INTEGER NOT NULL DEFAULT 4 CHECK (product_limit BETWEEN 1 AND 12),
      product_ids TEXT NOT NULL DEFAULT '[]' CHECK (
        json_valid(product_ids) AND json_type(product_ids) = 'array' AND json_array_length(product_ids) <= 12
      ),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS shopping_guides (
      key TEXT PRIMARY KEY CHECK (key IN ('buying', 'unboxing')),
      video_url TEXT NOT NULL DEFAULT '' CHECK (length(video_url) <= 2048),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS support_conversations (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
      conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      author TEXT NOT NULL CHECK (author IN ('customer', 'admin')),
      request_id TEXT NOT NULL,
      text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
      created_at TEXT NOT NULL,
      UNIQUE (conversation_id, author, request_id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS support_messages_conversation
      ON support_messages(conversation_id, id);
  `);

  db.exec("INSERT INTO shopping_guides (key) VALUES ('buying'), ('unboxing') ON CONFLICT DO NOTHING");

  if (!homeSectionsExist) {
    const seedHomeSection = db.prepare("INSERT INTO home_sections (key, title, subtitle) VALUES (?, ?, ?)");
    seedHomeSection.run("best-selling", "Sản phẩm bán chạy", "Những lựa chọn được khách hàng mua nhiều nhất.");
    seedHomeSection.run("latest", "Sản phẩm mới nhất", "Cập nhật những sản phẩm vừa có mặt tại cửa hàng.");
    seedHomeSection.run("featured", "Sản phẩm nổi bật", "Lựa chọn sản phẩm nổi bật và thêm vào giỏ hàng.");
    seedHomeSection.close();
  }

  if (!categoriesExist) {
    const seedCategory = db.prepare(`
      INSERT INTO product_categories (id, slug, name, description, image_url, image_alt, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedCategory.run(1, "kem-danh-rang", "Kem đánh răng", "",
      "/kem-danh-rang.jpg", "Kem đánh răng", 1);
    seedCategory.run(2, "ban-chai-danh-rang", "Bàn chải đánh răng", "",
      "/assets/category-toothbrush.png", "Bàn chải đánh răng", 2);
    seedCategory.close();
  }

  const bannerColumns = new Set(
    db.prepare("PRAGMA table_info(home_banners)").all().map(column => column.name)
  );
  const migrateSideBanners = !bannersExist || !bannerColumns.has("placement");
  if (!bannerColumns.has("placement")) {
    db.exec(`
      ALTER TABLE home_banners RENAME TO home_banners_legacy;
      CREATE TABLE home_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id BETWEEN 1 AND 9007199254740991),
        placement TEXT NOT NULL DEFAULT 'hero' CHECK (placement IN ('hero', 'left', 'right')),
        creation_key TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL,
        image_alt TEXT NOT NULL,
        button_label TEXT NOT NULL DEFAULT '',
        button_url TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
        revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
      ) STRICT;
      INSERT INTO home_banners (
        id, title, description, image_url, image_alt, button_label, button_url,
        enabled, sort_order, revision
      ) SELECT id, title, description, image_url, image_alt, button_label, button_url,
        enabled, sort_order, ${bannerColumns.has("revision") ? "revision" : "0"}
        FROM home_banners_legacy;
      DROP TABLE home_banners_legacy;
    `);
  }

  if (!bannersExist) {
    const seedBanner = db.prepare(`
      INSERT INTO home_banners (
        id, title, description, image_url, image_alt, button_label, button_url, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, '#catalog', ?)
    `);
    const banners = [
      [1, "Chọn kem đánh răng cho mỗi ngày.",
        "Xem sản phẩm, chọn số lượng và thanh toán khi nhận hàng.",
        "/assets/dental-care-hero.png", "Kem đánh răng cùng dụng cụ chăm sóc răng miệng",
        "Khám phá sản phẩm", 1],
      [2, "Hương bạc hà cho ngày mới.",
        "Khám phá các lựa chọn kem đánh răng cho thói quen chăm sóc mỗi ngày.",
        "/assets/banner-mint.png", "Kem đánh răng và lá bạc hà tươi",
        "Xem sản phẩm", 2],
      [3, "Chăm sóc nụ cười cả nhà.",
        "Tìm sản phẩm phù hợp trong danh mục và thanh toán khi nhận hàng.",
        "/assets/banner-family.png", "Các sản phẩm chăm sóc răng miệng cho gia đình",
        "Khám phá cửa hàng", 3]
    ];
    for (const banner of banners) seedBanner.run(...banner);
    seedBanner.close();
  }

  if (migrateSideBanners) {
    const seedSideBanner = db.prepare(`
      INSERT INTO home_banners (
        placement, title, description, image_url, image_alt, button_label, button_url, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, '/kem-danh-rang.html', 0)
    `);
    seedSideBanner.run("left", "Nụ cười tươi mới", "Chăm sóc mỗi ngày",
      "/assets/side-banner-fresh.png", "Nụ cười tươi mới – Chăm sóc răng miệng mỗi ngày", "Xem sản phẩm");
    seedSideBanner.run("right", "Chăm sóc răng miệng", "Chọn kem đánh răng phù hợp",
      "/assets/side-banner-care.png", "Chăm sóc răng miệng – Chọn kem đánh răng phù hợp", "Khám phá ngay");
    seedSideBanner.close();
  }

  const customerColumns = new Set(
    db.prepare("PRAGMA table_info(customers)").all().map(column => column.name)
  );
  for (const name of ["phone", "address"]) {
    if (!customerColumns.has(name)) {
      db.exec(`ALTER TABLE customers ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
    }
  }
  if (!customerColumns.has("avatar_url")) {
    db.exec("ALTER TABLE customers ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
  if (!customerColumns.has("addresses_initialized")) {
    db.exec(`ALTER TABLE customers ADD COLUMN addresses_initialized
      INTEGER NOT NULL DEFAULT 0 CHECK (addresses_initialized IN (0, 1))`);
  }

  const orderColumns = new Set(
    db.prepare("PRAGMA table_info(orders)").all().map(column => column.name)
  );
  if (!orderColumns.has("order_number")) {
    db.exec(`ALTER TABLE orders ADD COLUMN order_number
      INTEGER CHECK (order_number BETWEEN 100001 AND 9007199254740991)`);
  }
  if (!orderColumns.has("customer_id")) {
    db.exec(`ALTER TABLE orders ADD COLUMN customer_id
      INTEGER REFERENCES customers(id) ON DELETE SET NULL`);
  }
  if (!orderColumns.has("customer_email")) {
    db.exec("ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''");
  }
  if (!orderColumns.has("request_email")) {
    db.exec("ALTER TABLE orders ADD COLUMN request_email TEXT");
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS orders_customer_created ON orders(customer_id, created_at DESC);
    INSERT INTO order_number_sequence (id, last_number) VALUES (1, 100000)
      ON CONFLICT(id) DO NOTHING;
    UPDATE order_number_sequence
    SET last_number = MAX(last_number, COALESCE((SELECT MAX(order_number) FROM orders), 100000))
    WHERE id = 1;
  `);

  const nextOrderNumber = db.prepare(`
    UPDATE order_number_sequence SET last_number = last_number + 1
    WHERE id = 1 AND last_number < 9007199254740991
    RETURNING last_number
  `);
  const assignOrderNumber = db.prepare("UPDATE orders SET order_number = ? WHERE id = ?");
  const unnumberedOrders = db.prepare(`
    SELECT id FROM orders WHERE order_number IS NULL ORDER BY created_at ASC, rowid ASC
  `).all();

  for (const order of unnumberedOrders) {
    const allocated = nextOrderNumber.get();
    if (!allocated) throw new Error("Đã đạt giới hạn mã đơn hàng.");
    assignOrderNumber.run(allocated.last_number, order.id);
  }

  const productColumns = new Set(
    db.prepare("PRAGMA table_info(products)").all().map(column => column.name)
  );
  const additions = {
    description: "TEXT NOT NULL DEFAULT ''",
    detailed_description: "TEXT NOT NULL DEFAULT ''",
    gallery_images: "TEXT NOT NULL DEFAULT '[]'",
    specifications: "TEXT NOT NULL DEFAULT '[]'",
    image_url: "TEXT NOT NULL DEFAULT ''",
    active: "INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))",
    revision: "INTEGER NOT NULL DEFAULT 0",
    creation_key: "TEXT",
    stock_tracked: "INTEGER NOT NULL DEFAULT 0 CHECK (stock_tracked IN (0, 1))",
    stock_quantity: "INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)",
    category_id: "INTEGER REFERENCES product_categories(id) ON DELETE RESTRICT"
  };

  for (const [name, definition] of Object.entries(additions)) {
    if (!productColumns.has(name)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS products_creation_key
      ON products(creation_key) WHERE creation_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS products_category ON products(category_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      total INTEGER NOT NULL CHECK (total >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      UNIQUE (order_id, product_id)
    ) STRICT;

    INSERT INTO order_items (
      order_id, product_id, product_name, quantity, unit_price, total
    )
    SELECT id, product_id, product_name, quantity, unit_price, total
    FROM orders
    WHERE NOT EXISTS (
      SELECT 1 FROM order_items WHERE order_items.order_id = orders.id
    );
  `);

  const itemColumns = new Set(
    db.prepare("PRAGMA table_info(order_items)").all().map(column => column.name)
  );
  db.exec("CREATE INDEX IF NOT EXISTS order_items_product_orders ON order_items(product_id, order_id)");
  if (!itemColumns.has("reserved_quantity")) {
    db.exec(`ALTER TABLE order_items ADD COLUMN reserved_quantity
      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0)`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS order_status_history_order
      ON order_status_history(order_id, id);

    INSERT INTO order_status_history (order_id, status, changed_at)
    SELECT id, status, CASE WHEN status = 'NEW' THEN created_at ELSE NULL END
    FROM orders
    WHERE NOT EXISTS (
      SELECT 1 FROM order_status_history WHERE order_status_history.order_id = orders.id
    );
  `);

  const seedProduct = db.prepare(`
    INSERT INTO products (id, name, price, image_url, category_id)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(id) DO NOTHING
  `);

  seedProduct.run(1, "Kem đánh răng Sensodyne – 100 g", 79000, "/kem-danh-rang.jpg");
  seedProduct.close();

  if (!productColumns.has("image_url")) {
    db.exec("UPDATE products SET image_url = '/kem-danh-rang.jpg' WHERE id = 1");
  }
  db.exec("UPDATE products SET category_id = 1 WHERE category_id IS NULL");

  if (!productColumns.has("detailed_description") || !productColumns.has("specifications")) {
    const demoProducts = db.prepare(`
      SELECT p.id, p.name, p.description, c.name AS categoryName
      FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
      WHERE p.id IN (1, 2)
    `).all();
    const updateDemo = db.prepare(`
      UPDATE products SET description = ?, detailed_description = ?, specifications = ?,
        revision = MIN(revision + 1, 9007199254740991) WHERE id = ?
    `);
    const currentDetails = db.prepare("SELECT detailed_description, specifications FROM products WHERE id = ?");
    for (const product of demoProducts) {
      const brand = product.id === 1 && /\bsensodyne\b/i.test(product.name) ? "Sensodyne"
        : product.id === 2 && /\bcrest\b/i.test(product.name) ? "Crest" : null;
      if (!brand) continue;
      const current = currentDetails.get(product.id);
      const description = ["", "abc", "abs"].includes(product.description.trim())
        ? "Kem đánh răng " + brand + ". Xem hình ảnh, giá bán và thông tin sản phẩm trước khi lựa chọn."
        : product.description;
      const detailedDescription = !productColumns.has("detailed_description")
        ? "Khám phá kem đánh răng " + brand + " trong danh mục chăm sóc răng miệng của cửa hàng.\n\n" +
          "Xem hình ảnh, giá bán và số lượng đang có trước khi thêm sản phẩm vào giỏ hàng.\n\n" +
          "Đối chiếu thành phần, quy cách và hướng dẫn sử dụng trên bao bì sản phẩm. " +
          "Cửa hàng sẽ cập nhật thông tin chi tiết khi có dữ liệu từ sản phẩm."
        : current.detailed_description;
      const specifications = !productColumns.has("specifications") ? JSON.stringify([
        { label: "Thương hiệu", value: brand },
        { label: "Danh mục", value: product.categoryName || "Kem đánh răng" }
      ]) : current.specifications;
      updateDemo.run(description, detailedDescription, specifications, product.id);
    }
  }
}

try {
  runTransaction(db, initializeSchema);
} catch (error) {
  db.close();
  throw error;
}

module.exports = db;
