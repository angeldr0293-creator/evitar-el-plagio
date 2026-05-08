const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const STORAGE_ROOT = process.env.APP_STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || "";
const DATA_DIR = STORAGE_ROOT ? path.join(STORAGE_ROOT, "data") : __dirname;
const DB_FILE = path.join(DATA_DIR, "app.sqlite");
const LEGACY_JSON_FILES = [
  path.join(DATA_DIR, "data.json"),
  path.join(__dirname, "data.json")
].filter((file, index, files) => files.indexOf(file) === index);

const defaultState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    teacher_id TEXT DEFAULT '',
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_requests_teacher_id ON requests(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
`);

function parseRowData(row) {
  return JSON.parse(row.data);
}

function getTableCount(tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function isDatabaseEmpty() {
  return getTableCount("users") === 0
    && getTableCount("requests") === 0
    && getTableCount("subscriptions") === 0;
}

function readLegacyState() {
  for (const legacyFile of LEGACY_JSON_FILES) {
    if (!fs.existsSync(legacyFile)) {
      continue;
    }

    try {
      return { ...defaultState, ...JSON.parse(fs.readFileSync(legacyFile, "utf8")) };
    } catch (error) {
      return null;
    }
  }

  return null;
}

function replaceTableRows(tableName, rows, toValues) {
  db.prepare(`DELETE FROM ${tableName}`).run();

  rows.forEach((row) => {
    toValues(row);
  });
}

function saveState(state) {
  const nextState = { ...defaultState, ...state };

  db.exec("BEGIN IMMEDIATE");

  try {
    replaceTableRows("users", nextState.oa_users || [], (user) => {
      db.prepare("INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)").run(
        user.id,
        JSON.stringify(user)
      );
    });

    replaceTableRows("requests", nextState.oa_requests || [], (request) => {
      db.prepare("INSERT OR REPLACE INTO requests (id, user_id, teacher_id, data) VALUES (?, ?, ?, ?)").run(
        request.id,
        request.userId || "",
        request.teacherId || "",
        JSON.stringify(request)
      );
    });

    replaceTableRows("subscriptions", nextState.oa_subscriptions || [], (subscription) => {
      db.prepare("INSERT OR REPLACE INTO subscriptions (id, user_id, data) VALUES (?, ?, ?)").run(
        subscription.id,
        subscription.userId || "",
        JSON.stringify(subscription)
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function readState() {
  return {
    oa_users: db.prepare("SELECT data FROM users ORDER BY rowid").all().map(parseRowData),
    oa_requests: db.prepare("SELECT data FROM requests ORDER BY rowid DESC").all().map(parseRowData),
    oa_subscriptions: db.prepare("SELECT data FROM subscriptions ORDER BY rowid DESC").all().map(parseRowData)
  };
}

function resetState() {
  saveState(defaultState);
}

function migrateLegacyJsonIfNeeded() {
  if (!isDatabaseEmpty()) {
    return false;
  }

  const legacyState = readLegacyState();

  if (!legacyState) {
    return false;
  }

  saveState(legacyState);
  return true;
}

migrateLegacyJsonIfNeeded();

module.exports = {
  DATA_DIR,
  DB_FILE,
  readState,
  resetState,
  saveState
};
