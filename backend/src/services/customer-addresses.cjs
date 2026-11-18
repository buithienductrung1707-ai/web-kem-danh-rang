const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const maximumAddresses = 5;
const maximumRevision = Number.MAX_SAFE_INTEGER;
const customerQuery = db.prepare(`
  SELECT id, name, email, phone, address, avatar_url, addresses_initialized, password_salt
  FROM customers WHERE id = ?
`);
const addressesQuery = db.prepare(`
  SELECT id, recipient_name AS recipientName, phone, address,
    is_default AS isDefault, revision
  FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id
`);
const addressQuery = db.prepare("SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?");

function customerResponse(customer) {
  const shipping = db.prepare(`
    SELECT recipient_name AS recipientName, phone, address FROM customer_addresses
    WHERE customer_id = ? AND is_default = 1
  `).get(customer.id);
  const initialized = customer.addresses_initialized ?? customerQuery.get(customer.id)?.addresses_initialized;
  const legacyShipping = initialized !== 1 && customer.phone && customer.address
    ? { recipientName: customer.name, phone: customer.phone, address: customer.address }
    : null;
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    avatarUrl: customer.avatar_url || "",
    shippingAddress: shipping || legacyShipping
  };
}

function failure(status, error, field) {
  return { status, body: { error, ...(field ? { field } : {}) } };
}

function validateName(value, field = "name") {
  return typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(value)
    ? { error: "Họ tên cần có từ 1 đến 120 ký tự.", field }
    : null;
}

function validatePhone(value, allowEmpty = false) {
  const phone = typeof value === "string" ? value.trim() : null;
  if (phone === "" && allowEmpty) return null;
  const digits = phone?.replace(/\D/g, "") || "";
  return phone === null || phone.length > 32 || !/^[+\d() -]+$/.test(phone) ||
    digits.length < 8 || digits.length > 15
    ? { error: "Số điện thoại cần có từ 8 đến 15 chữ số.", field: "phone" }
    : null;
}

function validateAddress(value, allowEmpty = false) {
  if (value === "" && allowEmpty) return null;
  return typeof value !== "string" || value.trim().length < 5 || value.trim().length > 500 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ? { error: "Địa chỉ nhận hàng cần có từ 5 đến 500 ký tự.", field: "address" }
    : null;
}

function validateAddressPayload(body) {
  return validateName(body.recipientName, "recipientName") || validatePhone(body.phone) ||
    validateAddress(body.address) ||
    (typeof body.isDefault !== "boolean"
      ? { error: "Lựa chọn địa chỉ mặc định chưa hợp lệ.", field: "isDefault" }
      : null);
}

function initializeAddresses(customer) {
  if (customer.addresses_initialized === 1) return;
  if (customer.name.trim() && customer.phone.trim() && customer.address.trim()) {
    db.prepare(`
      INSERT INTO customer_addresses (customer_id, recipient_name, phone, address, is_default)
      SELECT ?, ?, ?, ?, 1 WHERE NOT EXISTS (
        SELECT 1 FROM customer_addresses WHERE customer_id = ?
      )
    `).run(customer.id, customer.name, customer.phone, customer.address, customer.id);
  }
  db.prepare("UPDATE customers SET addresses_initialized = 1 WHERE id = ?").run(customer.id);
}

function authenticatedCustomer(customerId, salt) {
  const customer = customerQuery.get(customerId);
  if (!customer || customer.password_salt !== salt) return null;
  initializeAddresses(customer);
  return customer;
}

function addressBook(customerId) {
  return {
    addresses: addressesQuery.all(customerId).map(address => ({
      ...address,
      isDefault: address.isDefault === 1
    })),
    limit: maximumAddresses,
    customer: customerResponse(customerQuery.get(customerId))
  };
}

function withCustomer(customerId, salt, work) {
  return runTransaction(db, () => {
    const customer = authenticatedCustomer(customerId, salt);
    if (!customer) return failure(401, "Hãy đăng nhập tài khoản của bạn.");
    return work(customer);
  }, { rollbackIf: result => result.status >= 400 });
}

function getAddresses(customerId, salt) {
  return withCustomer(customerId, salt, () => ({ status: 200, body: addressBook(customerId) }));
}

