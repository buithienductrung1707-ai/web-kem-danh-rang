(() => {
  const receiptKey = "toothpaste-receipts";
  const phoneKey = "toothpaste-order-phones";
  const trackingKey = "toothpaste-tracking-handoff";
  const reorderKey = "toothpaste-reorder";
  const placedOrderKey = "toothpaste-placed-order";
  let memoryReceipts = [];
  let unsavedReceipts = false;
  let receiptReadFailed = false;

  function validText(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  function validOrderNumber(value) {
    return value === undefined || value === null || (typeof value === "string" &&
      Number.isSafeInteger(Number(value)) && Number(value) >= 100001 && String(Number(value)) === value);
  }

  function mergeReceipts(receipts) {
    const unique = new Map();
    for (const receipt of [...receipts].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))) {
      const existing = unique.get(receipt.orderId);
      if (!existing) unique.set(receipt.orderId, receipt);
      else if (existing.orderNumber === undefined && receipt.orderNumber !== undefined) {
        unique.set(receipt.orderId, { ...existing, orderNumber: receipt.orderNumber });
      }
    }
    return [...unique.values()].slice(0, 10);
  }

  function readReceipts() {
    try {
      const receipts = JSON.parse(localStorage.getItem(receiptKey) ?? "[]");
      if (!Array.isArray(receipts) || !receipts.every(receipt => receipt &&
        validText(receipt.orderId) && validOrderNumber(receipt.orderNumber) &&
        Number.isSafeInteger(receipt.total) && receipt.total >= 0 &&
        typeof receipt.savedAt === "string" && Number.isFinite(Date.parse(receipt.savedAt)))) {
        throw new Error("Danh sách đơn đã lưu chưa hợp lệ");
      }
      const sanitized = receipts.map(receipt => {
        const record = { orderId: receipt.orderId.trim(), total: receipt.total, savedAt: receipt.savedAt };
        const orderNumber = receipt.orderNumber ?? memoryReceipts.find(item => item.orderId === record.orderId)?.orderNumber;
        if (typeof orderNumber === "string") record.orderNumber = orderNumber;
        return record;
      });
      receiptReadFailed = false;
      memoryReceipts = mergeReceipts(unsavedReceipts ? [...memoryReceipts, ...sanitized] : sanitized);
      return {
        receipts: memoryReceipts.map(receipt => ({ ...receipt })),
        error: unsavedReceipts ? "Một số mã đơn chưa lưu được vào trình duyệt. Hãy sao chép mã đơn cần giữ." : ""
      };
    } catch {
      receiptReadFailed = true;
      return {
        receipts: memoryReceipts.map(receipt => ({ ...receipt })),
        error: "Đọc mã đơn đã lưu gặp lỗi. Hãy sao chép mã đơn đang hiển thị để giữ lại."
      };
    }
  }

  function readPhones() {
    const phones = JSON.parse(sessionStorage.getItem(phoneKey) ?? "[]");
    if (!Array.isArray(phones) || !phones.every(entry => entry &&
      validText(entry.orderId) && validOrderNumber(entry.orderNumber) && validText(entry.customerPhone))) {
      return [];
    }
    return phones.map(entry => ({ orderId: entry.orderId.trim(), orderNumber: entry.orderNumber,
      customerPhone: entry.customerPhone.trim() }));
  }

  function saveReceipt(receipt, customerPhone) {
    if (!receipt || !validText(receipt.orderId) || !validOrderNumber(receipt.orderNumber) ||
      !Number.isSafeInteger(receipt.total) || receipt.total < 0 || !validText(customerPhone)) {
      return { error: "Thông tin mã đơn cần lưu chưa hợp lệ." };
    }
    const orderId = receipt.orderId.trim();
    const previousReceipts = readReceipts().receipts;
    const orderNumber = receipt.orderNumber ?? previousReceipts.find(item => item.orderId === orderId)?.orderNumber;
    const record = { orderId, total: receipt.total, savedAt: new Date().toISOString() };
    if (orderNumber !== undefined) record.orderNumber = orderNumber;
    memoryReceipts = [record, ...previousReceipts.filter(item => item.orderId !== orderId)].slice(0, 10);
    const messages = [];
    if (receiptReadFailed) {
      unsavedReceipts = true;
      messages.push("Chưa đọc được danh sách mã đơn đã lưu. Mã mới đang hiển thị trong trang này, hãy sao chép mã để giữ lại.");
    } else {
      try {
        localStorage.setItem(receiptKey, JSON.stringify(memoryReceipts));
        unsavedReceipts = false;
      } catch {
        unsavedReceipts = true;
        messages.push("Mã đơn chỉ đang hiển thị trong trang này. Hãy sao chép mã để giữ lại.");
      }
    }
    try {
      const phones = readPhones();
      sessionStorage.setItem(phoneKey, JSON.stringify([
        { orderId, orderNumber, customerPhone: customerPhone.trim() },
        ...phones.filter(item => item.orderId !== orderId)
      ].slice(0, 10)));
    } catch {
      messages.push("Chưa nhớ được số điện thoại trong phiên này. Bạn có thể nhập lại khi tra cứu.");
    }
    return { error: messages.join(" ") };
  }

  function forgetReceipts() {
    const messages = [];
    try {
      localStorage.removeItem(receiptKey);
      memoryReceipts = [];
      unsavedReceipts = false;
      receiptReadFailed = false;
    } catch {
      messages.push("Xóa danh sách mã đơn đã lưu gặp lỗi. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt.");
    }
    for (const key of [phoneKey, trackingKey, placedOrderKey]) {
      try { sessionStorage.removeItem(key); } catch {
        messages.push("Xóa thông tin tra cứu trong phiên gặp lỗi.");
      }
    }
    return { error: [...new Set(messages)].join(" ") };
  }

  function prepareTracking(orderId, customerPhone = "") {
    if (!validText(orderId) || typeof customerPhone !== "string") {
      return { error: "Mã đơn cần tra cứu chưa hợp lệ." };
    }
    try {
      let phone = customerPhone.trim();
      if (phone === "") {
        try {
          const canonicalId = memoryReceipts.find(receipt => receipt.orderNumber === orderId.trim())?.orderId;
          phone = readPhones().find(entry => entry.orderId === orderId.trim() ||
            entry.orderNumber === orderId.trim() || entry.orderId === canonicalId)?.customerPhone ?? "";
        } catch { phone = ""; }
      }
      sessionStorage.setItem(trackingKey, JSON.stringify({
        version: 1, orderId: orderId.trim(), customerPhone: phone
      }));
      return { error: "" };
    } catch {
      return { error: "Chưa chuyển được thông tin tra cứu. Hãy nhập số điện thoại tại trang tra cứu." };
    }
  }

  function takeTracking() {
    try {
      const value = sessionStorage.getItem(trackingKey);
      if (value === null) return { tracking: null, error: "" };
      // Consume first so a reload cannot automatically repeat the same lookup.
      sessionStorage.removeItem(trackingKey);
      const tracking = JSON.parse(value);
      if (tracking?.version !== 1 || !validText(tracking.orderId) ||
        typeof tracking.customerPhone !== "string") {
        return { tracking: null, error: "Thông tin tra cứu đã lưu chưa hợp lệ. Hãy nhập lại mã đơn và số điện thoại." };
      }
      return {
        tracking: { orderId: tracking.orderId.trim(), customerPhone: tracking.customerPhone.trim() }, error: ""
      };
    } catch {
      return { tracking: null, error: "Đọc thông tin tra cứu gặp lỗi. Hãy nhập lại mã đơn và số điện thoại." };
    }
  }

  function validPlacedReceipt(receipt) {
    return receipt && typeof receipt.orderId === "string" && receipt.orderId.length <= 128
      && validText(receipt.orderId) && validOrderNumber(receipt.orderNumber)
      && Number.isSafeInteger(receipt.total) && receipt.total >= 0
      && ["COD", "BANK_TRANSFER"].includes(receipt.paymentMethod)
      && ["NEW", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"].includes(receipt.status);
  }

  function validPlacedContext(customerId) {
    return customerId === null || (Number.isSafeInteger(customerId) && customerId > 0);
  }

  function preparePlacedOrder(receipt, customerId) {
    if (!validPlacedReceipt(receipt) || !validPlacedContext(customerId)) {
      return { error: "Chưa chuyển được thông tin đơn hàng. Mã đơn vẫn được giữ trên trang này." };
    }
    const clean = { orderId: receipt.orderId.trim(), total: receipt.total,
      paymentMethod: receipt.paymentMethod, status: receipt.status };
    if (receipt.orderNumber != null) clean.orderNumber = receipt.orderNumber;
    try {
      sessionStorage.setItem(placedOrderKey, JSON.stringify({
        version: 1, receipt: clean, customerId, expiresAt: Date.now() + 5 * 60 * 1000
      }));
      return { error: "" };
    } catch {
      return { error: "Chưa chuyển được thông tin đơn hàng. Hãy giữ mã đơn đang hiển thị và bấm Xem đơn hàng của tôi để tiếp tục." };
    }
  }

  function takePlacedOrder(customerId) {
    try {
      const raw = sessionStorage.getItem(placedOrderKey);
      if (raw === null) return { receipt: null, error: "" };
      sessionStorage.removeItem(placedOrderKey);
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !validPlacedReceipt(value.receipt)
          || !validPlacedContext(value.customerId) || !validPlacedContext(customerId)
          || value.customerId !== customerId || !Number.isSafeInteger(value.expiresAt)
          || value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 5 * 60 * 1000) {
        return { receipt: null, error: "" };
      }
      const receipt = { orderId: value.receipt.orderId.trim(), total: value.receipt.total,
        paymentMethod: value.receipt.paymentMethod, status: value.receipt.status };
      if (value.receipt.orderNumber != null) receipt.orderNumber = value.receipt.orderNumber;
      return { receipt, error: "" };
    } catch {
      return { receipt: null, error: "Chưa đọc được thông báo nhận đơn. Bạn có thể mở Tra cứu đơn hàng bằng mã đã nhận." };
    }
  }

  function validItems(items) {
    return Array.isArray(items) && items.length > 0 &&
      items.every(item => item && Number.isSafeInteger(item.productId) && item.productId > 0 &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0) &&
      new Set(items.map(item => item.productId)).size === items.length;
  }

  function queueReorder(orderId, items) {
    if (!validText(orderId) || !validItems(items)) {
      return { error: "Sản phẩm của đơn này chưa đủ thông tin để thêm lại vào giỏ." };
    }
    try {
      const intentId = crypto.randomUUID();
      sessionStorage.setItem(reorderKey, JSON.stringify({
        version: 1, intentId, orderId: orderId.trim(),
        items: items.map(item => ({ productId: item.productId, quantity: item.quantity }))
      }));
      return { intentId, error: "" };
    } catch {
      return { error: "Chưa chuyển được sản phẩm vào giỏ. Kiểm tra quyền lưu dữ liệu rồi thử lại." };
    }
  }

  function readReorder() {
    try {
      const value = sessionStorage.getItem(reorderKey);
      if (value === null) return { reorder: null, error: "" };
      const reorder = JSON.parse(value);
      if (reorder?.version !== 1 || !validText(reorder.intentId) ||
        !validText(reorder.orderId) || !validItems(reorder.items)) {
        return { reorder: null, error: "Danh sách sản phẩm cần thêm lại chưa hợp lệ. Hãy mở lại đơn và thử lại." };
      }
      return {
        reorder: {
          version: 1, intentId: reorder.intentId.trim(), orderId: reorder.orderId.trim(),
          items: reorder.items.map(item => ({ productId: item.productId, quantity: item.quantity }))
        }, error: ""
      };
    } catch {
      return { reorder: null, error: "Đọc sản phẩm cần thêm lại gặp lỗi. Kiểm tra quyền lưu dữ liệu rồi thử lại." };
    }
  }

  function clearReorder(intentId) {
    const { reorder, error } = readReorder();
    if (error) return { error };
    if (!reorder || reorder.intentId !== intentId) return { error: "" };
    try {
      sessionStorage.removeItem(reorderKey);
      return { error: "" };
    } catch {
      return { error: "Chưa xóa được lần thêm lại đã xử lý trong phiên này." };
    }
  }

  window.ShopMemory = {
    readReceipts, saveReceipt, forgetReceipts, prepareTracking, takeTracking,
    queueReorder, readReorder, clearReorder, preparePlacedOrder, takePlacedOrder
  };
})();
