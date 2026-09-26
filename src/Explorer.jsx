import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  ChevronDown,
  TriangleAlert,
} from "lucide-react";
import { filterPokemon, matchupAbilityWarning, sortPokemon, STATS, LABELS } from "./engine.mjs";
import {
  Combo,
  Empty,
  IconButton,
  PokemonImage,
  TypeBadge,
  Modal,
} from "./common.jsx";
export const blankFilters = () => ({
  query: "",
  types: [],
  ability: "",
  moves: [],
  matchups: [],
  includeAbilities: true,
});
export function Explorer({
  pool,
  types,
  filters,
  setFilters,
  sort,
  setSort,
  onInspect,
  onAdd,
  team,
  format,
  pickerOnly = false,
}) {
  const [page, setPage] = useState(0),
    [showFilters, setShowFilters] = useState(false),
    [headerPicker, setHeaderPicker] = useState("");
  const [matchType, setMatchType] = useState(""),
    [matchMode, setMatchMode] = useState("weak");
  const abilities = useMemo(
    () => [...new Set(pool.pokemon.flatMap((p) => p.abilities))].sort(),
    [pool],
  );
  const availableTypes = types.filter((t) =>
    pool.pokemon.some((p) => p.types.includes(t)),
  );
  const availableMoves = useMemo(
    () =>
      [...new Set(pool.pokemon.flatMap((p) => p.moves))]
        .map((id) => ({ value: id, label: pool.moves[id]?.name || id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [pool],
  );
  const results = useMemo(
    () => sortPokemon(filterPokemon(pool, filters), sort.key, sort.direction),
    [pool, filters, sort],
  );
  useEffect(() => setPage(0), [filters, sort, pool]);
  const count =
    filters.types.length +
    !!filters.ability +
    filters.moves.length +
    filters.matchups.length;
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggleType = (type) =>
    update({
      types: filters.types.includes(type)
        ? filters.types.filter((t) => t !== type)
        : [...filters.types.slice(-1), type],
    });
  const chooseSort = (key) =>
    setSort((s) => ({
      key,
      direction: s.key === key && s.direction === "desc" ? "asc" : "desc",
    }));
  const sidebar = (
    <>
      <div className="filter-heading">
        <SlidersHorizontal size={16} />
        <strong>Filters</strong>
        <button
          className="text-button muted"
          onClick={() => setFilters(blankFilters())}
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
      <div className="filter-section">
        <div className="section-label">
          Pokémon types <span>Match both</span>
        </div>
        <div className="type-grid">
          {availableTypes.map((t) => (
            <button
              key={t}
              className={`type-option ${filters.types.includes(t) ? "selected" : ""}`}
              onClick={() => toggleType(t)}
              aria-pressed={filters.types.includes(t)}
            >
              <TypeBadge type={t} />
            </button>
          ))}
        </div>
        <p className="help">Select up to two types.</p>
      </div>
      <div className="filter-section">
        <Combo
          label="Ability"
          placeholder="Any ability"
          options={abilities}
          value={filters.ability}
          onChange={(ability) => update({ ability })}
        />
      </div>
      <div className="filter-section">
        <Combo
          label="Can learn"
          placeholder="Add a move…"
          options={availableMoves.filter(
            (o) => !filters.moves.includes(o.value),
          )}
          value=""
          onChange={(move) =>
            move && update({ moves: [...filters.moves, move] })
          }
        />
        {filters.moves.map((m) => (
          <button
            key={m}
            className="filter-chip full"
            onClick={() =>
              update({ moves: filters.moves.filter((x) => x !== m) })
            }
          >
            {pool.moves[m]?.name || m}
            <X size={12} />
          </button>
        ))}
        <p className="help">Must have access to every selected move.</p>
      </div>
      <div className="filter-section">
        <div className="section-label">Type matchups</div>
        <select
          aria-label="Matchup condition"
          value={matchMode}
          onChange={(e) => setMatchMode(e.target.value)}
        >
          <option value="weak">Weak to</option>
          <option value="resist">Resists</option>
          <option value="immune">Immune to</option>
        </select>
        <div className="inline-control">
          <select
            aria-label="Matchup type"
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
          >
            <option value="">Choose a type</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <IconButton
            label="Add matchup filter"
            disabled={!matchType}
            onClick={() => {
              if (
                !filters.matchups.some(
                  (f) => f.type === matchType && f.mode === matchMode,
                )
              )
                update({
                  matchups: [
                    ...filters.matchups,
                    { type: matchType, mode: matchMode },
                  ],
                });
              setMatchType("");
            }}
          >
            <Plus size={17} />
          </IconButton>
        </div>
        {filters.matchups.map((f, i) => (
          <button
            className="filter-chip full"
            key={`${f.type}-${f.mode}`}
            onClick={() =>
              update({ matchups: filters.matchups.filter((_, j) => i !== j) })
            }
          >
            {f.mode === "weak"
              ? "Weak to"
              : f.mode === "resist"
                ? "Resists"
                : "Immune to"}{" "}
            {f.type}
            <X size={12} />
          </button>
        ))}
        <label className="matchup-ability-toggle">
          <input
            type="checkbox"
            checked={filters.includeAbilities !== false}
            onChange={(e) => update({ includeAbilities: e.target.checked })}
          />
          Include ability effects
        </label>
        <p className="help">
          {filters.includeAbilities !== false
            ? "Matches one available ability across all matchup filters. A selected ability must match."
            : "Based on typing only."}
          {" "}Immunities are separate from resistances. Held items and battle modifiers are excluded.
        </p>
      </div>
      <div className="filter-foot">
        <span className="eyebrow">FORMAT NOTES</span>
        <p>{format.description}</p>
      </div>
    </>
  );
  const rows = results.slice(page * 40, page * 40 + 40);
  return (
    <div className={`explorer-layout ${pickerOnly ? "picking" : ""}`}>
      <aside className={`filter-sidebar ${showFilters ? "mobile-open" : ""}`}>
        {sidebar}
      </aside>
      <section className="results-panel">
        <div className="search-row">
          <div className="search-input">
            <Search size={19} />
            <input
              aria-label="Search Pokémon"
              placeholder="Search Pokémon by name or Pokédex number…"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
            />
            {filters.query && (
              <IconButton
                label="Clear search"
                onClick={() => update({ query: "" })}
              >
                <X size={16} />
              </IconButton>
            )}
          </div>
          <button
            className="button filters-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={16} /> Filters {count > 0 && count}
          </button>
        </div>
        <div className="results-info">
          <div>
            <strong>{results.length.toLocaleString()}</strong>{" "}
            <span className="muted">Pokémon</span>
            {count > 0 && (
              <span className="result-filter-count">
                {count} active filter{count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <span className="muted desktop-hint">
            Click a Pokémon to explore its data
          </span>
        </div>
        {count > 0 && (
          <div className="active-filters">
            {filters.types.map((t) => (
              <button
                key={t}
                className="filter-chip"
                onClick={() => toggleType(t)}
              >
                {t}
                <X size={12} />
              </button>
            ))}
            {filters.ability && (
              <button
                className="filter-chip"
                onClick={() => update({ ability: "" })}
              >
                {filters.ability}
                <X size={12} />
              </button>
            )}
            {filters.moves.map((m) => (
              <button
                key={m}
                className="filter-chip"
                onClick={() =>
                  update({ moves: filters.moves.filter((x) => x !== m) })
                }
              >
                {pool.moves[m]?.name}
                <X size={12} />
              </button>
            ))}
            {filters.matchups.map((f, i) => (
              <button
                key={i}
                className="filter-chip"
                onClick={() =>
                  update({
                    matchups: filters.matchups.filter((_, j) => i !== j),
                  })
                }
              >
                {f.mode}: {f.type}
                <X size={12} />
              </button>
            ))}
            <button
              className="text-button muted"
              onClick={() => setFilters(blankFilters())}
            >
              Clear all
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table className="pokemon-table">
            <thead>
              <tr>
                <th className="number-cell">#</th>
                <th
                  aria-sort={
                    sort.key === "name"
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => chooseSort("name")}>
                    Name{" "}
                    {sort.key === "name" &&
                      (sort.direction === "desc" ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      ))}
                  </button>
                </th>
                <th>
                  <button onClick={() => setHeaderPicker("Types")}>
                    Types <ChevronDown size={12} />
                  </button>
                </th>
                <th className="ability-col">
                  <button onClick={() => setHeaderPicker("Abilities")}>
                    Abilities <ChevronDown size={12} />
                  </button>
                </th>
                {[...STATS, "bst"].map((k) => (
                  <th
                    key={k}
                    className={`stat-cell ${sort.key === k ? "sorted" : ""}`}
                    aria-sort={
                      sort.key === k
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button onClick={() => chooseSort(k)}>
                      {LABELS[k]}
                      {sort.key === k &&
                        (sort.direction === "desc" ? (
                          <ArrowDown size={11} />
                        ) : (
                          <ArrowUp size={11} />
                        ))}
                    </button>
                  </th>
                ))}
                <th>
                  <span className="sr-only">Add to team</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const abilityWarning = matchupAbilityWarning(p, pool.chart, filters);
                return (
                <tr key={p.id}>
                  <td className="number-cell">
                    {String(p.num).padStart(3, "0")}
                  </td>
                  <td>
                    <button
                      className="pokemon-name"
                      onClick={() => onInspect(p)}
                    >
                      <PokemonImage p={p} />
                      <span>
                        {p.name}
                        {p.battleOnly && <small>Battle form</small>}
                      </span>
                    </button>
                    {abilityWarning && (
                      <div className="matchup-ability-warning">
                        <TriangleAlert size={13} aria-hidden="true" />
                        <span>{abilityWarning}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="type-pair">
                      {p.types.map((t) => (
                        <TypeBadge key={t} type={t} small />
                      ))}
                    </div>
                  </td>
                  <td className="ability-col">
                    <div className="abilities">
                      {p.abilities.map((a) => (
                        <button
                          key={a}
                          title={pool.abilities[a]}
                          onClick={() => update({ ability: a })}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </td>
                  {STATS.map((k) => (
                    <td
                      className={`stat-cell ${p.stats[k] >= 110 ? "high-stat" : ""}`}
                      key={k}
                    >
                      {p.stats[k]}
                    </td>
                  ))}
                  <td className="stat-cell bst-cell">{p.bst}</td>
                  <td>
                    <button
                      className="add-pokemon"
                      aria-label={`Add ${p.name} to team`}
                      title={
                        team.members.length === 6
                          ? "Team is full"
                          : `Add ${p.name}`
                      }
                      disabled={team.members.length >= 6}
                      onClick={() => onAdd(p)}
                    >
                      <Plus size={17} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!results.length && (
            <Empty
              title="No Pokémon match these filters"
              action={
                <button
                  className="button"
                  onClick={() => setFilters(blankFilters())}
                >
                  Reset filters
                </button>
              }
            >
              Try removing a move, type, or ability.
            </Empty>
          )}
        </div>
        <div className="pagination">
          <span>
            {results.length
              ? `${page * 40 + 1}–${Math.min(page * 40 + 40, results.length)} of ${results.length}`
              : "0 results"}
          </span>
          <div>
            <IconButton
              label="Previous page"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </IconButton>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(results.length / 40))}
            </span>
            <IconButton
              label="Next page"
              disabled={(page + 1) * 40 >= results.length}
              onClick={() => {
                setPage(page + 1);
                document.querySelector(".table-scroll")?.scrollTo(0, 0);
              }}
            >
              <ChevronRight size={17} />
            </IconButton>
          </div>
        </div>
      </section>
      {headerPicker && (
        <Modal
          title={`Filter by ${headerPicker.toLowerCase()}`}
          subtitle={
            headerPicker === "Types"
              ? "Select up to two types; Pokémon must match both."
              : "Abilities available in this Pokémon pool."
          }
          onClose={() => setHeaderPicker("")}
        >
          {headerPicker === "Types" ? (
            <div className="type-grid modal-types">
              {availableTypes.map((t) => (
                <button
                  key={t}
                  className={`type-option ${filters.types.includes(t) ? "selected" : ""}`}
                  aria-pressed={filters.types.includes(t)}
                  onClick={() => toggleType(t)}
                >
                  <TypeBadge type={t} />
                </button>
              ))}
            </div>
          ) : (
            <Combo
              label="Available abilities"
              options={abilities}
              value={filters.ability}
              onChange={(ability) => {
                update({ ability });
                setHeaderPicker("");
              }}
            />
          )}
          <div className="modal-footer">
            <button
              className="button primary"
              onClick={() => setHeaderPicker("")}
            >
              Apply filters
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
