import http from "node:http";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { bracket, finish, id, advance } from "./tournament.js";
const production = process.env.NODE_ENV === "production";
const password =
  process.env.ADMIN_PASSWORD || (!production ? "miguel10" : null);
if (!password || password.length < 8)
  throw Error("Defina ADMIN_PASSWORD com pelo menos 8 caracteres.");
let pool;
const file = process.env.DATA_FILE || "data/state.json";
if (process.env.DATABASE_URL) {
  const { Pool } = await import("pg");
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    "CREATE TABLE IF NOT EXISTS tournament_state (id integer PRIMARY KEY, data jsonb NOT NULL)",
  );
}
let state = {
  players: [],
  teams: [],
  matches: [],
  title: "Copa do Miguel",
  registrationOpen: true,
};
if (pool) {
  const r = await pool.query("SELECT data FROM tournament_state WHERE id=1");
  if (r.rows[0]) state = r.rows[0].data;
} else {
  await mkdir("data", { recursive: true });
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
async function save() {
  if (pool)
    await pool.query(
      "INSERT INTO tournament_state VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET data=$1",
      [state],
    );
  else {
    await writeFile(file + ".tmp", JSON.stringify(state));
    await rename(file + ".tmp", file);
  }
}
const sessions = new Map(),
  clients = new Set(),
  attempts = new Map();
let queue = Promise.resolve();
const clean = (v, max = 45) =>
  String(v || "")
    .trim()
    .slice(0, max);
function fail(msg) {
  throw Error(msg);
}
function admin(req) {
  const token = req.headers.cookie?.match(/(?:^|; )admin=([^;]+)/)?.[1];
  return sessions.get(token) > Date.now();
}
function broadcast() {
  for (const c of clients) c.write("data: update\n\n");
}
async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 16384) fail("Pedido muito grande.");
  }
  return JSON.parse(data || "{}");
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function api(req, res, path) {
  if (req.method === "GET" && path === "/api/health")
    return json(res, 200, { ok: true });
  if (req.method === "GET" && path === "/api/export") {
    if (!admin(req))
      return json(res, 401, { error: "Entre como organizador." });
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="copa-miguel-backup.json"',
    );
    return json(res, 200, state);
  }
  if (req.method === "GET" && path === "/api/state")
    return json(res, 200, { ...state, isAdmin: admin(req) });
  if (req.method === "GET" && path === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (req.method !== "POST") return json(res, 404, { error: "Não encontrado" });
  const b = await body(req);
  if (path === "/api/login") {
    const ip = req.socket.remoteAddress;
    const a = attempts.get(ip) || { count: 0, until: Date.now() + 60000 };
    if (a.until < Date.now()) {
      a.count = 0;
      a.until = Date.now() + 60000;
    }
    attempts.set(ip, a);
    if (++a.count > 10)
      return json(res, 429, {
        error: "Aguarde um minuto para tentar novamente.",
      });
    const x = Buffer.from(String(b.password || "")),
      y = Buffer.from(password);
    if (x.length !== y.length || !timingSafeEqual(x, y))
      return json(res, 401, { error: "Senha incorreta." });
    const token = randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + 24 * 3600000);
    res.setHeader(
      "Set-Cookie",
      `admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${production ? "; Secure" : ""}`,
    );
    return json(res, 200, { ok: true });
  }
  if (path === "/api/logout") {
    const token = req.headers.cookie?.match(/(?:^|; )admin=([^;]+)/)?.[1];
    sessions.delete(token);
    res.setHeader(
      "Set-Cookie",
      "admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    return json(res, 200, { ok: true });
  }
  if (path !== "/api/register" && !admin(req))
    return json(res, 401, { error: "Entre como organizador." });
  const previous = structuredClone(state);
  try {
    if (path === "/api/register") {
      if (!state.registrationOpen) fail("Inscrições encerradas.");
      const name = clean(b.name);
      if (name.length < 2) fail("Informe seu nome.");
      if (!Number.isInteger(b.age) || b.age < 5 || b.age > 12)
        fail("A idade deve ser de 5 a 12 anos.");
      if (state.players.length >= 200)
        fail("Limite de participantes atingido.");
      if (
        state.players.some(
          (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        fail("Este nome já está inscrito. Use nome e sobrenome.");
      state.players.push({
        id: id(),
        name,
        age: b.age,
        avatar: clean(b.avatar, 30),
        team: null,
      });
    } else if (path === "/api/registration") {
      state.registrationOpen = !!b.open;
    } else if (path === "/api/team") {
      if (state.matches.length)
        fail("Os times estão fechados após gerar o chaveamento.");
      const name = clean(b.name);
      if (!name) fail("Informe o nome do time.");
      const players = state.players.filter((p) => b.players?.includes(p.id));
      if (!players.length) fail("Selecione jogadores.");
      if (players.some((p) => p.team))
        fail("Um jogador já está em outro time.");
      if (!players.some((p) => p.id === b.captain))
        fail("Selecione um capitão entre os jogadores do time.");
      const t = {
        id: id(),
        name,
        symbol: clean(b.symbol, 8),
        captain: b.captain,
      };
      state.teams.push(t);
      for (const p of players) p.team = t.id;
    } else if (path === "/api/delete-team") {
      if (state.matches.length) fail("Chaveamento já iniciado.");
      state.teams = state.teams.filter((t) => t.id !== b.id);
      for (const p of state.players) if (p.team === b.id) p.team = null;
    } else if (path === "/api/bracket") {
      if (state.matches.length) fail("O chaveamento já existe.");
      const teams = [...state.teams];
      for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }
      state.matches = bracket(teams);
    } else if (path === "/api/start") {
      const m = state.matches.find((m) => m.id === b.match);
      if (!m || m.status !== "ready") fail("Partida indisponível.");
      if (state.matches.some((m) => m.status === "live"))
        fail("Encerre a partida ao vivo antes de iniciar outra.");
      m.status = "live";
      m.startedAt = new Date().toISOString();
    } else if (path === "/api/goal") {
      const m = state.matches.find((m) => m.id === b.match);
      if (!m || !["ready", "live"].includes(m.status))
        fail("Partida indisponível.");
      if (![m.a, m.b].includes(b.team)) fail("Time inválido.");
      if (
        state.matches.some(
          (other) => other.id !== m.id && other.status === "live",
        )
      )
        fail("Há outra partida ao vivo.");
      const p = state.players.find(
        (p) => p.id === b.scorer && p.team === b.team,
      );
      if (!p) fail("Selecione quem fez o gol.");
      if (
        b.assist &&
        (b.assist === b.scorer ||
          !state.players.some((p) => p.id === b.assist && p.team === b.team))
      )
        fail("Assistência inválida.");
      m.events.push({
        id: id(),
        team: b.team,
        scorer: b.scorer,
        assist: b.assist || null,
        time: new Date().toISOString(),
      });
      m.status = "live";
    } else if (path === "/api/undo") {
      const m = state.matches.find((m) => m.id === b.match);
      if (!m || !["ready", "live"].includes(m.status))
        fail("Partida encerrada.");
      m.events.pop();
    } else if (path === "/api/finish") {
      const m = state.matches.find((m) => m.id === b.match);
      if (!m || !["ready", "live"].includes(m.status))
        fail("Partida indisponível.");
      finish(state.matches, m, b.penalties);
      advance(state);
      // The semifinal losers play for bronze, independently of the final.
      const last = Math.max(
        ...state.matches
          .filter((m) => !m.third && !m.league)
          .map((m) => m.round),
      );
      const semis = state.matches.filter(
        (m) => m.round === last - 1 && !m.third && !m.league,
      );
      if (
        semis.length === 2 &&
        semis.every((m) => m.status === "finished") &&
        !state.matches.some((m) => m.third)
      ) {
        const losers = semis.map((m) => (m.winner === m.a ? m.b : m.a));
        if (losers.every(Boolean))
          state.matches.push({
            id: id(),
            round: last,
            index: 1,
            a: losers[0],
            b: losers[1],
            third: true,
            events: [],
            status: "ready",
            winner: null,
            penalties: null,
          });
      }
    } else fail("Operação desconhecida.");
    await save();
    broadcast();
    json(res, 200, { ok: true });
  } catch (e) {
    state = previous;
    throw e;
  }
}
const server = http.createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (path.startsWith("/api/")) {
    if (
      req.method === "POST" &&
      req.headers.origin &&
      req.headers.origin !==
        `${production ? "https" : "http"}://${req.headers.host}`
    )
      return json(res, 403, { error: "Origem inválida." });
    const run = () =>
      api(req, res, path).catch((e) => {
        if (!res.headersSent) json(res, 400, { error: e.message });
      });
    if (req.method === "POST") queue = queue.then(run, run);
    else run();
    return;
  }
  if (/^\/avatars\/(?:[0-9]|1[0-9]|2[0-3])\.svg$/.test(path)) {
    readFile(new URL("./public" + path, import.meta.url))
      .then((data) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(data);
      })
      .catch(() => {
        res.writeHead(404);
        res.end();
      });
    return;
  }
  if (/^\/awards\/(gold|silver|bronze|ball)\.svg$/.test(path)) {
    readFile(new URL("./public" + path, import.meta.url))
      .then((data) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(data);
      })
      .catch(() => {
        res.writeHead(404);
        res.end();
      });
    return;
  }
  const files = {
    "/": "index.html",
    "/app.js": "app.js",
    "/style.css": "style.css",
  };
  if (!files[path]) {
    res.writeHead(404);
    res.end("Não encontrado");
    return;
  }
  readFile(new URL("./public/" + files[path], import.meta.url))
    .then((data) => {
      res.setHeader(
        "Content-Type",
        path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : "text/html; charset=utf-8",
      );
      res.end(data);
    })
    .catch(() => {
      res.writeHead(500);
      res.end();
    });
});
const heartbeat = setInterval(() => {
  for (const c of clients) c.write(": keepalive\n\n");
}, 20000);
heartbeat.unref();
server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("Copa do Miguel iniciada na porta " + (process.env.PORT || 3000)),
);
