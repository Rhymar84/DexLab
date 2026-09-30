import React, { useMemo, useState } from "react";
import { Shield, Gauge, Swords, Plus } from "lucide-react";
import { calculateStats, effectiveness, threatsFor } from "./engine.mjs";
import { PokemonImage, TypeBadge, Empty } from "./common.jsx";
import { useOverallUsage } from "./OverallUsage.jsx";
export function Profile({ team, pool, types, format, onExplore, onInspect }) {
  const [abilities, setAbilities] = useState(true);
  const { data: usage, error: usageError, retry } = useOverallUsage(format);
  const members = team.members
    .map((s) => ({ set: s, p: pool.pokemon.find((p) => p.id === s.species) }))
    .filter((m) => m.p);
  const threats = useMemo(() => threatsFor(team, pool, usage?.pokemon), [team, pool, usage]);
  const speeds = members
    .map((m) => ({
      ...m,
      speed: calculateStats(m.p, m.set, pool, format.champion).spe,
    }))
    .sort((a, b) => b.speed - a.speed);
  if (!members.length)
    return (
      <Empty
        title="A team worth knowing"
        action={
          <button className="button primary" onClick={onExplore}>
            <Plus size={16} /> Add Pokémon
          </button>
        }
      >
        Add Pokémon to see all 18 defensive matchups, speed tiers, and potential
        threats.
      </Empty>
    );
  return (
    <div className="profile-content">
      <section className="panel speed-panel">
        <h3>
          <Gauge size={18} /> Speed spread{" "}
          <span className="muted">
            Calculated stats · level {format.champion ? 50 : "as set"}
          </span>
        </h3>
        <div className="speed-cards">
          {speeds.map((m) => (
            <div className="speed-card" key={m.set.uid}>
              <PokemonImage p={m.p} />
              <strong>{m.speed}</strong>
              <span>{m.p.name}</span>
              <div className="speed-track">
                <i
                  style={{
                    width: `${(m.speed / Math.max(...speeds.map((s) => s.speed))) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="help">
          Before battle modifiers such as Choice Scarf, Tailwind, paralysis, or
          weather abilities. Trick Room reverses the order within each priority
          bracket.
        </p>
      </section>
      <div className="profile-grid">
        <section className="panel defense-panel">
          <h3>
            <Shield size={18} /> Defensive profile
          </h3>
          <label className="check-label">
            <input
              type="checkbox"
              checked={abilities}
              onChange={(e) => setAbilities(e.target.checked)}
            />{" "}
            Include passive type-based ability effects and held-item immunities
          </label>
          <div className="table-scroll">
            <table className="matchup-table">
              <thead>
                <tr>
                  <th>Attack type</th>
                  {members.map((m) => (
                    <th key={m.set.uid}>
                      <PokemonImage p={m.p} />
                      <span>{m.p.name}</span>
                    </th>
                  ))}
                  <th>Weak</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const values = members.map((m) =>
                    effectiveness(
                      t,
                      m.p,
                      pool.chart,
                      abilities ? m.set.ability : "",
                      abilities ? m.set.item : "",
                    ),
                  );
                  return (
                    <tr key={t}>
                      <td>
                        <TypeBadge type={t} small />
                      </td>
                      {values.map((v, i) => (
                        <td
                          key={i}
                          className={
                            v === 0
                              ? "immune-cell"
                              : v > 1
                                ? "weak-cell"
                                : v < 1
                                  ? "resist-cell"
                                  : "neutral-cell"
                          }
                        >
                          {v === 0.25
                            ? "¼"
                            : v === 0.5
                              ? "½"
                              : v === 1
                                ? "—"
                                : v}{" "}
                          {v !== 1 && "×"}
                        </td>
                      ))}
                      <td
                        className={
                          values.filter((n) => n > 1).length >= 3
                            ? "weak-text"
                            : "muted"
                        }
                      >
                        {values.filter((n) => n > 1).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <span className="weak-text">2–4× Weak</span>
            <span className="resist-text">¼–½× Resistant</span>
            <span className="immune-text">0× Immune</span>
          </div>
          <p className="help">
            Assumes the selected form and no Terastallization. Conditional
            effects, weather, terrain, damage rolls, and move-specific
            exceptions (e.g. Freeze-Dry) are not modeled.
          </p>
        </section>
        <section className="panel threats-panel">
          <h3>
            <Swords size={18} /> Potential threats
          </h3>
          <p className="help">
            Ranked by number of team members hit by super-effective STAB, then
            overall usage. Unranked Pokémon follow ranked ones; remaining ties
            sort by name. This measures type coverage, not damage.
          </p>
          <p className="help">
            {usage ? <>{usage.label} · <a href={usage.sourceUrl} target="_blank" rel="noreferrer">Pokémon Champions Battle Data</a>. {usage.note}</>
              : usageError ? <>{usageError} Showing coverage and name order. <button className="text-button" onClick={retry}>Retry</button></>
              : "Loading overall usage rankings…"}
          </p>
          {!threats.length && (
            <p className="muted">No super-effective STAB threats found.</p>
          )}
          {threats.map((t, i) => (
            <button
              className="threat-row"
              key={t.p.id}
              onClick={() => onInspect(t.p)}
            >
              <span className="rank">{i + 1}</span>
              <PokemonImage p={t.p} />
              <div>
                <strong>{t.p.name}</strong>
                <span>{t.targets.join(", ")}</span>
                {usage && <span>{t.usage ? `Usage #${t.usage.rank}${t.usage.startingForm ? ` · ${t.usage.startingForm} starting form` : ""}` : "Usage unranked"}</span>}
              </div>
              <span className="threat-count">
                {t.weak}/{members.length}
              </span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
