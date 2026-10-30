import { randomUUID } from "node:crypto";
export const id = () => randomUUID();
export function knockout(teams) {
  if (teams.length < 2) throw Error("Cadastre pelo menos dois times.");
  let size = 2;
  while (size < teams.length) size *= 2;
  const rounds = [];
  let slots = teams.map((t) => t.id);
  while (slots.length < size) slots.push(null);
  // Distribute byes across pairs so a bye never plays another bye.
  const ordered = [];
  const byes = size - teams.length;
  let cursor = 0;
  for (let i = 0; i < size / 2; i++) {
    ordered.push(slots[cursor++]);
    ordered.push(i < byes ? null : slots[cursor++]);
  }
  for (let n = size / 2, r = 0; n >= 1; n /= 2, r++)
    rounds.push(
      Array.from({ length: n }, (_, i) => ({
        id: id(),
        round: r,
        index: i,
        a: r === 0 ? ordered[i * 2] : null,
        b: r === 0 ? ordered[i * 2 + 1] : null,
        events: [],
        status: "waiting",
        winner: null,
        penalties: null,
      })),
    );
  const matches = rounds.flat();
  settle(matches);
  return matches;
}
export function settle(matches) {
  matches = matches.filter((m) => !m.third && !m.league);
  const rounds = Math.max(...matches.map((m) => m.round));
  for (let r = 0; r <= rounds; r++)
    for (const m of matches.filter((m) => m.round === r)) {
      const prev = matches
        .filter((x) => x.round === r - 1 && Math.floor(x.index / 2) === m.index)
        .sort((a, b) => a.index - b.index);
      const ready =
        r === (m.knockoutStart || 0) ||
        prev.every((x) => x.status === "finished");
      if (r > (m.knockoutStart || 0)) {
        m.a = prev[0]?.winner || null;
        m.b = prev[1]?.winner || null;
      }
      if (ready && (!m.a || !m.b)) {
        m.status = "finished";
        m.winner = m.a || m.b;
      } else if (ready && m.status === "waiting") m.status = "ready";
    }
}
export function scores(m) {
  return [
    m.events.filter((e) => e.team === m.a).length,
    m.events.filter((e) => e.team === m.b).length,
  ];
}
export function finish(matches, m, penalties) {
  const [a, b] = scores(m);
  if (a === b && !m.league) {
    if (
      !penalties ||
      !penalties.every(Number.isInteger) ||
      penalties.some((x) => x < 0) ||
      penalties[0] === penalties[1]
    )
      throw Error("Empate: informe os pênaltis com um vencedor.");
    m.penalties = penalties;
  }
  if (m.league) {
    m.status = "finished";
    m.winner = a === b ? null : a > b ? m.a : m.b;
    return;
  }
  m.winner =
    a === b ? (penalties[0] > penalties[1] ? m.a : m.b) : a > b ? m.a : m.b;
  m.status = "finished";
  settle(matches);
}

export function bracket(teams) {
  if (teams.length < 2) throw Error("Cadastre pelo menos dois times.");
  const matches = [];
  const slots = teams.map((t) => t.id);
  if (slots.length % 2) slots.push(null);
  for (let r = 0; r < slots.length - 1; r++) {
    for (let i = 0; i < slots.length / 2; i++) {
      const a = slots[i],
        b = slots[slots.length - 1 - i];
      if (a && b)
        matches.push({
          id: id(),
          round: r,
          index: i,
          a,
          b,
          league: true,
          events: [],
          status: "ready",
          winner: null,
          penalties: null,
        });
    }
    slots.splice(1, 0, slots.pop());
  }
  if (teams.length === 2)
    matches.push({
      ...matches[0],
      id: id(),
      round: 1,
      a: matches[0].b,
      b: matches[0].a,
    });
  return matches;
}
export function standings(teams, matches) {
  return teams
    .map((t, index) => {
      let points = 0,
        gf = 0,
        ga = 0,
        played = 0,
        wins = 0;
      for (const m of matches.filter(
        (m) => m.league && m.status === "finished" && [m.a, m.b].includes(t.id),
      )) {
        const s = scores(m);
        const a = m.a === t.id ? s[0] : s[1],
          b = m.a === t.id ? s[1] : s[0];
        gf += a;
        ga += b;
        played++;
        points += a > b ? 3 : a === b ? 1 : 0;
        if (a > b) wins++;
      }
      return { ...t, points, gf, ga, gd: gf - ga, played, wins, index };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.index - b.index,
    );
}
export function advance(state) {
  const league = state.matches.filter((m) => m.league);
  if (
    !league.length ||
    league.some((m) => m.status !== "finished") ||
    state.matches.some((m) => !m.league)
  )
    return;
  const ranked = standings(state.teams, state.matches);
  const seeds =
    ranked.length >= 4
      ? [ranked[0], ranked[3], ranked[1], ranked[2]]
      : ranked.slice(0, 2);
  const offset = Math.max(...league.map((m) => m.round)) + 1;
  const games = knockout(seeds);
  for (const m of games) {
    m.round += offset;
    m.knockoutStart = offset;
  }
  state.matches.push(...games);
}
