const fs = require("node:fs");
const path = require("node:path");
const { Database } = require("node:sqlite");
const { databasePath } = require("../config/paths.cjs");

const db = new Database(databasePath, { readOnly: true });
function quoteIdentifier(name) {
  return '"' + name.replaceAll('"', '""') + '"';
}

try {
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const ordered = [];
  const visited = new Set();
  function visit(table) {
    if (visited.has(table.name)) return;
    visited.add(table.name);
    for (const relation of db.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(table.name)})`).all()) {
      const parent = tables.find(candidate => candidate.name === relation.table);
      if (parent) visit(parent);
    }
    ordered.push(table);
  }
  for (const table of tables) visit(table);
  const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all();
  const seed = {
    schema: [...tables.map(table => table.sql), ...indexes.map(index => index.sql)],
    tables: ordered.map(table => ({
      name: table.name,
      columns: db.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`).all().map(column => column.name),
      rows: db.prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`).all().map(row => Object.values(row))
    }))
  };
  const outputDirectory = path.join(__dirname, "..", ".cloudflare");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "seed.json"), JSON.stringify(seed));
  console.log(`Prepared SQLite snapshot with ${seed.tables.length} tables.`);
} finally {
  db.close();
}
