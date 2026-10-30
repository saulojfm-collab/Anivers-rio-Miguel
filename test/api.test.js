import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
test("inscrição, autenticação, campeonato completo, bronze e persistência", async () => {
  const dir = await mkdtemp(join(tmpdir(), "miguel-")),
    port = 3199,
    url = `http://127.0.0.1:${port}`;
  let child,
    cookie = "";
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        DATABASE_URL: "",
        PORT: String(port),
        ADMIN_PASSWORD: "test-password",
        DATA_FILE: join(dir, "state.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Servidor não iniciou");
      }),
    ]);
  }
  async function stop() {
    child.kill();
    await once(child, "exit");
  }
  const post = async (path, data = {}, auth = true) => {
    const r = await fetch(url + "/api/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: auth ? cookie : "",
      },
      body: JSON.stringify(data),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie"),
    };
  };
  const state = () => fetch(url + "/api/state").then((r) => r.json());
  try {
    await start();
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await post("team")).status, 401);
    assert.equal((await post("login", { password: "wrong" })).status, 401);
    const login = await post("login", { password: "test-password" });
    assert.equal(login.status, 200);
    cookie = login.cookie.split(";")[0];
    for (let i = 0; i < 8; i++)
      assert.equal(
        (
          await post(
            "register",
            { name: "Craque " + i, age: 7 + (i % 5), avatar: "Neymar" },
            false,
          )
        ).status,
        200,
      );
    assert.equal(
      (await post("register", { name: "Craque 0", age: 8 })).status,
      400,
    );
    assert.equal(
      (await post("register", { name: "Bebê", age: 2 })).status,
      400,
    );
    let s = await state();
    const first = s.players[0];
    assert.equal(
      (
        await post(
          "edit-player",
          { id: first.id, name: "Craque 0 Silva", age: 10, avatar: "Haaland" },
          false,
        )
      ).status,
      401,
    );
    assert.equal(
      (await post("delete-player", { id: first.id }, false)).status,
      401,
    );
    assert.equal(
      (await post("edit-player", { id: first.id, name: " ", age: 10 })).status,
      400,
    );
    assert.equal(
      (await post("edit-player", { id: first.id, name: "Craque 1", age: 10 }))
        .status,
      400,
    );
    assert.equal(
      (
        await post("edit-player", {
          id: first.id,
          name: "Craque 0 Silva",
          age: 13,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post("edit-player", {
          id: first.id,
          name: "Craque 0 Silva",
          age: 10,
          avatar: "Haaland",
        })
      ).status,
      200,
    );
    assert.equal(
      (await state()).players.find((p) => p.id === first.id).name,
      "Craque 0 Silva",
    );
    await post(
      "register",
      { name: "Inscrição duplicada", age: 9, avatar: "Messi" },
      false,
    );
    const duplicate = (await state()).players.find(
      (p) => p.name === "Inscrição duplicada",
    );
    assert.equal(
      (await post("delete-player", { id: duplicate.id })).status,
      200,
    );
    assert.equal(
      (await post("delete-player", { id: duplicate.id })).status,
      400,
    );
    s = await state();
    assert.equal(s.players.length, 8);

    for (let i = 0; i < 4; i++) {
      const ps = s.players.slice(i * 2, i * 2 + 2);
      assert.equal(
        (
          await post("team", {
            name: "Time " + i,
            symbol: "🦁",
            players: ps.map((p) => p.id),
            captain: ps[0].id,
          })
        ).status,
        200,
      );
    }
    assert.equal(
      (await post("delete-player", { id: first.id })).status,
      400,
      "Capitão não pode ficar sem referência",
    );
    assert.equal((await post("bracket")).status, 200);
    assert.equal(
      (await post("delete-player", { id: s.players[1].id })).status,
      400,
      "Elenco fechado não pode perder jogador",
    );
    s = await state();
    assert.equal(s.matches.length, 6);
    assert.equal((await post("start", { match: s.matches[0].id })).status, 200);
    assert.equal((await post("start", { match: s.matches[1].id })).status, 400);
    assert.equal((await state()).matches[0].status, "live");
    for (const m of s.matches) {
      const ps = s.players.filter((p) => p.team === m.a);
      assert.equal(
        (
          await post("goal", {
            match: m.id,
            team: m.a,
            scorer: ps[0].id,
            assist: ps[0].id,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await post("goal", {
            match: m.id,
            team: m.a,
            scorer: ps[0].id,
            assist: ps[1].id,
          })
        ).status,
        200,
      );
      assert.equal((await post("finish", { match: m.id })).status, 200);
    }
    s = await state();
    assert.equal(s.matches.filter((m) => !m.league).length, 3);
    for (const m of s.matches.filter((m) => !m.league && m.status === "ready"))
      assert.equal(
        (await post("finish", { match: m.id, penalties: [3, 2] })).status,
        200,
      );
    s = await state();
    assert.ok(s.matches.find((m) => m.third));
    for (const m of s.matches.filter((m) => m.status === "ready"))
      assert.equal(
        (await post("finish", { match: m.id, penalties: [1, 2] })).status,
        200,
      );
    s = await state();
    assert.ok(s.matches.every((m) => m.status === "finished"));
    assert.ok(s.matches.find((m) => m.third).winner);
    assert.equal((await post("goal", { match: s.matches[0].id })).status, 400);
    const eventsBefore = structuredClone(s.matches);
    const scorer = s.players.find(
      (p) => p.id === s.matches[0].events[0].scorer,
    );
    assert.equal((await post("delete-player", { id: scorer.id })).status, 400);
    const assist = s.matches[0].events[0].assist;
    assert.equal((await post("delete-player", { id: assist })).status, 400);
    assert.equal(
      (
        await post("edit-player", {
          id: scorer.id,
          name: "Artilheiro Sobrenome",
          age: scorer.age,
          avatar: scorer.avatar,
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (await state()).matches,
      eventsBefore,
      "Editar nome preserva partidas, gols e assistências",
    );
    assert.equal(
      (await state()).players.find((p) => p.id === scorer.id).team,
      scorer.team,
    );
    const snapshot = await state();
    await stop();
    await start();
    assert.deepEqual(await state(), snapshot);
  } finally {
    if (child?.exitCode === null) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
