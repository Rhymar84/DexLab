import React, { useEffect, useState } from "react";
import {
  Plus,
  ExternalLink,
  RefreshCw,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { ItemImage, Modal, PokemonImage, TypeBadge } from "./common.jsx";
import { LABELS, STATS, effectiveness, toID } from "./engine.mjs";
import { loadUsage } from "./api.mjs";
export function Details({
  pokemon: p,
  pool,
  referencePool = pool,
  format,
  types,
  onClose,
  onAdd,
  teamFull,
  onMoves,
}) {
  const [tab, setTab] = useState("overview"),
    [usage, setUsage] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (tab !== "usage") return;
    let active = true;
    setLoading(true);
    setError("");
    setUsage(null);
    loadUsage(p, format)
      .then((data) => {
        if (active) setUsage(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [p.id, format.id, tab, retry]);
  function usageEntry(name, key) {
    const id = toID(name);
    if (key === "moves") return pool.moves[id] || referencePool.moves[id];
    if (key === "items")
      return pool.items.find((i) => i.id === id) || referencePool.items.find((i) => i.id === id);
    if (key === "partners")
      return pool.pokemon.find((p) => p.id === id) || referencePool.pokemon.find((p) => p.id === id);
  }
  function displayName(name, key) {
    const entry = usageEntry(name, key);
    if (entry) return entry.name;
    if (key === "abilities")
      return (
        Object.keys(pool.abilities).find((a) => toID(a) === toID(name)) || name
      );
    return name;
  }
  return (
    <Modal title="Pokémon details" onClose={onClose} wide>
      <div className="detail-hero">
        <PokemonImage p={p} large />
        <div>
          <span className="eyebrow">
            NO. {String(p.num).padStart(3, "0")}{" "}
            {p.battleOnly ? " · BATTLE FORM" : ""}
          </span>
          <h1>{p.name}</h1>
          <div className="type-pair">
            {p.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <p className="muted">
            {p.height} m · {p.weight} kg
          </p>
        </div>
        <button
          className="button primary"
          disabled={teamFull}
          onClick={() => onAdd(p)}
        >
          <Plus size={17} />
          {teamFull ? "Team full" : "Add to team"}
        </button>
      </div>
      <div className="tabs detail-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          <BookOpen size={16} /> Overview
        </button>
        <button
          className={tab === "usage" ? "active" : ""}
          onClick={() => setTab("usage")}
        >
          <BarChart3 size={16} /> Usage & partners
        </button>
      </div>
      {tab === "overview" ? (
        <div className="detail-content">
          <div className="detail-grid">
            <section className="panel">
              <h3>
                Base stats <span className="muted">{p.bst} total</span>
              </h3>
              <div className="stat-bars">
                {STATS.map((k) => (
                  <div className="stat-bar" key={k}>
                    <span>{LABELS[k]}</span>
                    <strong>{p.stats[k]}</strong>
                    <div>
                      <i
                        style={{
                          width: `${Math.min(100, (p.stats[k] / 255) * 100)}%`,
                          background: k === "spe" ? "#a99af5" : "#c6f36b",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>Abilities</h3>
              {p.abilities.map((a) => (
                <div className="ability-description" key={a}>
                  <strong>{a}</strong>
                  <p>{pool.abilities[a] || "No description available."}</p>
                </div>
              ))}
            </section>
          </div>
          <section className="panel">
            <h3>
              Defensive matchups <span className="muted">Type only</span>
            </h3>
            <div className="matchup-chips">
              {types.map((t) => {
                const n = effectiveness(t, p, pool.chart);
                return (
                  <div key={t}>
                    <TypeBadge type={t} />
                    <strong
                      className={
                        n > 1 ? "weak-text" : n < 1 ? "resist-text" : "muted"
                      }
                    >
                      {n}×
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="detail-bottom">
            <span className="muted">
              {p.moves.length} available moves in {format.name}
            </span>
            <button className="button" onClick={() => onMoves(p)}>
              Explore learnset
            </button>
          </div>
          {p.battleOnly && (
            <p className="notice">
              This is a battle form.{" "}
              {p.requiredItem
                ? `It requires ${p.requiredItem}.`
                : `It transforms from ${Array.isArray(p.battleOnly) ? p.battleOnly.join(" / ") : p.battleOnly}.`}{" "}
              The profile uses the form you select.
            </p>
          )}
        </div>
      ) : (
        <div className="detail-content">
          {loading && (
            <div className="usage-state">
              <RefreshCw className="spin" />
              <h3>Fetching usage statistics…</h3>
              <p>Requesting the selected Pokémon’s report.</p>
            </div>
          )}
          {error && (
            <div className="usage-state">
              <h3>Usage data unavailable</h3>
              <p>{error}</p>
              <button className="button" onClick={() => setRetry(retry + 1)}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          )}
          {usage && (
            <>
                {usage.note && <p className="notice">{usage.note}</p>}
                <div className="usage-source">
                <div>
                  <strong>{usage.label}</strong>
                  <p>
                    {format.champion ? 'Retrieved' : 'Snapshot downloaded'} {new Date(usage.fetchedAt).toLocaleString()} ·{' '}
                    {format.champion ? 'Refreshed on demand; cached for one hour.' : 'Refreshed when the site is deployed.'}
                  </p>
                </div>
                <a href={usage.sourceUrl} target="_blank" rel="noreferrer">
                  Source <ExternalLink size={13} />
                </a>
              </div>
              <div className="usage-grid">
                {[
                  ["moves", "Common moves"],
                  ["abilities", "Abilities"],
                  ["items", "Held items"],
                  ["partners", "Common partners"],
                  ["natures", "Natures"],
                  [
                    "spreads",
                    format.champion ? "Stat point spreads" : "EV spreads",
                  ],
                ].map(([key, title]) => (
                  <section className="panel usage-card" key={key}>
                    <h3>{title}</h3>
                    {key === "spreads" && (
                      <p className="help">HP / Atk / Def / SpA / SpD / Spe</p>
                    )}
                    {!usage.groups[key].length && (
                      <p className="muted">Not provided in this report.</p>
                    )}
                    {usage.groups[key].slice(0, 10).map((r, i) => {
                      const entry = usageEntry(r.name, key);
                      return (
                      <div className="usage-row" key={`${r.name}-${i}`}>
                        <div>
                          <div className="usage-label">
                            {key === "items" && entry && (
                              <ItemImage item={entry} />
                            )}
                            {key === "partners" && entry && (
                              <span className="usage-partner-sprite" aria-hidden="true"><PokemonImage p={entry} /></span>
                            )}
                            <span>{displayName(r.name, key)}</span>
                            {key === "moves" && entry?.type && <TypeBadge type={entry.type} small />}
                          </div>
                          <strong>
                            {r.value == null
                              ? `#${r.rank || i + 1}`
                              : `${r.value.toFixed(1)}%`}
                          </strong>
                        </div>
                        {r.extra && <small>{r.extra}</small>}
                        {r.value != null && (
                          <div className="usage-track">
                            <i
                              style={{
                                width: `${Math.max(0, Math.min(100, r.value))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </section>
                ))}
              </div>
              <p className="source-attribution">
                Battle data provided by{" "}
                <a href={usage.sourceUrl} target="_blank" rel="noreferrer">
                  {usage.source}
                </a>
                . Missing categories are left empty; usage is not a
                recommendation or a legality check.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
