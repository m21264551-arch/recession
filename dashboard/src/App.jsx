import React, { useEffect, useState } from "react";

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
  const width = 1040,
    height = 330,
    left = 54,
    right = 24,
    top = 24,
    bottom = 40;
  const x = (i) =>
    left + (i * (width - left - right)) / Math.max(1, rows.length - 1);
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
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
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
          <line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#987557"
            strokeDasharray="5 5"
          />
        )}
        {chosen >= 0 && (
          <line
            x1={x(chosen)}
            x2={x(chosen)}
            y1={top}
            y2={height - bottom}
            stroke="#a95028"
            strokeDasharray="3 3"
          />
        )}
        {Array.from(
          new Set([
            0,
            Math.floor(rows.length / 4),
            Math.floor(rows.length / 2),
            Math.floor((rows.length * 3) / 4),
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
    <section className="history">
      <h2>
        Yield spread <span>Percentage points · GS10 − TB3MS</span>
      </h2>
      {chart(false)}
      <h2>
        What did the model estimate?{" "}
        <span>{names[model]} — solid · prevalence — dashed</span>
      </h2>
      {chart(true)}
      <p className="caption">
        Grey bands are recession months (USREC), not the forward-onset target.
        Blank forecasts mean insufficient training history, missing inputs, or
        an incomplete 12-month outcome window.
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
          Yield Curve Recession Study
        </a>
        <nav aria-label="External links">
          <a href="https://github.com/m21264551-arch/recession">
            Code & method ↗
          </a>
          <a href="https://m21264551.com">Portfolio ↗</a>
        </nav>
      </header>
      <main>
        <div className="opening">
          <p className="eyebrow">Historical evidence / US Treasury yields</p>
          <h1>
            Before a recession,
            <br />{" "}
            what does the curve tell us?
          </h1>
          <p>
            Test a yield-curve signal against simple baselines. Every estimate
            shown here comes from a chronological backtest using a dated
            historical snapshot.
          </p>
        </div>
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
            <nav className="views" aria-label="Study views">
              {[
                ["signals", "Historical signals"],
                ["backtest", "Backtest"],
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
                    Compare with prevalence
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
                  <label>
                    Selected historical month
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {rows.map((r) => (
                        <option key={r.date} value={r.date}>
                          {month(r.date)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <HistoryChart
                  rows={rows}
                  model={model}
                  selected={selected}
                  onSelect={setSelected}
                />
                <section className="selected">
                  <div>
                    <p className="eyebrow">
                      Selected month · {month(selected)}
                    </p>
                    <h2>
                      {prediction
                        ? percent(prediction.scores[model])
                        : "Estimate unavailable"}
                    </h2>
                    <p>
                      {prediction
                        ? "Estimated probability of an onset during the next 12 months."
                        : inspected?.unavailableReason}
                    </p>
                  </div>
                  <div>
                    <h3>Inspect the evidence</h3>
                    <p>
                      Spread:{" "}
                      <strong>
                        {format(inspected?.spread, 2)} percentage points.
                      </strong>{" "}
                      {inspected?.USREC === 1
                        ? "This month was in a recession."
                        : "This month was outside a recession."}
                    </p>
                    <p>
                      Observed target:{" "}
                      <strong>
                        {inspected?.target === null
                          ? "future window incomplete"
                          : inspected?.target === 1
                            ? "a recession began in the next 12 months"
                            : "no recession began in the next 12 months"}
                        .
                      </strong>
                    </p>
                    {fold && (
                      <p>
                        Fit on {month(fold.trainingStart)} –{" "}
                        {month(fold.trainingEnd)}. Training outcomes end{" "}
                        {month(fold.lastTrainingOutcome)}. Refit January{" "}
                        {fold.id}.
                      </p>
                    )}
                  </div>
                </section>
                <div className="note">
                  A yield inversion is a historical signal, not a recession
                  clock. The selected model’s full-backtest Brier score is{" "}
                  {format(study.models[model].metrics.brier)}, compared with{" "}
                  {format(study.models.prevalence.metrics.brier)} for prevalence
                  (lower is better). Inspect the Backtest view for misses, false
                  alarms, and calibration.
                </div>
              </>
            )}
            {view === "backtest" && (
              <>
                <h2>Compare every out-of-sample month</h2>
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
                    <h3>Failures are part of the result</h3>
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
                      <p>
                        {study.errors[model].falseAlarmMonths
                          .map(month)
                          .join(" · ") || "None at this threshold."}
                      </p>
                    </details>
                    <details>
                      <summary>Inspect missed positive months</summary>
                      <p>
                        {study.errors[model].missedPositiveMonths
                          .map(month)
                          .join(" · ") || "None at this threshold."}
                      </p>
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
                <h2>A retrospective study, with boundaries</h2>
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
                <h3>What remains uncertain</h3>
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
                Download complete study ↓
              </a>
              <span>
                {study.artifactId} · code {study.codeRevision.slice(0, 8)}
              </span>
              <span>
                Saved historical backtest · schema v{study.schemaVersion}
              </span>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
