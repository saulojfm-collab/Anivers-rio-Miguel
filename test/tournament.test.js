import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bracket,
  finish,
  standings,
  advance,
  scores,
  knockout,
} from "../tournament.js";
const teams = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: "t" + i, name: "Time " + i }));
for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 16])
  test(`${n} times: todos jogam mais de uma vez e finais têm campeão`, () => {
    const state = { teams: teams(n), matches: bracket(teams(n)) };
    assert.equal(state.matches.length, n === 2 ? 2 : (n * (n - 1)) / 2);
    for (const t of state.teams)
      assert.ok(
        state.matches.filter((m) => [m.a, m.b].includes(t.id)).length >= 2,
      );
    for (const m of [...state.matches]) {
      m.events.push({ team: m.a });
      finish(state.matches, m);
      advance(state);
    }
    assert.equal(
      state.matches.filter(
        (m) =>
          !m.league &&
          m.round ===
            Math.min(
              ...state.matches.filter((m) => !m.league).map((m) => m.round),
            ),
      ).length,
      n >= 4 ? 2 : 1,
    );
    while (state.matches.some((m) => !m.league && m.status !== "finished")) {
      const m = state.matches.find((m) => !m.league && m.status === "ready");
      assert.ok(m, "Final deve ser liberada");
      finish(state.matches, m, [3, 2]);
    }
    const final = state.matches.at(-1);
    assert.equal(final.status, "finished");
    assert.ok(final.winner);
  });
test("classificação permite empate e soma pontos e saldo corretamente", () => {
  const ts = teams(3),
    ms = bracket(ts);
  finish(ms, ms[0]);
  assert.equal(standings(ts, ms).filter((t) => t.points === 1).length, 2);
  const m = ms[1];
  m.events.push({ team: m.b }, { team: m.b }, { team: m.a });
  finish(ms, m);
  assert.deepEqual(scores(m), [1, 2]);
  assert.equal(standings(ts, ms).find((t) => t.id === m.b).points, 4);
});
test("mata-mata exige desempate e não aceita pênaltis empatados", () => {
  const ms = knockout(teams(2));
  assert.throws(() => finish(ms, ms[0]));
  assert.throws(() => finish(ms, ms[0], [2, 2]));
  finish(ms, ms[0], [2, 4]);
  assert.equal(ms[0].winner, "t1");
});
