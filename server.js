// npm i express express-rate-limit
const express = require("express");
const rateLimit = require("express-rate-limit");
const app = express();
app.use(express.json({ limit: "10kb" }));

const API_KEY = process.env.API_KEY || ""; // de trong = khong kiem tra key
const TTL = 5 * 60 * 1000;
const servers = new Map(); // key: name|jobId

// Trang web: chi 2 link hop le
const PAGES = {
  elite: { name: "Elite", title: "Elite Hunter" },
  kata: { name: "Cake Prince", title: "Katakuri (Cake Prince)" },
};
// Ten script dung khi bao / doc API (khong can sua script)
const BY_NAME = { elite: "Elite", "cake prince": "Cake Prince", kata: "Cake Prince" };
const canon = (n) => BY_NAME[String(n).toLowerCase().trim()] || null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const auth = (req, res, next) =>
  !API_KEY || req.get("x-key") === API_KEY ? next() : res.sendStatus(401);

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const k = (name, jobId) => `${name}|${jobId}`;

function getByName(name) {
  const now = Date.now(), out = [];
  for (const [key, s] of servers) {
    if (now - s.time > TTL) servers.delete(key);
    else if (s.name === name) out.push(s);
  }
  return out.sort((a, b) => b.time - a.time);
}

const STYLE = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;background:#111;color:#eee;padding:16px}
a{color:#6cf}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #333;padding:8px;word-break:break-all}th{background:#222}</style>`;

const links = `<p><a href="/elite">/elite</a> – Elite Hunter</p>
<p><a href="/kata">/kata</a> – Katakuri (Cake Prince)</p>`;

app.post("/report", limiter, auth, (req, res) => {
  const { placeId, jobId, players, maxPlayers, name } = req.body;
  const n = canon(name);
  if (!n || !placeId || !jobId || !/^[\w-]{1,64}$/.test(jobId)) return res.sendStatus(400);
  servers.set(k(n, jobId), {
    placeId: +placeId, jobId, name: n,
    players: +players || 0, maxPlayers: +maxPlayers || 0, time: Date.now(),
  });
  res.json({ ok: true });
});

app.post("/remove", limiter, auth, (req, res) => {
  const { jobId, name } = req.body;
  const n = canon(name);
  if (n && jobId) servers.delete(k(n, jobId));
  res.json({ ok: true });
});

// Script doc: /api/Elite, /api/Cake%20Prince (hoac /api/kata)
app.get("/api/:name", limiter, (req, res) => {
  const n = canon(req.params.name);
  if (!n) return res.status(404).json({ error: "Link khong hop le" });
  res.json(getByName(n));
});

app.get("/", (req, res) => res.send(`${STYLE}<h2>TopiHub</h2>${links}`));

app.get("/:slug", (req, res, next) => {
  const page = PAGES[req.params.slug]; // chi nhan dung "elite" hoac "kata"
  if (!page) return next();
  const rows = getByName(page.name).map((s) => `
    <tr><td>${s.players}/${s.maxPlayers}</td><td>${esc(s.placeId)}</td>
    <td>${esc(s.jobId)}</td><td>${Math.round((Date.now() - s.time) / 1000)}s trước</td></tr>`).join("");
  res.send(`${STYLE}<meta http-equiv="refresh" content="15"><title>${esc(page.title)} - TopiHub</title>
  <h2>${esc(page.title)}</h2>
  <table><tr><th>Người chơi</th><th>Game ID</th><th>Job ID</th><th>Cập nhật</th></tr>
  ${rows || '<tr><td colspan="4">Chưa có server nào</td></tr>'}</table>`);
});

// Moi link khac -> bao loi
app.use((req, res) =>
  res.status(404).send(`${STYLE}<title>404</title><h2>Link không hợp lệ</h2>
  <p>Chỉ có các link sau:</p>${links}`));

app.listen(process.env.PORT || 3000);
