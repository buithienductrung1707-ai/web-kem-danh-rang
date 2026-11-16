const path = require("node:path");

const backendDirectory = typeof __dirname === "string" ? path.resolve(__dirname, "..") : "/bundle";

module.exports = {
  databasePath: path.join(backendDirectory, "shop.sqlite"),
  publicDirectory: path.join(backendDirectory, "public")
};
