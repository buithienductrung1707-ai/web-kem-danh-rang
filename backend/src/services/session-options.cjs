const { randomBytes } = require("node:crypto");
const { getRuntime } = require("../runtime.cjs");

function getSessionOptions(name, cookieOptions) {
  const runtime = getRuntime();
  const options = {
    name,
    secret: runtime ? runtime.sessionSecret : randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      ...cookieOptions,
      secure: runtime ? "auto" : cookieOptions.secure,
      maxAge: 8 * 60 * 60 * 1000
    }
  };

  if (runtime) options.store = runtime.createSessionStore(name);
  return options;
}

module.exports = { getSessionOptions };
