const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "people.json");

let clients = new Set();
let currentIndex = 0;

function readPeople() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const people = JSON.parse(raw);
    return Array.isArray(people) ? people : [];
  } catch {
    return [];
  }
}

function getState() {
  const people = readPeople();
  return {
    currentIndex,
    total: people.length,
    person: people[currentIndex] || null,
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function broadcast() {
  const payload = `data: ${JSON.stringify(getState())}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") pathname = "/host.html";

  const target = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(target).toLowerCase();
    const type =
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      }[ext] || "application/octet-stream";

    res.writeHead(200, { "content-type": type });
    res.end(data);
  });
}

function handleAction(req, res, action) {
  const people = readPeople();
  if (people.length === 0) {
    currentIndex = 0;
    sendJson(res, 200, getState());
    broadcast();
    return;
  }

  if (action === "next") currentIndex = (currentIndex + 1) % people.length;
  if (action === "prev") currentIndex = (currentIndex - 1 + people.length) % people.length;
  if (action === "reset") currentIndex = 0;

  sendJson(res, 200, getState());
  broadcast();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/state") {
    sendJson(res, 200, getState());
    return;
  }

  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(getState())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    handleAction(req, res, url.pathname.slice("/api/".length));
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}`);

  console.log(`진행자 화면: http://localhost:${PORT}/host.html`);
  console.log(`참가자 화면: http://localhost:${PORT}/screen.html`);
  for (const address of addresses) {
    console.log(`같은 와이파이 기기에서 접속: ${address}`);
  }
});
