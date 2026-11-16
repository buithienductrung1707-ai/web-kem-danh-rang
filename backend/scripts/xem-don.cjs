const { databasePath } = require("../config/paths.cjs");
const { Database } = require("node:sqlite");

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND"
});
const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng"
};

const db = new Database(databasePath, {
  readOnly: true
});

try {
  const hasOrderNumbers = db.prepare("PRAGMA table_info(orders)").all()
    .some(column => column.name === "order_number");
  const ordersQuery = db.prepare(`
    SELECT
      id, ${hasOrderNumbers ? "CAST(order_number AS TEXT)" : "NULL"} AS orderNumber,
      customer_name, customer_phone, customer_address,
      product_name, quantity, unit_price, total,
      payment_method, status, created_at
    FROM orders
    ORDER BY created_at DESC, rowid DESC 
    LIMIT 20
  `);

  const orders = ordersQuery.all();
  ordersQuery.close();
  const hasItems = db.prepare("SELECT name FROM sqlite_master WHERE name = 'order_items'").get();
  const itemsQuery = hasItems ? db.prepare(`
    SELECT product_name, quantity, unit_price, total
    FROM order_items WHERE order_id = ? ORDER BY product_id
  `) : null;

  if (orders.length === 0) {
    console.log("Chưa có đơn hàng.");
  }

  for (const order of orders) {
    console.log("\nMã đơn " + (order.orderNumber ?? order.id));

    console.table({
      "Người nhận": order.customer_name,
      "Điện thoại": order.customer_phone,
      "Địa chỉ": order.customer_address,
      "Tiền sản phẩm": money.format(order.total),
      "Thanh toán": Object.hasOwn(paymentMethodLabels, order.payment_method)
        ? paymentMethodLabels[order.payment_method] : order.payment_method,
      "Trạng thái": order.status,
      "Thời gian tạo (UTC)": order.created_at
    });

    const items = itemsQuery?.all(order.id) ?? [];
    const lines = items.length > 0 ? items : [order];
    console.table(lines.map(item => ({
      "Sản phẩm": item.product_name,
      "Số lượng": item.quantity,
      "Đơn giá": money.format(item.unit_price),
      "Thành tiền": money.format(item.total)
    })));
  }
} finally {
  db.close();
}
