const cache = new Map();
const pending = new Map();
const API = "https://championsbattledata.com";
async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const error = new Error(`Data provider returned ${r.status}`);
    error.status = r.status;
    throw error;
  }
  return r.json();
}

async function getChampionsReport(pokemon, format) {
  const suffix = format.id === "regmb" ? "?season=M4&days=31" : "";
  const fetchReport = (id) => getJSON(`${API}/api/battle/Doubles/${encodeURIComponent(id)}${suffix}`);
  try {
    return { response: await fetchReport(pokemon.id), note: "" };
  } catch (error) {
    if (error.status !== 404) throw error;
    // Only battle transformations have an unambiguous starting form. Regional,
    // gendered, and other distinct forms must never silently share a report.
    const startingForms = pokemon.battleOnly ? [pokemon.battleOnly].flat() : [];
    if (startingForms.length === 1) {
      const startingName = startingForms[0];
      const startingId = startingName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (startingId !== pokemon.id) {
        try {
          return {
            response: await fetchReport(startingId),
            note: `Showing the ${startingName} report. The provider has no separate report for ${pokemon.name}. These percentages are not specific to this battle form.`,
          };
        } catch (fallbackError) {
          if (fallbackError.status !== 404) throw fallbackError;
        }
      }
    }
    throw new Error(`The provider has no usage report for ${pokemon.name || pokemon.id} in this format. Other Pokémon reports may still be available.`);
  }
}
export async function loadUsage(pokemon, format) {
  const key = `${format.id}:${pokemon.id}`;
  if (cache.has(key) && Date.now() - cache.get(key).time < 3600000)
    return cache.get(key).data;
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    let result;
    if (format.champion) {
      const { response, note } = await getChampionsReport(pokemon, format);
      const data =
        format.id === "regmb"
          ? response.daily?.find((d) => {
              const [day, month, year] = (d.date || "").split("_");
              const date = `${year}-${month}-${day}`;
              return date >= "2026-06-17" && date < "2026-09-09";
            })
          : response;
      if (!data?.rows?.length)
        throw new Error(
          "No usage data is available for this Pokémon in this format.",
        );
      const mapping = {
        move: "moves",
        held_item: "items",
        teammate: "partners",
        stat_alignment: "natures",
        ability: "abilities",
        stat_points: "spreads",
        stat_spread: "spreads",
      };
      const groups = {
        moves: [],
        items: [],
        partners: [],
        natures: [],
        abilities: [],
        spreads: [],
      };
      for (const r of data.rows) {
        const category =
          mapping[r.category] ||
          (r.category.includes("spread") ? "spreads" : undefined);
        if (!category) continue;
        const spread = [
          "hp_points",
          "attack_points",
          "defense_points",
          "sp_atk_points",
          "sp_def_points",
          "speed_points",
        ]
          .map((s) => r[s] || "0")
          .join(" / ");
        groups[category].push({
          name: category === "spreads" ? spread : r.name,
          value: r.percentage_value,
          rank: r.rank,
          extra: r.stat_up ? `+${r.stat_up} / −${r.stat_down}` : "",
        });
      }
      result = {
        groups,
        source: "Pokémon Champions Battle Data",
        sourceUrl: API,
        label:
          format.id === "regmb"
            ? `Archived M-B · provider season M4 · ${data.date}`
            : "Current Champions doubles · provider’s latest sample",
        fetchedAt: new Date().toISOString(),
        dataDate: data.date || null,
        note,
      };
    } else {
      // Smogon does not permit cross-origin browser fetches. Serve a dated,
      // normalized report from this static host; refresh it before deployment.
      const archive = await getJSON(
        `${import.meta.env?.BASE_URL || "./"}data/usage-national.json`,
      );
      const groups = archive.pokemon?.[pokemon.name];
      if (!groups)
        throw new Error("No usage report for this Pokémon in National Dex OU.");
      result = {
        groups,
        source: "Smogon usage statistics",
        sourceUrl: archive.sourceUrl,
        label: `${archive.month} · National Dex OU ladder · all ratings · bundled snapshot (not the unrestricted pool)`,
        fetchedAt: archive.generatedAt,
        dataDate: archive.month,
      };
    }
    cache.set(key, { time: Date.now(), data: result });
    return result;
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
