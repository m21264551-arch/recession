import HowToUse from "./components/HowToUse";
import React, { useEffect, useRef, useState } from "react";

const names = {
  prevalence: "Historical prevalence",
  logistic: "Spread-only logistic",
  boosting: "Gradient boosting",
};
const colours = {
  prevalence: "#68737b",
  logistic: "#254f91",
  boosting: "#a95028",
};
const format = (n, digits = 3) =>
  Number.isFinite(n) ? n.toFixed(digits) : "Undefined";
const percent = (n) =>
  Number.isFinite(n) ? `${(100 * n).toFixed(1)}%` : "Unavailable";
const month = (date) =>
  new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function ResultsTable({ heads, rows, label = `${heads[0]} results` }) {
  return (
    <div className="table-scroll" tabIndex="0" role="region" aria-label={label}>
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryChart({ rows, model, selected, onSelect }) {
  const container = useRef(null);
  const gesture = useRef(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, entry.contentRect.width)),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const height = width < 500 ? 170 : 190,
    left = 54,
    right = 24,
    top = 24,
    bottom = 40;
  const x = (i) =>
    left + (i * (width - left - right)) / Math.max(1, rows.length - 1);
  function selectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (((event.clientX-rect.left)*width)/rect.width-left)/(width-left-right);
    onSelect(rows[Math.max(0,Math.min(rows.length-1,Math.round(fraction*(rows.length-1))))].date);
  }
  const chart = (probability) => {
    const min = probability
      ? 0
      : Math.floor(
          Math.min(-1, ...rows.map((r) => r.spread).filter(Number.isFinite)),
        );
    const max = probability
      ? 1
      : Math.ceil(
          Math.max(1, ...rows.map((r) => r.spread).filter(Number.isFinite)),
        );
    const y = (v) => top + ((max - v) / (max - min)) * (height - top - bottom);
    const path = (value) => {
      let pen = false;
      return rows
        .map((r, i) => {
          const v = value(r);
          if (!Number.isFinite(v)) {
            pen = false;
            return "";
          }
          const next = `${pen ? "L" : "M"}${x(i)},${y(v)}`;
          pen = true;
          return next;
        })
        .join(" ");
    };
    const chosen = rows.findIndex((r) => r.date === selected);
    const selectedValue = probability ? rows[chosen]?.prediction?.scores[model] : rows[chosen]?.spread;
    const labelX = Math.max(left+4, Math.min(width-right-92, x(chosen)+10));
    const labelY = top - 7;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        onKeyDown={(event) => {
          const index = Math.max(0, rows.findIndex((r) => r.date === selected));
          const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : null;
          if (next !== null) { event.preventDefault(); onSelect(rows[Math.max(0, Math.min(rows.length-1, next))].date); }
        }}
        onPointerDown={(event) => {
          gesture.current = { id:event.pointerId, x:event.clientX, y:event.clientY, horizontal:event.pointerType !== "touch", vertical:false };
          if (event.pointerType !== "touch") { event.currentTarget.setPointerCapture(event.pointerId); selectPointer(event); }
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId || g.vertical) return;
          const dx = Math.abs(event.clientX-g.x), dy = Math.abs(event.clientY-g.y);
          if (!g.horizontal && dy > 8 && dy > dx) { g.vertical=true; return; }
          if (!g.horizontal && dx > 8 && dx > dy) { g.horizontal=true; event.currentTarget.setPointerCapture(event.pointerId); }
          if (g.horizontal) selectPointer(event);
        }}
        onPointerUp={(event) => {
          const g=gesture.current;
          if (g && !g.vertical) selectPointer(event);
          if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          gesture.current=null;
        }}
        onPointerCancel={() => { gesture.current=null; }}
        aria-label={
          probability
            ? "Out-of-sample probability of recession onset in the next 12 months, with historical prevalence baseline"
            : "10-year minus 3-month yield spread in percentage points, grey bands show USREC recession months"
        }
      >
        {rows.map((r, i) =>
          r.USREC === 1 ? (
            <rect
              key={r.date}
              x={x(i) - (width - left - right) / rows.length / 2}
              y={top}
              width={(width - left - right) / rows.length + 1}
              height={height - top - bottom}
              fill="#e2e4e4"
            />
          ) : null,
        )}
        {[0, 1, 2, 3, 4].map((i) => {
          const v = min + ((max - min) * i) / 4;
          if (!probability && Math.abs(y(v) - y(0)) < 18) return null;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                stroke="#d8dedf"
              />
              <text x={left - 9} y={y(v) + 4} textAnchor="end">
                {probability ? `${Math.round(v * 100)}%` : format(v, 1)}
              </text>
            </g>
          );
        })}
        <path
          d={path((r) =>
            probability ? r.prediction?.scores[model] : r.spread,
          )}
          fill="none"
          stroke={probability ? colours[model] : "#263c4b"}
          strokeWidth="2.5"
        />
        {probability && model !== "prevalence" && (
          <path
            d={path((r) => r.prediction?.scores.prevalence)}
            fill="none"
            stroke={colours.prevalence}
            strokeWidth="2"
            strokeDasharray="7 5"
          />
        )}
        {!probability && (
          <g><line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#987557"
            strokeDasharray="5 5"
          /><text x={left-9} y={y(0)+4} textAnchor="end" className="zero-label">0</text></g>
        )}
        {chosen >= 0 && (
          <g className="date-marker"><line
            x1={x(chosen)}
            x2={x(chosen)}
            y1={top}
            y2={height - bottom}
            stroke="#a95028" strokeWidth="2"
          />
          {Number.isFinite(selectedValue) && <>
            <circle data-selected-point={probability ? "probability" : "spread"} cx={x(chosen)} cy={y(selectedValue)} r="4.5" fill={probability ? colours[model] : "#263c4b"} stroke="white" strokeWidth="2" />
            <rect x={labelX-3} y={labelY-15} width="90" height="21" rx="2" fill="white" />
            <text x={labelX} y={labelY} fontWeight="700">{probability ? percent(selectedValue) : `${format(selectedValue,2)} pp`}</text>
          </>}
          {probability && model !== "prevalence" && Number.isFinite(rows[chosen]?.prediction?.scores.prevalence) && <circle cx={x(chosen)} cy={y(rows[chosen].prediction.scores.prevalence)} r="3.5" fill="white" stroke={colours.prevalence} strokeWidth="2" />}
          </g>
        )}
        {Array.from(
          new Set([
            0,
            ...(width < 500 ? [] : [Math.floor(rows.length / 4)]),
            Math.floor(rows.length / 2),
            ...(width < 500 ? [] : [Math.floor((rows.length * 3) / 4)]),
            rows.length - 1,
          ]),
        ).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 12}
            textAnchor={
              i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"
            }
          >
            {month(rows[i].date)}
          </text>
        ))}
      </svg>
    );
  };
  return (
    <section className="history" ref={container}>
      <h2>
        Yield spread <span>10-year − 3-month · percentage points · below zero: inverted</span>
      </h2>
      {chart(false)}
      <h2>
        Recession onset probability{" "}
        <span>{names[model]} — solid · prevalence — dashed</span>
      </h2>
      {chart(true)}
      <p className="caption">
        Grey bands: recession months. Forecast target: an onset in the next 12
        months. Gaps: unavailable estimates; select a month for the reason.
      </p>
      <label className="scrubber">
        Inspect historical month{" "}
        <input
          type="range"
          min="0"
          max={rows.length - 1}
          value={Math.max(
            0,
            rows.findIndex((r) => r.date === selected),
          )}
          onChange={(e) => onSelect(rows[+e.target.value].date)}
        />
      </label>
    </section>
  );
}