function normalizeAddress(body) {
  return {
    recipientName: body.recipientName.trim(),
    phone: body.phone.trim(),
    address: body.address.trim(),
    isDefault: body.isDefault
  };
}

function setDefault(customerId, addressId) {
  const exhausted = db.prepare(`
    SELECT id FROM customer_addresses
    WHERE customer_id = ? AND is_default = 1 AND id <> ? AND revision >= ?
  `).get(customerId, addressId, maximumRevision);
  if (exhausted) throw new Error("Địa chỉ đã đạt giới hạn phiên bản.");
  db.prepare(`
    UPDATE customer_addresses SET is_default = 0, revision = revision + 1
    WHERE customer_id = ? AND is_default = 1 AND id <> ?
  `).run(customerId, addressId);
  db.prepare("UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND customer_id = ?")
    .run(addressId, customerId);
}

function synchronizeDefault(customerId) {
  const address = db.prepare(`
    SELECT recipient_name, phone, address FROM customer_addresses
    WHERE customer_id = ? AND is_default = 1
  `).get(customerId);
  if (address) {
    db.prepare("UPDATE customers SET address = ? WHERE id = ?").run(address.address, customerId);
  } else {
    db.prepare("UPDATE customers SET address = '' WHERE id = ?").run(customerId);
  }
}

function createAddress(customerId, salt, body) {
  const validation = validateAddressPayload(body);
  if (validation) return { status: 400, body: validation };
  const requestId = body.requestId ?? null;
  if (requestId !== null && (typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))) {
    return failure(400, "Mã lần thêm địa chỉ chưa hợp lệ.", "requestId");
  }
  const address = normalizeAddress(body);
  const payload = JSON.stringify(address);
  return withCustomer(customerId, salt, () => {
    if (requestId) {
      if (db.prepare(`SELECT request_id FROM deleted_customer_address_requests
        WHERE customer_id = ? AND request_id = ?`).get(customerId, requestId)) {
        return failure(409, "Địa chỉ của lần gửi này đã được xóa. Hãy tải lại sổ địa chỉ.");
      }
      const previous = db.prepare(`SELECT creation_payload FROM customer_addresses
        WHERE customer_id = ? AND request_id = ?`).get(customerId, requestId);
      if (previous) {
        return previous.creation_payload === payload
          ? { status: 200, body: addressBook(customerId) }
          : failure(409, "Mã lần gửi đã được dùng cho thông tin địa chỉ khác.");
      }
    }
    const count = db.prepare("SELECT COUNT(*) AS total FROM customer_addresses WHERE customer_id = ?")
      .get(customerId).total;
    if (count >= maximumAddresses) return failure(409, "Bạn có thể lưu tối đa 5 địa chỉ.");
    const inserted = db.prepare(`
      INSERT INTO customer_addresses (
        customer_id, recipient_name, phone, address, request_id, creation_payload
      ) VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `).get(customerId, address.recipientName, address.phone, address.address, requestId, payload);
    if (address.isDefault || count === 0) setDefault(customerId, inserted.id);
    synchronizeDefault(customerId);
    return { status: 201, body: addressBook(customerId) };
  });
}

function updateAddress(customerId, salt, addressId, body) {
  const validation = validateAddressPayload(body);
  if (validation) return { status: 400, body: validation };
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    return failure(400, "Phiên bản địa chỉ chưa hợp lệ.", "expectedRevision");
  }
  const next = normalizeAddress(body);
  return withCustomer(customerId, salt, () => {
    const address = addressQuery.get(addressId, customerId);
    if (!address) return failure(404, "Địa chỉ không còn tồn tại.");
    const unchanged = address.recipient_name === next.recipientName && address.phone === next.phone &&
      address.address === next.address && Boolean(address.is_default) === next.isDefault;
    if (unchanged) return { status: 200, body: addressBook(customerId) };
    if (address.revision !== body.expectedRevision || address.revision >= maximumRevision) {
      return failure(409, "Địa chỉ đã thay đổi. Hãy tải lại trước khi chỉnh sửa.");
    }
    // An address book with entries always has one default shipping address.
    const keepDefault = next.isDefault || address.is_default === 1;
    if (keepDefault) setDefault(customerId, addressId);
    db.prepare(`
      UPDATE customer_addresses SET recipient_name = ?, phone = ?, address = ?,
        revision = revision + 1 WHERE id = ? AND customer_id = ?
    `).run(next.recipientName, next.phone, next.address, addressId, customerId);
    synchronizeDefault(customerId);
    return { status: 200, body: addressBook(customerId) };
  });
}

