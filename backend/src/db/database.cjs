const { databasePath } = require("../../config/paths.cjs");
const { Database } = require("node:sqlite");
const { runTransaction } = require("./transaction.cjs");
const { getRuntime } = require("../runtime.cjs");

const db = getRuntime()?.database || new Database(databasePath);

db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

function initializeSchema() {
  const bannersExist = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_banners'
  `).get();

  db.exec(`
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

    CREATE INDEX IF NOT EXISTS password_resets_customer ON password_resets(customer_id);

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
    image_url: "TEXT NOT NULL DEFAULT ''",
    active: "INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))",
    revision: "INTEGER NOT NULL DEFAULT 0",
    creation_key: "TEXT",
    stock_tracked: "INTEGER NOT NULL DEFAULT 0 CHECK (stock_tracked IN (0, 1))",
    stock_quantity: "INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)"
  };

  for (const [name, definition] of Object.entries(additions)) {
    if (!productColumns.has(name)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS products_creation_key
      ON products(creation_key) WHERE creation_key IS NOT NULL;

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
    INSERT INTO products (id, name, price, image_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  seedProduct.run(1, "Kem đánh răng Sensodyne – 100 g", 79000, "/kem-danh-rang.jpg");
  seedProduct.close();

  if (!productColumns.has("image_url")) {
    db.exec("UPDATE products SET image_url = '/kem-danh-rang.jpg' WHERE id = 1");
  }
}

try {
  runTransaction(db, initializeSchema);
} catch (error) {
  db.close();
  throw error;
}

module.exports = db;
