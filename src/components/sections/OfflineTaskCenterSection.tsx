import { useState } from 'react'
import ScheduleForm from './ScheduleForm'
import type { OfflineScheduleConfig, OfflineScheduleLogs, OfflineScheduleSummary } from '../../types/offline'

interface OfflineTaskProgress {
  fetched?: number
  written?: number
  failed?: number
  skipped?: number
}

interface OfflineTaskSummary {
  id: string
  type?: string
  status?: 'queued' | 'running' | 'completed' | 'stopped'
  progress?: OfflineTaskProgress
  createdAt?: string
  updatedAt?: string
  hashtag?: string
  keyword?: string
  username?: string
  tableName?: string
}

interface TaskTitleItem {
  hashtag?: string
  keyword?: string
  username?: string
  tableName?: string
}

interface OfflineTaskCenterSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  tasks: OfflineTaskSummary[]
  loading: boolean
  schedules: OfflineScheduleSummary[]
  scheduleLoading: boolean
  scheduleLogs: Record<string, OfflineScheduleLogs | undefined>
  scheduleLogsLoading: Record<string, boolean | undefined>
  scheduleActionLoading: Record<string, boolean | undefined>
  onLoadScheduleLogs: (scheduleId: string) => void
  onToggleScheduleStatus: (scheduleId: string, status: 'active' | 'paused') => void
  onDeleteSchedule: (scheduleId: string) => void
  onRunScheduleOnce: (scheduleId: string) => void
  onUpdateSchedule: (scheduleId: string, schedule: OfflineScheduleConfig) => void
  baseId: string
  onBaseIdChange: (value: string) => void
  authTokenInput: string
  onAuthTokenInputChange: (value: string) => void
  authStatus: 'loading' | 'missing' | 'ready'
  authSaving: boolean
  onSaveAuth: () => void
  settingsLocked?: boolean
}

const formatStatusText = (tr: OfflineTaskCenterSectionProps['tr'], status?: string) => {
  if (status === 'queued') return tr('排队中')
  if (status === 'running') return tr('运行中')
  if (status === 'completed') return tr('已完成')
  if (status === 'stopped') return tr('已停止')
  return tr('未知')
}

const formatTaskTitle = (tr: OfflineTaskCenterSectionProps['tr'], task: TaskTitleItem) => {
  const main = task.hashtag || task.keyword || task.username
  const parts = [main, task.tableName].filter(Boolean)
  if (parts.length > 0) return parts.join('｜')
  return tr('任务')
}

const formatTaskSource = (tr: OfflineTaskCenterSectionProps['tr'], type?: string) => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'hashtag') return tr('hashtag监控')
  if (normalized === 'keyword') return tr('关键词采集')
  if (normalized === 'account') return tr('账号采集')
  if (normalized === 'accountinfo' || normalized === 'account_info' || normalized === 'account-info') return tr('账号信息采集')
  if (normalized === 'audio') return tr('音频转写')
  return type ? String(type) : tr('其他')
}

const formatScheduleStatus = (tr: OfflineTaskCenterSectionProps['tr'], status?: string) => {
  if (status === 'active') return tr('已启用')
  if (status === 'paused') return tr('已暂停')
  if (status === 'completed') return tr('已结束')
  return tr('未知')
}

const formatScheduleMode = (tr: OfflineTaskCenterSectionProps['tr'], schedule?: OfflineScheduleSummary['schedule']) => {
  const mode = schedule?.mode
  if (mode === 'once') return tr('只执行一次')
  if (mode === 'daily') return tr('每天')
  if (mode === 'weekly') return tr('每周')
  if (mode === 'monthly') return tr('每月')
  if (mode === 'interval') return tr(`每${schedule?.intervalDays || 1}天`)
  return tr('未知')
}

const formatLogType = (tr: OfflineTaskCenterSectionProps['tr'], type?: string) => {
  if (type === 'start') return tr('开始')
  if (type === 'running') return tr('进行中')
  if (type === 'completed') return tr('完成')
  if (type === 'stopped') return tr('停止')
  if (type === 'skipped') return tr('跳过')
  if (type === 'failed') return tr('失败')
  return tr('未知')
}

const formatTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatCount = (value?: number) => (
  typeof value === 'number' ? value : 0
)

