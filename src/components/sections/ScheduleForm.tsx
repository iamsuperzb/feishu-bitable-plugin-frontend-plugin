import { useEffect, useMemo, useState } from 'react'
import type { OfflineScheduleConfig, OfflineScheduleMode } from '../../types/offline'

interface ScheduleFormProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  disabled?: boolean
  maxReached?: boolean
  submitLabel?: string
  onSubmit: (value: OfflineScheduleConfig) => void
  initialValue?: OfflineScheduleConfig | null
  onCancel?: () => void
}

const pad = (value: number) => String(value).padStart(2, '0')

const formatDateInput = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatDateInputFromDate = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
)

const parseDateInput = (value: string) => {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return ''
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

const buildDefaultStart = () => {
  const date = new Date(Date.now() + 10 * 60 * 1000)
  return formatDateInputFromDate(date)
}

export default function ScheduleForm(props: ScheduleFormProps) {
  const {
    tr,
    disabled,
    maxReached,
    submitLabel,
    onSubmit,
    initialValue,
    onCancel
  } = props

  const [mode, setMode] = useState<OfflineScheduleMode>('once')
  const [startAt, setStartAt] = useState(buildDefaultStart())
  const [endAt, setEndAt] = useState('')
  const [intervalDays, setIntervalDays] = useState('7')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialValue) return
    setMode(initialValue.mode || 'once')
    setStartAt(formatDateInput(initialValue.startAt) || buildDefaultStart())
    setEndAt(formatDateInput(initialValue.endAt) || '')
    setIntervalDays(
      initialValue.intervalDays ? String(initialValue.intervalDays) : '7'
    )
  }, [initialValue])

  const intervalValue = useMemo(() => {
    const value = Number(intervalDays)
    return Number.isFinite(value) && value > 0 ? value : 0
  }, [intervalDays])

  const handleSubmit = () => {
    if (disabled || maxReached) return
    if (!startAt) {
      setError(tr('请填写开始时间'))
      return
    }
    if (mode === 'interval' && !intervalValue) {
      setError(tr('请填写间隔天数'))
      return
    }
    const startIso = parseDateInput(startAt)
    if (!startIso) {
      setError(tr('开始时间无效'))
      return
    }
    const endIso = endAt ? parseDateInput(endAt) : ''
    if (endAt && !endIso) {
      setError(tr('结束时间无效'))
      return
    }
    if (endIso && startIso >= endIso) {
      setError(tr('结束时间需晚于开始时间'))
      return
    }
    setError('')
    onSubmit({
      mode,
      startAt: startIso,
      endAt: endIso || '',
      intervalDays: mode === 'interval' ? intervalValue : undefined
    })
  }

  return (
    <div className="schedule-form">
      <div className="form-item full-width">
        <label>{tr('执行频率:')}</label>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as OfflineScheduleMode)}
          disabled={disabled}
          className="select-styled"
        >
          <option value="once">{tr('只执行一次')}</option>
          <option value="daily">{tr('每天')}</option>
          <option value="weekly">{tr('每周')}</option>
          <option value="monthly">{tr('每月')}</option>
          <option value="interval">{tr('每X天')}</option>
        </select>
      </div>

      {mode === 'interval' && (
        <div className="form-item full-width">
          <label>{tr('间隔天数:')}</label>
          <input
            type="number"
            min="1"
            value={intervalDays}
            onChange={(event) => setIntervalDays(event.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      <div className="form-item full-width">
        <label>{tr('开始时间:')}</label>
        <input
          type="datetime-local"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
          disabled={disabled}
        />
      </div>

      {mode !== 'once' && (
        <div className="form-item full-width">
          <label>{tr('结束时间:')}</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            disabled={disabled}
          />
          <div className="offline-muted">{tr('可不填')}</div>
        </div>
      )}

      {maxReached && (
        <div className="offline-auth-tip missing">
          {tr('定时任务数量已达上限')}
        </div>
      )}
      {error && <div className="offline-auth-tip missing">{error}</div>}

      <div className="schedule-actions">
        <button type="button" onClick={handleSubmit} disabled={disabled || maxReached}>
          {submitLabel || tr('创建定时任务')}
        </button>
        {onCancel && (
          <button type="button" className="schedule-cancel-btn" onClick={onCancel}>
            {tr('取消')}
          </button>
        )}
      </div>
    </div>
  )
}
