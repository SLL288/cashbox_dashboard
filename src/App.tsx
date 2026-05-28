import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import { supabase } from './lib/supabase'

type Project = {
  local_project_id: string
  project_name: string
  location: string | null
  active: number
}

type User = {
  local_user_id: string
  username: string
  name: string
  role: 'admin' | 'manager' | 'viewer'
  password: string | null
  active: number
}

type ProjectUser = {
  local_project_id: string
  local_user_id: string
  role_in_project: string
  active: number
}

type TransactionType = 'expense' | 'cash_in' | 'exchange' | 'transfer'

type Transaction = {
  local_transaction_id: string
  transaction_no: string
  local_project_id: string
  date: string
  type: TransactionType
  amount: number
  currency: 'USD' | 'LRD'
  category: string
  note: string | null
  area: string | null
  from_currency: string | null
  from_amount: number | null
  to_currency: string | null
  to_amount: number | null
  exchange_rate: number | null
  change_usd: number | null
  change_lrd: number | null
  photo_uri: string | null
  transfer_to_user_id: string | null
  transfer_from_user_id: string | null
  linked_transaction_id: string | null
  active: number
  created_by: string
  created_at_local: string
  updated_at_local: string | null
  sync_status: string
}

type DailyCash = {
  local_daily_id: string
  local_project_id: string
  local_user_id: string | null
  date: string
  initial_usd: number
  initial_lrd: number
  actual_usd: number | null
  actual_lrd: number | null
  note: string | null
  created_by: string | null
}

type DaySummary = {
  initialUsd: number
  initialLrd: number
  inUsd: number
  inLrd: number
  outUsd: number
  outLrd: number
  exchangeInUsd: number
  exchangeInLrd: number
  exchangeOutUsd: number
  exchangeOutLrd: number
  expectedUsd: number
  expectedLrd: number
  balanceUsd: number
  balanceLrd: number
  actualCount: number
  peopleCount: number
}

type PhotoPreview = {
  item: Transaction
  previewUrl: string
}

type DailyChartRow = {
  day: string
  inUsd: number
  outUsd: number
  inLrd: number
  outLrd: number
  count: number
}

type CategoryChartRow = {
  category: string
  usd: number
  lrd: number
  count: number
}

type TypeChartRow = {
  type: TransactionType
  count: number
}

const PHOTO_BUCKET = 'transaction-photos'

