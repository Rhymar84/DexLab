export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const LABELS = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
  bst: "BST",
  name: "Name",
};
export const TAGS = [
  "Spread",
  "Sound",
  "Sharpness",
  "Sheer Force",
  "Speed Control",
  "Priority",
];
export const toID = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const emptyStats = (n = 0) =>
  Object.fromEntries(STATS.map((s) => [s, n]));
export const TYPE_COLORS = {
  Normal: "#999eaa",
  Fire: "#f78d58",
  Water: "#71a9ef",
  Electric: "#e9c954",
  Grass: "#85be65",
  Ice: "#77cdd2",
  Fighting: "#df867c",
  Poison: "#b28bcc",
  Ground: "#c6a47a",
  Flying: "#a6a0e6",
  Psychic: "#ef83a3",
  Bug: "#b0be55",
  Rock: "#c5b274",
  Ghost: "#9a8bcc",
  Dragon: "#9c8cf0",
  Dark: "#a99b93",
  Steel: "#94b9c5",
  Fairy: "#e8a0d3",
};

export function effectiveness(type, pokemon, chart, ability = "", item = "") {
  const grounded = item === "Iron Ball" && type === "Ground";
  let value = pokemon.types.reduce(
    (n, t) =>
      n *
      (grounded && t === "Flying"
        ? 1
        : item === "Ring Target" && chart[type]?.[t] === 0
          ? 1
          : (chart[type]?.[t] ?? 1)),
    1,
  );
  const immunities = {
    Levitate: "Ground",
    Eelevate: "Ground",
    "Flash Fire": "Fire",
    "Well-Baked Body": "Fire",
    "Water Absorb": "Water",
    "Storm Drain": "Water",
    "Dry Skin": "Water",
    "Volt Absorb": "Electric",
    "Lightning Rod": "Electric",
    "Motor Drive": "Electric",
    "Sap Sipper": "Grass",
    "Earth Eater": "Ground",
  };
  if (
    (immunities[ability] === type &&
      !(grounded && ["Levitate", "Eelevate"].includes(ability))) ||
    (item === "Air Balloon" && type === "Ground")
  )
    return 0;
  if (ability === "Wonder Guard" && value <= 1) return 0;
  if (ability === "Thick Fat" && ["Fire", "Ice"].includes(type)) value *= 0.5;
  if (ability === "Heatproof" && type === "Fire") value *= 0.5;
  if (ability === "Water Bubble" && type === "Fire") value *= 0.5;
  if (ability === "Dry Skin" && type === "Fire") value *= 1.25;
  if (ability === "Fluffy" && type === "Fire") value *= 2;
  if (["Filter", "Solid Rock", "Prism Armor"].includes(ability) && value > 1)
    value *= 0.75;
  if (ability === "Purifying Salt" && type === "Ghost") value *= 0.5;
  return value;
}
export function matchupAbilities(pokemon, chart, filters) {
  const abilities = filters.includeAbilities === false
    ? [""]
    : filters.ability
      ? pokemon.abilities.filter((a) => a === filters.ability)
      : [...new Set(pokemon.abilities)];
  // A single available ability must satisfy every matchup; never combine abilities.
  return abilities.filter((ability) => (filters.matchups || []).every((f) => {
    if (f.mode === "strong") {
      return pokemon.types.some((type) => (chart[type]?.[f.type] ?? 1) > 1);
    }
    const n = effectiveness(f.type, pokemon, chart, ability);
    return f.mode === "weak" ? n > 1
      : f.mode === "resist" ? n < 1
      : n === 0;
  }));
}
export function matchupAbilityWarning(pokemon, chart, filters) {
  if (filters.includeAbilities === false || !filters.matchups?.length) return "";
  const abilities = [...new Set(pokemon.abilities)];
  const matching = matchupAbilities(pokemon, chart, { ...filters, ability: "" });
  if (abilities.length < 2 || !matching.length || matching.length === abilities.length) return "";
  const required = filters.ability ? matching.filter((a) => a === filters.ability) : matching;
  if (!required.length) return "";
  const f = filters.matchups[0];
  const subject = filters.matchups.length === 1 && f.mode === "immune"
    ? `${f.type} immunity requires` : "These matchups require";
  return `${subject} ${required.join(" or ")}.`;
}
export function filterPokemon(pool, filters) {
  return pool.pokemon.filter((p) => {
    if (
      filters.query &&
      !toID(p.name).includes(toID(filters.query)) &&
      String(p.num) !== filters.query.trim()
    )
      return false;
    if (filters.types?.some((t) => !p.types.includes(t))) return false;
    if (filters.ability && !p.abilities.includes(filters.ability)) return false;
    if (filters.moves?.some((m) => !p.moves.includes(m))) return false;
    if (filters.matchups?.length && !matchupAbilities(p, pool.chart, filters).length)
      return false;
    return true;
  });
}
export function sortPokemon(list, key, direction) {
  return [...list].sort(
    (a, b) =>
      (key === "name"
        ? a.name.localeCompare(b.name)
        : (a.stats[key] ?? a[key]) - (b.stats[key] ?? b[key])) *
        (direction === "asc" ? 1 : -1) || a.name.localeCompare(b.name),
  );
}
export function filterMoves(moves, filters) {
  return moves.filter(
    (m) =>
      (!filters.query || toID(m.name).includes(toID(filters.query))) &&
      (!filters.type || m.type === filters.type) &&
      (!filters.category || m.category === filters.category) &&
      (filters.tags || []).every((t) => m.tags.includes(t)),
  );
}
export function makeSet(p) {
  return {
    uid: crypto.randomUUID(),
    species: p.id,
    nickname: "",
    item: p.requiredItem || "",
    ability: p.abilities[0] || "",
    nature: "Serious",
    level: 50,
    gender: p.gender || "",
    shiny: false,
    happiness: 255,
    teraType: p.types[0],
    evs: emptyStats(),
    ivs: emptyStats(31),
    moves: ["", "", "", ""],
  };
}
export function calculateStats(p, set, pool, champion) {
  const nature = pool.natures.find((n) => n.name === set.nature) || {};
  return Object.fromEntries(
    STATS.map((stat) => {
      const base = p.stats[stat];
      let n = champion
        ? base + (+set.evs[stat] || 0) + (stat === "hp" ? 75 : 20)
        : Math.floor(
            ((2 * base +
              (+set.ivs[stat] || 0) +
              Math.floor((+set.evs[stat] || 0) / 4)) *
              set.level) /
              100,
          ) + (stat === "hp" ? +set.level + 10 : 5);
      if (stat === "hp" && base === 1) n = 1;
      if (stat !== "hp")
        n = Math.floor(
          n * (nature.plus === stat ? 1.1 : nature.minus === stat ? 0.9 : 1),
        );
      return [stat, n];
    }),
  );
}
export function validateTeam(team, pool, champion) {
  const issues = [];
  if (champion && team.members.length !== 6)
    issues.push("VGC requires a full team of 6 Pokémon (choose 4 for battle).");
  const species = new Set(),
    items = new Set();
  for (const s of team.members) {
    const p = pool.pokemon.find((p) => p.id === s.species);
    const name = p?.name || s.species;
    if (!p) {
      issues.push(`${name} is not available in this format.`);
      continue;
    }
    if (champion && species.has(p.baseSpecies))
      issues.push(`${name}: Species Clause — duplicate species.`);
    species.add(p.baseSpecies);
    if (s.item && !pool.items.some((i) => i.name === s.item))
      issues.push(`${name}: ${s.item} is not available in this format.`);
    if (champion && s.item && items.has(s.item))
      issues.push(`${name}: Item Clause — duplicate ${s.item}.`);
    if (s.item) items.add(s.item);
    if (!p.abilities.includes(s.ability))
      issues.push(`${name}: select an available ability.`);
    if (p.requiredItem && p.requiredItem !== s.item)
      issues.push(`${name} requires ${p.requiredItem}.`);
    if (!pool.natures.some((n) => n.name === s.nature))
      issues.push(`${name}: invalid nature.`);
    if (champion && s.level !== 50)
      issues.push(`${name}: Champions battles are level 50.`);
    const total = Object.values(s.evs).reduce((a, b) => a + b, 0);
    if (
      total > (champion ? 66 : 510) ||
      Object.values(s.evs).some((v) => v < 0 || v > (champion ? 32 : 252))
    )
      issues.push(
        `${name}: ${champion ? "stat point" : "EV"} budget exceeded.`,
      );
    if (Object.values(s.ivs).some((v) => v < 0 || v > 31))
      issues.push(`${name}: IVs must be between 0 and 31.`);
    if (!s.moves.filter(Boolean).length)
      issues.push(`${name}: select at least one move.`);
    const seen = new Set();
    for (const m of s.moves.filter(Boolean)) {
      if (!p.moves.includes(m))
        issues.push(
          `${name} cannot learn ${pool.moves[m]?.name || m} in this pool.`,
        );
      if (seen.has(m))
        issues.push(`${name}: duplicate move ${pool.moves[m]?.name || m}.`);
      seen.add(m);
    }
  }
  return issues;
}
export function exportTeam(team, pool, champion, allPools = []) {
  return team.members
    .map((s) => {
      const p =
        pool.pokemon.find((p) => p.id === s.species) ||
        allPools.flatMap((p) => p.pokemon).find((p) => p.id === s.species);
      const name = p?.name || s.species;
      const lines = [
        `${s.nickname ? `${s.nickname} (${name})` : name}${["M", "F"].includes(s.gender) ? ` (${s.gender})` : ""}${s.item ? ` @ ${s.item}` : ""}`,
        `Ability: ${s.ability}`,
        `Level: ${s.level}`,
      ];
      if (s.shiny) lines.push("Shiny: Yes");
      if (!champion) {
        lines.push(`Happiness: ${s.happiness}`);
        if (s.teraType) lines.push(`Tera Type: ${s.teraType}`);
      }
      if (Object.values(s.evs).some(Boolean))
        lines.push(
          `EVs: ${STATS.filter((k) => s.evs[k])
            .map((k) => `${s.evs[k]} ${LABELS[k]}`)
            .join(" / ")}`,
        );
      lines.push(`${s.nature} Nature`);
      if (!champion && STATS.some((k) => s.ivs[k] !== 31))
        lines.push(
          `IVs: ${STATS.filter((k) => s.ivs[k] !== 31)
            .map((k) => `${s.ivs[k]} ${LABELS[k]}`)
            .join(" / ")}`,
        );
      s.moves
        .filter(Boolean)
        .forEach((m) =>
          lines.push(
            `- ${pool.moves[m]?.name || allPools.map((p) => p.moves[m]).find(Boolean)?.name || m}`,
          ),
        );
      return lines.join("\n");
    })
    .join("\n\n");
}
export function importTeam(text, pool, champion) {
  const blocks = text
    .trim()
    .replace(/^===.*===\s*$/gm, "")
    .trim()
    .split(/\n\s*\n/)
    .filter((b) => b.trim());
  if (!blocks.length || blocks.length > 6)
    throw new Error("Paste a Showdown team containing 1–6 Pokémon.");
  return blocks.map((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const [head, item = ""] = lines.shift().split(" @ ");
    const gender = head.match(/ \(([MF])\)$/)?.[1] || "";
    const label = head.replace(/ \([MF]\)$/, "");
    const matched = label.match(/^(.*) \(([^)]+)\)$/);
    const speciesName = matched ? matched[2] : label;
    const p = pool.pokemon.find((p) => toID(p.name) === toID(speciesName));
    if (!p)
      throw new Error(
        `“${speciesName}” is not in the selected format. Select the matching format first.`,
      );
    const set = {
      ...makeSet(p),
      nickname: matched ? matched[1] : "",
      item,
      gender: gender || p.gender || "",
    };
    let moves = [];
    for (const line of lines) {
      if (line.startsWith("- ")) {
        const move = Object.values(pool.moves).find(
          (m) => toID(m.name) === toID(line.slice(2)),
        );
        if (!move) throw new Error(`Unknown move: ${line.slice(2)}`);
        moves.push(move.id);
      } else if (/ Nature$/.test(line))
        set.nature = line.replace(/ Nature$/, "");
      else {
        const [key, ...parts] = line.split(": ");
        const value = parts.join(": ");
        if (key === "Ability") set.ability = value;
        else if (key === "Level") {
          const v = Number(value);
          if (!Number.isInteger(v) || v < 1 || v > 100)
            throw new Error("Level must be 1–100.");
          set.level = v;
        } else if (key === "Shiny") set.shiny = value === "Yes";
        else if (key === "Happiness") {
          const v = Number(value);
          if (!Number.isInteger(v) || v < 0 || v > 255)
            throw new Error("Happiness must be 0–255.");
          set.happiness = v;
        } else if (key === "Tera Type") {
          if (!Object.keys(TYPE_COLORS).includes(value) && value !== "Stellar")
            throw new Error("Invalid Tera type.");
          set.teraType = value;
        } else if (key === "EVs" || key === "IVs") {
          const target = key === "EVs" ? "evs" : "ivs";
          for (const chunk of value.split("/")) {
            const match = chunk
              .trim()
              .match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
            if (!match) throw new Error(`Invalid ${key} entry: ${chunk}`);
            set[target][match[2].toLowerCase()] = +match[1];
          }
        } else throw new Error(`Unsupported Showdown line: ${line}`);
      }
    }
    if (moves.length > 4) throw new Error(`${p.name} has more than 4 moves.`);
    set.moves = [...moves, ...Array(4 - moves.length).fill("")];
    const issues = validateTeam({ members: [set] }, pool, champion).filter(
      (s) => !s.startsWith("VGC requires"),
    );
    if (issues.length) throw new Error(issues.join(" "));
    return set;
  });
}
export function threatsFor(team, pool) {
  const members = team.members
    .map((s) => ({ set: s, p: pool.pokemon.find((p) => p.id === s.species) }))
    .filter((m) => m.p);
  if (!members.length) return [];
  return pool.pokemon
    .map((p) => {
      const attacking = p.types.filter((t) =>
        p.moves.some(
          (id) =>
            pool.moves[id]?.type === t && pool.moves[id]?.category !== "Status",
        ),
      );
      const hits = members.map((m) =>
        Math.max(
          0,
          ...attacking.map((t) =>
            effectiveness(t, m.p, pool.chart, m.set.ability, m.set.item),
          ),
        ),
      );
      const weak = hits.filter((x) => x > 1).length;
      return {
        p,
        weak,
        score: hits.reduce((a, x) => a + (x > 1 ? x : 0), 0),
        targets: members.filter((m, i) => hits[i] > 1).map((m) => m.p.name),
      };
    })
    .filter((t) => t.weak)
    .sort((a, b) => b.score - a.score || b.p.bst - a.p.bst)
    .filter(
      (t, i, all) =>
        all.findIndex((x) => x.p.baseSpecies === t.p.baseSpecies) === i,
    )
    .slice(0, 10);
}
