const fs = require("fs");
const path = require("path");
const database = require("../data/database");

const SERVER_ROOT = path.join(__dirname, "..");
const STORAGE_ROOT = process.env.APP_STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || "";
const DATA_ROOT = database.DATA_DIR;
const UPLOADS_ROOT = STORAGE_ROOT ? path.join(STORAGE_ROOT, "uploads") : path.join(SERVER_ROOT, "uploads");
const BACKUPS_ROOT = path.join(DATA_ROOT, "backups");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }

  fs.cpSync(source, destination, { recursive: true });
  return true;
}

function createBackup() {
  const backupId = timestamp();
  const backupRoot = path.join(BACKUPS_ROOT, backupId);

  fs.mkdirSync(backupRoot, { recursive: true });

  const copiedDatabase = copyIfExists(database.DB_FILE, path.join(backupRoot, "app.sqlite"));
  const copiedUploads = copyIfExists(UPLOADS_ROOT, path.join(backupRoot, "uploads"));

  fs.writeFileSync(
    path.join(backupRoot, "manifest.json"),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      database: copiedDatabase,
      uploads: copiedUploads
    }, null, 2)
  );

  return backupRoot;
}

const backupRoot = createBackup();
console.log(`Backup creado en ${backupRoot}`);
