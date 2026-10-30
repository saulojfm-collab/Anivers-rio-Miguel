const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let state,
  tab = "overview",
  avatar = "Neymar",
  busy = false;
const icons = {
  Neymar: "🇧🇷",
  Haaland: "🇳🇴",
  "Harry Kane": "🏴",
  Messi: "🇦🇷",
  "Cristiano Ronaldo": "🇵🇹",
  Mbappé: "🇫🇷",
  "Vini Jr.": "🇧🇷",
  Bellingham: "🏴",
  Salah: "🇪🇬",
  "Lamine Yamal": "🇪🇸",
  Rodrygo: "🇧🇷",
  Lewandowski: "🇵🇱",
  Estêvão: "💚",
  "Raphael Veiga": "🟢",
  Pedro: "🔴",
  Arrascaeta: "🇺🇾",
  "Bruno Henrique": "⚫",
  "Yuri Alberto": "🦅",
  "Memphis Depay": "🇳🇱",
  Gabigol: "⚽",
  Hulk: "💪",
  "Lucas Moura": "🔴",
  "Germán Cano": "🇦🇷",
  Alisson: "🧤",
};
const portrait = (n) =>
    `<img src="/avatars/${Math.max(0, Object.keys(icons).indexOf(n))}.svg" alt="Avatar ilustrado: ${esc(n)}" width="48" height="48" loading="lazy">`,
  face = (p) => portrait(p.avatar),
  team = (id) => state.teams.find((t) => t.id === id),
  player = (id) => state.players.find((p) => p.id === id),
  tn = (id) => (id ? esc(team(id)?.name || "Time") : "A definir"),
  sym = (id) => esc(team(id)?.symbol || "🛡️");
const score = (m) => [
  m.events.filter((e) => e.team === m.a).length,
  m.events.filter((e) => e.team === m.b).length,
];
function totals() {
  const result = state.players.map((p) => ({ ...p, goals: 0, assists: 0 }));
  for (const m of state.matches)
    for (const e of m.events) {
      const p = result.find((p) => p.id === e.scorer),
        a = result.find((p) => p.id === e.assist);
      if (p) p.goals++;
      if (a) a.assists++;
    }
  return result.map((p) => ({ ...p, total: p.goals + p.assists }));
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
async function post(path, data) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Não foi possível salvar.");
  await load();
  return j;
}
async function load() {
  const r = await fetch("/api/state");
  if (!r.ok) throw Error("Não foi possível carregar a copa.");
  state = await r.json();
  render();
}
function modal(html) {
  $("#modalBody").innerHTML = html;
  $("#modal").showModal();
}
$("#modal .close").onclick = () => $("#modal").close();
function form(html, submit) {
  modal(`<form id="form">${html}<p class="error" id="error"></p></form>`);
  $("#form")
    .querySelectorAll("label")
    .forEach((label, i) => {
      const field = label.nextElementSibling;
      if (field?.matches("input,select")) {
        field.id ||= "field-" + i;
        label.htmlFor = field.id;
      }
    });
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const b = $("#form button[type=submit]");
    if (b) b.disabled = true;
    try {
      await submit(new FormData(e.target));
      $("#modal").close();
    } catch (e) {
      $("#error").textContent = e.message;
    } finally {
      busy = false;
      if (b) b.disabled = false;
    }
  };
}
function join() {
  if (!state.registrationOpen) return toast("As inscrições estão encerradas.");
  form(
    `<span class="eyebrow" style="color:#567633">SEU LUGAR NO CAMPO</span><h2>Todo craque tem uma história.</h2><p class="sub">Comece a sua na Copa do Miguel! Seu nome ficará salvo. Você não precisa escolher um time agora: o organizador fará a divisão no dia da festa.</p><label>Nome e sobrenome</label><input name="name" required minlength="2" maxlength="45" autocomplete="name" placeholder="Como vamos te chamar?"><label>Idade</label><select name="age">${Array.from({ length: 8 }, (_, i) => `<option>${i + 5}</option>`).join("")}</select><label>Quem inspira seu futebol?</label><p class="hint">Escolha um ídolo. Avatares ilustrados inspirados no futebol, sem fotos reais.</p><div class="avatars">${Object.entries(
      icons,
    )
      .map(
        ([n, i]) =>
          `<button type="button" class="avatar-choice ${n === avatar ? "selected" : ""}" data-avatar="${esc(n)}"><span>${portrait(n)}</span>${esc(n)}</button>`,
      )
      .join(
        "",
      )}</div><p class="hint">Seu nome, idade e ídolo ficam visíveis aos convidados com o link. Peça ajuda a um responsável para se inscrever.</p><button type="submit" class="primary full">⚽ Confirmar minha inscrição</button>`,
    async (f) => {
      await post("register", {
        name: f.get("name"),
        age: Number(f.get("age")),
        avatar,
      });
      toast("Inscrição confirmada. Bem-vindo à copa!");
    },
  );
  $("#modalBody")
    .querySelectorAll("[data-avatar]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          avatar = b.dataset.avatar;
          $("#modalBody")
            .querySelectorAll("[data-avatar]")
            .forEach((x) => x.classList.toggle("selected", x === b));
        }),
    );
}
function login() {
  form(
    '<h2>Área do organizador</h2><p class="sub">Controle os times, os jogos e cada lance da copa.</p><label>Senha do organizador</label><input name="password" type="password" autocomplete="current-password" required><button type="submit" class="primary full">Entrar no gerenciamento</button>',
    async (f) => {
      await post("login", { password: f.get("password") });
      tab = "admin";
      render();
    },
  );
}
$("#joinHero").onclick = join;
$("#adminButton").onclick = () =>
  state.isAdmin ? ((tab = "admin"), render()) : login();
