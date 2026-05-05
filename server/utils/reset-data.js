const fs = require("fs");
const path = require("path");

const dataFile = path.join(__dirname, "..", "data", "data.json");
const emptyState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

fs.writeFileSync(dataFile, JSON.stringify(emptyState, null, 2));
console.log("Datos reiniciados en server/data/data.json");
