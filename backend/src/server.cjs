const app = require("./app.cjs");
const { createOutboxWorker } = require("./services/email-outbox.cjs");

const server = app.listen(3000, "127.0.0.1", () => {
  console.log("Cửa hàng đang chạy tại http://127.0.0.1:3000");
});
const mailWorker = createOutboxWorker();
mailWorker.start();
server.on("close", () => mailWorker.stop());