$("#tabs").onclick = (e) => {
  if (e.target.dataset.tab) {
    tab = e.target.dataset.tab;
    render();
  }
};
function empty(icon, title, desc) {
  return `<div class="empty"><span class="big">${icon}</span><h3>${title}</h3><p>${desc}</p></div>`;
}
function section(title, sub = "", extra = "") {
  return `<div class="section-head"><div><h2>${title}</h2><div class="sub">${sub}</div></div>${extra}</div>`;
}
function playerRow(p) {
  return `<div class="list-row"><span class="avatar">${face(p)}</span><div class="details"><b>${esc(p.name)}</b><br><small>${p.age} anos · ${esc(p.avatar)}${p.team ? " · " + tn(p.team) : " · Aguardando time"}</small></div>${team(p.team)?.captain === p.id ? '<span title="Capitão">©</span>' : ""}</div>`;
}
function overview() {
  const final = state.matches.find(
    (m) =>
      !m.third &&
      !m.league &&
      m.round === Math.max(...state.matches.map((m) => m.round)),
  );
  const third = state.matches.find((m) => m.third);
  let html = "";
  if (final?.status === "finished" && final.winner) {
    const champion = team(final.winner);
    html += `<div class="podium"><div class="trophy"><img src="/awards/gold.svg" alt="Troféu de ouro" width="110" height="124"></div><span class="eyebrow" style="color:#8a6d21">OS CAMPEÕES DA COPA DO MIGUEL</span><h2>${esc(champion.symbol)} ${esc(champion.name)}</h2><p>Um time de ouro. Uma história para sempre! ✨</p><div class="members">${state.players
      .filter((p) => p.team === champion.id)
      .map((p) => `${face(p)} ${esc(p.name)}`)
      .join(
        " · ",
      )}</div><p>🥈 ${tn(final.winner === final.a ? final.b : final.a)} ${third?.winner ? " · 🥉 " + tn(third.winner) : ""}</p></div>`;
  }
  if (final?.status === "finished" && final.winner) {
    const places = [
      ["gold", "Campeão", final.winner],
      ["silver", "Vice-campeão", final.winner === final.a ? final.b : final.a],
      ...(third?.winner ? [["bronze", "Terceiro lugar", third.winner]] : []),
    ];
    html += `<div class="grid awards">${places.map(([color, title, t]) => `<div class="card" style="text-align:center"><img src="/awards/${color}.svg" width="90" height="100" alt="Troféu de ${color === "gold" ? "ouro" : color === "silver" ? "prata" : "bronze"}"><h3>${title}</h3><h2>${sym(t)} ${tn(t)}</h2></div>`).join("")}</div>`;
  }
  html +=
    section(
      "A festa já começou",
      "Acompanhe cada lance da nossa copa.",
      `<span class="badge">${state.registrationOpen ? "INSCRIÇÕES ABERTAS" : "COPA EM ANDAMENTO"}</span>`,
    ) +
    `<div class="two-col"><div class="card"><h3>⚽ Dentro de campo</h3>${
      state.matches.length
        ? state.matches
            .filter((m) => m.a && m.b && m.status !== "finished")
            .slice(0, 2)
            .map(matchCard)
            .join("") ||
          empty(
            "🎉",
            "Fim de jogo!",
            "Confira os resultados e celebre nossos craques.",
          )
        : empty(
            "🏟️",
            "A bola vai rolar em breve!",
            "Os times serão montados pelo organizador para deixar a disputa equilibrada.",
          )
    }<div class="pitch"><span>⚽</span></div></div><div class="card"><h3>Como vai funcionar?</h3>${[
      ["Garanta sua vaga", "Cadastre seu nome, idade e escolha seu ídolo."],
      [
        "Encontre sua equipe",
        "Os nomes ficam salvos agora. Os times serão montados no dia da festa, conforme a quantidade de participantes.",
      ],
      [
        "Jogue e acompanhe",
        "Veja os gols, assistências e o caminho até a taça ao vivo.",
      ],
    ]
      .map(
        ([t, d], i) =>
          `<div class="step"><span>0${i + 1}</span><div><b>${t}</b><p>${d}</p></div></div>`,
      )
      .join(
        "",
      )}<button class="primary full" data-action="share">🔗 Copiar link da copa</button></div></div>`;
  const leaders = totals().sort((a, b) => b.goals - a.goals);
  html +=
    section("Nossos protagonistas", "Cada gol e cada passe contam.") +
    `<div class="grid">${[
      ["⚽", "Artilharia", "goals"],
      ["🎯", "Reis da assistência", "assists"],
      ["🌟", "Participações em gols", "total"],
    ]
      .map(([i, t, k]) => {
        const list = [...leaders].sort((a, b) => b[k] - a[k]);
        return `<div class="card"><h3>${i} ${t}</h3>${
          list[0]?.[k] > 0
            ? list
                .filter((p) => p[k] === list[0][k])
                .slice(0, 3)
                .map(
                  (p) =>
                    `<div class="list-row"><span class="avatar">${face(p)}</span><div class="details"><b>${esc(p.name)}</b><br><small>${tn(p.team)}</small></div><b>${p[k]}</b></div>`,
                )
                .join("")
            : empty(
                i,
                "O próximo destaque pode ser você",
                "Os rankings aparecem assim que a bola entrar.",
              )
        }</div>`;
      })
      .join("")}</div>`;
  return html;
}
function matchCard(m) {
  const s = score(m),
    label = m.league
      ? `Classificação · rodada ${m.round + 1}`
      : m.third
        ? "Disputa de bronze"
        : m.round === Math.max(...state.matches.map((m) => m.round))
          ? "Final"
          : `Rodada ${m.round + 1}`;
  return `<div class="card"><div style="display:flex;justify-content:space-between"><small>${label}</small><span class="badge ${m.status === "live" ? "live" : ""}">${{ waiting: "Aguardando", ready: "Próximo jogo", live: "● AO VIVO", finished: "Encerrado" }[m.status]}</span></div><div class="score"><span>${sym(m.a)}<br>${tn(m.a)}</span><strong>${s[0]} : ${s[1]}</strong><span>${sym(m.b)}<br>${tn(m.b)}</span></div>${m.penalties ? `<p class="hint">Pênaltis: ${m.penalties.join(" × ")}</p>` : ""}${m.status === "finished" && (!m.a || !m.b) ? '<p class="hint">Avanço automático por folga.</p>' : ""}${m.events.map((e) => `<div class="event">⚽ ${esc(player(e.scorer)?.name)}${e.assist ? " · 🎯 " + esc(player(e.assist)?.name) : ""}</div>`).join("")}${state.isAdmin && ["ready", "live"].includes(m.status) ? `<div class="actions">${m.status === "ready" ? `<button data-start="${m.id}">▶ Iniciar jogo</button>` : ""}<button class="primary" data-goal="${m.id}">+ Gol</button><button data-finish="${m.id}">Encerrar</button>${m.events.length ? `<button class="danger" data-undo="${m.id}">Desfazer gol</button>` : ""}</div>` : ""}</div>`;
}
function teamsView() {
  return (
    section(
      "Os times da copa",
      "Identidade, amizade e muita vontade de jogar.",
      state.isAdmin && !state.matches.length
        ? '<button class="primary" data-action="team">+ Montar time</button>'
        : "",
    ) +
    (state.teams.length
      ? `<div class="grid">${state.teams
          .map(
            (t) =>
              `<div class="card"><h2>${esc(t.symbol)} ${esc(t.name)}</h2><p class="sub">${state.players.filter((p) => p.team === t.id).length} craques · Capitão: ${esc(player(t.captain)?.name)}</p>${state.players
                .filter((p) => p.team === t.id)
                .map(playerRow)
                .join(
                  "",
                )}${state.isAdmin && !state.matches.length ? `<button class="danger full" data-delete="${t.id}">Desmontar time</button>` : ""}</div>`,
          )
          .join("")}</div>`
      : `<div class="card">${empty("🛡️", "Cada time vai ter sua identidade", "Nome, símbolo e capitão escolhidos para a nossa copa.")}</div>`)
  );
}
function matchesView() {
  return (
    section(
      "O caminho até a taça",
      "Todos contra todos + finais · Uma derrota não elimina seu time",
    ) +
    (state.matches.length
      ? leagueTable() +
        `<div class="rounds">${[...new Set(state.matches.map((m) => m.round))]
          .map(
            (r) =>
              `<div class="round"><h3>${state.matches.filter((m) => m.round === r).every((m) => m.league) ? `Classificação · Rodada ${r + 1}` : r === Math.max(...state.matches.map((m) => m.round)) ? "🏆 Finais" : "Semifinais"}</h3>${state.matches
                .filter((m) => m.round === r)
                .map(matchCard)
                .join("")}</div>`,
          )
          .join("")}</div>`
      : `<div class="card">${empty("🏆", "O caminho da vitória está por vir", "A tabela será sorteada depois da montagem dos times.")}</div>`)
  );
}
function rankings() {
  const list = totals().sort((a, b) => b.total - a.total || b.goals - a.goals);
  const table = (title, arr, cols) =>
    `<div class="card" style="overflow-x:auto"><h3>${title}</h3><table class="rank-table"><thead><tr><th>#</th><th>Craque / time</th>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${arr.map((p, i) => `<tr><td>${i + 1}</td><td>${face(p)} ${esc(p.name)}<br><small class="sub">${tn(p.team)}</small></td>${cols.map((c) => `<td><b>${p[c[1]]}</b></td>`).join("")}</tr>`).join("")}</tbody></table>${!arr.length ? '<p class="sub">Aguardando as primeiras inscrições.</p>' : ""}</div>`;
  return (
    section(
      "O talento ganha destaque",
      "Empates nos números compartilham a premiação.",
    ) +
    `<div class="grid">${[
      ["🏅 Bola de Ouro", "goals"],
      ["🎯 Passe de Ouro", "assists"],
      ["🌟 Craque decisivo", "total"],
    ]
      .map(([t, k]) => {
        const n = Math.max(0, ...list.map((p) => p[k]));
        return `<div class="card"><h3>${t}</h3>${
          n
            ? list
                .filter((p) => p[k] === n)
                .map(
                  (p) =>
                    `<div class="list-row"><span class="avatar">${face(p)}</span><div><b>${esc(p.name)}</b><p class="sub">${n} ${k === "goals" ? "gols" : k === "assists" ? "assistências" : "participações"}</p></div><span style="font-size:30px">${k === "goals" ? '<img src="/awards/ball.svg" width="55" height="65" alt="Bola de Ouro">' : "✨"}</span></div>`,
                )
                .join("")
            : '<p class="sub">Quem vai conquistar esse prêmio?</p>'
        }</div>`;
      })
      .join("")}</div><br>` +
    table("Classificação dos jogadores", list, [
      ["Gols", "goals"],
      ["Assist.", "assists"],
      ["G+A", "total"],
    ]) +
    section("Ataques da copa", "Gols marcados por equipe") +
    `<div class="grid">${state.teams
      .map((t) => ({
        ...t,
        count: state.matches
          .flatMap((m) => m.events)
          .filter((e) => e.team === t.id).length,
      }))
      .sort((a, b) => b.count - a.count)
      .map(
        (t) =>
          `<div class="card"><h3>${esc(t.symbol)} ${esc(t.name)}</h3><h2>${t.count} gols</h2></div>`,
      )
      .join("")}</div>`
  );
}
function adminView() {
  if (!state.isAdmin)
    return empty(
      "🔒",
      "Acesso do organizador",
      "Use o botão Organizador para entrar.",
    );
  return (
    section(
      "Central do organizador",
      "Os convidados acompanham as alterações automaticamente.",
      '<div class="actions"><a href="/api/export" download class="quiet" style="padding:10px;color:inherit">↓ Backup da copa</a><button data-action="logout" class="quiet">Sair</button></div>',
    ) +
    `<div class="notice">📋 Condomínio Maria Isabel 1 · A quantidade de jogadores e times é variável. ${rosterSuggestion()} Primeiro cadastre os participantes; depois monte times equilibrados, escolhendo capitães. Todos contra todos: vitória vale 3 pontos, empate 1. Com 4 ou mais times, os quatro primeiros vão às semifinais; com 2 ou 3, os dois primeiros vão à final. Com 2 times, a classificação tem ida e volta. Ao gerar os jogos, os times ficam fechados. Durante os jogos, lance um gol de cada vez e selecione o autor e a assistência.</div><div class="grid"><div class="card"><h3>1. Inscrições</h3><p class="sub">${state.players.length} participantes · ${state.registrationOpen ? "Abertas" : "Encerradas"}</p><button data-action="registration">${state.registrationOpen ? "Encerrar inscrições" : "Reabrir inscrições"}</button></div><div class="card"><h3>2. Montar equipes</h3><p class="sub">${state.players.filter((p) => !p.team).length} jogadores aguardando time</p><button data-action="team" ${state.matches.length ? "disabled" : ""}>+ Cadastrar time</button></div><div class="card"><h3>3. Gerar campeonato</h3><p class="sub">${state.teams.length} equipes · Sorteio aleatório dos confrontos.</p><button data-action="bracket" ${state.matches.length || state.teams.length < 2 ? "disabled" : ""}>🏆 Gerar jogos</button></div></div>` +
    matchesView()
  );
}
function render() {
  if (!state) return;
  $("#stats").innerHTML = [
    ["👟", state.players.length, "Craques inscritos"],
    ["🛡️", state.teams.length, "Times na disputa"],
    [
      "⚽",
      state.matches.reduce((a, m) => a + m.events.length, 0),
      "Gols na copa",
    ],
    [
      "🏆",
      state.matches.filter((m) => m.status === "finished" && m.a && m.b).length,
      "Jogos encerrados",
    ],
  ]
    .map(
      ([i, n, l]) =>
        `<div class="stat"><div class="stat-icon">${i}</div><div><strong>${n}</strong><small>${l}</small></div></div>`,
    )
    .join("");
  $("#adminTab").hidden = !state.isAdmin;
  $("#adminButton").textContent = state.isAdmin
    ? "⚙ Gerenciar"
    : "⚙ Organizador";
  $("#joinHero").textContent = state.registrationOpen
    ? "Quero jogar ↗"
    : "Ver os craques ↗";
  $("#joinHero").onclick = state.registrationOpen
    ? join
    : () => {
        tab = "players";
        render();
      };
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#content").innerHTML =
    tab === "overview"
      ? overview()
      : tab === "players"
        ? section(
            "A seleção da festa",
            "Os craques que vão fazer essa copa acontecer.",
            state.registrationOpen
              ? '<button class="primary" data-action="join">+ Quero participar</button>'
              : "",
          ) +
          `<div class="card">${state.players.length ? state.players.map(playerRow).join("") : empty("👟", "Seja o primeiro a entrar em campo!", "Escolha seu ídolo e confirme sua inscrição.")}</div>`
        : tab === "teams"
          ? teamsView()
          : tab === "matches"
            ? matchesView()
            : tab === "ranking"
              ? rankings()
              : adminView();
}
function newTeam() {
  const available = state.players.filter((p) => !p.team);
  if (!available.length)
    return toast("Cadastre jogadores disponíveis primeiro.");
  form(
    `<h2>Um novo time entra em campo</h2><label>Nome do time</label><input name="name" required maxlength="45" placeholder="Ex.: Leões do Miguel"><label>Símbolo</label><select name="symbol">${["🦁", "🐯", "🦅", "🐉", "🦈", "🐺", "🔥", "⚡", "🚀", "💎", "🛡️", "⭐", "💚", "❤️", "💙", "🖤"].map((x) => `<option>${x}</option>`).join("")}</select><label>Jogadores · idade para ajudar a equilibrar</label><div class="checks">${available.map((p) => `<label><input type="checkbox" name="players" value="${p.id}">${face(p)} ${esc(p.name)} · ${p.age} anos</label>`).join("")}</div><label>Capitão (selecione alguém marcado acima)</label><select name="captain">${available.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><button type="submit" class="primary full">Salvar time</button>`,
    async (f) => {
      await post("team", {
        name: f.get("name"),
        symbol: f.get("symbol"),
        captain: f.get("captain"),
        players: f.getAll("players"),
      });
      toast("Time escalado!");
    },
  );
}
function goal(matchId) {
  const m = state.matches.find((m) => m.id === matchId);
  form(
    `<h2>⚽ É goooool!</h2><label>Time que marcou</label><select name="team" id="goalTeam">${[m.a, m.b].map((t) => `<option value="${t}">${tn(t)}</option>`).join("")}</select><label>Quem fez o gol?</label><select name="scorer" id="scorer" required></select><label>Quem deu a assistência?</label><select name="assist" id="assist"></select><button type="submit" class="primary full">Confirmar gol no placar</button>`,
    async (f) => {
      await post("goal", {
        match: matchId,
        team: f.get("team"),
        scorer: f.get("scorer"),
        assist: f.get("assist"),
      });
      toast("Goooool! Placar atualizado para todos.");
    },
  );
  const update = () => {
    const ps = state.players.filter((p) => p.team === $("#goalTeam").value);
    $("#scorer").innerHTML =
      '<option value="">Selecione o artilheiro</option>' +
      ps.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    assist();
  };
  const assist = () => {
    $("#assist").innerHTML =
      '<option value="">Sem assistência</option>' +
      state.players
        .filter(
          (p) => p.team === $("#goalTeam").value && p.id !== $("#scorer").value,
        )
        .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
        .join("");
  };
  $("#goalTeam").onchange = update;
  $("#scorer").onchange = assist;
  update();
}
function finishGame(matchId) {
  const m = state.matches.find((m) => m.id === matchId),
    s = score(m);
  form(
    `<h2>Apito final</h2><p class="sub">${tn(m.a)} ${s[0]} × ${s[1]} ${tn(m.b)}</p>${s[0] === s[1] && !m.league ? `<p>Empate! Informe o resultado da disputa de pênaltis.</p><div class="fields"><div><label>${tn(m.a)}</label><input type="number" min="0" name="a" required></div><div><label>${tn(m.b)}</label><input type="number" min="0" name="b" required></div></div>` : ""}<p class="hint">Confira os gols antes de encerrar. O resultado atualiza a classificação ou avança o vencedor nas finais e não poderá ser editado.</p><button type="submit" class="primary full">Confirmar resultado</button>`,
    async (f) => {
      await post("finish", {
        match: matchId,
        penalties:
          s[0] === s[1] && !m.league
            ? [Number(f.get("a")), Number(f.get("b"))]
            : null,
      });
      toast("Resultado confirmado!");
    },
  );
}
$("#content").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.start) return await post("start", { match: b.dataset.start });
    if (b.dataset.goal) return goal(b.dataset.goal);
    if (b.dataset.finish) return finishGame(b.dataset.finish);
    if (b.dataset.undo && confirm("Remover o último gol desta partida?"))
      return await post("undo", { match: b.dataset.undo });
    if (
      b.dataset.delete &&
      confirm("Desmontar este time e liberar seus jogadores?")
    )
      return await post("delete-team", { id: b.dataset.delete });
    switch (b.dataset.action) {
      case "join":
        join();
        break;
      case "team":
        newTeam();
        break;
      case "share":
        {
          const link = new URL("/?inscricao=1", location.origin).href;
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(link);
              toast("Link de inscrição copiado! Envie aos convidados.");
              break;
            } catch {}
          }
          modal(
            '<h2>Convide os amigos do Miguel</h2><p class="sub">Copie este link e envie no grupo. A inscrição fica salva e os times serão definidos no dia da festa.</p><input id="inviteLink" readonly aria-label="Link de inscrição" value="' +
              esc(link) +
              '">',
          );
          $("#inviteLink").select();
        }
        break;
      case "logout":
        await post("logout", {});
        tab = "overview";
        render();
        break;
      case "registration":
        await post("registration", { open: !state.registrationOpen });
        break;
      case "bracket":
        if (
          confirm(
            `Sortear ${state.teams.length} times? Todos jogam a classificação antes das finais. Após confirmar, as equipes não poderão ser alteradas. ${state.players.filter((p) => !p.team).length} jogadores estão sem time.`,
          )
        )
          await post("bracket", {});
        break;
    }
  } catch (e) {
    toast(e.message);
  }
};
const events = new EventSource("/api/events");
events.onopen = () => {
  $("#connection").textContent = "● Atualização ao vivo";
};
events.onmessage = () => load().catch(() => toast("Tentando reconectar…"));
events.onerror = () => {
  $("#connection").textContent = "● Reconectando…";
};
load()
  .then(() => {
    if (
      new URLSearchParams(location.search).has("inscricao") &&
      state.registrationOpen
    )
      join();
  })
  .catch((e) => {
    $("#content").innerHTML =
      `<div class="notice">${esc(e.message)} Recarregue a página para tentar novamente.</div>`;
  });

