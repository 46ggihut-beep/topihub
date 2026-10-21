// npm i express express-rate-limit
const express = require("express");
const rateLimit = require("express-rate-limit");
const app = express();
app.use(express.json({ limit: "10kb" }));

const API_KEY = process.env.API_KEY || ""; // dat trung voi TopiHub.Key trong script
const TTL = 5 * 60 * 1000;
const servers = new Map(); // key: name|jobId

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const auth = (req, res, next) =>
  !API_KEY || req.get("x-key") === API_KEY ? next() : res.sendStatus(401);

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const k = (name, jobId) => `${String(name).toLowerCase()}|${jobId}`;

function getByName(name) {
  const now = Date.now(), out = [];
  for (const [key, s] of servers) {
    if (now - s.time > TTL) servers.delete(key);
    else if (s.name.toLowerCase() === name.toLowerCase()) out.push(s);
  }
  return out.sort((a, b) => b.time - a.time);
}

app.post("/report", limiter, auth, (req, res) => {
  const { placeId, jobId, players, maxPlayers, name } = req.body;
  if (!placeId || !jobId || !name || !/^[\w-]{1,64}$/.test(jobId)) return res.sendStatus(400);
  const n = String(name).slice(0, 50);
  servers.set(k(n, jobId), {
    placeId: +placeId, jobId, name: n,
    players: +players || 0, maxPlayers: +maxPlayers || 0, time: Date.now(),
  });
  res.json({ ok: true });
});

// Boss/Elite het -> script goi de go server khoi danh sach
app.post("/remove", limiter, auth, (req, res) => {
  const { jobId, name } = req.body;
  if (jobId && name) servers.delete(k(name, jobId));
  res.json({ ok: true });
});

app.get("/api/:name", limiter, (req, res) => res.json(getByName(req.params.name)));

app.get("/:name", (req, res) => {
  const name = req.params.name;
  const rows = getByName(name).map((s) => `
    <tr><td>${s.players}/${s.maxPlayers}</td><td>${esc(s.placeId)}</td>
    <td>${esc(s.jobId)}</td><td>${Math.round((Date.now() - s.time) / 1000)}s trước</td></tr>`).join("");
  res.send(`<!doctype html><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="15">
  <title>${esc(name)} - TopiHub</title>
  <style>body{font-family:sans-serif;background:#111;color:#eee;padding:16px}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:8px;word-break:break-all}
  th{background:#222}</style>
  <h2>${esc(name)}</h2>
  <table><tr><th>Người chơi</th><th>Game ID</th><th>Job ID</th><th>Cập nhật</th></tr>
  ${rows || '<tr><td colspan="4">Chưa có server nào</td></tr>'}</table>`);
});

app.listen(process.env.PORT || 3000);