function Calibration({ points }) {
  return (
    <svg
      className="calibration"
      viewBox="0 0 380 310"
      role="img"
      aria-label="Calibration: predicted probability versus observed fraction, diagonal indicates perfect calibration"
    >
      <line
        x1="45"
        y1="265"
        x2="330"
        y2="20"
        stroke="#8996a0"
        strokeDasharray="5 5"
      />
      <line x1="45" y1="20" x2="45" y2="265" stroke="#66757e" />
      <line x1="45" y1="265" x2="330" y2="265" stroke="#66757e" />
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <text x={45 + 285 * v} y="286" textAnchor="middle">
            {v}
          </text>
          <text x="32" y={270 - 245 * v} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={45 + 285 * p.meanPrediction}
            cy={265 - 245 * p.observedFrequency}
            r={5 + Math.sqrt(p.n) / 4}
            fill="#254f91"
          />
          <title>{`${p.n} months: mean prediction ${percent(p.meanPrediction)}, observed ${percent(p.observedFrequency)}`}</title>
        </g>
      ))}
      <text x="185" y="307" textAnchor="middle">
        Predicted probability
      </text>
      <text transform="translate(12 150) rotate(-90)" textAnchor="middle">
        Observed fraction
      </text>
    </svg>
  );
}

export default function App() {
  const [study, setStudy] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [view, setView] = useState("signals"),
    [period, setPeriod] = useState("2000"),
    [model, setModel] = useState("logistic"),
    [selected, setSelected] = useState("2019-08-01");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/study.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (
          d.schemaVersion !== 1 ||
          !d.artifactId ||
          !d.rows?.length ||
          !d.folds?.length ||
          !d.models?.logistic
        )
          throw Error("Unsupported or incomplete study bundle");
        setStudy(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  const returnToMonth = useRef(false);
  useEffect(() => {
    if (view === "signals" && returnToMonth.current) {
      returnToMonth.current=false;
      document.getElementById("selected-month")?.focus();
    }
  }, [view]);
  const inspectError = (date) => {
    if (+date.slice(0,4) < +period) setPeriod("1953");
    setSelected(date); returnToMonth.current=true; setView("signals");
  };
  const rows = study?.rows.filter((r) => +r.date.slice(0, 4) >= +period) || [];
  const inspected = study?.rows.find((r) => r.date === selected),
    prediction = inspected?.prediction;
  const fold = study?.folds.find((f) => f.id === prediction?.foldId);
  const pickPeriod = (value) => {
    setPeriod(value);
    if (+selected.slice(0, 4) < +value) setSelected(`${value}-01-01`);
  };
  return (
    <>
      <header>
        <a className="brand" href="/">
          Yield Curve Study
        </a>
        <span className="mode">Historical backtest</span>
        <nav aria-label="Project links">
          <a href="#how-to-use">How to use</a>
          <a href="https://github.com/m21264551-arch/recession">Code ↗</a>
          <a href="https://m21264551.com">Portfolio ↗</a>
        </nav>
      </header>
      <main id="tool" tabIndex={-1}>
        <h1>Compare yield-curve signals with subsequent recession onsets.</h1>
        {error ? (
          <div role="alert">
            <h2>Study unavailable</h2>
            <p>{error}. The dashboard will not substitute synthetic results.</p>
            <button onClick={() => setRetry((r) => r + 1)}>
              Retry snapshot
            </button>{" "}
            <a href="https://github.com/m21264551-arch/recession#reproduce">
              Reproduction instructions
            </a>
          </div>
        ) : !study ? (
          <p role="status">Loading the historical study…</p>
        ) : (
          <>
            <nav className="views" aria-label="Study views">
              {[
                ["signals", "Historical signals"],
                ["backtest", "Results"],
                ["method", "Data and method"],
              ].map(([key, title]) => (
                <button
                  key={key}
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                >
                  {title}
                </button>
              ))}
            </nav>
            {view === "signals" && (
              <>
                <div className="chart-controls">
                  <label>
                    Chart period
                    <select
                      value={period}
                      onChange={(e) => pickPeriod(e.target.value)}
                    >
                      <option value="1953">Full history</option>
                      <option value="1980">1980 onward</option>
                      <option value="2000">2000 onward</option>
                      <option value="2010">2010 onward</option>
                    </select>
                  </label>
                  <label>
                    Model
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {Object.entries(names).map(([key, title]) => (
                        <option key={key} value={key}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="month-controls">
                    <label>
                      Selected month
                      <input
                        id="selected-month" type="month"
                        value={selected.slice(0, 7)}
                        min={study.rows[0].date.slice(0, 7)}
                        max={study.rows.at(-1).date.slice(0, 7)}
                        onChange={(e) => {
                          const date = `${e.target.value}-01`;
                          if (study.rows.some((r) => r.date === date)) {
                            setSelected(date);
                            if (+date.slice(0, 4) < +period) setPeriod("1953");
                          }
                        }}
                      />
                    </label>
                    <button
                      aria-label="Previous month"
                      disabled={rows[0]?.date === selected}
                      onClick={() =>
                        setSelected(
                          rows[
                            Math.max(
                              0,
                              rows.findIndex((r) => r.date === selected) - 1,
                            )
                          ].date,
                        )
                      }
                    >
                      ←
                    </button>
                    <button
                      aria-label="Next month"
                      disabled={rows.at(-1)?.date === selected}
                      onClick={() =>
                        setSelected(
                          rows[
                            Math.min(
                              rows.length - 1,
                              rows.findIndex((r) => r.date === selected) + 1,
                            )
                          ].date,
                        )
                      }
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="signal-layout">
                  <section className="selected" aria-label="Selected month results">
                    <div className="estimate"><p className="selection-label">{month(selected)}</p>
                      <h2>{prediction ? percent(prediction.scores[model]) : "Estimate unavailable"}</h2>
                      <p>{prediction ? "Onset within 12 months" : inspected?.unavailableReason}</p></div>
                    <dl className="selected-values"><div><dt>Baseline</dt><dd>{prediction ? percent(prediction.scores.prevalence) : "Unavailable"}</dd></div>
                      <div><dt>Spread</dt><dd>{format(inspected?.spread, 2)} pp</dd></div></dl>
                    <p className="observed-outcome"><strong>Observed:</strong> {inspected?.target === null ? "future window incomplete" : inspected?.target === 1 ? "a recession began in the next 12 months" : "no recession began in the next 12 months"}.
                      <span>{inspected?.USREC === 1 ? "Selected month: in recession." : "Selected month: outside recession."}</span></p>
                    {fold && <details className="training"><summary>Training window</summary><p>Fit on {month(fold.trainingStart)} – {month(fold.trainingEnd)}. Training outcomes end {month(fold.lastTrainingOutcome)}. Refit January {fold.id}.</p></details>}
                  </section>
                  <HistoryChart
                    rows={rows}
                    model={model}
                    selected={selected}
                    onSelect={setSelected}
                  />

                </div>
                <div className="note">
                  Full-backtest Brier score:{" "}
                  {format(study.models[model].metrics.brier)}, compared with{" "}
                  {format(study.models.prevalence.metrics.brier)} for prevalence
                  (lower is better). See Results for errors and calibration.
                </div>
              </>
            )}
            {view === "backtest" && (
              <>
                <h2>Backtest results</h2>
                <p>
                  These metrics cover the full evaluation history, independently
                  of the chart period. The overlapping 12-month targets are
                  correlated; monthly sample count is not a count of independent
                  economic events.
                </p>
                <ResultsTable
                  heads={[
                    "Model",
                    "ROC-AUC ↑",
                    "Average precision ↑",
                    "Brier ↓",
                    "Evaluated months",
                  ]}
                  rows={Object.entries(study.models).map(([key, m]) => [
                    m.name,
                    format(m.metrics.rocAuc),
                    format(m.metrics.averagePrecision),
                    format(m.metrics.brier),
                    m.metrics.n,
                  ])}
                />
                <div className="two-col">
                  <section>
                    <h3>Calibration · {names[model]}</h3>
                    <label>
                      Inspect model
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {Object.entries(names).map(([k, n]) => (
                          <option key={k} value={k}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Calibration
                      points={study.models[model].metrics.calibration}
                    />
                    <p className="caption">
                      Ten fixed probability bins; circle size reflects the
                      number of months. The diagonal represents agreement, not a
                      fitted calibration correction.
                    </p>
                  </section>
                  <section>
                    <h3>False alarms and misses</h3>
                    <p>At the illustrative, untuned threshold of 50%:</p>
                    <p>
                      <strong>
                        {study.errors[model].falseAlarmMonths.length}{" "}
                        false-alarm months
                      </strong>{" "}
                      had no onset in the next year.
                    </p>
                    <p>
                      <strong>
                        {study.errors[model].missedPositiveMonths.length} missed
                        positive months
                      </strong>{" "}
                      preceded an onset but stayed below 50%.
                    </p>
                    <p>
                      These counts depend on the threshold. A low probability
                      model can miss every onset at 50% while still
                      rank-ordering months usefully.
                    </p>
                    <details>
                      <summary>Inspect false-alarm months</summary>
                      <div className="error-months">{study.errors[model].falseAlarmMonths.length ? study.errors[model].falseAlarmMonths.map((date) => <button key={date} onClick={() => inspectError(date)}>{month(date)}</button>) : "None at this threshold."}</div>
                    </details>
                    <details>
                      <summary>Inspect missed positive months</summary>
                      <div className="error-months">{study.errors[model].missedPositiveMonths.length ? study.errors[model].missedPositiveMonths.map((date) => <button key={date} onClick={() => inspectError(date)}>{month(date)}</button>) : "None at this threshold."}</div>
                    </details>
                  </section>
                </div>
                <h3>Before each recession onset · {names[model]}</h3>
                <ResultsTable
                  heads={[
                    "USREC onset",
                    "Evaluated pre-onset months",
                    "Mean estimate",
                    "Peak estimate",
                    "Months ≥50%",
                    "Brier ↓",
                  ]}
                  rows={study.episodes.map((e) => [
                    month(e.onset),
                    `${e.evaluatedMonths}/12`,
                    percent(e.models[model].meanProbability),
                    percent(e.models[model].maxProbability),
                    e.models[model].monthsAboveHalf,
                    format(e.models[model].metrics.brier),
                  ])}
                />
                <p className="caption">
                  Each row covers the 12 months before the first USREC=1 month.
                  Ranking metrics are undefined within these all-positive
                  windows; Brier remains defined. This target follows USREC’s
                  convention, not the date an NBER announcement was published.
                </p>
                <h3>Annual evaluation windows</h3>
                <ResultsTable
                  heads={[
                    "Refit",
                    "Train observations through",
                    "Train outcomes through",
                    "Evaluate through",
                    "ROC-AUC",
                    "AP",
                    "Brier",
                  ]}
                  rows={study.folds.map((f) => [
                    f.id,
                    month(f.trainingEnd),
                    month(f.lastTrainingOutcome),
                    month(f.evaluationEnd),
                    format(f.metrics[model].rocAuc),
                    format(f.metrics[model].averagePrecision),
                    format(f.metrics[model].brier),
                  ])}
                />
                <p className="caption">
                  Undefined means an annual evaluation period contains only one
                  target class. No numeric substitute is inserted.
                </p>
              </>
            )}
            {view === "method" && (
              <section className="method">
                <h2>Data and method</h2>
                <div className="snapshot">
                  <span>
                    {month(study.observationPeriod.start)} –{" "}
                    {month(study.observationPeriod.end)}
                  </span>
                  <span>
                    FRED snapshot · retrieved{" "}
                    {study.snapshot.retrievedAt.slice(0, 10)}
                  </span>
                  <span>
                    {study.folds.length} annual refits ·{" "}
                    {study.models.logistic.metrics.n} evaluated months
                  </span>
                </div>
                <p className="identity">
                  {study.artifactId} · code {study.codeRevision.slice(0, 8)} ·
                  schema v{study.schemaVersion}
                </p>
                <p>{study.protocol.vintageLimitation}</p>
                <h3>Data and units</h3>
                <p>
                  {study.protocol.spreadDefinition} These are two yields, not a
                  full fitted yield curve.
                </p>
                <ResultsTable
                  heads={["Series", "Definition", "Unit", "Missing months"]}
                  rows={study.snapshot.sources.map((s) => [
                    <a href={s.url}>{s.series}</a>,
                    s.basis,
                    s.unit,
                    study.missingObservations[s.series],
                  ])}
                />
                <p>
                  No invented GDP, inflation, unemployment or PMI series enter
                  this study. Missing values are preserved; models skip rows
                  without all required features. Synthetic histories are
                  restricted to test fixtures.
                </p>
                <h3>Target and eligible training labels</h3>
                <p>
                  {study.protocol.target}. A calendar reindex ensures missing
                  observations cannot shorten the horizon. The final 12 months
                  with unobserved outcomes are excluded from evaluation.
                </p>
                <p>
                  Each January, refit on all eligible earlier observations with
                  at least 20 years of history. A training label’s complete
                  outcome window must end strictly before the refit. The same
                  fitted model is applied throughout that calendar year. Scaling
                  is learned only on the training portion.
                </p>
                <h3>Fixed models, no retrospective tuning</h3>
                <p>
                  Prevalence predicts the mean training target. Logistic
                  regression uses only the standardized spread (C=1). Gradient
                  boosting uses the spread, its three-month lag and change,
                  GS10, and TB3MS: 100 trees, depth 2, learning rate 0.03, seed
                  42. Settings were fixed before running this reconstruction; no
                  hyperparameter selection uses evaluation periods.
                </p>
                <h3>Reproduce or update explicitly</h3>
                <pre>
                  python -m analysis.acquire{"\n"}python -m analysis.export
                  {"\n"}python -m pytest{"\n"}cd dashboard && npm ci && npm run
                  build
                </pre>
                <p>
                  Skip acquisition to reproduce the checked-in snapshot.
                  Updating downloads a new vintage and changes the data
                  identity. Public browsing reads the committed artifact and
                  does not contact FRED or train on startup.
                </p>
                <h3>Limitations</h3>
                <p>
                  There are few recession episodes. Final recession
                  classifications and revised yield data were not all known in
                  real time. Adjacent labels overlap, errors are correlated, and
                  expanding training does not remove changes in monetary
                  regimes. Pandemic recessions need not follow yield-curve
                  mechanisms. The study does not establish a current forecast or
                  a trading strategy.
                </p>
                <p>
                  Snapshot SHA256: <code>{study.snapshot.sha256}</code>
                </p>
              </section>
            )}
            <footer>
              <a href="/api/study.json" download="yield-curve-study-v1.json">
                Download data ↓
              </a>
              <span>
                Historical backtest · FRED snapshot{" "}
                {study.snapshot.retrievedAt.slice(0, 10)}
              </span>
            </footer>
          </>
        )}
      <HowToUse />
      </main>
    </>
  );
}
