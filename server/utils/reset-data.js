const fs = require("fs");
const path = require("path");

const dataFile = path.join(__dirname, "..", "data", "data.json");
const backupsDir = path.join(__dirname, "..", "data", "backups");
const emptyState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

if (fs.existsSync(dataFile)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupsDir, `data-${timestamp}.json`);
  fs.copyFileSync(dataFile, backupFile);
  console.log(`Backup creado en ${path.relative(process.cwd(), backupFile)}`);
}

fs.writeFileSync(dataFile, JSON.stringify(emptyState, null, 2));
console.log("Datos reiniciados en server/data/data.json");