function leagueTable() {
  const rows = state.teams
    .map((t, index) => {
      let pts = 0,
        gf = 0,
        ga = 0,
        j = 0,
        w = 0;
      for (const m of state.matches.filter(
        (m) => m.league && m.status === "finished" && [m.a, m.b].includes(t.id),
      )) {
        const s = score(m),
          a = m.a === t.id ? s[0] : s[1],
          b = m.a === t.id ? s[1] : s[0];
        j++;
        gf += a;
        ga += b;
        pts += a > b ? 3 : a === b ? 1 : 0;
        if (a > b) w++;
      }
      return { ...t, pts, gf, ga, j, w, index };
    })
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.w - a.w ||
        b.gf - b.ga - (a.gf - a.ga) ||
        b.gf - a.gf ||
        a.index - b.index,
    );
  return `<div class="card" style="overflow-x:auto;margin-bottom:22px"><h3>Classificação · todo time tem outra chance</h3><p class="hint">Vitória: 3 pontos · Empate: 1 ponto. Desempate: vitórias, saldo de gols, gols marcados e ordem de cadastro dos times. Top ${rows.length >= 4 ? "4 → semifinais" : "2 → final"}. Nas finais, empate vai aos pênaltis.</p><table class="rank-table"><thead><tr><th>#</th><th>Time</th><th>J</th><th>PTS</th><th>GP</th><th>SG</th></tr></thead><tbody>${rows.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.symbol)} ${esc(t.name)}</td><td>${t.j}</td><td><b>${t.pts}</b></td><td>${t.gf}</td><td>${t.gf - t.ga}</td></tr>`).join("")}</tbody></table></div>`;
}

function rosterSuggestion() {
  const count = state.players.length;
  if (!count)
    return "As inscrições já podem ser compartilhadas; nenhuma equipe precisa estar montada.";
  const full = Math.floor(count / 5),
    extra = count % 5;
  return `${count} jogadores inscritos até agora. A referência é 4 na linha + 1 goleiro, com flexibilidade para reservas e equilíbrio.${full >= 2 ? ` Hoje daria para montar ${full} equipes completas de cinco${extra ? ` e distribuir ${extra} jogador${extra > 1 ? "es" : ""} como reservas ou reequilibrar os elencos` : ""}.` : ""}`;
}
