export type OfflineScheduleMode = 'once' | 'daily' | 'weekly' | 'monthly' | 'interval'

export type OfflineScheduleStatus = 'active' | 'paused' | 'completed'

export interface OfflineScheduleConfig {
  mode: OfflineScheduleMode
  startAt: string
  endAt?: string
  intervalDays?: number
}

export interface OfflineScheduleSummary {
  id: string
  type?: string
  status?: OfflineScheduleStatus
  schedule?: OfflineScheduleConfig
  payload?: Record<string, unknown>
  nextRunAt?: string
  lastRunAt?: string
  lastTaskId?: string
  createdAt?: string
  updatedAt?: string
  hashtag?: string
  keyword?: string
  username?: string
  tableName?: string
}

export interface OfflineScheduleLogEntry {
  at: string
  type?: string
  note?: string
}

export interface OfflineScheduleRunLogEntry {
  at: string
  status?: string
  taskId?: string
  note?: string
  summary?: {
    fetched?: number
    written?: number
    skipped?: number
    failed?: number
  }
}

export interface OfflineScheduleLogs {
  messages: OfflineScheduleLogEntry[]
  runs: OfflineScheduleRunLogEntry[]
}
