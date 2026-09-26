import React, { useEffect, useId, useRef, useState } from "react";
import { Search, X, ChevronDown, Check, Plus } from "lucide-react";
import { TYPE_COLORS } from "./engine.mjs";

export function TypeBadge({ type, small = false }) {
  return (
    <span
      className={`type-badge ${small ? "small" : ""}`}
      style={{ "--type": TYPE_COLORS[type] || "#a4a9bd" }}
    >
      {type}
    </span>
  );
}
export function ItemImage({ item }) {
  if (!item) return null;
  const index = item.spritenum || 0;
  return (
    <span
      className="item-sprite"
      aria-hidden="true"
      style={{
        backgroundPosition: `-${(index % 16) * 24}px -${Math.floor(index / 16) * 24}px`,
      }}
    />
  );
}
export function PokemonImage({ p, large = false, shiny = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [p?.id, shiny]);
  if (!p) return <div className="sprite missing">?</div>;
  const slug = p.spriteid || p.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return failed ? (
    <div
      className={`sprite missing ${large ? "large" : ""}`}
      aria-label={p.name}
    >
      #{p.num}
    </div>
  ) : (
    <img
      className={`sprite ${large ? "large" : ""}`}
      src={`https://play.pokemonshowdown.com/sprites/${shiny ? "gen5-shiny" : "gen5"}/${slug}.png`}
      alt={p.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function IconButton({ label, children, ...rest }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <Search size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef();
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function Combo({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  clearable = true,
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const ref = useRef(),
    input = useRef(),
    id = useId();
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selected = normalized.find((o) => o.value === value);
  const matches = normalized.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  function choose(v) {
    onChange(v);
    setOpen(false);
    setQuery("");
    ref.current?.querySelector("button")?.focus();
  }
  return (
    <div className="combo" ref={ref}>
      {label && <label id={`${id}-label`}>{label}</label>}
      <button
        type="button"
        className={`combo-trigger ${value ? "has-value" : ""}`}
        aria-label={label || placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setQuery("");
          setIndex(0);
          setOpen(!open);
        }}
      >
        <span>{selected?.label || value || placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="combo-menu">
          <div className="combo-search">
            <Search size={15} />
            <input
              ref={input}
              aria-label={`Search ${label || placeholder}`}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={
                matches[index] ? `${id}-option-${index}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex(Math.min(index + 1, matches.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex(Math.max(0, index - 1));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[index]) choose(matches[index].value);
                }
              }}
              placeholder="Type to search…"
            />
          </div>
          <div
            className="combo-options"
            role="listbox"
            id={`${id}-list`}
            aria-label={label || placeholder}
          >
            {clearable && (
              <button
                role="option"
                aria-selected={!value}
                onClick={() => choose("")}
                className="muted"
              >
                None / clear
              </button>
            )}
            {matches.map((o, i) => (
              <button
                key={o.value}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={value === o.value}
                className={i === index ? "focused" : ""}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(o.value)}
              >
                {o.label}
                {value === o.value && <Check size={14} />}
              </button>
            ))}
            {!matches.length && <p className="muted">No matching options</p>}
          </div>
        </div>
      )}
    </div>
  );
}
export function TeamTray({ team, pool, allPokemon, onAdd, onEdit, onBuilder, onRemove }) {
  return (
    <section className="team-tray" aria-label="Current team">
      <div className="tray-title">
        <span className="eyebrow">YOUR TEAM</span>
        <button className="text-button" onClick={onBuilder}>
          {team.name} <span className="muted">{team.members.length}/6</span>
        </button>
      </div>
      <div className="tray-slots">
        {Array.from({ length: 6 }, (_, i) => {
          const s = team.members[i];
          const p =
            s &&
            (pool.pokemon.find((p) => p.id === s.species) ||
              allPokemon.find((p) => p.id === s.species));
          return (
            <div className="team-slot tray-slot-wrapper" key={s?.uid || i}>
            <button
              className={`tray-slot ${s ? "filled" : ""}`}
              aria-label={
                s
                  ? `Edit ${p?.name || s.species}`
                  : `Add Pokémon to slot ${i + 1}`
              }
              onClick={() => (s ? onEdit(s.uid) : onAdd())}
            >
              {s ? (
                <>
                  <PokemonImage p={p} />
                  <span>{p?.name || s.species}</span>
                </>
              ) : (
                <>
                  <Plus size={20} />
                  <span>Slot {i + 1}</span>
                </>
              )}
            </button>
            {s && (
              <button
                className="team-slot-remove"
                aria-label={`Remove ${p?.name || s.species} from team slot ${i + 1}`}
                title={`Remove ${p?.name || s.species}`}
                onClick={() => onRemove(s.uid)}
              >
                <X size={16} />
              </button>
            )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
