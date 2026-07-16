import { useState, useEffect, useCallback } from 'react'

// App code lives in this public repo. Data lives in a separate PRIVATE repo,
// same split as finance-tracker, so job application data isn't public even
// though the app itself has to be (GitHub Pages on the Free plan requires
// a public repo).
const DATA_OWNER = 'princesavsaviya'
const DATA_REPO = 'application-tracker-data'
const BRANCH = 'main'
const LOG_PATH = 'data/log.json'
const SUMMARY_PATH = 'data/summary.json'
const FLOOR = 5
const TARGET = 30

const apiUrl = (path) =>
  `https://api.github.com/repos/${DATA_OWNER}/${DATA_REPO}/contents/${path}`

function fmtDate(d) {
  return d.toISOString().slice(0, 10)
}

function computeStreak(log) {
  let streak = 0
  let d = new Date()
  let firstDay = true
  while (true) {
    const key = fmtDate(d)
    const entry = log[key]
    if (entry && entry.count >= FLOOR) {
      streak++
    } else if (firstDay && !entry) {
      // today not logged yet, don't break on this alone
    } else {
      break
    }
    firstDay = false
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function computeWeekSum(log) {
  let sum = 0
  let d = new Date()
  for (let i = 0; i < 7; i++) {
    const entry = log[fmtDate(d)]
    if (entry) sum += entry.count
    d.setDate(d.getDate() - 1)
  }
  return sum
}

function levelFor(count) {
  if (count === 0 || count === undefined) return null
  if (count < FLOOR) return 'under'
  if (count < 10) return '1'
  if (count < 18) return '2'
  if (count < 25) return '3'
  return '4'
}

async function getFile(path, token) {
  const res = await fetch(apiUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (res.status === 404) return { content: null, sha: null }
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  const data = await res.json()
  const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))))
  return { content: JSON.parse(decoded), sha: data.sha }
}

async function putFile(path, token, obj, message) {
  const { sha } = await getFile(path, token)
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))))
  const body = { message, content, branch: BRANCH }
  if (sha) body.sha = sha
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `PUT ${path} failed: ${res.status}`)
  }
}

