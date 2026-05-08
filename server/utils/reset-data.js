const fs = require("fs");
const path = require("path");
const database = require("../data/database");

const dataFile = path.join(database.DATA_DIR, "data.json");
const sqliteFile = database.DB_FILE;
const backupsDir = path.join(database.DATA_DIR, "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

if (fs.existsSync(dataFile)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const backupFile = path.join(backupsDir, `data-${timestamp}.json`);
  fs.copyFileSync(dataFile, backupFile);
  console.log(`Backup creado en ${path.relative(process.cwd(), backupFile)}`);
}

if (fs.existsSync(sqliteFile)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const backupFile = path.join(backupsDir, `app-${timestamp}.sqlite`);
  fs.copyFileSync(sqliteFile, backupFile);
  console.log(`Backup SQLite creado en ${path.relative(process.cwd(), backupFile)}`);
}

database.resetState();
console.log(`Datos reiniciados en ${path.relative(process.cwd(), sqliteFile)}`);