function deleteAddress(customerId, salt, addressId, expectedRevision) {
  return withCustomer(customerId, salt, () => {
    const address = addressQuery.get(addressId, customerId);
    if (!address) return { status: 200, body: addressBook(customerId) };
    if (address.revision !== expectedRevision) {
      return failure(409, "Địa chỉ đã thay đổi. Hãy tải lại trước khi xóa.");
    }
    if (address.request_id) {
      db.prepare(`INSERT INTO deleted_customer_address_requests (customer_id, request_id)
        VALUES (?, ?) ON CONFLICT DO NOTHING`).run(customerId, address.request_id);
    }
    db.prepare("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?").run(addressId, customerId);
    if (address.is_default === 1) {
      const replacement = db.prepare(`
        SELECT id, revision FROM customer_addresses WHERE customer_id = ? ORDER BY id LIMIT 1
      `).get(customerId);
      if (replacement) {
        if (replacement.revision >= maximumRevision) throw new Error("Địa chỉ đã đạt giới hạn phiên bản.");
        db.prepare("UPDATE customer_addresses SET is_default = 1, revision = revision + 1 WHERE id = ?")
          .run(replacement.id);
      }
    }
    synchronizeDefault(customerId);
    return { status: 200, body: addressBook(customerId) };
  });
}

function updateProfile(customerId, salt, body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !["name", "phone", "address"].some(field => Object.hasOwn(body, field))) {
    return failure(400, "Hãy nhập thông tin cần cập nhật.");
  }
  return withCustomer(customerId, salt, customer => {
    const merged = {
      name: Object.hasOwn(body, "name") ? body.name : customer.name,
      phone: Object.hasOwn(body, "phone") ? body.phone : customer.phone,
      address: Object.hasOwn(body, "address") ? body.address : customer.address
    };
    const updatesShippingAddress = Object.hasOwn(body, "address");
    const validation = validateName(merged.name) ||
      ((Object.hasOwn(body, "phone") || updatesShippingAddress) ? validatePhone(merged.phone) : null) ||
      (updatesShippingAddress ? validateAddress(merged.address) : null);
    if (validation) return { status: 400, body: validation };
    const name = merged.name.trim();
    const phone = merged.phone.trim();
    const address = merged.address.trim();
    const defaultAddress = db.prepare(`
      SELECT id, revision FROM customer_addresses WHERE customer_id = ? AND is_default = 1
    `).get(customerId);
    if (Object.hasOwn(body, "address") && defaultAddress) {
      if (!phone || !address) return failure(400, "Hãy chỉnh sửa thông tin nhận hàng tại sổ địa chỉ.");
      const current = addressQuery.get(defaultAddress.id, customerId);
      if (name !== current.recipient_name || phone !== current.phone || address !== current.address) {
        if (defaultAddress.revision >= maximumRevision) throw new Error("Địa chỉ đã đạt giới hạn phiên bản.");
        db.prepare(`UPDATE customer_addresses
          SET recipient_name = ?, phone = ?, address = ?, revision = revision + 1 WHERE id = ?`)
          .run(name, phone, address, defaultAddress.id);
      }
    } else if (Object.hasOwn(body, "address") && phone && address && !defaultAddress) {
      db.prepare(`INSERT INTO customer_addresses
        (customer_id, recipient_name, phone, address, is_default) VALUES (?, ?, ?, ?, 1)`)
        .run(customerId, name, phone, address);
    }
    db.prepare("UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?")
      .run(name, phone, address, customerId);
    return { status: 200, body: customerResponse(customerQuery.get(customerId)) };
  });
}

module.exports = {
  customerResponse,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateProfile
};
