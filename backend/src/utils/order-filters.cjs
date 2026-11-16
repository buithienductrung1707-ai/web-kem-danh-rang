const vietnamOffsetMilliseconds = 7 * 60 * 60 * 1000;

const orderFilterSql = `
  (? = '' OR status = ?)
  AND (? = '' OR customer_phone = ?)
  AND (? = '' OR datetime(created_at) >= ?)
  AND (? = '' OR datetime(created_at) < ?)
`;

function calendarDate(value) {
  if (typeof value !== "string" || value.length !== 10 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

function utcBoundary(date, nextDay = false) {
  const boundary = new Date(date.getTime());
  if (nextDay) boundary.setUTCDate(boundary.getUTCDate() + 1);
  return new Date(boundary.getTime() - vietnamOffsetMilliseconds)
    .toISOString().slice(0, 19).replace("T", " ");
}

function parseOrderFilters(query, validStatuses) {
  const status = query.status ?? "";
  const phone = query.phone ?? "";
  const fromDate = query.fromDate === undefined ? "" : query.fromDate;
  const toDate = query.toDate === undefined ? "" : query.toDate;

  if (typeof status !== "string" ||
    (status !== "" && !validStatuses.includes(status))) {
    return { error: "Trạng thái lọc chưa hợp lệ." };
  }
  if (typeof phone !== "string") {
    return { error: "Số điện thoại tìm kiếm chưa hợp lệ." };
  }

  const start = fromDate === "" ? null : calendarDate(fromDate);
  const end = toDate === "" ? null : calendarDate(toDate);
  const structuredDate = Object.keys(query).some(key => /^(fromDate|toDate)\[/.test(key));
  if (structuredDate || (fromDate !== "" && !start) || (toDate !== "" && !end)) {
    return { error: "Ngày lọc cần đúng định dạng YYYY-MM-DD và là ngày có thật." };
  }
  if (start && end && fromDate > toDate) {
    return { error: "Ngày bắt đầu cần sớm hơn hoặc trùng ngày kết thúc." };
  }

  return {
    filters: {
      status,
      phone: phone.trim(),
      fromDate,
      toDate,
      fromUtc: start ? utcBoundary(start) : "",
      toUtc: end ? utcBoundary(end, true) : ""
    }
  };
}

function orderFilterParameters(filters) {
  return [filters.status, filters.status, filters.phone, filters.phone,
    filters.fromUtc, filters.fromUtc, filters.toUtc, filters.toUtc];
}

module.exports = { parseOrderFilters, orderFilterSql, orderFilterParameters };
