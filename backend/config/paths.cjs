const path = require("node:path");

const backendDirectory = path.resolve(__dirname, "..");

module.exports = {
  databasePath: path.join(backendDirectory, "shop.sqlite"),
  publicDirectory: path.join(backendDirectory, "public")
};
