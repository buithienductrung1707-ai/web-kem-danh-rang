function runTransaction(db, work, { rollbackIf } = {}) {
  const rollbackSignal = {};
  let rollbackResult;

  function execute() {
    const result = work();
    if (rollbackIf && rollbackIf(result)) {
      rollbackResult = result;
      throw rollbackSignal;
    }
    return result;
  }

  try {
    if (typeof db.transactionSync === "function") {
      return db.transactionSync(execute);
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      const result = execute();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    if (error === rollbackSignal) return rollbackResult;
    throw error;
  }
}

module.exports = { runTransaction };