const T = {
  title: '\u4f1a\u8ba1\u660e\u7ec6\u5de5\u4f5c\u53f0',
  refresh: '\u5237\u65b0',
  refreshing: '\u5237\u65b0\u4e2d',
  exportCsv: '\u5bfc\u51fa CSV',
  readFailed: 'Supabase \u8bfb\u53d6\u5931\u8d25\uff1a',
  project: '\u9879\u76ee',
  allProjects: '\u5168\u90e8\u9879\u76ee',
  person: '\u4eba\u5458',
  allPeople: '\u5168\u90e8\u4eba\u5458',
  month: '\u6708\u4efd',
  search: '\u641c\u7d22',
  searchPlaceholder: '\u7c7b\u522b\u3001\u5907\u6ce8\u3001\u5730\u70b9\u3001\u7c7b\u578b',
  income: '\u6536\u5165',
  expenseTransfer: '\u652f\u51fa/\u8f6c\u8d26',
  exchangeIn: '\u5151\u6362\u5165',
  exchangeOut: '\u5151\u6362\u51fa',
  dailyOverview: '\u6bcf\u65e5\u6c47\u603b',
  days: '\u5929',
  records: '\u7b14\u8bb0\u5f55',
  recordsShort: '\u7b14',
  initial: '\u521d\u59cb',
  expected: '\u5e94\u6709',
  actualBalance: '\u5b9e\u70b9/\u4f59\u989d',
  notEntered: '\u672a\u5f55\u5165',
  actualNotEntered: '\u5b9e\u70b9\u672a\u5f55\u5165',
  cashboxBalance: '\u94b1\u7bb1\u4f59\u989d',
  noData: '\u8fd9\u4e2a\u6708\u6682\u65e0\u8bb0\u5f55',
  time: '\u65f6\u95f4',
  createdTime: '\u5f55\u5165\u65f6\u95f4',
  creator: '\u5f55\u5165\u4eba',
  type: '\u7c7b\u578b',
  amount: '\u91d1\u989d',
  category: '\u7c7b\u522b',
  area: '\u5730\u70b9',
  change: '\u627e\u96f6',
  note: '\u5907\u6ce8',
  photo: '\u7167\u7247',
  sync: '\u540c\u6b65',
  hasPhoto: '\u6709',
  loadingPhoto: '\u52a0\u8f7d\u4e2d',
  viewPhoto: '\u67e5\u770b\u7167\u7247',
  downloadPhoto: '\u4e0b\u8f7d\u7167\u7247',
  close: '\u5173\u95ed',
  photoUnavailable: '\u7167\u7247\u6682\u65f6\u65e0\u6cd5\u6253\u5f00',
  expense: '\u652f\u51fa',
  cashIn: '\u73b0\u91d1\u6536\u5165',
  exchange: '\u8d27\u5e01\u5151\u6362',
  transfer: '\u7ecf\u7406\u8f6c\u8d26',
}

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function normalizeDate(value: string | null | undefined) {
  const text = String(value ?? '')
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text.slice(0, 10)
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function normalizeMonth(value: string | null | undefined) {
  return normalizeDate(value).slice(0, 7)
}

function formatTime(value: string | null | undefined) {
  const parsed = new Date(String(value ?? ''))
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value: string | null | undefined) {
  const parsed = new Date(String(value ?? ''))
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString()
}

function getPhotoPath(uri: string | null | undefined) {
  const text = String(uri ?? '')
  if (!text) return ''
  if (text.startsWith('storage://')) return text.replace('storage://', '')
  return text
}

async function resolvePhotoUrl(uri: string | null | undefined, size: 'thumb' | 'preview' | 'original' = 'preview') {
  const text = String(uri ?? '')
  if (!text) return ''
  if (text.startsWith('http://') || text.startsWith('https://')) return text
  const path = getPhotoPath(text)
  if (!path || path.startsWith('file://')) return ''
  const transform = size === 'thumb'
    ? { width: 96, height: 96, resize: 'cover' as const, quality: 55 }
    : size === 'preview'
      ? { width: 1200, height: 900, resize: 'contain' as const, quality: 70 }
      : undefined
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60, transform ? { transform } : undefined)
  if (error) throw error
  return data.signedUrl
}

function typeLabel(type: TransactionType) {
  if (type === 'expense') return T.expense
  if (type === 'cash_in') return T.cashIn
  if (type === 'exchange') return T.exchange
  return T.transfer
}

function amountText(item: Transaction) {
  if (item.type === 'exchange') {
    return `${item.from_currency ?? ''} ${money(item.from_amount)} -> ${item.to_currency ?? ''} ${money(item.to_amount)}`
  }
  const sign = item.type === 'cash_in' ? '+' : '-'
  return `${sign}${item.currency} ${money(item.amount)}`
}

function addFlow(row: Transaction, target: { inUsd: number; outUsd: number; inLrd: number; outLrd: number }) {
  if (row.type === 'cash_in') {
    if (row.currency === 'USD') target.inUsd += Number(row.amount) || 0
    if (row.currency === 'LRD') target.inLrd += Number(row.amount) || 0
  }
  if (row.type === 'expense' || row.type === 'transfer') {
    if (row.currency === 'USD') target.outUsd += Number(row.amount) || 0
    if (row.currency === 'LRD') target.outLrd += Number(row.amount) || 0
  }
  if (row.type === 'expense') {
    target.inUsd += Number(row.change_usd) || 0
    target.inLrd += Number(row.change_lrd) || 0
  }
  if (row.type === 'exchange') {
    if (row.from_currency === 'USD') target.outUsd += Number(row.from_amount) || 0
    if (row.from_currency === 'LRD') target.outLrd += Number(row.from_amount) || 0
    if (row.to_currency === 'USD') target.inUsd += Number(row.to_amount) || 0
    if (row.to_currency === 'LRD') target.inLrd += Number(row.to_amount) || 0
  }
}

