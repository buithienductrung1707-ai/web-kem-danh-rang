const { AsyncLocalStorage } = require("node:async_hooks");
const { randomBytes } = require("node:crypto");
const { Store } = require("express-session");

const storageContext = new AsyncLocalStorage();
const imageChunkBytes = 256 * 1024;

function storage() {
  const current = storageContext.getStore();
  if (!current) throw new Error("Database context is unavailable.");
  return current;
}

function withStorage(current, callback) {
  return storageContext.run(current, callback);
}

const database = {
  exec(sql) {
    // Durable Objects enforce foreign keys and manage locking internally.
    const statement = sql.replace(/PRAGMA\s+(?:foreign_keys\s*=\s*ON|busy_timeout\s*=\s*5000)\s*;/gi, "").trim();
    if (statement) storage().sql.exec(statement).toArray();
  },
  prepare(sql) {
    return {
      all(...parameters) {
        return storage().sql.exec(sql, ...parameters).toArray();
      },
      get(...parameters) {
        return this.all(...parameters)[0];
      },
      run(...parameters) {
        this.all(...parameters);
        return storage().sql.exec("SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid").one();
      },
      close() {}
    };
  },
  transactionSync(callback) {
    return storage().transactionSync(callback);
  },
  close() {}
};

function initializeStorage(seed) {
  database.transactionSync(() => {
    const initialized = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").get();
    if (!initialized) {
      for (const statement of seed.schema) database.exec(statement);
      for (const table of seed.tables) {
        const columns = table.columns.map(name => '"' + name.replaceAll('"', '""') + '"').join(", ");
        const name = '"' + table.name.replaceAll('"', '""') + '"';
        const insert = database.prepare(`INSERT INTO ${name} (${columns}) VALUES (${table.columns.map(() => "?").join(", ")})`);
        for (const row of table.rows) insert.run(...row);
      }
    }
    database.exec(`
      CREATE TABLE IF NOT EXISTS shop_sessions (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (namespace, id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS shop_sessions_expiry ON shop_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS shop_runtime_settings (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS shop_images (
        filename TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS shop_image_chunks (
        filename TEXT NOT NULL REFERENCES shop_images(filename) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        content BLOB NOT NULL,
        PRIMARY KEY (filename, position)
      ) STRICT;
    `);
    database.prepare("INSERT INTO shop_runtime_settings (name, value) VALUES ('session-secret', ?) ON CONFLICT DO NOTHING")
      .run(randomBytes(32).toString("hex"));
  });
  return database.prepare("SELECT value FROM shop_runtime_settings WHERE name = 'session-secret'").get().value;
}

class DurableSessionStore extends Store {
  constructor(namespace) {
    super();
    this.namespace = namespace;
  }

  get(id, callback) {
    try {
      const row = database.prepare("SELECT payload FROM shop_sessions WHERE namespace = ? AND id = ? AND expires_at > ?")
        .get(this.namespace, id, Date.now());
      callback(null, row ? JSON.parse(row.payload) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(id, session, callback = () => {}) {
    try {
      const expiresAt = session.cookie?.expires ? new Date(session.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000;
      database.transactionSync(() => {
        database.prepare("DELETE FROM shop_sessions WHERE expires_at <= ?").run(Date.now());
        database.prepare(`INSERT INTO shop_sessions (namespace, id, payload, expires_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(namespace, id) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at`)
          .run(this.namespace, id, JSON.stringify(session), expiresAt);
      });
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(id, session, callback) {
    this.set(id, session, callback);
  }

  destroy(id, callback = () => {}) {
    try {
      database.prepare("DELETE FROM shop_sessions WHERE namespace = ? AND id = ?").run(this.namespace, id);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

function saveImage(filename, data, contentType) {
  return database.transactionSync(() => {
    if (database.prepare("SELECT filename FROM shop_images WHERE filename = ?").get(filename)) return false;
    database.prepare("INSERT INTO shop_images (filename, content_type, byte_length) VALUES (?, ?, ?)")
      .run(filename, contentType, data.length);
    const insert = database.prepare("INSERT INTO shop_image_chunks (filename, position, content) VALUES (?, ?, ?)");
    for (let offset = 0; offset < data.length; offset += imageChunkBytes) {
      const chunk = data.subarray(offset, offset + imageChunkBytes);
      insert.run(filename, offset / imageChunkBytes, chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
    }
    return true;
  });
}

function imageResponse(filename, request) {
  const metadata = database.prepare("SELECT content_type, byte_length FROM shop_images WHERE filename = ?").get(filename);
  if (!metadata) return null;
  const headers = {
    "Content-Type": metadata.content_type,
    "Content-Length": String(metadata.byte_length),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff"
  };
  if (request.method === "HEAD") return new Response(null, { headers });
  const data = new Uint8Array(metadata.byte_length);
  const chunks = database.prepare("SELECT content FROM shop_image_chunks WHERE filename = ? ORDER BY position").all(filename);
  let offset = 0;
  for (const chunk of chunks) {
    const bytes = new Uint8Array(chunk.content);
    data.set(bytes, offset);
    offset += bytes.length;
  }
  return new Response(data, { headers });
}

module.exports = { database, withStorage, initializeStorage, DurableSessionStore, saveImage, imageResponse };
