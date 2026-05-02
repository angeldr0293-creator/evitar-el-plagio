const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5173;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");

const defaultState = {
  oa_users: [],
  oa_requests: [],
  oa_subscriptions: []
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
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

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function serveFile(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://localhost:${PORT}`).pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/api/state" && request.method === "GET") {
    sendJson(response, 200, readState());
    return;
  }

  if (request.url === "/api/state" && request.method === "POST") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        const nextState = JSON.parse(body || "{}");
        saveState(nextState);
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  serveFile(request, response);
});

server.listen(PORT, () => {
  console.log(`Originalidad Academica listo en http://localhost:${PORT}/`);
});
