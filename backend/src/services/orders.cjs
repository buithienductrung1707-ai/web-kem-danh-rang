const { randomUUID } = require("node:crypto");
const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");
const { enqueueOrderEmail } = require("./email-outbox.cjs");
const { normalizeRecipientEmail } = require("./mailer.cjs");

const itemsQuery = db.prepare(`
  SELECT product_id AS productId, product_name AS productName,
    quantity, unit_price AS unitPrice, total
  FROM order_items WHERE order_id = ? ORDER BY product_id
`);
const findOrder = db.prepare("SELECT * FROM orders WHERE request_id = ?");
const findDeletedRequest = db.prepare("SELECT request_id FROM deleted_order_requests WHERE request_id = ?");
const findProduct = db.prepare(`
  SELECT id, name, price, active, stock_tracked, stock_quantity, revision
  FROM products WHERE id = ?
`);
const findCustomerEmail = db.prepare("SELECT email FROM customers WHERE id = ?");
const setOrderEmail = db.prepare("UPDATE orders SET customer_email = ? WHERE id = ? AND customer_email = ''");
const reserveStock = db.prepare(`
  UPDATE products SET stock_quantity = stock_quantity - ?, revision = revision + 1
  WHERE id = ? AND stock_tracked = 1 AND stock_quantity >= ? AND revision < ?
  RETURNING id
`);
const restoreStock = db.prepare(`
  UPDATE products SET stock_quantity = stock_quantity + ?, revision = revision + 1
  WHERE id = ? AND stock_quantity <= ? AND revision < ?
  RETURNING id
`);
const reservedItemsQuery = db.prepare(`
  SELECT product_id, reserved_quantity FROM order_items
  WHERE order_id = ? AND reserved_quantity > 0 ORDER BY product_id
`);
const historyQuery = db.prepare(`
  SELECT status, changed_at AS changedAt FROM order_status_history
  WHERE order_id = ? ORDER BY id
`);
const insertHistory = db.prepare(`
  INSERT INTO order_status_history (order_id, status, admin_id) VALUES (?, ?, ?)
`);
const findOrderStatus = db.prepare(`
  SELECT * FROM orders WHERE id = ? OR CAST(order_number AS TEXT) = ?
`);
const findOrderForDeletion = db.prepare(`
  SELECT id, status, request_id, customer_id FROM orders WHERE id = ? OR CAST(order_number AS TEXT) = ?
`);
const recordDeletedRequest = db.prepare(`
  INSERT INTO deleted_order_requests (request_id) VALUES (?) ON CONFLICT DO NOTHING
`);
const deleteOrderQuery = db.prepare("DELETE FROM orders WHERE id = ?");
const nextOrderNumber = db.prepare(`
  UPDATE order_number_sequence SET last_number = last_number + 1
  WHERE id = 1 AND last_number < 9007199254740991
  RETURNING last_number
`);
const updateOrderStatus = db.prepare(`
  UPDATE orders SET status = ? WHERE id = ? AND status = ? RETURNING id, status
`);
const insertOrder = db.prepare(`
  INSERT INTO orders (
    id, order_number, request_id, customer_name, customer_phone, customer_address,
    product_id, product_name, quantity, unit_price, total, payment_method, customer_id, customer_email, request_email
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO order_items (
    order_id, product_id, product_name, quantity, unit_price, total, reserved_quantity
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function getOrderHistory(orderId) {
  return historyQuery.all(orderId);
}

function getOrderItems(order) {
  const items = itemsQuery.all(order.id);
  if (items.length > 0) return items;

  return [{
    productId: order.product_id,
    productName: order.product_name,
    quantity: order.quantity,
    unitPrice: order.unit_price,
    total: order.total
  }];
}

function receipt(order, status) {
  return {
    status,
    body: {
      orderId: order.id,
      ...(order.order_number == null ? {} : { orderNumber: String(order.order_number) }),
      total: order.total,
      paymentMethod: order.payment_method,
      status: order.status
    }
  };
}

function saveOrder(payload, items, paymentMethod, { customerId, expectedCustomerId, requestEmail }) {
  const key = payload.requestId.trim();
  if (findDeletedRequest.get(key)) {
    return {
      status: 409,
      body: { error: "Đơn hàng của lần gửi này đã bị xóa. Hãy tải lại cửa hàng trước khi đặt đơn mới." }
    };
  }

  const name = payload.customerName.trim();
  const phone = payload.customerPhone.trim();
  const address = payload.customerAddress.trim();
  const existing = findOrder.get(key);

  if (existing) {
    const savedItems = getOrderItems(existing);
    const matches = existing.customer_name === name &&
      existing.customer_phone === phone &&
      existing.customer_address === address &&
      existing.payment_method === paymentMethod &&
      (requestEmail === null || requestEmail === (existing.request_email ?? existing.customer_email)) &&
      savedItems.length === items.length &&
      savedItems.every((item, index) => {
        const expected = items[index];
        return item.productId === expected.productId &&
          item.quantity === expected.quantity &&
          item.unitPrice === expected.expectedUnitPrice &&
          (expected.expectedProductName === undefined ||
            item.productName === expected.expectedProductName);
      });

    return matches ? receipt(existing, 200) : {
      status: 409,
      body: { error: "Mã lần gửi đã được dùng cho thông tin đơn khác." }
    };
  }

  const actualCustomerId = customerId === null ? "guest" : String(customerId);
  if (expectedCustomerId !== undefined && expectedCustomerId !== actualCustomerId) {
    return {
      status: 401,
      body: { error: "Phiên tài khoản đã thay đổi. Hãy kiểm tra thông tin và xem lại đơn hàng." }
    };
  }

  const snapshots = [];
  let total = 0;

  for (const item of items) {
    const product = findProduct.get(item.productId);

    if (!product || product.active !== 1 ||
      product.price !== item.expectedUnitPrice ||
      (item.expectedProductName !== undefined && product.name !== item.expectedProductName)) {
      return {
        status: 409,
        body: { error: "Thông tin sản phẩm đã thay đổi. Hãy tải lại cửa hàng và xem lại đơn." }
      };
    }

    const lineTotal = product.price * item.quantity;
    total += lineTotal;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total)) {
      return { status: 400, body: { error: "Tổng tiền đơn hàng vượt giới hạn cho phép." } };
    }

    if (product.stock_tracked === 1 &&
      (!Number.isSafeInteger(product.stock_quantity) || product.stock_quantity < item.quantity)) {
      return {
        status: 409,
        body: { error: `Sản phẩm ${product.name} không đủ số lượng. Hãy tải lại cửa hàng và giảm số lượng.` }
      };
    }

    snapshots.push({
      ...item,
      productName: product.name,
      total: lineTotal,
      reservedQuantity: product.stock_tracked === 1 ? item.quantity : 0
    });
  }

  for (const item of snapshots) {
    if (item.reservedQuantity > 0 && !reserveStock.get(item.reservedQuantity,
      item.productId, item.reservedQuantity, Number.MAX_SAFE_INTEGER)) {
      return {
        status: 409,
        body: { error: "Số lượng sản phẩm vừa thay đổi. Hãy tải lại cửa hàng và xem lại đơn." }
      };
    }
  }

  const id = randomUUID();
  const allocated = nextOrderNumber.get();
  if (!allocated) {
    return { status: 409, body: { error: "Cửa hàng đã đạt giới hạn mã đơn hàng. Hãy liên hệ cửa hàng để được hỗ trợ." } };
  }
  const first = snapshots[0];
  const recipientEmail = customerId === null ? requestEmail ?? "" : findCustomerEmail.get(customerId)?.email ?? "";
  insertOrder.run(id, allocated.last_number, key, name, phone, address,
    first.productId, first.productName, first.quantity, first.expectedUnitPrice, total, paymentMethod,
    customerId, recipientEmail, requestEmail);

  for (const item of snapshots) {
    insertItem.run(id, item.productId, item.productName,
      item.quantity, item.expectedUnitPrice, item.total, item.reservedQuantity);
  }
  const history = insertHistory.run(id, "NEW", null);
  const savedOrder = findOrder.get(key);
  enqueueOrderEmail(savedOrder, getOrderItems(savedOrder), history.lastInsertRowid);
  return receipt(savedOrder, 201);
}

function createOrder(payload, { customerId = null, expectedCustomerId } = {}) {
  let requestEmail = null;
  if (payload.customerEmail !== undefined) {
    if (typeof payload.customerEmail !== "string" ||
      (payload.customerEmail.trim() !== "" && !normalizeRecipientEmail(payload.customerEmail))) {
      return { status: 400, body: { error: "Hãy nhập địa chỉ email nhận thông báo hợp lệ.", field: "customerEmail" } };
    }
    requestEmail = payload.customerEmail.trim().toLowerCase();
  }
  const paymentMethod = payload.paymentMethod === undefined ? "COD" : payload.paymentMethod;
  if (!["COD", "BANK_TRANSFER"].includes(paymentMethod)) {
    return {
      status: 400,
      body: { error: "Hãy chọn thanh toán khi nhận hàng hoặc chuyển khoản ngân hàng.", field: "paymentMethod" }
    };
  }

  const texts = [payload.requestId, payload.customerName,
    payload.customerPhone, payload.customerAddress];
  const items = payload.items === undefined ? [{
    productId: payload.productId,
    quantity: payload.quantity,
    expectedUnitPrice: payload.expectedUnitPrice,
    expectedProductName: payload.expectedProductName
  }] : payload.items;

  if (!texts.every(value => typeof value === "string" && value.trim() !== "") ||
    !Array.isArray(items) || items.length === 0 ||
    !items.every(item => item &&
      Number.isSafeInteger(item.productId) && item.productId > 0 &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
      Number.isSafeInteger(item.expectedUnitPrice) && item.expectedUnitPrice >= 0 &&
      Number.isSafeInteger(item.quantity * item.expectedUnitPrice) &&
      (item.expectedProductName === undefined || typeof item.expectedProductName === "string")) ||
    new Set(items.map(item => item.productId)).size !== items.length ||
    !Number.isSafeInteger(items.reduce((sum, item) =>
      sum + item.quantity * item.expectedUnitPrice, 0))) {
    return {
      status: 400,
      body: { error: "Hãy kiểm tra thông tin nhận hàng, sản phẩm, số lượng và đơn giá." }
    };
  }

  const sortedItems = [...items].sort((a, b) => a.productId - b.productId);
  return runTransaction(
    db,
    () => saveOrder(payload, sortedItems, paymentMethod, { customerId, expectedCustomerId, requestEmail }),
    { rollbackIf: result => result.status >= 400 }
  );
}

function changeOrderStatus(id, expectedStatus, targetStatus, adminId) {
  return runTransaction(db, () => {
    const current = findOrderStatus.get(id, id);
    let result;

    if (!current) {
      result = { status: 404, body: { error: "Không tìm thấy đơn hàng." } };
    } else if (current.status === targetStatus) {
      result = { status: 200, body: current };
    } else if (current.status !== expectedStatus) {
      result = { status: 409, body: { error: "Đơn hàng đã đổi trạng thái. Hãy tải lại danh sách." } };
    } else {
      if (targetStatus === "CANCELLED" && !restoreReservedStock(current.id)) {
        return {
          status: 409,
          body: { error: "Chưa thể hoàn số lượng về kho. Hãy kiểm tra số lượng sản phẩm rồi thử hủy lại." }
        };
      }

      const updated = updateOrderStatus.get(targetStatus, current.id, expectedStatus);
      const history = insertHistory.run(current.id, targetStatus, adminId);
      const recipientEmail = current.customer_email ||
        (current.customer_id == null ? "" : findCustomerEmail.get(current.customer_id)?.email ?? "");
      if (recipientEmail && !current.customer_email) setOrderEmail.run(recipientEmail, current.id);
      enqueueOrderEmail({ ...current, status: targetStatus, customer_email: recipientEmail },
        getOrderItems(current), history.lastInsertRowid);
      result = { status: 200, body: updated };
    }

    return result;
  }, { rollbackIf: result => result.status >= 400 });
}

function restoreReservedStock(orderId) {
  for (const item of reservedItemsQuery.all(orderId)) {
    if (!Number.isSafeInteger(item.reserved_quantity) ||
      !restoreStock.get(item.reserved_quantity, item.product_id,
        Number.MAX_SAFE_INTEGER - item.reserved_quantity, Number.MAX_SAFE_INTEGER)) {
      return false;
    }
  }
  return true;
}

function deleteOrder(id, expectedStatus, { customerId } = {}) {
  return runTransaction(db, () => {
    const current = findOrderForDeletion.get(id, id);
    let result;

    if (!current || (customerId !== undefined && current.customer_id !== customerId)) {
      result = { status: 404, body: { error: "Không tìm thấy đơn hàng." } };
    } else if (current.status !== expectedStatus) {
      result = {
        status: 409,
        body: { error: "Đơn hàng đã đổi trạng thái. Hãy xem lại đơn trước khi xóa." }
      };
    } else if (["NEW", "CONFIRMED"].includes(current.status) && !restoreReservedStock(current.id)) {
      result = {
        status: 409,
        body: { error: "Chưa thể hoàn số lượng về kho. Hãy kiểm tra số lượng sản phẩm rồi thử xóa lại." }
      };
    } else {
      // Giữ mã lần gửi để lần thử lại của khách không tạo lại đơn đã xóa.
      recordDeletedRequest.run(current.request_id);
      deleteOrderQuery.run(current.id);
      result = { status: 200, body: { id: current.id, deleted: true } };
    }

    return result;
  }, { rollbackIf: result => result.status >= 400 });
}

function deleteCustomerOrder(id, customerId) {
  if (!Number.isSafeInteger(customerId) || customerId < 1) {
    return { status: 401, body: { error: "Hãy đăng nhập tài khoản của bạn." } };
  }
  return deleteOrder(id, "NEW", { customerId });
}

module.exports = { createOrder, getOrderItems, getOrderHistory, changeOrderStatus, deleteOrder, deleteCustomerOrder };