function blankSummary(): DaySummary {
  return {
    initialUsd: 0,
    initialLrd: 0,
    inUsd: 0,
    inLrd: 0,
    outUsd: 0,
    outLrd: 0,
    exchangeInUsd: 0,
    exchangeInLrd: 0,
    exchangeOutUsd: 0,
    exchangeOutLrd: 0,
    expectedUsd: 0,
    expectedLrd: 0,
    balanceUsd: 0,
    balanceLrd: 0,
    actualCount: 0,
    peopleCount: 0,
  }
}

function addToSummary(total: DaySummary, row: Transaction) {
  if (row.type === 'cash_in') {
    if (row.currency === 'USD') total.inUsd += Number(row.amount) || 0
    if (row.currency === 'LRD') total.inLrd += Number(row.amount) || 0
  }
  if (row.type === 'expense' || row.type === 'transfer') {
    if (row.currency === 'USD') total.outUsd += Number(row.amount) || 0
    if (row.currency === 'LRD') total.outLrd += Number(row.amount) || 0
  }
  if (row.type === 'expense') {
    total.inUsd += Number(row.change_usd) || 0
    total.inLrd += Number(row.change_lrd) || 0
  }
  if (row.type === 'exchange') {
    if (row.from_currency === 'USD') total.exchangeOutUsd += Number(row.from_amount) || 0
    if (row.from_currency === 'LRD') total.exchangeOutLrd += Number(row.from_amount) || 0
    if (row.to_currency === 'USD') total.exchangeInUsd += Number(row.to_amount) || 0
    if (row.to_currency === 'LRD') total.exchangeInLrd += Number(row.to_amount) || 0
  }
  return total
}

function cashOwner(row: DailyCash) {
  return row.local_user_id ?? row.created_by ?? ''
}

