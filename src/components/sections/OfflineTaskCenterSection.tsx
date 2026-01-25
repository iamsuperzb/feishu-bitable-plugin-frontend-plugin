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

const formatTaskTitle = (tr: OfflineTaskCenterSectionProps['tr'], task: OfflineTaskSummary) => {
  const main = task.keyword || task.username
  const parts = [main, task.tableName].filter(Boolean)
  if (parts.length > 0) return parts.join('｜')
  return tr('任务')
}

const formatTaskSource = (tr: OfflineTaskCenterSectionProps['tr'], type?: string) => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'keyword') return tr('关键词采集')
  if (normalized === 'account') return tr('账号采集')
  if (normalized === 'accountinfo' || normalized === 'account_info') return tr('账号信息采集')
  if (normalized === 'audio') return tr('音频转写')
  return type ? String(type) : tr('其他')
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
    baseId,
    onBaseIdChange,
    authTokenInput,
    onAuthTokenInputChange,
    authStatus,
    authSaving,
    onSaveAuth,
    settingsLocked
  } = props

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
      </div>
    </div>
  )
}
