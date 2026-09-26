import fs from "node:fs";
const output = "public/data/usage-national.json";
let written = false;
for (let n = 1; n <= 4; n++) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - n);
  const month = date.toISOString().slice(0, 7);
  const sourceUrl = `https://www.smogon.com/stats/${month}/chaos/gen9nationaldex-0.json`;
  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) continue;
    const report = await response.json();
    if (!report.data || !report.info)
      throw new Error("Unexpected report shape");
    const pokemon = {};
    for (const [species, entry] of Object.entries(report.data)) {
      const total =
        Object.values(entry.Abilities || {}).reduce((a, b) => a + b, 0) ||
        entry["Raw count"] ||
        1;
      const rows = (obj) =>
        Object.entries(obj || {})
          .map(([name, n]) => ({ name, value: (n / total) * 100 }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      const natures = {};
      for (const [spread, n] of Object.entries(entry.Spreads || {})) {
        const nature = spread.split(":")[0];
        natures[nature] = (natures[nature] || 0) + n;
      }
      pokemon[species] = {
        moves: rows(entry.Moves),
        items: rows(entry.Items),
        abilities: rows(entry.Abilities),
        partners: rows(entry.Teammates),
        spreads: rows(entry.Spreads),
        natures: rows(natures),
      };
    }
    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
      output,
      JSON.stringify({
        month,
        sourceUrl,
        generatedAt: new Date().toISOString(),
        battles: report.info["number of battles"],
        pokemon,
      }),
    );
    console.log(
      `Saved ${month} National Dex OU usage for ${Object.keys(pokemon).length} species.`,
    );
    written = true;
    break;
  } catch (error) {
    console.warn(`Could not load ${month}: ${error.message}`);
  }
}
if (!written) {
  if (fs.existsSync(output))
    console.warn(
      "Provider unavailable; retaining the existing, dated usage snapshot.",
    );
  else
    throw new Error("No usage report available and no local snapshot exists.");
}
