const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = 5173;
const ROOT = path.join(__dirname, "..");
const CLIENT_ROOT = path.join(ROOT, "client");
const AUTH_ROOT = path.join(__dirname, "auth");
const DATA_FILE = path.join(__dirname, "data", "data.json");

const defaultState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

function readState() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2));
  }

  try {
    return { ...defaultState, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch (error) {
    return defaultState;
  }
}

function saveState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ ...defaultState, ...state }, null, 2));
}

const app = express();

app.use((request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "25mb" }));

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ ok: false, error: "Invalid JSON" });
    return;
  }
  next(error);
});

app.get("/api/state", (request, response) => {
  response.json(readState());
});

app.post("/api/state", (request, response) => {
  saveState(request.body || {});
  response.json({ ok: true });
});

app.use("/auth", express.static(AUTH_ROOT));
app.use(express.static(CLIENT_ROOT));

app.get("/", (request, response) => {
  response.sendFile(path.join(CLIENT_ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Originalidad Academica listo en http://localhost:${PORT}/`);
});
