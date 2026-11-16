let runtime = null;

function configureRuntime(options) {
  runtime = options;
}

function getRuntime() {
  return runtime;
}

module.exports = { configureRuntime, getRuntime };