function applyCashToSummary(total: DaySummary, cashRows: DailyCash[], rows: Transaction[], singleUser: boolean) {
  const transactionUsers = new Set(rows.map((row) => row.created_by))
  const cashByUser = new Map<string, DailyCash>()
  cashRows.forEach((row) => {
    const owner = cashOwner(row)
    if (owner) cashByUser.set(owner, row)
  })
  transactionUsers.forEach((owner) => {
    if (!cashByUser.has(owner)) {
      cashByUser.set(owner, {
        local_daily_id: '',
        local_project_id: '',
        local_user_id: owner,
        date: '',
        initial_usd: 0,
        initial_lrd: 0,
        actual_usd: null,
        actual_lrd: null,
        note: null,
        created_by: owner,
      })
    }
  })

  total.initialUsd = 0
  total.initialLrd = 0
  total.expectedUsd = 0
  total.expectedLrd = 0
  total.balanceUsd = 0
  total.balanceLrd = 0
  total.actualCount = 0
  total.peopleCount = cashByUser.size

  for (const [owner, cash] of cashByUser) {
    const userSummary = rows.filter((row) => row.created_by === owner).reduce(addToSummary, blankSummary())
    const expectedUsd =
      Number(cash.initial_usd) +
      userSummary.inUsd +
      userSummary.exchangeInUsd -
      userSummary.outUsd -
      userSummary.exchangeOutUsd
    const expectedLrd =
      Number(cash.initial_lrd) +
      userSummary.inLrd +
      userSummary.exchangeInLrd -
      userSummary.outLrd -
      userSummary.exchangeOutLrd
    const hasActual = cash.actual_usd !== null || cash.actual_lrd !== null
    total.initialUsd += Number(cash.initial_usd) || 0
    total.initialLrd += Number(cash.initial_lrd) || 0
    total.expectedUsd += expectedUsd
    total.expectedLrd += expectedLrd
    if (hasActual) total.actualCount += 1
    total.balanceUsd += singleUser && !hasActual ? 0 : cash.actual_usd ?? expectedUsd
    total.balanceLrd += singleUser && !hasActual ? 0 : cash.actual_lrd ?? expectedLrd
  }
  return total
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(rows: Transaction[], projects: Project[], users: User[], month: string) {
  const projectName = (id: string) => projects.find((project) => project.local_project_id === id)?.project_name ?? id
  const userName = (id: string) => users.find((user) => user.local_user_id === id)?.name ?? id
  const header = [T.createdTime, T.amount, T.category, T.area, T.change, T.note, T.photo, T.project, T.creator, T.type, T.sync]
  const body = rows.map((row) => [
    formatDateTime(row.created_at_local || row.date),
    amountText(row),
    row.category,
    row.area ?? '',
    Number(row.change_usd || row.change_lrd) ? `USD ${money(row.change_usd)} / LRD ${money(row.change_lrd)}` : '',
    row.note ?? '',
    row.photo_uri ? T.hasPhoto : '',
    projectName(row.local_project_id),
    userName(row.created_by),
    typeLabel(row.type),
    row.sync_status,
  ])
  const csv = [header, ...body].map((line) => line.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `cashbox-${month}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function downloadPhoto(preview: PhotoPreview) {
  const originalUrl = await resolvePhotoUrl(preview.item.photo_uri, 'original')
  const response = await fetch(originalUrl || preview.previewUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${preview.item.transaction_no || preview.item.local_transaction_id}.jpg`
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginName, setLoginName] = useState('admin')
  const [loginPassword, setLoginPassword] = useState('admin')
  const [loginError, setLoginError] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dailyCash, setDailyCash] = useState<DailyCash[]>([])
  const [projectId, setProjectId] = useState('all')
  const [userId, setUserId] = useState('all')
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [projectResult, userResult, projectUserResult, transactionResult, dailyCashResult] = await Promise.all([
      supabase.from('projects').select('*').order('project_name'),
      supabase.from('users').select('*').order('name'),
      supabase.from('project_users').select('*').eq('active', 1),
      supabase.from('transactions').select('*').eq('active', 1).order('date', { ascending: false }).limit(3000),
      supabase.from('daily_cash').select('*').order('date', { ascending: false }).limit(3000),
    ])
    setLoading(false)
    const firstError = projectResult.error || userResult.error || projectUserResult.error || transactionResult.error || dailyCashResult.error
    if (firstError) {
      setError(firstError.message)
      return
    }
    setProjects((projectResult.data ?? []) as Project[])
    setUsers((userResult.data ?? []) as User[])
    setProjectUsers((projectUserResult.data ?? []) as ProjectUser[])
    setTransactions((transactionResult.data ?? []) as Transaction[])
    setDailyCash((dailyCashResult.data ?? []) as DailyCash[])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const allowedProjectIds = useMemo(() => {
    if (!currentUser) return new Set<string>()
    if (currentUser.role === 'admin') return new Set(projects.map((project) => project.local_project_id))
    return new Set(projectUsers.filter((item) => item.local_user_id === currentUser.local_user_id).map((item) => item.local_project_id))
  }, [currentUser, projectUsers, projects])

  const visibleProjects = useMemo(() => projects.filter((project) => allowedProjectIds.has(project.local_project_id)), [allowedProjectIds, projects])

  const visibleUsers = useMemo(() => {
    if (currentUser?.role === 'admin') return users
    const ids = new Set(projectUsers.filter((item) => allowedProjectIds.has(item.local_project_id)).map((item) => item.local_user_id))
    return users.filter((user) => ids.has(user.local_user_id))
  }, [allowedProjectIds, currentUser, projectUsers, users])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions.filter((item) => {
      if (!allowedProjectIds.has(item.local_project_id)) return false
      if (projectId !== 'all' && item.local_project_id !== projectId) return false
      if (userId !== 'all' && item.created_by !== userId) return false
      if (month && normalizeMonth(item.date) !== month) return false
      if (!term) return true
      return [item.transaction_no, item.category, item.note, item.area, typeLabel(item.type)].some((value) =>
        String(value ?? '').toLowerCase().includes(term),
      )
    })
  }, [allowedProjectIds, month, projectId, search, transactions, userId])

  const summary = useMemo(() => filtered.reduce(addToSummary, blankSummary()), [filtered])

  const dailyChart = useMemo(() => {
    const map = new Map<string, DailyChartRow>()
    filtered.forEach((row) => {
      const day = normalizeDate(row.date)
      const item = map.get(day) ?? { day, inUsd: 0, outUsd: 0, inLrd: 0, outLrd: 0, count: 0 }
      addFlow(row, item)
      item.count += 1
      map.set(day, item)
    })
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day))
  }, [filtered])

  const categoryChart = useMemo(() => {
    const map = new Map<string, CategoryChartRow>()
    filtered
      .filter((row) => row.type === 'expense' || row.type === 'cash_in' || row.type === 'transfer')
      .forEach((row) => {
        const item = map.get(row.category) ?? { category: row.category, usd: 0, lrd: 0, count: 0 }
        if (row.currency === 'USD') item.usd += Number(row.amount) || 0
        if (row.currency === 'LRD') item.lrd += Number(row.amount) || 0
        item.count += 1
        map.set(row.category, item)
      })
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [filtered])

  const typeChart = useMemo(() => {
    const map = new Map<TransactionType, number>()
    filtered.forEach((row) => map.set(row.type, (map.get(row.type) ?? 0) + 1))
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }))
  }, [filtered])

  const filteredDailyCash = useMemo(() => {
    return dailyCash.filter((item) => {
      if (projectId !== 'all' && item.local_project_id !== projectId) return false
      if (!allowedProjectIds.has(item.local_project_id)) return false
      if (userId !== 'all' && cashOwner(item) !== userId) return false
      if (month && normalizeMonth(item.date) !== month) return false
      return true
    })
  }, [allowedProjectIds, dailyCash, month, projectId, userId])

  useEffect(() => {
    let mounted = true
    const rowsWithPhotos = filtered.filter((item) => item.photo_uri && !photoUrls[item.local_transaction_id])
    if (!rowsWithPhotos.length) return undefined

    Promise.all(
      rowsWithPhotos.map(async (item) => {
        try {
          return [item.local_transaction_id, await resolvePhotoUrl(item.photo_uri, 'thumb')] as const
        } catch {
          return [item.local_transaction_id, ''] as const
        }
      }),
    ).then((entries) => {
      if (!mounted) return
      setPhotoUrls((current) => {
        const next = { ...current }
        entries.forEach(([id, url]) => {
          next[id] = url
        })
        return next
      })
    })

    return () => {
      mounted = false
    }
  }, [filtered, photoUrls])

  const dayGroups = useMemo(() => {
    const map = new Map<string, { day: string; rows: Transaction[]; cashRows: DailyCash[]; summary: DaySummary }>()
    filtered.forEach((row) => {
      const day = normalizeDate(row.date)
      const group = map.get(day) ?? { day, rows: [], cashRows: [], summary: blankSummary() }
      group.rows.push(row)
      addToSummary(group.summary, row)
      map.set(day, group)
    })
    filteredDailyCash.forEach((cash) => {
      const day = normalizeDate(cash.date)
      const group = map.get(day) ?? { day, rows: [], cashRows: [], summary: blankSummary() }
      group.cashRows.push(cash)
      map.set(day, group)
    })
    map.forEach((group) => {
      group.rows.sort((a, b) => (a.created_at_local || a.date).localeCompare(b.created_at_local || b.date))
      applyCashToSummary(group.summary, group.cashRows, group.rows, userId !== 'all')
    })
    return Array.from(map.values())
      .filter((group) => group.rows.length > 0)
      .sort((a, b) => b.day.localeCompare(a.day))
  }, [filtered, filteredDailyCash, userId])

  const projectName = (id: string) => projects.find((project) => project.local_project_id === id)?.project_name ?? id
  const userName = (id: string) => users.find((user) => user.local_user_id === id)?.name ?? id

  const submitLogin = (event: FormEvent) => {
    event.preventDefault()
    const user = users.find((item) => item.username === loginName.trim() && item.password === loginPassword && item.active === 1)
    if (!user) {
      setLoginError('\u7528\u6237\u540d\u6216\u5bc6\u7801\u4e0d\u6b63\u786e')
      return
    }
    setCurrentUser(user)
    setLoginError('')
    setProjectId('all')
    setUserId('all')
  }

  if (!currentUser) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={submitLogin}>
          <p className="eyebrow">Gold Field Cashbox</p>
          <h1>{'\u4f1a\u8ba1\u660e\u7ec6\u767b\u5f55'}</h1>
          {error ? <div className="error">{T.readFailed}{error}</div> : null}
          {loginError ? <div className="error">{loginError}</div> : null}
          <label>
            {'\u7528\u6237\u540d'}
            <input value={loginName} onChange={(event) => setLoginName(event.target.value)} />
          </label>
          <label>
            {'\u5bc6\u7801'}
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>
          <button type="submit" className="button primary">{'\u767b\u5f55'}</button>
        </form>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gold Field Cashbox</p>
          <h1>{T.title}</h1>
          <p className="userline">{currentUser.name} / {currentUser.role === 'admin' ? '\u7ba1\u7406\u5458' : currentUser.role === 'viewer' ? '\u67e5\u770b\u5458' : '\u7ecf\u7406'}</p>
        </div>
        <div className="top-actions">
          <button type="button" className="button secondary" onClick={() => void load()}>
            {loading ? T.refreshing : T.refresh}
          </button>
          <button type="button" className="button primary" onClick={() => downloadCsv(filtered, projects, users, month)}>
            {T.exportCsv}
          </button>
          <button type="button" className="button secondary" onClick={() => setCurrentUser(null)}>
            {'\u9000\u51fa'}
          </button>
        </div>
      </header>

      {error ? <div className="error">{T.readFailed}{error}</div> : null}

      <section className="filters">
        <label>
          {T.project}
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="all">{T.allProjects}</option>
            {visibleProjects.map((project) => (
              <option key={project.local_project_id} value={project.local_project_id}>{project.project_name}</option>
            ))}
          </select>
        </label>
        <label>
          {T.person}
          <select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="all">{T.allPeople}</option>
            {visibleUsers.map((user) => (
              <option key={user.local_user_id} value={user.local_user_id}>{user.name}</option>
            ))}
          </select>
        </label>
        <label>
          {T.month}
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="search">
          {T.search}
          <span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={T.searchPlaceholder} />
          </span>
        </label>
      </section>

      <section className="summary-grid">
        <SummaryCard title={T.income} usd={summary.inUsd} lrd={summary.inLrd} tone="good" />
        <SummaryCard title={T.expenseTransfer} usd={summary.outUsd} lrd={summary.outLrd} tone="bad" />
        <SummaryCard title={T.exchangeIn} usd={summary.exchangeInUsd} lrd={summary.exchangeInLrd} />
        <SummaryCard title={T.exchangeOut} usd={summary.exchangeOutUsd} lrd={summary.exchangeOutLrd} />
      </section>

      <StatsCharts daily={dailyChart} categories={categoryChart} types={typeChart} />

      <section className="days-shell">
        <div className="table-title">
          <strong>{T.dailyOverview}</strong>
          <span>{dayGroups.length} {T.days} / {filtered.length} {T.records}</span>
        </div>
        {dayGroups.map((group) => {
          const open = openDays[group.day] ?? false
          const actualText = userId !== 'all' && group.summary.actualCount === 0
            ? T.notEntered
            : `USD ${money(group.summary.balanceUsd)} / LRD ${money(group.summary.balanceLrd)}`
          return (
            <section className="day-group" key={group.day}>
              <button type="button" className="day-header" onClick={() => setOpenDays((current) => ({ ...current, [group.day]: !open }))}>
                <div className="day-main">
                  <span className="chevron">{open ? '-' : '+'}</span>
                  <strong>{group.day}</strong>
                  <span>{group.rows.length} {T.recordsShort}</span>
                </div>
                <div className="day-summary">
                  <span>{T.initial} USD {money(group.summary.initialUsd)} / LRD {money(group.summary.initialLrd)}</span>
                  <span className="good">{T.income} USD {money(group.summary.inUsd)} / LRD {money(group.summary.inLrd)}</span>
                  <span className="bad">{T.expenseTransfer} USD {money(group.summary.outUsd)} / LRD {money(group.summary.outLrd)}</span>
                  <span>{T.expected} USD {money(group.summary.expectedUsd)} / LRD {money(group.summary.expectedLrd)}</span>
                  <span>{T.actualBalance} {actualText}</span>
                </div>
              </button>
              {open ? (
                <div className="day-detail">
                  <div className="table-wrap day-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{T.time}</th>
                          <th>{T.amount}</th>
                          <th>{T.category}</th>
                          <th>{T.area}</th>
                          <th>{T.change}</th>
                          <th>{T.note}</th>
                          <th>{T.photo}</th>
                          <th>{T.project}</th>
                          <th>{T.creator}</th>
                          <th>{T.type}</th>
                          <th>{T.sync}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((item) => (
                          <tr key={item.local_transaction_id}>
                            <td>{formatTime(item.created_at_local || item.date)}</td>
                            <td className={item.type === 'cash_in' ? 'amount good' : item.type === 'exchange' ? 'amount exchange' : 'amount bad'}>{amountText(item)}</td>
                            <td>{item.category}</td>
                            <td>{item.area ?? ''}</td>
                            <td>{Number(item.change_usd || item.change_lrd) ? `USD ${money(item.change_usd)} / LRD ${money(item.change_lrd)}` : ''}</td>
                            <td className="note">{item.note ?? ''}</td>
                            <td>
                              {item.photo_uri ? (
                                <button
                                  type="button"
                                  className="photo-thumb"
                                  onClick={() => {
                                    const url = photoUrls[item.local_transaction_id]
                                    if (url) void resolvePhotoUrl(item.photo_uri, 'preview').then((previewUrl) => setPhotoPreview({ item, previewUrl: previewUrl || url }))
                                  }}
                                  title={T.viewPhoto}
                                >
                                  {photoUrls[item.local_transaction_id] ? (
                                    <img src={photoUrls[item.local_transaction_id]} alt={T.photo} />
                                  ) : (
                                    <span>{T.loadingPhoto}</span>
                                  )}
                                </button>
                              ) : null}
                            </td>
                            <td>{projectName(item.local_project_id)}</td>
                            <td>{userName(item.created_by)}</td>
                            <td><span className={`pill ${item.type}`}>{typeLabel(item.type)}</span></td>
                            <td>{item.sync_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>
          )
        })}
        {dayGroups.length === 0 ? <div className="empty">{T.noData}</div> : null}
      </section>

      {photoPreview ? (
        <div className="photo-modal" role="dialog" aria-modal="true" onClick={() => setPhotoPreview(null)}>
          <div className="photo-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="photo-modal-header">
              <div>
                <strong>{T.viewPhoto}</strong>
                <span>{formatDateTime(photoPreview.item.created_at_local || photoPreview.item.date)} / {typeLabel(photoPreview.item.type)} / {amountText(photoPreview.item)}</span>
              </div>
              <button type="button" className="button secondary" onClick={() => setPhotoPreview(null)}>{T.close}</button>
            </div>
            <img className="photo-large" src={photoPreview.previewUrl} alt={T.photo} />
            <div className="photo-modal-actions">
              <button type="button" className="button primary" onClick={() => void downloadPhoto(photoPreview)}>{T.downloadPhoto}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function SummaryCard({
  title,
  usd,
  lrd,
  tone,
  muted,
}: {
  title: string
  usd: number
  lrd: number
  tone?: 'good' | 'bad'
  muted?: boolean
}) {
  return (
    <div className="summary-card">
      <p>{title}</p>
      {muted ? (
        <strong className="muted">{T.notEntered}</strong>
      ) : (
        <>
          <strong className={tone ?? ''}>USD {money(usd)}</strong>
          <strong className={tone ?? ''}>LRD {money(lrd)}</strong>
        </>
      )}
    </div>
  )
}

function StatsCharts({ daily, categories, types }: { daily: DailyChartRow[]; categories: CategoryChartRow[]; types: TypeChartRow[] }) {
  const maxUsd = Math.max(1, ...daily.map((item) => Math.max(item.inUsd, item.outUsd)))
  const maxLrd = Math.max(1, ...daily.map((item) => Math.max(item.inLrd, item.outLrd)))
  const maxCategoryCount = Math.max(1, ...categories.map((item) => item.count))
  const totalTypeCount = Math.max(1, types.reduce((total, item) => total + item.count, 0))
  const colors: Record<TransactionType, string> = {
    cash_in: '#047857',
    expense: '#b91c1c',
    exchange: '#1d4ed8',
    transfer: '#7c5c16',
  }
  const pieStops = types.reduce<{ cursor: number; stops: string[] }>((state, item) => {
    const start = state.cursor
    const end = start + (item.count / totalTypeCount) * 100
    return {
      cursor: end,
      stops: [...state.stops, `${colors[item.type]} ${start}% ${end}%`],
    }
  }, { cursor: 0, stops: [] }).stops.join(', ')

  return (
    <section className="stats-grid">
      <div className="chart-card wide">
        <div className="chart-title">
          <strong>{'\u6bcf\u65e5\u6536\u652f\u8d8b\u52bf'}</strong>
          <span>{'\u6309\u5f53\u524d\u7b5b\u9009'}</span>
        </div>
        <div className="histogram">
          {daily.length ? daily.map((item) => (
            <div className="day-bars" key={item.day} title={`${item.day} / ${item.count} ${T.recordsShort}`}>
              <div className="bar-pair">
                <span className="bar good-bg" style={{ height: `${Math.max(4, (item.inUsd / maxUsd) * 100)}%` }} />
                <span className="bar bad-bg" style={{ height: `${Math.max(4, (item.outUsd / maxUsd) * 100)}%` }} />
              </div>
              <div className="bar-pair lrd-bars">
                <span className="bar good-bg" style={{ height: `${Math.max(4, (item.inLrd / maxLrd) * 100)}%` }} />
                <span className="bar bad-bg" style={{ height: `${Math.max(4, (item.outLrd / maxLrd) * 100)}%` }} />
              </div>
              <span className="day-label">{item.day.slice(5)}</span>
            </div>
          )) : <div className="empty mini">{T.noData}</div>}
        </div>
        <div className="legend">
          <span><i className="legend-dot good-bg" />USD/LRD {T.income}</span>
          <span><i className="legend-dot bad-bg" />USD/LRD {T.expenseTransfer}</span>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">
          <strong>{'\u7c7b\u522b\u5206\u5e03'}</strong>
          <span>{'\u6309\u7b14\u6570\u6392\u5e8f'}</span>
        </div>
        <div className="category-bars">
          {categories.length ? categories.map((item) => (
            <div className="category-row" key={item.category}>
              <div className="category-head">
                <strong>{item.category}</strong>
                <span>{item.count} {T.recordsShort}</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} />
              </div>
              <small>USD {money(item.usd)} / LRD {money(item.lrd)}</small>
            </div>
          )) : <div className="empty mini">{T.noData}</div>}
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">
          <strong>{'\u7c7b\u578b\u5360\u6bd4'}</strong>
          <span>{filteredTypeCount(types)} {T.records}</span>
        </div>
        <div className="pie-wrap">
          <div className="pie" style={{ background: pieStops ? `conic-gradient(${pieStops})` : '#e5e7eb' }} />
          <div className="pie-legend">
            {types.length ? types.map((item) => (
              <span key={item.type}><i className="legend-dot" style={{ background: colors[item.type] }} />{typeLabel(item.type)} {Math.round((item.count / totalTypeCount) * 100)}%</span>
            )) : <span>{T.noData}</span>}
          </div>
        </div>
      </div>
    </section>
  )
}

function filteredTypeCount(types: TypeChartRow[]) {
  return types.reduce((total, item) => total + item.count, 0)
}

export default App
