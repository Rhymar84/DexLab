import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

// A pinned, reviewable snapshot. Run --latest deliberately to advance it.
const PIN = "a5df8274e85b0889bf2a9b3422a08b39732374fc";
const root = path.resolve(".data-source/showdown");
if (!fs.existsSync(root)) {
  fs.mkdirSync(path.dirname(root), { recursive: true });
  execFileSync(
    "git",
    ["clone", "https://github.com/smogon/pokemon-showdown.git", root],
    { stdio: "inherit" },
  );
}
if (process.argv.includes("--latest")) {
  execFileSync("git", ["fetch", "origin", "master"], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync("git", ["checkout", "--detach", "FETCH_HEAD"], {
    cwd: root,
    stdio: "inherit",
  });
} else execFileSync("git", ["checkout", PIN], { cwd: root, stdio: "inherit" });
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) files.push(p);
  }
}
for (const dir of ["sim", "data", "lib", "config"]) walk(path.join(root, dir));
await build({
  entryPoints: files,
  outdir: path.join(root, "dist"),
  outbase: root,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "warning",
});
const require = createRequire(import.meta.url);
const { Dex } = require(path.join(root, "dist/sim/dex.js"));
const { TeamValidator } = require(
  path.join(root, "dist/sim/team-validator.js"),
);
const types = Dex.types
  .all()
  .filter((t) => t.name !== "Stellar")
  .map((t) => t.name);
