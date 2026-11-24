const { createHash, randomUUID } = require("node:crypto");
const db = require("../db/database.cjs");
const { runTransaction } = require("../db/transaction.cjs");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const findConversationByToken = db.prepare(`
  SELECT id, name FROM support_conversations WHERE token_hash = ?
`);
const findConversationById = db.prepare(`
  SELECT id, name FROM support_conversations WHERE id = ?
`);
const insertConversation = db.prepare(`
  INSERT INTO support_conversations (id, token_hash, name, created_at)
  VALUES (?, ?, ?, ?)
`);
const findMessages = db.prepare(`
  SELECT id, author, text, created_at AS createdAt, request_id AS requestId
  FROM support_messages WHERE conversation_id = ? AND id > ? ORDER BY id
`);
const findCustomerSummary = db.prepare(`
  SELECT conversations.id AS conversationId,
    (SELECT COUNT(*) FROM support_messages
      WHERE conversation_id = conversations.id AND author = 'admin' AND id > ?) AS unreadCount,
    COALESCE((SELECT MAX(id) FROM support_messages
      WHERE conversation_id = conversations.id AND author = 'admin'), 0) AS lastAdminId,
    COALESCE((SELECT MAX(id) FROM support_messages
      WHERE conversation_id = conversations.id), 0) AS lastMessageId
  FROM support_conversations AS conversations WHERE token_hash = ?
`);
const findMessageByRequest = db.prepare(`
  SELECT id, author, text, created_at AS createdAt, request_id AS requestId
  FROM support_messages WHERE conversation_id = ? AND author = ? AND request_id = ?
`);
const insertMessage = db.prepare(`
  INSERT INTO support_messages (conversation_id, author, request_id, text, created_at)
  VALUES (?, ?, ?, ?, ?)
  RETURNING id, author, text, created_at AS createdAt, request_id AS requestId
`);
const listConversations = db.prepare(`
  SELECT conversations.id, conversations.name, messages.text AS preview,
    messages.id AS lastMessageId, messages.author AS lastAuthor,
    messages.created_at AS updatedAt
  FROM support_conversations AS conversations
  JOIN support_messages AS messages ON messages.id = (
    SELECT MAX(latest.id) FROM support_messages AS latest
    WHERE latest.conversation_id = conversations.id
  )
  ORDER BY messages.id DESC
`);

function failure(status, error) {
  return { status, body: { error } };
}

function supportTokenHash(authorization) {
  if (typeof authorization !== "string") return null;
  const match = /^Bearer ([0-9a-f]{64})$/i.exec(authorization);
  if (!match) return null;
  return createHash("sha256").update(match[1].toLowerCase()).digest("hex");
}

function parseAfter(value) {
  if (value === undefined) return 0;
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const after = Number(value);
  return Number.isSafeInteger(after) ? after : null;
}

function parseMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    typeof body.requestId !== "string" || !uuidPattern.test(body.requestId) ||
    typeof body.text !== "string" ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.text)) {
    return null;
  }
  const text = body.text.trim();
  if (text.length < 1 || text.length > 2000) return null;
  return { requestId: body.requestId.toLowerCase(), text };
}

function getCustomerMessages(tokenHash, afterValue) {
  const after = parseAfter(afterValue);
  if (after === null) return failure(400, "Vị trí tải tin nhắn chưa hợp lệ.");
  const conversation = findConversationByToken.get(tokenHash);
  return {
    status: 200,
    body: {
      conversationId: conversation?.id ?? null,
      messages: conversation ? findMessages.all(conversation.id, after) : []
    }
  };
}

function getCustomerSummary(tokenHash, readAfterValue) {
  const readAfter = parseAfter(readAfterValue);
  if (readAfter === null) return failure(400, "Vị trí đọc tin nhắn chưa hợp lệ.");
  return {
    status: 200,
    body: findCustomerSummary.get(readAfter, tokenHash) ?? {
      conversationId: null, unreadCount: 0, lastAdminId: 0, lastMessageId: 0
    }
  };
}

function appendMessage(conversationId, author, message) {
  const existing = findMessageByRequest.get(conversationId, author, message.requestId);
  if (existing) {
    if (existing.text !== message.text) {
      return failure(409, "Mã gửi tin này đã được sử dụng với nội dung khác.");
    }
    return { status: 200, body: { conversationId, message: existing } };
  }
  const savedMessage = insertMessage.get(
    conversationId, author, message.requestId, message.text, new Date().toISOString()
  );
  return { status: 201, body: { conversationId, message: savedMessage } };
}

function sendCustomerMessage(tokenHash, body) {
  const message = parseMessage(body);
  if (!message) return failure(400, "Hãy nhập tin nhắn từ 1 đến 2.000 ký tự và mã gửi hợp lệ.");
  if (body.name !== undefined && (typeof body.name !== "string" ||
    body.name.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(body.name))) {
    return failure(400, "Tên khách hàng tối đa 120 ký tự.");
  }
  const name = body.name?.trim() || "Khách truy cập";
  return runTransaction(db, () => {
    let conversation = findConversationByToken.get(tokenHash);
    if (!conversation) {
      conversation = { id: randomUUID(), name };
      insertConversation.run(conversation.id, tokenHash, name, new Date().toISOString());
    }
    return appendMessage(conversation.id, "customer", message);
  });
}

function getSupportConversations() {
  return listConversations.all().map(conversation => ({
    ...conversation,
    preview: conversation.preview.slice(0, 160),
    awaitingReply: conversation.lastAuthor === "customer"
  }));
}

function getAdminMessages(conversationId, afterValue) {
  if (!uuidPattern.test(conversationId)) return failure(400, "Mã cuộc trò chuyện chưa hợp lệ.");
  const after = parseAfter(afterValue);
  if (after === null) return failure(400, "Vị trí tải tin nhắn chưa hợp lệ.");
  const conversation = findConversationById.get(conversationId.toLowerCase());
  if (!conversation) return failure(404, "Không tìm thấy cuộc trò chuyện.");
  return {
    status: 200,
    body: {
      conversationId: conversation.id,
      name: conversation.name,
      messages: findMessages.all(conversation.id, after)
    }
  };
}

function sendAdminMessage(conversationId, body) {
  if (!uuidPattern.test(conversationId)) return failure(400, "Mã cuộc trò chuyện chưa hợp lệ.");
  const message = parseMessage(body);
  if (!message) return failure(400, "Hãy nhập tin nhắn từ 1 đến 2.000 ký tự và mã gửi hợp lệ.");
  return runTransaction(db, () => {
    const conversation = findConversationById.get(conversationId.toLowerCase());
    if (!conversation) return failure(404, "Không tìm thấy cuộc trò chuyện.");
    return appendMessage(conversation.id, "admin", message);
  });
}

module.exports = {
  supportTokenHash,
  getCustomerMessages,
  getCustomerSummary,
  sendCustomerMessage,
  getSupportConversations,
  getAdminMessages,
  sendAdminMessage
};
