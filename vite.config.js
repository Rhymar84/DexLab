import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Tie the data URL to its contents so a new app build cannot reuse stale move tags.
const dexVersion = createHash("sha256")
  .update(readFileSync(new URL("./public/data/dex.json", import.meta.url)))
  .digest("hex")
  .slice(0, 16);

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { __DEX_VERSION__: JSON.stringify(dexVersion) },
});
