import { STATS, emptyStats } from "./engine.mjs";

export const STORAGE = "dexlab-teams-v2";
export const LEGACY_STORAGE = "dexlab-teams-v1";

export function migrateSavedTeams(saved) {
  if (saved.version !== 1) return saved;
  return {
    ...saved,
    version: 2,
    teams: saved.teams.map((team) => team.format !== "national" ? team : {
      ...team,
      members: team.members.map((member) => ({
        ...member,
        level: 50,
        ivs: emptyStats(31),
        // Match the old level-50 investment contribution with fixed 31 IVs.
        evs: Object.fromEntries(STATS.map((stat) => [stat,
          Math.min(32, Math.max(0, Math.ceil(Math.floor(member.evs[stat] / 4) / 2))),
        ])),
      })),
    }),
  };
}
