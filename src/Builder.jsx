import React, { useState } from "react";
import { OverallUsage } from "./OverallUsage.jsx";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  Copy,
  Check,
  X,
  Info,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import {
  STATS,
  LABELS,
  calculateStats,
  exportTeam,
  importTeam,
  validateTeam,
  toID,
} from "./engine.mjs";
import {
  Combo,
  Empty,
  IconButton,
  ItemImage,
  Modal,
  PokemonImage,
  TypeBadge,
} from "./common.jsx";
export function Builder({
  team,
  updateTeam,
  pool,
  allPokemon,
  allPools,
  format,
  types,
  activeMember,
  setActiveMember,
  onExplore,
  onMoves,
  onInspect,
  onRemove,
  notify,
}) {
  const [io, setIO] = useState(""),
    [importText, setImportText] = useState(""),
    [importError, setImportError] = useState("");
  const selected =
    team.members.find((m) => m.uid === activeMember) || team.members[0];
  const pokemon =
    selected &&
    (pool.pokemon.find((p) => p.id === selected.species) ||
      allPokemon.find((p) => p.id === selected.species));
  const legal = selected && pool.pokemon.some((p) => p.id === selected.species);
  const issues = validateTeam(team, pool, format.champion);
  const exportText = exportTeam(team, pool, format.champion, allPools);
  function update(patch) {
    updateTeam((t) => ({
      ...t,
      members: t.members.map((m) =>
        m.uid === selected.uid ? { ...m, ...patch } : m,
      ),
    }));
  }
  function move(direction) {
    const index = team.members.findIndex((m) => m.uid === selected.uid),
      next = index + direction;
    if (next < 0 || next >= team.members.length) return;
    const members = [...team.members];
    [members[index], members[next]] = [members[next], members[index]];
    updateTeam((t) => ({ ...t, members }));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(exportText);
      notify("Showdown team copied.");
    } catch {
      notify("Clipboard unavailable. Select and copy the text below.");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportText], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${team.name.replace(/[^a-z0-9 -]/gi, "").trim() || "team"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const stats =
    pokemon && selected
      ? calculateStats(pokemon, selected, pool, format.champion)
      : {};
  const total = selected
    ? Object.values(selected.evs).reduce((a, b) => a + b, 0)
    : 0;
  const limit = format.champion ? 66 : 510,
    singleLimit = format.champion ? 32 : 252;
  function investment(key, value) {
    const amount = Math.max(
      0,
      Math.min(
        singleLimit,
        Math.trunc(Number(value) || 0),
        Math.max(0, limit - total + selected.evs[key]),
      ),
    );
    update({ evs: { ...selected.evs, [key]: amount } });
  }
  return (
    <div className="builder-content">
      <div className="builder-top">
        <div>
          <label className="eyebrow" htmlFor="team-name">
            TEAM NAME
          </label>
          <input
            id="team-name"
            className="team-name-input"
            maxLength={70}
            value={team.name}
            onChange={(e) =>
              updateTeam((t) => ({ ...t, name: e.target.value }))
            }
          />
        </div>
        <div className="button-row">
          <button
            className="button"
            onClick={() => {
              setImportText("");
              setImportError("");
              setIO("import");
            }}
          >
            <Download size={16} /> Import
          </button>
          <button
            className="button"
            disabled={!team.members.length}
            onClick={() => setIO("export")}
          >
            <Upload size={16} /> Export team
          </button>
        </div>
      </div>
      <div className="team-cards">
        {Array.from({ length: 6 }, (_, i) => {
          const m = team.members[i];
          const p =
            m &&
            (pool.pokemon.find((p) => p.id === m.species) ||
              allPokemon.find((p) => p.id === m.species));
          const item = m?.item && (
            pool.items.find((item) => item.id === toID(m.item)) ||
            allPools.flatMap((p) => p.items).find((item) => item.id === toID(m.item))
          );
          return (
            <div className="team-slot" key={m?.uid || i}>
            <button
              className={`team-card ${m?.uid === selected?.uid ? "active" : ""} ${!m ? "empty-slot" : ""}`}
              onClick={() => (m ? setActiveMember(m.uid) : onExplore())}
            >
              {m ? (
                <>
                  <span className="slot-number">0{i + 1}</span>
                  <PokemonImage p={p} />
                  <strong>{p?.name || m.species}</strong>
                  <span className="team-card-item">
                    <ItemImage item={item} />
                    <span>{m.item || "No item"}</span>
                  </span>
                </>
              ) : (
                <>
                  <Plus size={24} />
                  <strong>Add Pokémon</strong>
                  <span>Slot {i + 1}</span>
                </>
              )}
            </button>
            {m && (
              <button
                className="team-slot-remove"
                aria-label={`Remove ${p?.name || m.species} from team slot ${i + 1}`}
                title={`Remove ${p?.name || m.species}`}
                onClick={() => onRemove(m.uid)}
              >
                <X size={16} />
              </button>
            )}
            </div>
          );
        })}
      </div>
      {!selected ? (
        <Empty
          title="Build your next team"
          action={
            <button className="button primary" onClick={onExplore}>
              Explore
            </button>
          }
        >
          Use an empty slot above to browse Pokémon, or import an existing
          Showdown team.
        </Empty>
      ) : (
        <>
          <div className="set-heading">
            <div>
              <h2>{pokemon?.name || selected.species}</h2>
              {pokemon && (
                <div className="type-pair">
                  {pokemon.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              )}
            </div>
            <div className="button-row">
              <button
                className="button"
                disabled={!pokemon}
                onClick={() => onInspect(pokemon)}
              >
                <BarChart3 size={17} /> View stats
              </button>
              <IconButton
                label="Move Pokémon left"
                disabled={team.members[0]?.uid === selected.uid}
                onClick={() => move(-1)}
              >
                <ArrowLeft size={17} />
              </IconButton>
              <IconButton
                label="Move Pokémon right"
                disabled={team.members.at(-1)?.uid === selected.uid}
                onClick={() => move(1)}
              >
                <ArrowRight size={17} />
              </IconButton>
              <IconButton
                label="Remove Pokémon"
                onClick={() => onRemove(selected.uid)}
              >
                <Trash2 size={17} />
              </IconButton>
            </div>
          </div>
          {!legal && (
            <p className="notice warning">
              This Pokémon is unavailable in {format.name}. It is preserved in
              your team so you can replace it or switch formats.
            </p>
          )}
          <div className="set-grid">
            <section className="panel set-basics">
              <h3>Set details</h3>
              <label>
                Nickname
                <input
                  value={selected.nickname}
                  maxLength={30}
                  onChange={(e) =>
                    update({
                      nickname: e.target.value.replace(/[\n\r@()]/g, ""),
                    })
                  }
                  placeholder={pokemon?.name}
                />
              </label>
              <Combo
                label="Held item"
                placeholder="No item"
                value={selected.item}
                options={pool.items.map((i) => i.name).sort()}
                onChange={(item) => update({ item })}
              />
              {selected.item && (
                <p className="help item-description">
                  {
                    pool.items.find((i) => i.name === selected.item)
                      ?.description
                  }
                </p>
              )}
              <Combo
                label="Ability"
                value={selected.ability}
                clearable={false}
                options={pokemon?.abilities || []}
                onChange={(ability) => update({ ability })}
              />
              <Combo
                label="Nature"
                value={selected.nature}
                clearable={false}
                options={pool.natures.map((n) => ({
                  value: n.name,
                  label: `${n.name}${n.plus ? ` (+${LABELS[n.plus]}, −${LABELS[n.minus]})` : " (neutral)"}`,
                }))}
                onChange={(nature) => update({ nature })}
              />
              <div className="form-row">
                <label>
                  Level
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={format.champion}
                    value={selected.level}
                    onChange={(e) =>
                      update({
                        level: Math.max(1, Math.min(100, +e.target.value || 1)),
                      })
                    }
                  />
                </label>
                <label>
                  Gender
                  <select
                    value={selected.gender}
                    disabled={!!pokemon?.gender}
                    onChange={(e) => update({ gender: e.target.value })}
                  >
                    <option value="">Unspecified</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="N">Genderless</option>
                  </select>
                </label>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selected.shiny}
                  onChange={(e) => update({ shiny: e.target.checked })}
                />{" "}
                Shiny
              </label>
              {!format.champion && (
                <div className="form-row">
                  <label>
                    Tera type
                    <select
                      value={selected.teraType}
                      onChange={(e) => update({ teraType: e.target.value })}
                    >
                      {[...types, "Stellar"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Happiness
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={selected.happiness}
                      onChange={(e) =>
                        update({
                          happiness: Math.max(
                            0,
                            Math.min(255, +e.target.value || 0),
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </section>
            <section className="panel set-moves">
              <h3>
                Moves{" "}
                <span className="muted">
                  {selected.moves.filter(Boolean).length}/4
                </span>
              </h3>
              {selected.moves.map((id, i) => {
                const m =
                  pool.moves[id] ||
                  allPools.map((p) => p.moves[id]).find(Boolean);
                return (
                  <button
                    className={`move-slot ${id ? "filled" : ""}`}
                    key={i}
                    disabled={!legal}
                    onClick={() => onMoves(pokemon, selected, i)}
                  >
                    <span className="move-slot-number">{i + 1}</span>
                    <div>
                      {m ? (
                        <>
                          <strong>{m.name}</strong>
                          <span>
                            {m.category} · {m.power || "—"} power ·{" "}
                            {m.accuracy === true
                              ? "Always hits"
                              : `${m.accuracy}% accuracy`}
                          </span>
                        </>
                      ) : (
                        <strong>Choose a move</strong>
                      )}
                    </div>
                    {m ? <TypeBadge type={m.type} small /> : <Plus size={18} />}
                  </button>
                );
              })}
              <p className="help">
                Browse the learnset, sort by power or accuracy, and combine
                advanced move filters.
              </p>
              {pokemon?.requiredItem && (
                <p className="notice">
                  <Info size={16} />
                  {pokemon.name} needs {pokemon.requiredItem}.
                </p>
              )}
              <PokemonImage p={pokemon} large shiny={selected.shiny} />
            </section>
            <section className="panel set-stats">
              <OverallUsage pokemon={pokemon} format={format} />
              <h3>
                {format.champion ? "Stat points" : "EVs & IVs"}
                <span className={total > limit ? "weak-text" : "muted"}>
                  {total} / {limit}
                </span>
              </h3>
              <div className="budget-track">
                <i
                  style={{ width: `${Math.min(100, (total / limit) * 100)}%` }}
                />
              </div>
              <div className="stat-editor-head">
                <span>Stat</span>
                <span>Base</span>
                <span>{format.champion ? "Points" : "EV"}</span>
                {!format.champion && <span>IV</span>}
                <span>Total</span>
              </div>
              {STATS.map((k) => (
                <div
                  className="stat-editor"
                  key={k}
                  style={{ "--columns": format.champion ? "4" : "5" }}
                >
                  <div
                    className={`stat-editor-row ${format.champion ? "champion" : ""}`}
                  >
                    <label htmlFor={`ev-${k}`}>{LABELS[k]}</label>
                    <span className="muted">{pokemon?.stats[k] || "—"}</span>
                    <input
                      id={`ev-${k}`}
                      aria-label={`${LABELS[k]} ${format.champion ? "points" : "EVs"}`}
                      type="number"
                      min="0"
                      max={singleLimit}
                      value={selected.evs[k]}
                      onChange={(e) => investment(k, e.target.value)}
                    />
                    {!format.champion && (
                      <input
                        aria-label={`${LABELS[k]} IVs`}
                        type="number"
                        min="0"
                        max="31"
                        value={selected.ivs[k]}
                        onChange={(e) =>
                          update({
                            ivs: {
                              ...selected.ivs,
                              [k]: Math.max(
                                0,
                                Math.min(31, Math.trunc(+e.target.value || 0)),
                              ),
                            },
                          })
                        }
                      />
                    )}
                    <strong>{stats[k]}</strong>
                  </div>
                  <input
                    type="range"
                    aria-label={`${LABELS[k]} investment slider`}
                    min="0"
                    max={singleLimit}
                    step={format.champion ? 1 : 4}
                    value={selected.evs[k]}
                    onChange={(e) => investment(k, e.target.value)}
                  />
                </div>
              ))}
              <div className="stat-actions">
                <button
                  className="text-button muted"
                  onClick={() =>
                    update({
                      evs: Object.fromEntries(STATS.map((k) => [k, 0])),
                    })
                  }
                >
                  Reset investment
                </button>
                <strong>{Math.max(0, limit - total)} left</strong>
              </div>
              <p className="help">
                {format.champion
                  ? "Champions: 66 points total, 32 per stat. IVs are fixed; stats are calculated at level 50. Showdown exports points on the EVs line."
                  : "Up to 510 EVs total and 252 per stat. Calculated stats include level, nature, EVs, and IVs."}
              </p>
            </section>
          </div>
        </>
      )}
      <details className={`validation ${issues.length ? "" : "valid"}`}>
        <summary>
          {issues.length ? <Info size={17} /> : <Check size={17} />}{" "}
          {issues.length
            ? `${issues.length} team check${issues.length === 1 ? "" : "s"} to review`
            : "Basic team checks passed"}
          <ChevronRight size={16} />
        </summary>
        <div>
          {issues.length ? (
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>
              Pokémon, items, abilities, individual move availability, and stat
              budgets are valid.
            </p>
          )}
          <p className="help">
            Basic checks do not certify tournament legality or historical
            move-source combinations. Confirm the final team in Pokémon Showdown
            and the event rules.
          </p>
        </div>
      </details>
      {io && (
        <Modal
          title={
            io === "import" ? "Import Showdown team" : "Export Showdown team"
          }
          subtitle={
            format.champion
              ? "Champions stat points use the EVs line in Showdown text."
              : "Standard Showdown text format."
          }
          onClose={() => setIO("")}
          wide
        >
          {io === "import" ? (
            <>
              <p className="notice">
                Import creates a replacement for the current team’s members.
                Your current team is kept until parsing and validation succeed.
              </p>
              <textarea
                className="showdown-text"
                aria-label="Paste Showdown team"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={
                  "Incineroar @ Sitrus Berry\nAbility: Intimidate\nLevel: 50\nCareful Nature\n- Fake Out\n- Flare Blitz\n- Parting Shot\n- Protect"
                }
              />
              {importError && (
                <p className="error" role="alert">
                  {importError}
                </p>
              )}
              <div className="modal-footer">
                <button
                  className="button primary"
                  disabled={!importText.trim()}
                  onClick={() => {
                    try {
                      const members = importTeam(
                        importText,
                        pool,
                        format.champion,
                      );
                      updateTeam((t) => ({ ...t, members }));
                      setActiveMember(members[0]?.uid);
                      setIO("");
                      notify(`Imported ${members.length} Pokémon.`);
                    } catch (e) {
                      setImportError(e.message);
                    }
                  }}
                >
                  Import & replace members
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                className="showdown-text"
                aria-label="Showdown export"
                readOnly
                value={exportText}
                onFocus={(e) => e.target.select()}
              />
              <div className="modal-footer">
                <button className="button primary" onClick={copy}>
                  <Copy size={16} /> Copy to clipboard
                </button>
                <button className="button" onClick={download}>
                  <Download size={16} /> Download .txt
                </button>
              </div>
              {issues.length > 0 && (
                <p className="help">
                  Export is available for unfinished teams. Review the team
                  checks before battling.
                </p>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