const sources = [
  {
    label: "Pokémon Showdown data",
    url: `https://github.com/smogon/pokemon-showdown/tree/${sha}`,
  },
  {
    label: "Official Regulation M-C",
    url: "https://champions-news.pokemon-home.com/en/page/816.html",
  },
  {
    label: "Champions Battle Data API",
    url: "https://championsbattledata.com/api_guide",
  },
];
const configurations = [
  {
    id: "national",
    name: "National Dex",
    mod: "gen9",
    description:
      "All official Pokémon and historical items. Gen 9 mechanics, with transfer moves. An unrestricted research pool.",
    usage: "smogon",
    champion: false,
  },
  {
    id: "regmc",
    name: "Champions · VGC Regulation M-C",
    mod: "champions",
    format: "gen9championsvgc2026regmc",
    description:
      "9 September – 2 December 2026 · Doubles · Bring 6, pick 4 · Level 50",
    usage: "champions",
    champion: true,
  },
  {
    id: "regmb",
    name: "Champions · VGC Regulation M-B",
    mod: "championsregmb",
    format: "gen9championsvgc2026regmb",
    description:
      "Archived format · June – September 2026 · Doubles · Bring 6, pick 4 · Level 50",
    usage: "champions-m5",
    champion: true,
  },
];
const out = {
  generatedAt: new Date().toISOString(),
  sha,
  types,
  sources,
  formats: configurations,
  pools: {},
};
for (const config of configurations) {
  const dex = Dex.mod(config.mod);
  const validator = config.champion ? new TeamValidator(config.format) : null;
  const official = (x) =>
    x.exists &&
    !["CAP", "Custom", "LGPE", "Pokestar"].includes(x.isNonstandard);
  const moves = Object.fromEntries(
    dex.moves
      .all()
      .filter(
        (m) =>
          official(m) &&
          (!config.champion ||
            !validator.checkMove({ species: "", name: "" }, m, {})),
      )
      .map((m) => {
        const secondary = m.secondaries || (m.secondary ? [m.secondary] : []);
        const speedEffect = (e) =>
          !!(e && (e.boosts?.spe || e.status === "par" || e.self?.boosts?.spe));
        return [
          m.id,
          {
            id: m.id,
            name: m.name,
            type: m.type,
            category: m.category,
            power: m.basePower,
            accuracy: m.accuracy,
            pp: m.pp,
            priority: m.priority,
            description: dex.text.get(m).shortDesc || dex.text.get(m).desc,
            target: m.target,
            tags: [
              ["allAdjacent", "allAdjacentFoes"].includes(m.target)
                ? "Spread"
                : "",
              m.flags.sound ? "Sound" : "",
              m.flags.slicing ? "Sharpness" : "",
              m.category !== "Status" &&
              (secondary.length || m.hasSheerForceBoost)
                ? "Sheer Force"
                : "",
              [
                "tailwind",
                "trickroom",
                "quash",
                "afteryou",
                "waterpledge",
                "grasspledge",
                "electrify",
                "instruct",
                "triattack",
                "direclaw",
                "secretpower",
              ].includes(m.id) ||
              speedEffect(m) ||
              speedEffect(m.self) ||
              secondary.some(speedEffect)
                ? "Speed Control"
                : "",
              m.priority > 0 ? "Priority" : "",
            ].filter(Boolean),
          },
        ];
      }),
  );
  const items = dex.items
    .all()
    .filter(
      (i) =>
        official(i) &&
        (!config.champion ||
          !validator.checkItem({ species: "", name: "" }, i, {})),
    )
    .map((i) => ({
      id: i.id,
      name: i.name,
      spritenum: i.spritenum,
      description: dex.text.get(i).shortDesc || dex.text.get(i).desc,
      megaStone: i.megaStone,
    }));
  function obtainableSpecies(p, seen = new Set()) {
    if (!official(p) || p.num <= 0 || seen.has(p.id)) return false;
    if (!config.champion) return true;
    if (validator.checkSpecies({ species: p.name, name: p.name }, p, p, {})) return false;
    if (p.requiredItem && !items.some(i => i.name === p.requiredItem)) return false;
    if (p.battleOnly) {
      const visited = new Set([...seen, p.id]);
      return [p.battleOnly].flat().some(name => obtainableSpecies(dex.species.get(name), visited));
    }
    return true;
  }
  const pokemon = dex.species
    .all()
    .filter(p => obtainableSpecies(p))
    .map((p) => {
      let learnset = [];
      try {
        learnset = [...dex.species.getMovePool(p.id, !config.champion)].filter(
          (id) => moves[id],
        );
      } catch {
        /* Unobtainable forms can have no independent learnset. */
      }
      // Species declarations are authoritative for battle-only abilities. For example,
      // Aura Guard remains globally tagged Future upstream despite Lucario-Mega-Z's release.
      const abilities = Object.entries(p.abilities)
        .filter(([slot]) => !(slot === "H" && p.unreleasedHidden))
        .map(([, ability]) => ability);
      return {
        id: p.id,
        name: p.name,
        spriteid: p.spriteid,
        num: p.num,
        baseSpecies: p.baseSpecies,
        types: p.types,
        abilities: [...new Set(abilities)],
        stats: p.baseStats,
        bst: p.bst,
        tier: p.tier,
        moves: learnset,
        requiredItem: p.requiredItem || p.requiredItems?.[0] || "",
        requiredAbility: p.requiredAbility || "",
        battleOnly: p.battleOnly || false,
        gender: p.gender || "",
        weight: p.weightkg,
        height: p.heightm,
      };
    });
  out.pools[config.id] = {
    pokemon,
    moves,
    items,
    abilities: Object.fromEntries(
      dex.abilities
        .all()
        .filter(official)
        .map((a) => [
          a.name,
          dex.text.get(a).shortDesc || dex.text.get(a).desc,
        ]),
    ),
    natures: dex.natures
      .all()
      .map((n) => ({ name: n.name, plus: n.plus, minus: n.minus })),
    chart: Object.fromEntries(
      types.map((t) => [
        t,
        Object.fromEntries(
          types.map((def) => [
            def,
            dex.getImmunity(t, def) ? 2 ** dex.getEffectiveness(t, def) : 0,
          ]),
        ),
      ]),
    ),
  };
  console.log(
    `${config.name}: ${pokemon.length} Pokémon, ${Object.keys(moves).length} moves, ${items.length} items`,
  );
}
fs.mkdirSync("public/data", { recursive: true });
fs.writeFileSync("public/data/dex.json", JSON.stringify(out));
fs.mkdirSync("public/licenses", { recursive: true });
fs.copyFileSync(
  path.join(root, "LICENSE"),
  "public/licenses/pokemon-showdown.txt",
);
console.log(`Data snapshot: ${sha}`);
