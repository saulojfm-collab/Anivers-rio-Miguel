const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
(async () => {
  const dir = await fs.mkdtemp("/tmp/miguel-ui-");
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3201",
      DATABASE_URL: "",
      ADMIN_PASSWORD: "browser-test",
      DATA_FILE: dir + "/state.json",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await once(server.stdout, "data");
    browser = await chromium.launch({
      executablePath:
        process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const admin = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
      }),
      guest = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
    const a = await admin.newPage(),
      g = await guest.newPage(),
      errors = [];
    a.on("pageerror", (e) => errors.push(e.message));
    g.on("pageerror", (e) => errors.push(e.message));
    await a.goto("http://127.0.0.1:3201");
    await g.goto("http://127.0.0.1:3201/?inscricao=1");
    await g.locator("input[name=name]").fill("Craque 1");
    await g.locator("select[name=age]").selectOption("10");
    await g
      .getByRole("button", { name: "Confirmar minha inscrição", exact: false })
      .click();
    await g.locator("dialog").waitFor({ state: "hidden" });
    await g
      .getByRole("button", { name: "Craques inscritos", exact: true })
      .click();
    const post = async (path, data = {}) => {
      const r = await a.request.post("http://127.0.0.1:3201/api/" + path, {
        data,
      });
      if (!r.ok()) throw Error(path + ": " + (await r.text()));
      return r.json();
    };
    const state = () =>
      a.request.get("http://127.0.0.1:3201/api/state").then((r) => r.json());
    await post("login", { password: "browser-test" });
    for (let i = 1; i < 20; i++)
      await post("register", {
        name: "Craque " + (i + 1),
        age: 5 + (i % 8),
        avatar: ["Neymar", "Haaland", "Harry Kane", "Messi"][i % 4],
      });
    await g.getByText("Craque 20", { exact: true }).waitFor();
    let s = await state();
    if (s.teams.length || s.matches.length || s.players.some((p) => p.team))
      throw Error("Inscrições antecipadas devem independer dos times");
    await a
      .getByRole("button", { name: "Gerenciar copa", exact: true })
      .click();
    await a
      .getByRole("button", { name: "Editar Craque 1", exact: true })
      .click();
    await a.locator("input[name=name]").fill("Craque 1 Silva");
    await a
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await a.locator("dialog").waitFor({ state: "hidden" });
    await g.getByText("Craque 1 Silva", { exact: true }).waitFor();
    if (await g.locator("[data-edit-player], [data-delete-player]").count())
      throw Error("Convidado não pode ver controles de gestão");
    await post("register", {
      name: "Cadastro duplicado",
      age: 10,
      avatar: "Messi",
    });
    a.once("dialog", (d) => d.accept());
    await a
      .getByRole("button", { name: "Excluir Cadastro duplicado", exact: true })
      .click();
    await a
      .getByRole("button", { name: "Excluir Cadastro duplicado", exact: true })
      .waitFor({ state: "detached" });
    if ((await state()).players.length !== 20)
      throw Error("Exclusão deveria remover somente o cadastro duplicado");
    for (let i = 0; i < 4; i++) {
      const ps = s.players.slice(i * 5, i * 5 + 5);
      await post("team", {
        name: [
          "Leões do Miguel",
          "Tubarões Azuis",
          "Dragões do Gol",
          "Águias Douradas",
        ][i],
        symbol: ["🦁", "🦈", "🐉", "🦅"][i],
        players: ps.map((p) => p.id),
        captain: ps[0].id,
      });
    }
    await post("bracket");
    s = await state();
    for (const m of s.matches) {
      const ps = s.players.filter((p) => p.team === m.a);
      await post("goal", {
        match: m.id,
        team: m.a,
        scorer: ps[0].id,
        assist: ps[1].id,
      });
      await post("finish", { match: m.id });
    }
    s = await state();
    for (const m of s.matches.filter((m) => !m.league && m.status === "ready"))
      await post("finish", { match: m.id, penalties: [3, 2] });
    s = await state();
    for (const m of s.matches.filter((m) => m.status === "ready"))
      await post("finish", { match: m.id, penalties: [2, 3] });
    await a.getByRole("button", { name: "Visão geral" }).click();
    await a.getByRole("heading", { name: "Campeão", exact: true }).waitFor();
    await a.screenshot({ path: "/tmp/miguel-champion.png", fullPage: true });
    for (const tab of [
      "Craques inscritos",
      "Times",
      "Jogos e chaveamento",
      "Rankings",
    ]) {
      await g.getByRole("button", { name: tab, exact: true }).click();
      await g.waitForTimeout(60);
      if (
        await g.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Overflow em " + tab);
    }
    await g.getByRole("button", { name: "Visão geral" }).click();
    await g.screenshot({
      path: "/tmp/miguel-champion-mobile.png",
      fullPage: true,
    });
    const imageFailures = await a
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.src),
      );
    console.log(
      JSON.stringify({
        players: 20,
        teams: 4,
        matches: (await state()).matches.length,
        liveGuestUpdate: true,
        pageErrors: errors,
        brokenImages: imageFailures,
      }),
    );
    if (errors.length || imageFailures.length)
      throw Error("Erros na interface");
  } finally {
    if (browser) await browser.close();
    server.kill();
    await once(server, "exit");
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