export default function OfflineTaskCenterSection(props: OfflineTaskCenterSectionProps) {
  const {
    tr,
    open,
    onToggle,
    tasks,
    loading,
    schedules,
    scheduleLoading,
    scheduleLogs,
    scheduleLogsLoading,
    scheduleActionLoading,
    onLoadScheduleLogs,
    onToggleScheduleStatus,
    onDeleteSchedule,
    onRunScheduleOnce,
    onUpdateSchedule,
    baseId,
    onBaseIdChange,
    authTokenInput,
    onAuthTokenInputChange,
    authStatus,
    authSaving,
    onSaveAuth,
    settingsLocked
  } = props

  const [editingScheduleId, setEditingScheduleId] = useState('')
  const [openLogIds, setOpenLogIds] = useState<Record<string, boolean>>({})

  const toggleLogs = (scheduleId: string) => {
    setOpenLogIds(prev => {
      const next = { ...prev, [scheduleId]: !prev[scheduleId] }
      return next
    })
    if (!scheduleLogs[scheduleId]) {
      onLoadScheduleLogs(scheduleId)
    }
  }

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>{tr('后台任务中心')}</h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="offline-card">
          <div className="offline-title">{tr('后台任务设置')}</div>
          <div className="form-item full-width">
            <label>{tr('表格编号:')}</label>
            <input
              type="text"
              value={baseId}
              onChange={(event) => onBaseIdChange(event.target.value)}
              placeholder={tr('请填写表格编号')}
              disabled={settingsLocked}
            />
          </div>
          <div className="form-item full-width">
            <label>{tr('授权码:')}</label>
            <div className="redeem-form">
              <input
                type="text"
                className="redeem-input"
                value={authTokenInput}
                onChange={(event) => onAuthTokenInputChange(event.target.value)}
                placeholder={tr('请填写授权码')}
                disabled={authSaving || settingsLocked}
              />
              <button
                type="button"
                className="redeem-open-btn"
                onClick={onSaveAuth}
                disabled={authSaving || !authTokenInput.trim()}
              >
                {authSaving ? tr('保存中...') : tr('保存')}
              </button>
            </div>
            <div className={`offline-auth-tip ${authStatus}`}>
              {authStatus === 'ready' && tr('已保存授权，可直接后台执行')}
              {authStatus === 'missing' && tr('未授权，后台任务无法开始')}
              {authStatus === 'loading' && tr('正在读取授权状态')}
            </div>
          </div>
        </div>
        <div className="offline-card">
          {loading && <div className="offline-muted">{tr('正在读取任务列表...')}</div>}
          {!loading && tasks.length === 0 && (
            <div className="offline-muted">{tr('暂无后台任务')}</div>
          )}
          {!loading && tasks.length > 0 && (
            <div className="offline-list offline-list-scroll">
              {tasks.map(task => (
                <div key={task.id} className="offline-item">
                  <div className="offline-title">{formatTaskTitle(tr, task)}</div>
                  <div className="offline-meta">
                    {tr('来源')}: {formatTaskSource(tr, task.type)}
                  </div>
                  <div className={`offline-status ${task.status || 'unknown'}`}>
                    {formatStatusText(tr, task.status)}
                  </div>
                  <div className="offline-meta">
                    {tr('已获取')} {formatCount(task.progress?.fetched)}，
                    {tr('已写入')} {formatCount(task.progress?.written)}，
                    {tr('已跳过（重复内容）')} {formatCount(task.progress?.skipped)}，
                    {tr('失败')} {formatCount(task.progress?.failed)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="offline-card">
          <div className="offline-title">{tr('定时任务')}</div>
          {scheduleLoading && <div className="offline-muted">{tr('正在读取定时任务...')}</div>}
          {!scheduleLoading && schedules.length === 0 && (
            <div className="offline-muted">{tr('暂无定时任务')}</div>
          )}
          {!scheduleLoading && schedules.length > 0 && (
            <div className="offline-list">
              {schedules.map(schedule => {
                const logs = scheduleLogs[schedule.id]
                const logsOpen = Boolean(openLogIds[schedule.id])
                const actionLoading = Boolean(scheduleActionLoading[schedule.id])
                const isActive = schedule.status === 'active'
                const isCompleted = schedule.status === 'completed'
                return (
                  <div key={schedule.id} className="offline-item">
                    <div className="offline-title">{formatTaskTitle(tr, schedule)}</div>
                    <div className="offline-meta">
                      {tr('来源')}: {formatTaskSource(tr, schedule.type)}
                    </div>
                    <div className={`offline-status ${schedule.status || 'unknown'}`}>
                      {formatScheduleStatus(tr, schedule.status)}
                    </div>
                    <div className="offline-meta">
                      {tr('频率')}: {formatScheduleMode(tr, schedule.schedule)}
                    </div>
                    <div className="offline-meta">
                      {tr('开始时间')}: {formatTime(schedule.schedule?.startAt)}
                    </div>
                    {schedule.schedule?.endAt && (
                      <div className="offline-meta">
                        {tr('结束时间')}: {formatTime(schedule.schedule?.endAt)}
                      </div>
                    )}
                    <div className="offline-meta">
                      {tr('下次执行')}: {formatTime(schedule.nextRunAt)}
                    </div>
                    <div className="offline-meta">
                      {tr('最近执行')}: {formatTime(schedule.lastRunAt)}
                    </div>
                    <div className="offline-actions">
                      <button
                        type="button"
                        className="offline-action-btn"
                        onClick={() => onToggleScheduleStatus(schedule.id, isActive ? 'paused' : 'active')}
                        disabled={actionLoading || isCompleted}
                      >
                        {isActive ? tr('暂停') : tr('恢复')}
                      </button>
                      <button
                        type="button"
                        className="offline-action-btn"
                        onClick={() => setEditingScheduleId(schedule.id)}
                        disabled={actionLoading}
                      >
                        {tr('编辑')}
                      </button>
                      <button
                        type="button"
                        className="offline-action-btn"
                        onClick={() => onRunScheduleOnce(schedule.id)}
                        disabled={actionLoading}
                      >
                        {tr('立即执行一次')}
                      </button>
                      <button
                        type="button"
                        className="offline-action-btn"
                        onClick={() => toggleLogs(schedule.id)}
                        disabled={actionLoading}
                      >
                        {logsOpen ? tr('收起日志') : tr('查看日志')}
                      </button>
                      <button
                        type="button"
                        className="offline-action-btn danger"
                        onClick={() => onDeleteSchedule(schedule.id)}
                        disabled={actionLoading}
                      >
                        {tr('删除')}
                      </button>
                    </div>

                    {editingScheduleId === schedule.id && (
                      <ScheduleForm
                        tr={tr}
                        disabled={actionLoading}
                        submitLabel={tr('保存修改')}
                        initialValue={schedule.schedule || null}
                        onSubmit={(value) => {
                          onUpdateSchedule(schedule.id, value)
                          setEditingScheduleId('')
                        }}
                        onCancel={() => setEditingScheduleId('')}
                      />
                    )}

                    {logsOpen && (
                      <div className="offline-logs">
                        {scheduleLogsLoading[schedule.id] && (
                          <div className="offline-muted">{tr('正在读取日志...')}</div>
                        )}
                        {!scheduleLogsLoading[schedule.id] && (
                          <>
                            <div className="offline-log-block">
                              <div className="offline-title">{tr('消息日志')}</div>
                              {logs?.messages?.length ? (
                                <div className="offline-log-list">
                                  {logs.messages.map((log, index) => (
                                    <div key={`${schedule.id}-msg-${index}`} className="offline-log-item">
                                      <span>{formatTime(log.at)}</span>
                                      <span>{formatLogType(tr, log.type)}</span>
                                      <span>{log.note || '-'}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="offline-muted">{tr('暂无记录')}</div>
                              )}
                            </div>
                            <div className="offline-log-block">
                              <div className="offline-title">{tr('执行日志')}</div>
                              {logs?.runs?.length ? (
                                <div className="offline-log-list">
                                  {logs.runs.map((log, index) => (
                                    <div key={`${schedule.id}-run-${index}`} className="offline-log-item">
                                      <span>{formatTime(log.at)}</span>
                                      <span>{formatLogType(tr, log.status)}</span>
                                      <span>
                                        {tr('已获取')} {formatCount(log.summary?.fetched)}，
                                        {tr('已写入')} {formatCount(log.summary?.written)}，
                                        {tr('已跳过（重复内容）')} {formatCount(log.summary?.skipped)}，
                                        {tr('失败')} {formatCount(log.summary?.failed)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="offline-muted">{tr('暂无记录')}</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
