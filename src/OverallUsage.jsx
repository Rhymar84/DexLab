import React, { useEffect, useState } from "react";
import { loadOverallUsage } from "./api.mjs";
import { overallUsageFor } from "./engine.mjs";

export function useOverallUsage(format) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    loadOverallUsage(format).then(
      (data) => active && setResult({ format: format.id, data }),
      (error) => active && setResult({ format: format.id, error: error.message }),
    );
    return () => { active = false; };
  }, [format.id, attempt]);
  return { ...(result?.format === format.id ? result : {}), retry: () => setAttempt((n) => n + 1) };
}

export function OverallUsage({ pokemon, format }) {
  const { data, error, retry } = useOverallUsage(format);
  const entry = overallUsageFor(pokemon, data?.pokemon);
  return (
    <div className="overall-usage" aria-live="polite">
      <strong>Overall usage {entry ? `#${entry.rank}` : data ? "· Unranked" : error ? "· Unavailable" : "· Loading…"}</strong>
      {data && <span className="muted">{data.label}
        {entry?.startingForm && ` · ${entry.startingForm} rank (starting form)`}
        {format.id === "national" && " · Champions sample"}
        {" · "}<a href={data.sourceUrl} target="_blank" rel="noreferrer">Source</a>
      </span>}
      {error && <span className="muted">{error} <button className="text-button" onClick={retry}>Retry</button></span>}
    </div>
  );
}
