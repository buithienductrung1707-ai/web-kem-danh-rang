const { randomBytes, scryptSync } = require("node:crypto");
const db = require("../src/db/database.cjs");

function createAdmin() {
  const username = "admin";

  const findAdmin = db.prepare(
    "SELECT id FROM admins WHERE username = ?"
  );
  const existingAdmin = findAdmin.get(username);
  findAdmin.close();

  if (existingAdmin) {
    console.log("Tài khoản admin đã được tạo trước đó.");
    return;
  }

  const password = process.env.SHOP_ADMIN_PASSWORD;

  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 128
  ) {
    throw new Error("Mật khẩu cần có từ 1 đến 128 ký tự.");
  }

  const salt = randomBytes(16).toString("hex");

  const passwordHash = scryptSync(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024
  }).toString("hex");

  const insertAdmin = db.prepare(`
    INSERT INTO admins (username, password_salt, password_hash)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO NOTHING
  `);

  const result = insertAdmin.run(username, salt, passwordHash);
  insertAdmin.close();

  console.log(
    result.changes === 1
      ? "Đã tạo tài khoản quản trị admin."
      : "Tài khoản admin đã được tạo trước đó."
  );
}

try {
  createAdmin();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
