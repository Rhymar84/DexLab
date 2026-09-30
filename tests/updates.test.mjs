import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeSet, validateTeam, importTeam, threatsFor, overallUsageFor } from "../src/engine.mjs";
import { migrateSavedTeams } from "../src/storage.mjs";
import { loadOverallUsage } from "../src/api.mjs";

const data = JSON.parse(fs.readFileSync(new URL("../public/data/dex.json", import.meta.url)));
const pool = data.pools.national;

test("National Dex admits all dex numbers with Champions budgets but no VGC clauses", () => {
  const numbers = new Set(pool.pokemon.map((p) => p.num));
  for (let n = 1; n <= 1025; n++) assert.ok(numbers.has(n), `Missing dex #${n}`);
  const set = importTeam("Mewtwo @ Life Orb\nAbility: Pressure\nEVs: 32 SpA / 32 Spe / 2 HP\n- Psychic", pool, true)[0];
  assert.deepEqual(validateTeam({ members: [set, { ...set, uid: "copy" }] }, pool, true), []);
  assert.throws(() => importTeam("Mewtwo\nAbility: Pressure\nEVs: 252 SpA\n- Psychic", pool, true), /budget exceeded/);
  assert.throws(() => importTeam("Mewtwo\nAbility: Pressure\nEVs: 32 SpA / 32 Spe / 3 HP\n- Psychic", pool, true), /budget exceeded/);
  assert.throws(() => importTeam("Mewtwo\nAbility: Pressure\nLevel: 100\n- Psychic", pool, true), /level 50/);
});

test("Saved EV teams migrate once, keep all teams, and leave original data intact", () => {
  const member = makeSet(pool.pokemon.find((p) => p.id === "garchomp"));
  member.level = 100;
  member.evs = { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 };
  const old = { version: 1, active: "n", teams: [
    { id: "n", format: "national", members: [member] },
    { id: "c", format: "regmc", members: [{ ...member, level: 50 }] },
  ] };
  const before = structuredClone(old);
  const migrated = migrateSavedTeams(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.active, "n");
  assert.deepEqual(migrated.teams[0].members[0].evs, { hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  assert.equal(migrated.teams[0].members[0].level, 50);
  assert.equal(migrated.teams[1], old.teams[1]);
  assert.deepEqual(old, before);
  assert.equal(migrateSavedTeams(migrated), migrated);
});

test("Threats prioritize target count, then usage rank rather than 4x damage or BST", () => {
  const target = { id: "target", name: "Target", baseSpecies: "Target", types: ["Grass", "Steel"], moves: [] };
  const attacker = (id, type, bst) => ({ id, name: id, baseSpecies: id, types: [type], moves: [type], bst });
  const sample = { pokemon: [target, attacker("rare", "Fire", 800), attacker("common", "Fighting", 300), attacker("unranked", "Fire", 999)],
    moves: { Fire: { type: "Fire", category: "Special" }, Fighting: { type: "Fighting", category: "Physical" } },
    chart: { Fire: { Grass: 2, Steel: 2 }, Fighting: { Grass: 1, Steel: 2 } } };
  const team = { members: [{ species: "target" }] };
  assert.deepEqual(threatsFor(team, sample, { rare: { rank: 20 }, common: { rank: 1 } }).map((t) => t.p.id), ["common", "rare", "unranked"]);
  const target2 = { ...target, id: "target2", name: "Target2", types: ["Grass"] };
  sample.pokemon.push(target2);
  team.members.push({ species: "target2" });
  assert.equal(threatsFor(team, sample, { rare: { rank: 20 }, common: { rank: 1 } })[0].p.id, "rare");
});

test("Overall ranks preserve exact forms and visibly qualify starting-form fallbacks", () => {
  const ranks = { charizard: { rank: 10 }, charizardmegay: { rank: 3 }, indeedee: { rank: 40 } };
  assert.equal(overallUsageFor({ id: "charizardmegay", battleOnly: "Charizard" }, ranks).rank, 3);
  assert.equal(overallUsageFor({ id: "charizardmegax", battleOnly: "Charizard" }, ranks).startingForm, "Charizard");
  assert.equal(overallUsageFor({ id: "indeedeef", baseSpecies: "Indeedee" }, ranks), null);
});

test("Overall API uses dated doubles ranks, handles retry, deduplicates requests, and isolates archives", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(loadOverallUsage({ id: "regmc" }), /503/);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("index.json")) return Response.json({ seasons: [
      { season: "M4", formats: ["Doubles"], dates: ["05_08_2026"] },
      { season: "M6", formats: ["Doubles"], dates: ["29_09_2026", "30_09_2026"] },
      { season: "M7", formats: ["Singles"], dates: ["01_10_2026"] },
    ] });
    const archive = url.includes("/M4/");
    return Response.json({ season: archive ? "M4" : "M6", date: archive ? "05_08_2026" : "30_09_2026", format: "Doubles", pokemon: {
      Rillaboom: { position: archive ? 50 : 1, move: [["Fake Out", 99, 1]] },
      "Indeedee-F": { position: 5 }, Unknown: { position: null }, Invalid: { position: 0 },
    } });
  };
  const [current, national] = await Promise.all([loadOverallUsage({ id: "regmc" }), loadOverallUsage({ id: "national" })]);
  assert.deepEqual(current, national);
  assert.equal(calls.length, 2);
  assert.equal(current.pokemon.rillaboom.rank, 1);
  assert.equal(current.pokemon.indeedeef.rank, 5);
  assert.equal(current.pokemon.unknown, undefined);
  assert.equal(current.pokemon.invalid, undefined);
  assert.match(current.label, /2026-09-30/);
  const archived = await loadOverallUsage({ id: "regmb" });
  assert.equal(archived.pokemon.rillaboom.rank, 50);
  assert.match(archived.label, /Archived M-B.*2026-08-05/);
  await loadOverallUsage({ id: "national" });
  assert.equal(calls.length, 4);
});