export default function App() {
  const [log, setLog] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '')
  const [count, setCount] = useState('')
  const [mlInfra, setMlInfra] = useState(false)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (t) => {
    if (!t) return
    setLoading(true)
    setLoadError('')
    try {
      const { content } = await getFile(LOG_PATH, t)
      const data = content || {}
      setLog(data)
      const todayKey = fmtDate(new Date())
      if (data[todayKey]) {
        setCount(String(data[todayKey].count))
        setMlInfra(!!data[todayKey].mlInfra)
        setNote(data[todayKey].note || '')
      }
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) load(token)
  }, [token, load])

  function saveToken(t) {
    setToken(t)
    localStorage.setItem('gh_token', t)
  }

  async function logToday() {
    const n = parseInt(count, 10)
    if (isNaN(n) || n < 0) {
      setStatus('enter a valid number')
      return
    }
    if (!token) {
      setStatus('add a GitHub token first (Settings below)')
      return
    }

    setSaving(true)
    setStatus('saving...')
    try {
      const todayKey = fmtDate(new Date())
      const updatedLog = { ...log, [todayKey]: { count: n, mlInfra, note } }

      await putFile(
        LOG_PATH,
        token,
        updatedLog,
        `log: ${todayKey} (${n} applications)`
      )

      const summary = {
        streak: computeStreak(updatedLog),
        today: updatedLog[todayKey]?.count || 0,
        week: computeWeekSum(updatedLog),
        updatedAt: new Date().toISOString(),
      }
      await putFile(SUMMARY_PATH, token, summary, `summary: ${todayKey}`)

      setLog(updatedLog)
      setStatus(`logged ${n} for ${todayKey}`)
    } catch (e) {
      setStatus(`save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const todayKey = fmtDate(new Date())
  const todayCount = log[todayKey]?.count || 0
  const streak = computeStreak(log)
  const weekSum = computeWeekSum(log)

  const days = 84
  const cells = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = fmtDate(d)
    cells.push({ key, count: log[key]?.count })
  }
  const firstDow = new Date(cells[0].key).getDay()
  const padded = [...Array(firstDow).fill(null), ...cells]

  return (
    <div className="max-w-3xl mx-auto p-6 font-sans">
      <div className="flex justify-between items-baseline border-b border-border pb-3 mb-5 flex-wrap gap-2">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wide">
          Application Log
        </h1>
        <div className="font-mono text-xs text-muted">
          floor {FLOOR} · target {TARGET} / day
        </div>
      </div>

      <details className="mb-5 font-mono text-xs text-muted" open={!token}>
        <summary className="cursor-pointer">Settings</summary>
        <div className="mt-2">
          <label className="block mb-1">
            GitHub token (fine-grained, Contents read/write on
            application-tracker-data only, stored in this browser only)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="github_pat_..."
            className="bg-bg border border-border text-white text-xs px-2.5 py-1.5 rounded w-full max-w-sm"
          />
        </div>
      </details>

      {!token ? (
        <div className="font-mono text-xs text-muted">
          add a token above to load your data, it's in a private repo
        </div>
      ) : loading ? (
        <div className="font-mono text-xs text-muted">loading...</div>
      ) : loadError ? (
        <div className="font-mono text-xs text-warn">
          couldn't load: {loadError}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label="Streak" value={streak} sub="consecutive days ≥ floor" tone={streak > 0 ? 'ok' : 'warn'} />
            <Stat
              label="Today"
              value={todayCount}
              sub="of 30 target"
              tone={todayCount >= TARGET ? 'ok' : todayCount >= FLOOR ? 'neutral' : 'warn'}
            />
            <Stat
              label="Last 7 Days"
              value={weekSum}
              sub="of 210 target"
              tone={weekSum >= TARGET * 7 ? 'ok' : 'neutral'}
            />
          </div>

          <div className="bg-surface border border-border rounded p-4 mb-5">
            <div className="flex gap-2 items-center flex-wrap">
              <label className="font-mono text-xs text-muted">applications today</label>
              <input
                type="number"
                min="0"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="bg-bg border border-border text-white font-mono text-sm px-2.5 py-1.5 rounded w-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted font-mono">
                <input
                  type="checkbox"
                  checked={mlInfra}
                  onChange={(e) => setMlInfra(e.target.checked)}
                />
                ML infra block done
              </label>
              <input
                type="text"
                placeholder="note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-bg border border-border text-white text-xs px-2.5 py-1.5 rounded flex-1 min-w-[140px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
              <button
                onClick={logToday}
                disabled={saving}
                className="bg-accent text-[#06180A] font-mono text-xs font-semibold px-4 py-1.5 rounded uppercase tracking-wide disabled:opacity-50"
              >
                {saving ? 'saving' : 'log'}
              </button>
            </div>
            {status && (
              <div className="font-mono text-xs text-muted mt-2">{status}</div>
            )}
          </div>

          <div className="bg-surface border border-border rounded p-4 overflow-x-auto">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted mb-2.5">
              Last 12 weeks
            </div>
            <div
              className="grid gap-[3px] w-max"
              style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 12px)' }}
            >
              {padded.map((c, i) => (
                <div
                  key={i}
                  title={c ? `${c.key}: ${c.count ?? 'not logged'} applications` : undefined}
                  className={`w-3 h-3 rounded-sm border ${cellClass(c && levelFor(c.count))}`}
                  style={{ visibility: c ? 'visible' : 'hidden' }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function cellClass(level) {
  switch (level) {
    case '1':
      return 'bg-[#0E4429] border-[#0E4429]'
    case '2':
      return 'bg-[#006D32] border-[#006D32]'
    case '3':
      return 'bg-[#26A641] border-[#26A641]'
    case '4':
      return 'bg-[#39D353] border-[#39D353]'
    case 'under':
      return 'bg-[#3D1418] border-warn'
    default:
      return 'bg-bg border-border'
  }
}

function Stat({ label, value, sub, tone }) {
  const toneClass = tone === 'ok' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-white'
  return (
    <div className="bg-surface border border-border rounded px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1.5">{label}</div>
      <div className={`font-mono text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="font-mono text-[11px] text-muted mt-0.5">{sub}</div>
    </div>
  )
}
