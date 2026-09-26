import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Users,
  Shield,
  Plus,
  ChevronDown,
  Check,
  CircleHelp,
  ExternalLink,
  X,
  Trash2,
} from "lucide-react";
import { Explorer, blankFilters } from "./Explorer.jsx";
import { Builder } from "./Builder.jsx";
import { Profile } from "./Profile.jsx";
import { Details } from "./Details.jsx";
import { Moves } from "./Moves.jsx";
import { Modal, TeamTray, IconButton } from "./common.jsx";
import { makeSet, STATS, filterPokemon } from "./engine.mjs";
import "./styles.css";

const STORAGE = "dexlab-teams-v1";
const newTeam = (format = "regmc", name = "Untitled team") => ({
  id: crypto.randomUUID(),
  name,
  format,
  members: [],
});
function loadTeams() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE));
    if (
      parsed?.version === 1 &&
      parsed.teams?.length &&
      parsed.teams.every(
        (t) =>
          typeof t.id === "string" &&
          typeof t.name === "string" &&
          ["regmc", "regmb", "national"].includes(t.format) &&
          Array.isArray(t.members) &&
          t.members.length <= 6 &&
          t.members.every(
            (m) =>
              m.uid &&
              m.species &&
              Array.isArray(m.moves) &&
              m.moves.length === 4 &&
              STATS.every(
                (k) =>
                  Number.isFinite(m.evs?.[k]) && Number.isFinite(m.ivs?.[k]),
              ),
          ),
      )
    )
      return parsed;
  } catch {
    /* Missing or malformed storage: start a fresh session. */
  }
  const team = newTeam();
  return { version: 1, teams: [team], active: team.id };
}
function App({ data }) {
  const [saved] = useState(loadTeams),
    [teams, setTeams] = useState(saved.teams),
    [active, setActive] = useState(saved.active),
    [view, setView] = useState("explore");
  const [filters, setFilters] = useState(blankFilters),
    [sort, setSort] = useState({ key: "num", direction: "asc" });
  const [activeMember, setActiveMember] = useState(""),
    [removeMember, setRemoveMember] = useState(""),
    [detail, setDetail] = useState(null),
    [movePicker, setMovePicker] = useState(null),
    [modal, setModal] = useState(""),
    [toast, setToast] = useState(""),
    [storageError, setStorageError] = useState(false),
    [pendingFormat, setPendingFormat] = useState("");
  const [newName, setNewName] = useState(""),
    [deleteTeam, setDeleteTeam] = useState("");
  const toastTimer = useRef();
  const team = teams.find((t) => t.id === active) || teams[0];
  const format =
    data.formats.find((f) => f.id === team.format) || data.formats[1];
  const pool = data.pools[format.id],
    allPools = Object.values(data.pools),
    allPokemon = data.pools.national.pokemon;
  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ version: 1, teams, active: team.id }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [teams, team.id]);
  function updateTeam(fn) {
    setTeams((ts) =>
      ts.map((t) =>
        t.id === team.id
          ? typeof fn === "function"
            ? fn(t)
            : { ...t, ...fn }
          : t,
      ),
    );
  }
  function add(p) {
    if (team.members.length >= 6)
      return notify("Your team already has six Pokémon.");
    const member = makeSet(p);
    updateTeam((t) => ({ ...t, members: [...t.members, member] }));
    setActiveMember(member.uid);
    notify(`${p.name} added to ${team.name}.`);
  }
  function changeFormat(id) {
    if (
      team.members.length &&
      data.formats.find((f) => f.id === id).champion !== format.champion
    ) {
      setPendingFormat(id);
      return;
    }
    applyFormat(id);
  }
  function applyFormat(id) {
    const champion = data.formats.find((f) => f.id === id).champion;
    const convert = champion !== format.champion;
    updateTeam((t) => ({
      ...t,
      format: id,
      members: t.members.map((m) => ({
        ...m,
        level: champion ? 50 : m.level,
        evs: convert ? Object.fromEntries(STATS.map((s) => [s, 0])) : m.evs,
      })),
    }));
    setFilters(blankFilters());
    setDetail(null);
    setPendingFormat("");
    if (team.members.length)
      notify("Format changed. Review the team checks for unavailable choices.");
  }
  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const lifetime = new AbortController();
    try {
      Promise.resolve(
        document.modelContext.registerTool(
          {
            name: "search_pokemon",
            description:
              "Apply a Pokémon name query to the visible explorer and return matching names in the selected format.",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string", maxLength: 100 } },
              required: ["query"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              if (typeof input?.query !== "string" || input.query.length > 100)
                throw new Error("query must be a string up to 100 characters");
              const next = { ...blankFilters(), query: input.query };
              setFilters(next);
              setView("explore");
              await new Promise((resolve) => requestAnimationFrame(resolve));
              return { pokemon: filterPokemon(pool, next).map((p) => p.name) };
            },
          },
          { signal: lifetime.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifetime.abort();
  }, [pool]);
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          aria-label="DexLab home"
          onClick={(e) => {
            e.preventDefault();
            setView("explore");
          }}
        >
          <span className="brand-symbol">
            <span />
          </span>
          <span>
            dex<span className="brand-light">lab</span>
            <small>POKÉMON WORKSPACE</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {[
            ["explore", "Pokémon explorer", Search],
            ["builder", "Teambuilder", Users],
            ["profile", "Team profile", Shield],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "builder" && team.members.length > 0 && (
                <small>{team.members.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <button className="button my-teams" onClick={() => setModal("teams")}>
            <Users size={16} />
            <span>My teams</span>
            <small>{teams.length}</small>
          </button>
          <IconButton
            label="Data sources and help"
            onClick={() => setModal("about")}
          >
            <CircleHelp size={20} />
          </IconButton>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              {view === "explore"
                ? "FIND YOUR NEXT TEAMMATE"
                : view === "builder"
                  ? "SIX SLOTS. ENDLESS POSSIBILITIES."
                  : "KNOW YOUR MATCHUPS"}
            </div>
            <h1>
              {view === "explore"
                ? "Pokémon explorer"
                : view === "builder"
                  ? "Teambuilder"
                  : "Team profile"}
              <span className="beta-label">
                {view === "explore"
                  ? "ADVANCED SEARCH"
                  : format.champion
                    ? "VGC DOUBLES"
                    : "NATIONAL DEX"}
              </span>
            </h1>
            <p>
              {view === "explore"
                ? "Find the right Pokémon. Build something great."
                : view === "builder"
                  ? "Fine-tune every detail of your team."
                  : `${team.name} · Defensive coverage, speed tiers, and potential threats.`}
            </p>
          </div>
          <div className="format-control">
            <label htmlFor="format">POKÉMON POOL</label>
            <select
              id="format"
              value={format.id}
              onChange={(e) => changeFormat(e.target.value)}
            >
              {data.formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <span className="format-caption">
              {format.id === "regmc"
                ? "Current regulation"
                : format.id === "regmb"
                  ? "Archived regulation"
                  : "All official Pokémon & historical items"}
            </span>
          </div>
        </section>
        {storageError && (
          <p className="notice warning" role="alert">
            Browser storage is unavailable. Export your team before leaving this
            page.
          </p>
        )}
        <div className="workspace">
          {view === "explore" ? (
            <Explorer
              pool={pool}
              types={data.types}
              filters={filters}
              setFilters={setFilters}
              sort={sort}
              setSort={setSort}
              onInspect={setDetail}
              onAdd={add}
              team={team}
              format={format}
            />
          ) : view === "builder" ? (
            <Builder
              team={team}
              updateTeam={updateTeam}
              pool={pool}
              allPokemon={allPokemon}
              allPools={allPools}
              format={format}
              types={data.types}
              activeMember={activeMember}
              setActiveMember={setActiveMember}
              onExplore={() => setView("explore")}
              onMoves={(p, s, slot) => setMovePicker({ p, uid: s.uid, slot })}
              onInspect={setDetail}
              onRemove={setRemoveMember}
              notify={notify}
            />
          ) : (
            <Profile
              team={team}
              pool={pool}
              types={data.types}
              format={format}
              onExplore={() => setView("explore")}
              onInspect={setDetail}
            />
          )}
        </div>
        {view === "explore" && (
          <TeamTray
            team={team}
            pool={pool}
            allPokemon={allPokemon}
            onAdd={() => {
              document.querySelector('[aria-label="Search Pokémon"]')?.focus();
              notify("Search or use the + button on any Pokémon to add it.");
            }}
            onEdit={(uid) => {
              setActiveMember(uid);
              setView("builder");
            }}
            onBuilder={() => setView("builder")}
            onRemove={setRemoveMember}
          />
        )}
        <footer className="app-footer">
          <span>
            <Check size={13} />
            {storageError ? "Unsaved session" : "Teams saved in this browser"}
          </span>
          <button className="text-button" onClick={() => setModal("about")}>
            Showdown data ·{" "}
            {new Date(data.generatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            <ExternalLink size={11} />
          </button>
          <span>Unofficial Pokémon fan project</span>
        </footer>
      </main>
      {removeMember && (
        <Modal
          title="Remove this Pokémon?"
          subtitle={`${allPokemon.find((p) => p.id === team.members.find((m) => m.uid === removeMember)?.species)?.name || "This Pokémon"} and its set will be removed from this team.`}
          onClose={() => setRemoveMember("")}
        >
          <div className="modal-footer">
            <button className="button" onClick={() => setRemoveMember("")}>
              Keep Pokémon
            </button>
            <button
              className="button danger"
              onClick={() => {
                updateTeam((t) => ({
                  ...t,
                  members: t.members.filter((m) => m.uid !== removeMember),
                }));
                setRemoveMember("");
              }}
            >
              Remove Pokémon
            </button>
          </div>
        </Modal>
      )}
      {detail && (
        <Details
          pokemon={detail}
          pool={pool}
          referencePool={data.pools.national}
          format={format}
          types={data.types}
          onClose={() => setDetail(null)}
          onAdd={add}
          teamFull={team.members.length >= 6}
          onMoves={(p) => {
            setDetail(null);
            setMovePicker({ p, slot: -1 });
          }}
        />
      )}
      {movePicker && (
        <Moves
          pokemon={movePicker.p}
          pool={pool}
          types={data.types}
          slot={movePicker.slot}
          selectedMoves={
            team.members.find((m) => m.uid === movePicker.uid)?.moves
          }
          onClose={() => setMovePicker(null)}
          onSelect={
            movePicker.uid
              ? (id) => {
                  updateTeam((t) => ({
                    ...t,
                    members: t.members.map((m) =>
                      m.uid === movePicker.uid
                        ? {
                            ...m,
                            moves: m.moves.map((v, i) =>
                              i === movePicker.slot ? id : v,
                            ),
                          }
                        : m,
                    ),
                  }));
                  setMovePicker(null);
                }
              : undefined
          }
        />
      )}{" "}
      {modal === "about" && (
        <Modal title="Data, sources & help" onClose={() => setModal("")}>
          <div className="about-content">
            <p>
              DexLab combines Pokémon Showdown’s format data with on-demand
              competitive usage reports. Core searching and team editing work
              from the included data snapshot.
            </p>
            <h3>Data sources</h3>
            {data.sources.map((s) => (
              <a
                className="source-link"
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.label}
                <ExternalLink size={14} />
              </a>
            ))}
            <a
              className="source-link"
              href="https://www.smogon.com/stats/"
              target="_blank"
              rel="noreferrer"
            >
              Smogon National Dex usage reports
              <ExternalLink size={14} />
            </a>
            <p className="help">
              Snapshot: {data.generatedAt.slice(0, 10)} · Showdown{" "}
              {data.sha.slice(0, 7)}. Pool entries include alternate and battle
              forms. New rules require a data refresh and redeployment.
            </p>
            <h3>Filtering & building</h3>
            <p>
              All filters combine. Two selected types require both; selected
              moves require access to every move. Column headings sort
              descending first, then ascending. Types and Abilities headings
              open their filters.
            </p>
            <p>
              Team edits save automatically in this browser. Export teams to
              keep a portable backup. Champions uses 66 stat points; National
              Dex uses EVs and IVs. Usage reports identify their sample and
              source; missing data is never filled with examples.
            </p>
            <p>
              National Dex is an unrestricted research pool with historical
              learnsets, not a tournament ruleset. Team checks are advisory.
              Profiles assume the selected forms; threat rankings measure
              typing, not battle outcomes.
            </p>
            <p className="help">
              Pokémon names and sprites belong to their respective owners.
              Sprites and game data from Pokémon Showdown;{" "}
              <a
                href={`${import.meta.env.BASE_URL}licenses/pokemon-showdown.txt`}
                target="_blank"
                rel="noreferrer"
              >
                MIT license
              </a>
              . This project is not affiliated with Nintendo, Game Freak,
              Creatures, or The Pokémon Company.
            </p>
          </div>
        </Modal>
      )}
      {modal === "teams" && (
        <Modal
          title="Your teams"
          subtitle="Saved locally in this browser. Use Showdown export to back up or move a team."
          onClose={() => setModal("")}
        >
          <div className="saved-teams">
            {teams.map((t) => (
              <div
                className={`saved-team ${t.id === team.id ? "active" : ""}`}
                key={t.id}
              >
                <button
                  onClick={() => {
                    setActive(t.id);
                    setActiveMember("");
                    setFilters(blankFilters());
                    setView("builder");
                    setModal("");
                  }}
                >
                  <strong>{t.name || "Untitled team"}</strong>
                  <span>
                    {data.formats.find((f) => f.id === t.format)?.name} ·{" "}
                    {t.members.length}/6 Pokémon
                  </span>
                </button>
                <IconButton
                  label={`Delete ${t.name}`}
                  disabled={teams.length === 1}
                  onClick={() => setDeleteTeam(t.id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ))}
          </div>
          <form
            className="new-team-form"
            onSubmit={(e) => {
              e.preventDefault();
              const t = newTeam(
                format.id,
                newName.trim() || `Team ${teams.length + 1}`,
              );
              setTeams((ts) => [...ts, t]);
              setActive(t.id);
              setActiveMember("");
              setNewName("");
              setModal("");
              setView("builder");
            }}
          >
            <label htmlFor="new-team-name">New team name</label>
            <div className="inline-control">
              <input
                id="new-team-name"
                maxLength={70}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My next team"
              />
              <button className="button primary">
                <Plus size={16} /> New team
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteTeam && (
        <Modal
          title="Delete this team?"
          subtitle="This removes the saved team from this browser. Export a backup first if you want to keep it."
          onClose={() => setDeleteTeam("")}
        >
          <div className="modal-footer">
            <button className="button" onClick={() => setDeleteTeam("")}>
              Keep team
            </button>
            <button
              className="button danger"
              onClick={() => {
                setTeams((ts) => ts.filter((t) => t.id !== deleteTeam));
                if (active === deleteTeam)
                  setActive(teams.find((t) => t.id !== deleteTeam).id);
                setDeleteTeam("");
              }}
            >
              Delete team
            </button>
          </div>
        </Modal>
      )}
      {pendingFormat && (
        <Modal
          title="Switch stat systems?"
          subtitle="Champions uses stat points; National Dex uses EVs. Switching between them resets investment to zero, preserves the rest of the set, and sets Champions Pokémon to level 50."
          onClose={() => setPendingFormat("")}
        >
          <div className="modal-footer">
            <button className="button" onClick={() => setPendingFormat("")}>
              Keep current format
            </button>
            <button
              className="button primary"
              onClick={() => applyFormat(pendingFormat)}
            >
              Switch & reset investment
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </>
  );
}
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="boot-screen">
        <h1>Something went wrong</h1>
        <p>Your saved teams remain in this browser. Reload to try again.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = createRoot(document.getElementById("root"));
root.render(
  <div className="boot-screen">
    <span className="brand-symbol">
      <span />
    </span>
    <h1>Opening DexLab…</h1>
    <p>Loading Pokémon and format data.</p>
  </div>,
);
fetch(`${import.meta.env.BASE_URL}data/dex.json`)
  .then((r) => {
    if (!r.ok) throw new Error("Dataset could not be loaded");
    return r.json();
  })
  .then((data) =>
    root.render(
      <ErrorBoundary>
        <App data={data} />
      </ErrorBoundary>,
    ),
  )
  .catch(() =>
    root.render(
      <div className="boot-screen">
        <h1>Couldn’t load the Pokédex</h1>
        <p>
          Check your connection and reload. Hosts must serve the included data
          folder.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>,
    ),
  );
