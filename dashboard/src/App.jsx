import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api')
).replace(/\/$/, '')
const BRAND = 'YieldCurve IQ'

const COLORS = {
  ink: '#101418',
  muted: '#667085',
  grid: '#e8eaef',
  band: '#fde2e2',
  red: '#c62828',
  amber: '#b7791f',
  green: '#1f7a3f',
}

const RECESSIONS = [
  ['1980-01', '1980-07'],
  ['1981-07', '1982-11'],
  ['1990-07', '1991-03'],
  ['2001-03', '2001-11'],
  ['2007-12', '2009-06'],
  ['2020-02', '2020-04'],
]

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'yields', label: 'Yields' },
  { id: 'model', label: 'Model' },
  { id: 'eda', label: 'EDA' },
  { id: 'notes', label: 'Notes' },
]

async function get(path, signal) {
  const response = await fetch(`${API}${path}`, { signal })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

function numberOrNull(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatNumber(value, digits = 1, fallback = '-') {
  const numeric = numberOrNull(value)
  return numeric === null ? fallback : numeric.toFixed(digits)
}

function formatPercent(value, digits = 1) {
  const numeric = numberOrNull(value)
  return numeric === null ? '-' : `${(numeric * 100).toFixed(digits)}%`
}

function formatRate(value, digits = 1) {
  const numeric = numberOrNull(value)
  return numeric === null ? '-' : `${numeric.toFixed(digits)}%`
}

function formatSigned(value, suffix = '', digits = 2) {
  const numeric = numberOrNull(value)
  if (numeric === null) return '-'
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`
}

function riskFromProbability(value) {
  const probability = numberOrNull(value) ?? 0

  if (probability > 0.5) {
    return { label: 'High Risk', tone: 'red', color: COLORS.red, summary: 'above the high-risk threshold' }
  }

  if (probability > 0.25) {
    return { label: 'Elevated Risk', tone: 'amber', color: COLORS.amber, summary: 'inside the watch zone' }
  }

  return { label: 'Low Risk', tone: 'green', color: COLORS.green, summary: 'below the watch zone' }
}

function downsample(items, step = 3) {
  return Array.isArray(items) ? items.filter((_, index) => index % step === 0) : []
}

function tickInterval(length, targetTicks) {
  if (!length || length <= targetTicks) return 0
  return Math.max(0, Math.floor(length / targetTicks))
}

function tooltipStyle() {
  return {
    background: '#ffffff',
    border: '1px solid #d9dde5',
    borderRadius: 8,
    boxShadow: '0 18px 40px rgba(16, 24, 40, .12)',
    color: COLORS.ink,
    fontSize: 12,
  }
}

function RecessionBands() {
  return RECESSIONS.map(([start, end]) => (
    <ReferenceArea
      key={`${start}-${end}`}
      x1={start}
      x2={end}
      fill={COLORS.band}
      fillOpacity={0.72}
      strokeOpacity={0}
    />
  ))
}

function LogoLockup() {
  return (
    <div className="brand-block">
      <div className="brand-mark" aria-hidden="true">YC</div>
      <div>
        <strong>{BRAND}</strong>
        <span className="logo-subtitle">Recession Risk Monitor</span>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <main className="center-state">
      <LogoLockup />
      <p>Loading reproducible recession-risk analysis...</p>
    </main>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <main className="center-state">
      <LogoLockup />
      <h1>Data service unavailable</h1>
      <p>
        Start the local services with <code>./start.sh</code>, then retry.
        {error?.message ? ` ${error.message}.` : ''}
      </p>
      <button type="button" onClick={onRetry}>Retry</button>
    </main>
  )
}

function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function StatCard({ title, value, detail, tone = 'neutral', children }) {
  return (
    <section className="stat-card">
      <div className="stat-title">{title}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
      {detail ? <p>{detail}</p> : null}
      {children}
    </section>
  )
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label = 'No data available' }) {
  return <div className="empty-state">{label}</div>
}

export default function App() {
  const [overview, setOverview] = useState(null)
  const [yields, setYields] = useState(null)
  const [model, setModel] = useState(null)
  const [eda, setEda] = useState(null)
  const [tab, setTab] = useState('overview')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setStatus('loading')
    setError(null)

    Promise.all([
      get('/overview', controller.signal),
      get('/yields', controller.signal),
      get('/model', controller.signal),
      get('/eda', controller.signal),
    ])
      .then(([overviewData, yieldData, modelData, edaData]) => {
        setOverview(overviewData)
        setYields(yieldData)
        setModel(modelData)
        setEda(edaData)
        setStatus('ready')
      })
      .catch((nextError) => {
        if (nextError.name !== 'AbortError') {
          setError(nextError)
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [refreshVersion])

  const probability = numberOrNull(overview?.current?.probability) ?? 0
  const risk = riskFromProbability(probability)
  const yieldCurve = overview?.yield_curve || {}
  const curveData = ['3M', '2Y', '5Y', '10Y', '30Y']
    .map((term) => ({ term, value: numberOrNull(yieldCurve[term]) }))
    .filter((point) => point.value !== null)
  const spread10y2y = numberOrNull(yieldCurve['10Y']) !== null && numberOrNull(yieldCurve['2Y']) !== null
    ? numberOrNull(yieldCurve['10Y']) - numberOrNull(yieldCurve['2Y'])
    : null
  const curveSignal = overview?.is_inverted ? 'Inverted' : 'Normal'
  const probabilitySeries = useMemo(() => downsample(model?.probability_series), [model])
  const yieldSeries = useMemo(() => downsample(yields?.time_series), [yields])
  const featureImportance = useMemo(() => (
    model?.feature_importance
      ? Object.entries(model.feature_importance)
        .slice(0, 10)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Math.round(value * 100) }))
      : []
  ), [model])
  const coefficients = useMemo(() => (
    model?.lr_coefficients
      ? Object.entries(model.lr_coefficients)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 12)
      : []
  ), [model])
  const correlations = eda?.correlations ? Object.entries(eda.correlations) : []
  const auc = numberOrNull(overview?.model_performance?.gb_auc_mean)

  if (status === 'loading' && !overview) return <LoadingState />
  if (status === 'error') return <ErrorState error={error} onRetry={() => setRefreshVersion((value) => value + 1)} />

  const activeMeta = {
    overview: {
      title: 'Recession Probability Over Time',
      subtitle: 'Predicted 12-month recession probability with historical recession bands.',
    },
    yields: {
      title: 'Treasury Yield History',
      subtitle: 'Synthetic monthly Treasury series across the curve.',
    },
    model: {
      title: 'Feature Importance',
      subtitle: 'Top gradient boosting predictors ranked by contribution.',
    },
    eda: {
      title: 'Spread Distribution',
      subtitle: 'Negative values mark yield curve inversion.',
    },
    notes: {
      title: 'Architecture Notes',
      subtitle: 'A compact read on the modeling pipeline and tradeoffs.',
    },
  }[tab]

  const insight = {
    overview: {
      title: 'Signal',
      body: `${risk.label}: the current model probability is ${formatPercent(probability)} and ${risk.summary}.`,
      tip: 'Compare probability spikes with recession bands before reading a single current value too literally.',
    },
    yields: {
      title: 'Curve',
      body: spread10y2y === null
        ? 'The 10Y - 2Y spread is unavailable in this run.'
        : `The 10Y - 2Y spread is ${formatSigned(spread10y2y, '%')}, so the current curve reads ${curveSignal.toLowerCase()}.`,
      tip: 'The slope matters most when it stays inverted, not when it flickers for one observation.',
    },
    model: {
      title: 'Model',
      body: `Gradient boosting is the primary readout here, with AUC ${auc === null ? '-' : auc.toFixed(3)} on forward-looking folds.`,
      tip: 'Feature importance is a ranking aid, not a causal claim.',
    },
    eda: {
      title: 'EDA',
      body: 'The distribution and correlation checks keep the modeling story honest before the dashboard gets polished.',
      tip: 'Use these checks to spot leakage or an overfit synthetic signal.',
    },
    notes: {
      title: 'Notes',
      body: 'The app keeps data generation, feature engineering, model validation, API output, and UI rendering in one reproducible path.',
      tip: 'Synthetic data keeps the demo cloneable without external API keys.',
    },
  }[tab]

  const centerView = {
    overview: probabilitySeries.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={probabilitySeries} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: COLORS.muted }}
            tickFormatter={(value) => value?.slice(0, 4)}
            interval={tickInterval(probabilitySeries.length, 10)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.muted }}
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <RecessionBands />
          <Area
            type="monotone"
            dataKey="ensemble_prob"
            name="Model probability"
            stroke={COLORS.green}
            fill={COLORS.green}
            fillOpacity={0.08}
            strokeWidth={2.2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="NBER recession"
            stroke={COLORS.red}
            fill={COLORS.red}
            fillOpacity={0.08}
            strokeWidth={1}
            dot={false}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value, name) => [name === 'Model probability' ? formatPercent(value) : value, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </AreaChart>
      </ResponsiveContainer>
    ) : <EmptyState />,
    yields: yieldSeries.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={yieldSeries} margin={{ top: 14, right: 18, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: COLORS.muted }}
            tickFormatter={(value) => value?.slice(0, 4)}
            interval={tickInterval(yieldSeries.length, 12)}
          />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(value) => `${value}%`} />
          <RecessionBands />
          <Line type="monotone" dataKey="t3m" stroke="#9aa4b2" strokeWidth={1} dot={false} name="3-month" />
          <Line type="monotone" dataKey="t2y" stroke="#5d6678" strokeWidth={1.25} dot={false} name="2-year" />
          <Line type="monotone" dataKey="t10y" stroke={COLORS.ink} strokeWidth={2} dot={false} name="10-year" />
          <Line type="monotone" dataKey="t30y" stroke="#2f3848" strokeWidth={1.25} dot={false} name="30-year" />
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </LineChart>
      </ResponsiveContainer>
    ) : <EmptyState />,
    model: featureImportance.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={featureImportance} layout="vertical" margin={{ top: 18, right: 24, bottom: 10, left: 150 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: COLORS.ink }} width={140} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {featureImportance.map((_, index) => (
              <Cell key={index} fill={index < 3 ? COLORS.green : '#aab2c0'} />
            ))}
          </Bar>
          <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value}%`, 'Importance']} />
        </BarChart>
      </ResponsiveContainer>
    ) : <EmptyState />,
    eda: eda?.spread_distribution?.bins?.length ? (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={eda.spread_distribution.bins.map((bin, index) => ({ bin, count: eda.spread_distribution.counts[index] }))}
          margin={{ top: 18, right: 18, bottom: 10, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="bin" tick={{ fontSize: 10, fill: COLORS.muted }} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} />
          <ReferenceLine x={0} stroke={COLORS.red} strokeDasharray="4 4" />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {eda.spread_distribution.bins.map((bin, index) => (
              <Cell key={index} fill={bin < 0 ? COLORS.red : COLORS.green} opacity={bin < 0 ? 0.72 : 0.82} />
            ))}
          </Bar>
          <Tooltip contentStyle={tooltipStyle()} />
        </BarChart>
      </ResponsiveContainer>
    ) : <EmptyState />,
    notes: (
      <div className="notes-canvas">
        <section>
          <h3>Why synthetic data?</h3>
          <p>
            Real macro datasets bring API keys, refresh schedules, and licensing decisions.
            This project keeps the whole pipeline cloneable while preserving the modeling shape.
          </p>
        </section>
        <ol className="step-list">
          <li>Generate yield curves, recession labels, and macro indicators.</li>
          <li>Engineer spreads, rolling averages, inversion flags, and lead-time features.</li>
          <li>Train logistic regression and gradient boosting with time-series folds.</li>
          <li>Serve model outputs through FastAPI and visualize them in React.</li>
        </ol>
      </div>
    ),
  }[tab]

  return (
    <main className="site-shell">
      <div className="app-shell">
      <header className="topbar">
        <LogoLockup />

        <div className="topbar-title">
          <h1>Yield curve recession monitor</h1>
          <span>Interpretable recession-risk model with reproducible synthetic macro data</span>
        </div>

        <div className="topbar-actions">
          <span className="run-state is-ready">
            <span className="status-dot" />
            Ready
          </span>
          <button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Refresh</button>
        </div>
      </header>

      <aside className="panel control-panel" aria-label="Yield curve controls">
        <section className="field-group">
          <label>View</label>
          <div className="tab-stack">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="field-group">
          <label>Current risk</label>
          <div className="summary-value">{formatPercent(probability)}</div>
          <p>{risk.label}: {risk.summary}</p>
          <div className="rail-sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height={54}>
              <LineChart data={probabilitySeries.slice(-36)} margin={{ top: 8, right: 2, bottom: 2, left: 2 }}>
                <Line type="monotone" dataKey="ensemble_prob" stroke={risk.color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="field-group">
          <label>Latest curve</label>
          <div className="curve-list">
            {curveData.map((point) => (
              <div key={point.term}>
                <span>{point.term}</span>
                <strong>{formatNumber(point.value, 2)}%</strong>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="visual-panel" aria-label={activeMeta.title}>
        <div className="canvas-toolbar">
          <div>
            <h2>{activeMeta.title}</h2>
            <span>{activeMeta.subtitle}</span>
          </div>
          <div className="signal-pill">{curveSignal}</div>
        </div>
        <div className="chart-canvas">
          {centerView}
        </div>
      </section>

      <aside className="panel metrics-panel" aria-label="Current metrics">
        <section className="metrics-section">
          <h2>Current Signal</h2>
          <div className="parameter-grid">
            <div>
              <span>Probability</span>
              <strong className={risk.tone}>{formatPercent(probability)}</strong>
            </div>
            <div>
              <span>10Y - 2Y</span>
              <strong className={overview?.is_inverted ? 'red' : 'green'}>{spread10y2y === null ? '-' : formatSigned(spread10y2y, '%')}</strong>
            </div>
          </div>
        </section>

        <section className="metrics-section">
          <h2>Model Health</h2>
          <div className="row-stack">
            <div className="metric-row"><span>Gradient boosting AUC</span><strong>{auc === null ? '-' : auc.toFixed(3)}</strong></div>
            <div className="metric-row"><span>Brier score</span><strong>{formatNumber(model?.full_metrics?.brier, 3)}</strong></div>
            <div className="metric-row"><span>Accuracy</span><strong>{formatPercent(model?.full_metrics?.accuracy)}</strong></div>
          </div>
        </section>

        <section className="metrics-section">
          <h2>Key Inputs</h2>
          <div className="row-stack compact">
            <div className="metric-row"><span>Unemployment</span><strong>{formatRate(overview?.latest_indicators?.unemployment)}</strong></div>
            <div className="metric-row"><span>CPI YoY</span><strong>{formatRate(overview?.latest_indicators?.cpi_yoy)}</strong></div>
            <div className="metric-row"><span>GDP growth</span><strong>{formatRate(overview?.latest_indicators?.gdp_growth)}</strong></div>
            <div className="metric-row"><span>ISM PMI</span><strong>{formatNumber(overview?.latest_indicators?.ism_pmi, 1)}</strong></div>
          </div>
        </section>

        {tab === 'model' && coefficients.length ? (
          <section className="metrics-section">
            <h2>Top Coefficients</h2>
            <div className="row-stack compact">
              {coefficients.slice(0, 4).map(([name, value]) => (
                <div className="metric-row" key={name}>
                  <span>{name.replace(/_/g, ' ')}</span>
                  <strong className={value < 0 ? 'green' : 'red'}>{formatSigned(value, '', 3)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'eda' && correlations.length ? (
          <section className="metrics-section">
            <h2>Correlations</h2>
            <div className="row-stack compact">
              {correlations.slice(0, 4).map(([name, value]) => (
                <div className="metric-row" key={name}>
                  <span>{name.replace(/_/g, ' ')}</span>
                  <strong className={value < 0 ? 'green' : 'red'}>{formatSigned(value, '', 3)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </aside>

      <section className="insight-bar">
        <div className="insight-icon" aria-hidden="true">%</div>
        <div>
          <h2>{insight.title}</h2>
          <p>{insight.body}</p>
        </div>
        <div className="tip">
          <strong>Tip</strong>
          <span>{insight.tip}</span>
        </div>
      </section>
      </div>
    </main>
  )
}
