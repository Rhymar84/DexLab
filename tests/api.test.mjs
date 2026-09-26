import test from "node:test";
import assert from "node:assert/strict";
import { loadUsage } from "../src/api.mjs";

test("Champions API maps real categories, spreads, and partner rankings", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(
      JSON.stringify({
        rows: [
          {
            category: "move",
            name: "Fake Out",
            percentage_value: 97.7,
            rank: 1,
          },
          {
            category: "teammate",
            name: "Garchomp",
            percentage_value: null,
            rank: 1,
          },
          {
            category: "stat_points",
            name: "",
            hp_points: "32",
            attack_points: "0",
            defense_points: "2",
            sp_atk_points: "0",
            sp_def_points: "32",
            speed_points: "0",
            percentage_value: 8,
          },
          { category: "ability", name: "Intimidate", percentage_value: 99.7 },
        ],
      }),
    );
  };
  const format = { id: "regmc", champion: true },
    pokemon = { id: "api-test-one" };
  const [a, b] = await Promise.all([
    loadUsage(pokemon, format),
    loadUsage(pokemon, format),
  ]);
  assert.equal(requests, 1);
  assert.deepEqual(a, b);
  assert.equal(a.groups.moves[0].value, 97.7);
  assert.equal(a.groups.spreads[0].name, "32 / 0 / 2 / 0 / 32 / 0");
  assert.equal(a.groups.partners[0].value, null);
  assert.deepEqual(a.groups.items, []);
  await loadUsage(pokemon, format);
  assert.equal(requests, 1);
});
test("M-B rejects reports outside its calendar window, even with an archive label", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        daily: [
          {
            date: "10_09_2026",
            rows: [{ category: "move", name: "Protect", percentage_value: 80 }],
          },
        ],
      }),
    );
  await assert.rejects(
    loadUsage({ id: "api-test-two" }, { id: "regmb", champion: true }),
    /No usage data/,
  );
});
test("M-B selects a dated report inside the regulation", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        daily: [
          {
            date: "05_08_2026",
            rows: [
              { category: "held_item", name: "Life Orb", percentage_value: 20 },
            ],
          },
        ],
      }),
    );
  const result = await loadUsage(
    { id: "api-test-three" },
    { id: "regmb", champion: true },
  );
  assert.match(result.label, /Archived M-B/);
  assert.equal(result.dataDate, "05_08_2026");
  assert.equal(result.groups.items[0].name, "Life Orb");
});
test("Unavailable providers produce an error, not fabricated report data", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(
    loadUsage({ id: "api-test-four" }, { id: "regmc", champion: true }),
    /503/,
  );
});

test("Missing Mega reports fall back to the starting form with a visible qualification", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return url.endsWith('/baxcaliburmega')
      ? new Response('{"error":"Pokemon not found."}', { status: 404 })
      : new Response(JSON.stringify({ rows: [{ category: 'held_item', name: 'Baxcalibrite', percentage_value: 70 }] }));
  };
  const result = await loadUsage({ id: 'baxcaliburmega', name: 'Baxcalibur-Mega', battleOnly: 'Baxcalibur' }, { id: 'regmc', champion: true });
  assert.deepEqual(requests, [
    'https://championsbattledata.com/api/battle/Doubles/baxcaliburmega',
    'https://championsbattledata.com/api/battle/Doubles/baxcalibur',
  ]);
  assert.match(result.note, /Showing the Baxcalibur report/);
  assert.match(result.note, /not specific to this battle form/);
  assert.equal(result.groups.items[0].value, 70);
});

test("Existing exact-form reports take precedence and distinct forms never use a base fallback", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return new Response(JSON.stringify({ rows: [{ category: 'move', name: 'Protect', percentage_value: 50 }] }));
  };
  const exact = await loadUsage({ id: 'charizardmegay', name: 'Charizard-Mega-Y', battleOnly: 'Charizard' }, { id: 'regmc', champion: true });
  assert.equal(requests.length, 1);
  assert.equal(exact.note, '');
  globalThis.fetch = async (url) => { requests.push(url); return new Response('', {status:404}); };
  await assert.rejects(loadUsage({id:'indeedeef',name:'Indeedee-F',baseSpecies:'Indeedee',battleOnly:false},{id:'regmc',champion:true}), /no usage report for Indeedee-F/);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith('/indeedeef'));
});

test("An archived battle-form fallback retains the archive query and date filter", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests=[];
  globalThis.fetch=async(url)=>{
    requests.push(url);
    return url.includes('/charizardmegax?') ? new Response('',{status:404}) : new Response(JSON.stringify({daily:[{date:'05_08_2026',rows:[{category:'move',name:'Heat Wave',percentage_value:40}]}]}));
  };
  const result=await loadUsage({id:'charizardmegax',name:'Charizard-Mega-X',battleOnly:'Charizard'},{id:'regmb',champion:true});
  assert.ok(requests.every(url=>url.endsWith('?season=M4&days=31')));
  assert.equal(result.dataDate,'05_08_2026');
  assert.match(result.note,/Charizard report/);
});

test("Missing fallback reports are friendly; server errors do not trigger substitution", async (t) => {
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  let requests=0;
  globalThis.fetch=async()=>{requests++;return new Response('',{status:404});};
  await assert.rejects(loadUsage({id:'palafinhero',name:'Palafin-Hero',battleOnly:'Palafin'},{id:'regmc',champion:true}),/no usage report for Palafin-Hero/);
  assert.equal(requests,2);
  globalThis.fetch=async()=>{requests++;return new Response('',{status:503});};
  await assert.rejects(loadUsage({id:'venusaurmega',name:'Venusaur-Mega',battleOnly:'Venusaur'},{id:'regmc',champion:true}),/503/);
  assert.equal(requests,3);
});
