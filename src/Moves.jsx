import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, Check } from "lucide-react";
import { filterMoves, TAGS } from "./engine.mjs";
import { Empty, Modal, TypeBadge } from "./common.jsx";
export function Moves({
  pokemon,
  pool,
  types,
  onClose,
  onSelect,
  selectedMoves = [],
  slot = -1,
}) {
  const [filters, setFilters] = useState({
    query: "",
    type: "",
    category: "",
    tags: [],
  });
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const moves = useMemo(
    () =>
      filterMoves(
        pokemon.moves.map((id) => pool.moves[id]).filter(Boolean),
        filters,
      ).sort((a, b) => {
        const val = (m) =>
          sort.key === "accuracy" && m.accuracy === true ? 101 : m[sort.key];
        return (
          (sort.key === "name"
            ? a.name.localeCompare(b.name)
            : val(a) - val(b)) * (sort.direction === "asc" ? 1 : -1)
        );
      }),
    [pokemon, pool, filters, sort],
  );
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const order = (key) =>
    setSort((s) => ({
      key,
      direction: s.key === key && s.direction === "desc" ? "asc" : "desc",
    }));
  const descriptions = {
    Spread: "Targets both opponents or all adjacent Pokémon.",
    Sound: "Sound-based moves.",
    Sharpness: "Slicing moves boosted by Sharpness.",
    "Sheer Force": "Damaging moves with a removable secondary effect.",
    "Speed Control": "Changes turn order, or guarantees a Speed change or paralysis if it lands and the target is eligible. Excludes chance-based secondary effects.",
    Priority: "Moves with a positive priority bracket.",
  };
  return (
    <Modal
      title={`${pokemon.name} · ${onSelect ? `choose move ${slot + 1}` : "learnset"}`}
      subtitle={`${pokemon.moves.length} moves available in the selected format`}
      onClose={onClose}
      wide
    >
      <div className="move-controls">
        <div className="search-input">
          <Search size={17} />
          <input
            autoFocus
            aria-label="Search moves"
            placeholder="Search moves…"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <select
          aria-label="Move type"
          value={filters.type}
          onChange={(e) => update({ type: e.target.value })}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Move category"
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {["Physical", "Special", "Status"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="move-tags">
        {TAGS.map((t) => (
          <button
            key={t}
            title={descriptions[t]}
            aria-pressed={filters.tags.includes(t)}
            className={`tag-button ${filters.tags.includes(t) ? "active" : ""}`}
            onClick={() =>
              update({
                tags: filters.tags.includes(t)
                  ? filters.tags.filter((x) => x !== t)
                  : [...filters.tags, t],
              })
            }
          >
            {t}
          </button>
        ))}
        <button
          className="text-button muted"
          onClick={() =>
            setFilters({ query: "", type: "", category: "", tags: [] })
          }
        >
          Reset
        </button>
      </div>
      <p className="help">
        {moves.length} matches · All active filters must match. Power “—”
        includes status and variable-power moves.
      </p>
      <div className="move-table-wrap">
        <table className="move-table">
          <thead>
            <tr>
              {[
                ["name", "Name"],
                ["type", "Type"],
                ["category", "Category"],
                ["power", "Power"],
                ["accuracy", "Accuracy"],
              ].map(([key, label]) => (
                <th key={key}>
                  {["name", "power", "accuracy"].includes(key) ? (
                    <button onClick={() => order(key)}>
                      {label}
                      {sort.key === key &&
                        (sort.direction === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        ))}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
              <th>PP</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => {
              const used = selectedMoves.some(
                (id, i) => id === m.id && i !== slot,
              );
              return (
                <tr key={m.id}>
                  <td>
                    <button
                      className="move-name"
                      disabled={used || !onSelect}
                      onClick={() => onSelect?.(m.id)}
                    >
                      <strong>
                        {m.name}
                        {used && <Check size={13} />}
                      </strong>
                      <span>{m.description}</span>
                    </button>
                  </td>
                  <td>
                    <TypeBadge type={m.type} small />
                  </td>
                  <td>
                    <span className={`category ${m.category.toLowerCase()}`}>
                      {m.category}
                    </span>
                  </td>
                  <td>{m.power || "—"}</td>
                  <td>{m.accuracy === true ? "Always" : `${m.accuracy}%`}</td>
                  <td>{m.pp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!moves.length && (
          <Empty title="No moves match">
            Remove an advanced filter or choose another category.
          </Empty>
        )}
      </div>
      {onSelect && (
        <div className="modal-footer">
          <button className="button" onClick={() => onSelect("")}>
            Clear this slot
          </button>
          <span className="muted">Click a move to select it.</span>
        </div>
      )}
    </Modal>
  );
}
