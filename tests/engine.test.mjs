import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  filterPokemon,
  matchupAbilityWarning,
  filterMoves,
  sortPokemon,
  effectiveness,
  makeSet,
  calculateStats,
  exportTeam,
  importTeam,
  validateTeam,
  threatsFor,
  STATS,
} from "../src/engine.mjs";
const data = JSON.parse(
  fs.readFileSync(new URL("../public/data/dex.json", import.meta.url)),
);
const pool = data.pools.regmc,
  national = data.pools.national;
const mon = (id, p = pool) => p.pokemon.find((p) => p.id === id);
test("Pools include official forms and apply Champions regulation restrictions", () => {
  assert.equal(data.types.length, 18);
  assert.ok(national.pokemon.length > 1000);
  assert.ok(mon("rillaboom"));
  assert.equal(mon("rillaboom", data.pools.regmb), undefined);
  assert.ok(mon("baxcaliburmega"));
  assert.equal(mon("baxcaliburmega", data.pools.regmb), undefined);
  assert.ok(mon("mewtwo", national));
  assert.equal(mon("mewtwo"), undefined);
  assert.equal(mon("ogerponwellspringtera"), undefined);
  assert.equal(mon("cramorantgulping"), undefined);
  assert.deepEqual(mon("lucariomegaz").abilities, ["Aura Guard"]);
  for (const id of ['regmc','regmb']) {
    const selected = data.pools[id];
    for (const p of selected.pokemon) {
      if (p.requiredItem) assert.ok(selected.items.some(i => i.name === p.requiredItem), `${p.name} requires an obtainable item`);
      if (p.battleOnly) assert.ok([p.battleOnly].flat().some(name => selected.pokemon.some(s => s.name === name)), `${p.name} requires an obtainable starting form`);
    }
  }
  for (const p of Object.values(data.pools))
    for (const s of p.pokemon) {
      assert.ok(s.abilities.length, `${s.name} needs a declared ability`);
      assert.equal(
        s.bst,
        Object.values(s.stats).reduce((a, b) => a + b),
      );
      assert.ok(
        s.moves.every((id) => p.moves[id]),
        `${s.name} move references must resolve`,
      );
    }
});
test("Stacked type, ability, move, and weakness filters intersect", () => {
  const filtered = filterPokemon(pool, {
    types: ["Fire", "Dark"],
    ability: "Intimidate",
    moves: ["fakeout", "partingshot"],
    matchups: [{ type: "Water", mode: "weak" }],
  });
  assert.ok(filtered.some((p) => p.id === "incineroar"));
  assert.ok(
    filtered.every(
      (p) =>
        p.types.includes("Fire") &&
        p.types.includes("Dark") &&
        p.abilities.includes("Intimidate") &&
        p.moves.includes("fakeout") &&
        p.moves.includes("partingshot"),
    ),
  );
  assert.equal(
    filterPokemon(pool, { types: ["Fire", "Water"], ability: "Intimidate" })
      .length,
    0,
  );
});
test("Every sortable column orders in both directions", () => {
  for (const key of ["name", ...STATS, "bst"]) {
    const asc = sortPokemon(pool.pokemon, key, "asc"),
      desc = sortPokemon(pool.pokemon, key, "desc");
    const value = (p) => p.stats[key] ?? p[key];
    for (let i = 1; i < asc.length; i++)
      assert.ok(
        key === "name"
          ? asc[i - 1].name.localeCompare(asc[i].name) <= 0
          : value(asc[i - 1]) <= value(asc[i]),
      );
    for (let i = 1; i < desc.length; i++)
      assert.ok(
        key === "name"
          ? desc[i - 1].name.localeCompare(desc[i].name) >= 0
          : value(desc[i - 1]) >= value(desc[i]),
      );
  }
});
test("Type effectiveness handles dual typing, resistance, immunity and passive abilities", () => {
  assert.equal(effectiveness("Ice", mon("garchomp"), pool.chart), 4);
  assert.equal(effectiveness("Electric", mon("garchomp"), pool.chart), 0);
  assert.equal(effectiveness("Fire", mon("incineroar"), pool.chart), 0.5);
  assert.equal(
    effectiveness("Ground", mon("rotom"), pool.chart, "Levitate"),
    0,
  );
  assert.equal(
    effectiveness(
      "Water",
      mon("gastrodon", national),
      pool.chart,
      "Storm Drain",
    ),
    0,
  );
  assert.equal(
    effectiveness("Fire", mon("venusaurmega"), pool.chart, "Thick Fat"),
    1,
  );
  assert.ok(
    !filterPokemon(pool, {
      matchups: [{ mode: "resist", type: "Electric" }],
    }).some((p) => p.id === "garchomp"),
  );
});
test("Explorer includes ability immunities by default and supports typing-only search", () => {
  const filters = { matchups: [{ mode: "immune", type: "Ground" }] };
  const results = filterPokemon(pool, filters);
  for (const p of pool.pokemon.filter((p) => p.abilities.includes("Levitate"))) {
    assert.ok(results.some((r) => r.id === p.id), p.name);
  }
  assert.ok(results.some((p) => p.id === "rotom"));
  assert.ok(results.some((p) => p.id === "delphoxmega"));
  const typeOnly = filterPokemon(pool, { ...filters, includeAbilities: false });
  assert.ok(!typeOnly.some((p) => p.id === "rotom"));
  assert.ok(typeOnly.some((p) => p.id === "charizard"));
});
test("Explorer ability cautions identify conditional immunity without flagging natural immunity", () => {
  const filters = { matchups: [{ mode: "immune", type: "Ground" }] };
  assert.equal(matchupAbilityWarning(mon("bronzong", national), national.chart, filters), "Ground immunity requires Levitate.");
  assert.equal(matchupAbilityWarning(mon("rotom"), pool.chart, filters), "");
  assert.equal(matchupAbilityWarning(mon("charizard"), pool.chart, filters), "");
  assert.equal(matchupAbilityWarning(mon("bronzong", national), national.chart, { ...filters, includeAbilities: false }), "");
  assert.ok(!filterPokemon(national, { ...filters, query: "bronzong", ability: "Heatproof" }).length);
  assert.equal(filterPokemon(national, { ...filters, query: "bronzong", ability: "Levitate" }).length, 1);
});
test("Stacked matchups cannot combine mutually exclusive abilities", () => {
  const electric = { mode: "immune", type: "Electric" };
  const water = { mode: "immune", type: "Water" };
  assert.equal(filterPokemon(national, { query: "lanturn", matchups: [electric] }).length, 1);
  assert.equal(filterPokemon(national, { query: "lanturn", matchups: [water] }).length, 1);
  assert.equal(filterPokemon(national, { query: "lanturn", matchups: [electric, water] }).length, 0);
  assert.equal(filterPokemon(pool, { query: "rotom", matchups: [{ mode: "weak", type: "Ground" }] }).length, 0);
});
test("Move flags reflect actual mechanics and combine by intersection", () => {
  const m = pool.moves;
  assert.ok(m.earthquake.tags.includes("Spread"));
  assert.ok(m.hypervoice.tags.includes("Sound"));
  assert.ok(m.sacredsword.tags.includes("Sharpness"));
  assert.ok(m.fakeout.tags.includes("Priority"));
  assert.ok(m.flamethrower.tags.includes("Sheer Force"));
  assert.ok(!m.closecombat.tags.includes("Sheer Force"));
  assert.ok(m.icywind.tags.includes("Speed Control"));
  assert.ok(m.thunderwave.tags.includes("Speed Control"));
  assert.ok(m.trickroom.tags.includes("Speed Control"));
  assert.ok(!m.gyroball.tags.includes("Speed Control"));
  assert.ok(
    filterMoves(Object.values(m), {
      type: "Ice",
      category: "Special",
      tags: ["Spread", "Speed Control"],
    }).some((x) => x.id === "icywind"),
  );
  assert.ok(m.fakeout.description?.length > 10);
});
test("Champions points and National Dex EVs calculate correct speed and HP", () => {
  const p = mon("garchomp");
  const s = {
    ...makeSet(p),
    nature: "Jolly",
    evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  };
  assert.equal(calculateStats(p, s, pool, true).spe, 169);
  assert.equal(calculateStats(p, s, pool, true).hp, 185);
  const n = {
    ...s,
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  };
  assert.equal(
    calculateStats(mon("garchomp", national), n, national, false).spe,
    169,
  );
  assert.equal(
    calculateStats(mon("garchomp", national), n, national, false).hp,
    184,
  );
});
test("Showdown import/export preserves a full National Dex set", () => {
  const p = mon("garchomp", national);
  const s = {
    ...makeSet(p),
    nickname: "Chomper",
    item: "Life Orb",
    ability: "Rough Skin",
    nature: "Jolly",
    gender: "M",
    shiny: true,
    teraType: "Steel",
    happiness: 200,
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
    moves: ["earthquake", "dragonclaw", "protect", "swordsdance"],
  };
  const text = exportTeam({ members: [s] }, national, false);
  const imported = importTeam(text, national, false)[0];
  const { uid, ...expected } = s;
  const { uid: ignored, ...actual } = imported;
  assert.deepEqual(actual, expected);
});
test("Champions export uses the EVs line for points, not main-series EVs", () => {
  const p = mon("incineroar");
  const s = {
    ...makeSet(p),
    ability: "Intimidate",
    evs: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
    moves: ["fakeout", "protect", "partingshot", "flareblitz"],
  };
  const text = exportTeam({ members: [s] }, pool, true);
  assert.match(text, /EVs: 32 HP \/ 2 Def \/ 32 SpD/);
  assert.doesNotMatch(text, /IVs:|Tera Type:/);
  assert.deepEqual(importTeam(text, pool, true)[0].evs, s.evs);
});
test("Imports reject errors without accepting partially invalid teams", () => {
  assert.throws(
    () => importTeam("Mewtwo\nAbility: Pressure\n- Protect", pool, true),
    /not in the selected format/,
  );
  assert.throws(
    () =>
      importTeam(
        "Garchomp\nAbility: Rough Skin\nEVs: 252 Atk\n- Earthquake",
        pool,
        true,
      ),
    /budget exceeded/,
  );
  assert.throws(
    () => importTeam("Garchomp\nAbility: Rough Skin\n- Fake Out", pool, true),
    /cannot learn/,
  );
  assert.throws(
    () =>
      importTeam(
        "Garchomp\nAbility: Rough Skin\n- Earthquake\n- Earthquake",
        pool,
        true,
      ),
    /duplicate move/,
  );
  assert.throws(
    () => importTeam("Garchomp\nLevel: banana\n- Earthquake", pool, true),
    /Level must/,
  );
});
test("VGC clauses and threat rankings are computed from the actual team", () => {
  const s = {
    ...makeSet(mon("garchomp")),
    item: "Life Orb",
    moves: ["earthquake", "", "", ""],
  };
  assert.ok(
    validateTeam({ members: [s, { ...s, uid: "two" }] }, pool, true).some((x) =>
      x.includes("Species Clause"),
    ),
  );
  assert.ok(
    validateTeam({ members: [s, { ...s, uid: "two" }] }, pool, true).some((x) =>
      x.includes("Item Clause"),
    ),
  );
  assert.deepEqual(threatsFor({ members: [] }, pool), []);
  const threats = threatsFor({ members: [s] }, pool);
  assert.ok(threats.length);
  assert.ok(
    threats.every((t) => t.weak === 1 && t.targets.includes("Garchomp")),
  );
});
