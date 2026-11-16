const { getOrderItems } = require("../services/orders.cjs");

const statusLabels = {
  NEW: "Mới nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};
const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng"
};

function csvCell(value, preserveText = false) {
  let text = String(value ?? "");
  // CSV text prefixes also keep phone numbers with leading zeroes intact.
  if (preserveText || /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text) ||
    /^[\t\r\n]/u.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replaceAll('"', '""') + '"';
}

function ordersToCsv(orders) {
  const header = ["Mã đơn", "Thời gian tạo (UTC)", "Trạng thái", "Người nhận",
    "Số điện thoại", "Địa chỉ", "Sản phẩm", "Tổng tiền (VND)", "Thanh toán"];
  const lines = [header.map(value => csvCell(value)).join(",")];

  for (const order of orders) {
    const orderNumber = order.orderNumber ?? order.id;
    const products = getOrderItems(order).map(item =>
      `${item.productName} × ${item.quantity} | Đơn giá ${item.unitPrice} VND | Thành tiền ${item.total} VND`
    ).join("\n");
    const createdAt = order.created_at_utc
      ? order.created_at_utc + " UTC"
      : "Thời gian chưa xác định (" + order.created_at + ")";
    const status = Object.hasOwn(statusLabels, order.status)
      ? statusLabels[order.status]
      : order.status;
    lines.push([
      csvCell(orderNumber, /^\d+$/.test(orderNumber)),
      csvCell(createdAt),
      csvCell(status),
      csvCell(order.customer_name),
      csvCell(order.customer_phone, true),
      csvCell(order.customer_address),
      csvCell(products),
      csvCell(order.total),
      csvCell(Object.hasOwn(paymentMethodLabels, order.payment_method)
        ? paymentMethodLabels[order.payment_method] : order.payment_method)
    ].join(","));
  }

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

module.exports = { ordersToCsv };
