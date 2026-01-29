import type { IFieldMeta } from '@lark-base-open/js-sdk'
import { adjustHelpTipWithinRoot } from '../../utils/helpTip'
import ScheduleForm from './ScheduleForm'
import type { OfflineScheduleConfig, OfflineScheduleSummary } from '../../types/offline'

type TableTarget = 'current' | 'new'
type AccountInfoMode = 'column' | 'batch'
type AccountInfoRunMode = 'online' | 'offline' | 'schedule'

interface OfflineTaskProgress {
  fetched?: number
  written?: number
  failed?: number
  skipped?: number
  page?: number
}

interface OfflineTaskSummary {
  id: string
  status?: 'queued' | 'running' | 'completed' | 'stopped'
  progress?: OfflineTaskProgress
  createdAt?: string
  updatedAt?: string
  tableName?: string
}

interface OfflineTaskDetail extends OfflineTaskSummary {
  payload?: {
    tableName?: string
  }
  stopReason?: string
}

interface AccountInfoSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  fields: IFieldMeta[]
  accountInfoRunMode: AccountInfoRunMode
  accountInfoBaseId: string
  currentTableId: string
  tableOptions: { id: string; name: string }[]
  accountInfoOfflineAuthStatus: 'ready' | 'missing' | 'loading'
  accountInfoOfflineTasks: OfflineTaskSummary[]
  accountInfoOfflineActiveTask: OfflineTaskSummary | null
  accountInfoOfflineDetail: OfflineTaskDetail | null
  accountInfoOfflineRunning: boolean
  accountInfoOfflineStopping: boolean
  accountInfoScheduleCount: number
  accountInfoScheduleNextRunAt: string
  accountInfoNextSchedule: OfflineScheduleSummary | null
  accountInfoScheduleLimitReached: boolean
  accountInfoScheduleSaving: boolean
  accountInfoMode: AccountInfoMode
  setAccountInfoMode: (val: AccountInfoMode) => void
  accountInfoUsernameField: string
  setAccountInfoUsernameField: (val: string) => void
  accountInfoOverwrite: boolean
  setAccountInfoOverwrite: (val: boolean) => void
  accountInfoColumnTargetTable: TableTarget
  setAccountInfoColumnTargetTable: (val: TableTarget) => void
  accountInfoColumnTargetTableId: string
  setAccountInfoColumnTargetTableId: (val: string) => void
  accountInfoColumnNewTableName: string
  setAccountInfoColumnNewTableName: (val: string) => void
  batchTargetTable: TableTarget
  setBatchTargetTable: (val: TableTarget) => void
  accountInfoBatchTargetTableId: string
  setAccountInfoBatchTargetTableId: (val: string) => void
  newTableName: string
  setNewTableName: (val: string) => void
  accountInfoBatchInput: string
  setAccountInfoBatchInput: (val: string) => void
  accountInfoLoading: boolean
  accountInfoQuotaInsufficient: boolean
  accountInfoSelectedFields: Record<string, boolean>
  accountInfoRequiredFields: Set<string>
  handleAccountInfoFieldChange: (fieldName: string) => void
  handleAccountInfoFetch: () => void
  handleAccountInfoStop: () => void
  setAccountInfoRunMode: (val: AccountInfoRunMode) => void
  onCreateAccountInfoSchedule: (value: OfflineScheduleConfig) => void
}

const ACCOUNT_INFO_FIELD_NAMES = [
  'TT账户名称',
  'TT账户URL',
  'Instagram URL',
  'YouTube URL',
  '关注者数量',
  '点赞数量',
  '视频数量',
  '平均播放量',
  '视频互动率',
  '电子邮件地址',
  '视频创建位置',
  '是否有小店',
  '最后发帖时间',
  '发帖频率',
  '最近拉取时间'
]

export default function AccountInfoSection(props: AccountInfoSectionProps) {
  const {
    tr,
    open,
    onToggle,
    fields,
    accountInfoRunMode,
    accountInfoBaseId,
    currentTableId,
    tableOptions,
    accountInfoOfflineAuthStatus,
    accountInfoOfflineTasks,
    accountInfoOfflineActiveTask,
    accountInfoOfflineDetail,
    accountInfoOfflineRunning,
    accountInfoOfflineStopping,
    accountInfoScheduleCount,
    accountInfoScheduleNextRunAt,
    accountInfoNextSchedule,
    accountInfoScheduleLimitReached,
    accountInfoScheduleSaving,
    accountInfoMode,
    setAccountInfoMode,
    accountInfoUsernameField,
    setAccountInfoUsernameField,
    accountInfoOverwrite,
    setAccountInfoOverwrite,
    accountInfoColumnTargetTable,
    setAccountInfoColumnTargetTable,
    accountInfoColumnTargetTableId,
    setAccountInfoColumnTargetTableId,
    accountInfoColumnNewTableName,
    setAccountInfoColumnNewTableName,
    batchTargetTable,
    setBatchTargetTable,
    accountInfoBatchTargetTableId,
    setAccountInfoBatchTargetTableId,
    newTableName,
    setNewTableName,
    accountInfoBatchInput,
    setAccountInfoBatchInput,
    accountInfoLoading,
    accountInfoQuotaInsufficient,
    accountInfoSelectedFields,
    accountInfoRequiredFields,
    handleAccountInfoFieldChange,
    handleAccountInfoFetch,
    handleAccountInfoStop,
    setAccountInfoRunMode,
    onCreateAccountInfoSchedule
  } = props

  const allowStart = !accountInfoLoading && !accountInfoOfflineRunning
  const showScheduleForm = accountInfoRunMode === 'schedule'
  const offlineBlocked = (accountInfoRunMode === 'offline' || accountInfoRunMode === 'schedule') && (
    !accountInfoBaseId.trim() || accountInfoOfflineAuthStatus !== 'ready'
  )
  const stopInProgress = accountInfoOfflineStopping

  const formatTime = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const formatStatus = (status?: string) => {
    if (status === 'queued') return tr('排队中')
    if (status === 'running') return tr('运行中')
    if (status === 'completed') return tr('已完成')
    if (status === 'stopped') return tr('已停止')
    return tr('未知')
  }

  const formatScheduleMode = (schedule?: OfflineScheduleSummary['schedule']) => {
    const mode = schedule?.mode
    if (mode === 'once') return tr('只执行一次')
    if (mode === 'daily') return tr('每天')
    if (mode === 'weekly') return tr('每周')
    if (mode === 'monthly') return tr('每月')
    if (mode === 'interval') return tr(`每${schedule?.intervalDays || 1}天`)
    return '-'
  }

  const formatCount = (value?: number) => (
    typeof value === 'number' ? value : 0
  )

  const resolvedTableOptions = tableOptions.length
    ? tableOptions
    : (currentTableId ? [{ id: currentTableId, name: tr('当前表格') }] : [])
  const selectedColumnTargetTableId = accountInfoColumnTargetTableId || currentTableId
  const selectedBatchTargetTableId = accountInfoBatchTargetTableId || currentTableId

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('账号资料批量补全')}
          {accountInfoLoading && <span className="running-indicator">{tr('获取中')}</span>}
          {!accountInfoLoading && accountInfoOfflineRunning && <span className="running-indicator">{tr('后台运行中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form account-info-search-form">
          <div className="form-item full-width">
            <label>{tr('数据来源:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountInfoMode"
                  value="column"
                  checked={accountInfoMode === 'column'}
                  onChange={() => setAccountInfoMode('column')}
                  disabled={accountInfoLoading}
                />
                {tr('从表格列获取')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountInfoMode"
                  value="batch"
                  checked={accountInfoMode === 'batch'}
                  onChange={() => setAccountInfoMode('batch')}
                  disabled={accountInfoLoading}
                />
                {tr('批量输入账号')}
              </label>
            </div>
          </div>

          <div className="form-item full-width">
            <label>{tr('运行方式:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountInfoRunMode"
                  value="online"
                  checked={accountInfoRunMode === 'online'}
                  onChange={() => setAccountInfoRunMode('online')}
                  disabled={accountInfoLoading || accountInfoOfflineRunning}
                />
                {tr('立即执行')}
                <span className="help-tip align-left" onMouseEnter={adjustHelpTipWithinRoot}>
                  <span className="help-icon">?</span>
                  <span className="help-bubble">
                    {tr('页面需要保持打开，关闭页面或关闭插件会停止运行')}
                  </span>
                </span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountInfoRunMode"
                  value="offline"
                  checked={accountInfoRunMode === 'offline'}
                  onChange={() => setAccountInfoRunMode('offline')}
                  disabled={accountInfoLoading}
                />
                {tr('后台执行')}
                <span className="help-tip align-right" onMouseEnter={adjustHelpTipWithinRoot}>
                  <span className="help-icon">?</span>
                  <span className="help-bubble">
                    {tr('关闭页面或关闭插件也会继续运行')}
                  </span>
                </span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountInfoRunMode"
                  value="schedule"
                  checked={accountInfoRunMode === 'schedule'}
                  onChange={() => setAccountInfoRunMode('schedule')}
                  disabled={accountInfoLoading}
                />
                {tr('定时执行')}
                <span className="help-tip align-right" onMouseEnter={adjustHelpTipWithinRoot}>
                  <span className="help-icon">?</span>
                  <span className="help-bubble">
                    {tr('按设定时间自动执行')}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {showScheduleForm && (
            <div className="form-item full-width">
              <div className="offline-meta">
                {tr('已设置')} {accountInfoScheduleCount} {tr('个定时任务')}
              </div>
              <div className="offline-meta">
                {tr('下次执行')}: {formatTime(accountInfoScheduleNextRunAt)}
              </div>
              <div className="offline-meta">
                {tr('频率')}: {formatScheduleMode(accountInfoNextSchedule?.schedule)}
              </div>
              <div className="offline-meta">
                {tr('开始时间')}: {formatTime(accountInfoNextSchedule?.schedule?.startAt)}
              </div>
            </div>
          )}

          {accountInfoMode === 'column' ? (
            <>
              <div className="form-item full-width">
                <label>{tr('账号列:')}</label>
                <select
                  value={accountInfoUsernameField}
                  onChange={(e) => setAccountInfoUsernameField(e.target.value)}
                  disabled={accountInfoLoading}
                  className="select-styled"
                >
                  <option value="">{tr('请选择账号列')}</option>
                  {fields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-item full-width">
                <label>{tr('写入目标:')}</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="accountInfoColumnTargetTable"
                      value="new"
                      checked={accountInfoColumnTargetTable === 'new'}
                      onChange={() => setAccountInfoColumnTargetTable('new')}
                      disabled={accountInfoLoading}
                    />
                    {tr('新建表格')}
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="accountInfoColumnTargetTable"
                      value="current"
                      checked={accountInfoColumnTargetTable === 'current'}
                      onChange={() => setAccountInfoColumnTargetTable('current')}
                      disabled={accountInfoLoading}
                    />
                    {tr('写入表格')}
                  </label>
                  {accountInfoColumnTargetTable === 'current' && (
                    <select
                      value={selectedColumnTargetTableId}
                      onChange={(e) => setAccountInfoColumnTargetTableId(e.target.value)}
                      disabled={accountInfoLoading}
                      className="select-styled"
                    >
                      {resolvedTableOptions.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.name || tr('未命名表格')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="form-item checkbox-item full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={accountInfoOverwrite}
                    onChange={(e) => setAccountInfoOverwrite(e.target.checked)}
                    disabled={accountInfoLoading}
                  />
                  {tr('覆盖已有数据')}
                </label>
                <span className="field-tip">{tr('不勾选则跳过已有数据的行')}</span>
              </div>

              {accountInfoColumnTargetTable === 'new' && (
                <div className="form-item">
                  <label>{tr('新表格名称')}</label>
                  <input
                    type="text"
                    value={accountInfoColumnNewTableName}
                    onChange={(e) => setAccountInfoColumnNewTableName(e.target.value)}
                    disabled={accountInfoLoading}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-item">
                <label>{tr('目标表格:')}</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="batchTargetTable"
                      value="current"
                      checked={batchTargetTable === 'current'}
                      onChange={() => setBatchTargetTable('current')}
                      disabled={accountInfoLoading}
                    />
                    {tr('写入表格')}
                  </label>
                  {batchTargetTable === 'current' && (
                    <select
                      value={selectedBatchTargetTableId}
                      onChange={(e) => setAccountInfoBatchTargetTableId(e.target.value)}
                      disabled={accountInfoLoading}
                      className="select-styled"
                    >
                      {resolvedTableOptions.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.name || tr('未命名表格')}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="batchTargetTable"
                      value="new"
                      checked={batchTargetTable === 'new'}
                      onChange={() => setBatchTargetTable('new')}
                      disabled={accountInfoLoading}
                    />
                    {tr('新建表格')}
                  </label>
                </div>
              </div>

              {batchTargetTable === 'new' && (
                <div className="form-item">
                  <label>{tr('新表格名称')}</label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    disabled={accountInfoLoading}
                  />
                </div>
              )}

              <div className="form-item">
                <label>{tr('账号列表:')}</label>
                <textarea
                  value={accountInfoBatchInput}
                  onChange={(e) => setAccountInfoBatchInput(e.target.value)}
                  placeholder={tr('每行一个账号名称，或用逗号分隔')}
                  disabled={accountInfoLoading}
                  rows={4}
                  className="textarea-styled"
                />
              </div>
            </>
          )}
        </div>

        {accountInfoRunMode !== 'online' && offlineBlocked && (
          <div className="offline-auth-tip missing">
            {tr('请先在后台任务中心填写表格编号和授权码')}
          </div>
        )}

        {!showScheduleForm && (
          <div className="search-action">
            {allowStart ? (
              <button
                onClick={handleAccountInfoFetch}
                disabled={
                  (accountInfoMode === 'column' && !accountInfoUsernameField) ||
                  (accountInfoMode === 'batch' && !accountInfoBatchInput.trim()) ||
                  accountInfoQuotaInsufficient ||
                  offlineBlocked
                }
              >
                {tr('开始获取')}
              </button>
            ) : (
              <button
                onClick={handleAccountInfoStop}
                className="stop-button"
                disabled={stopInProgress}
              >
                {stopInProgress ? tr('正在停止...') : tr('停止获取')}
              </button>
            )}
          </div>
        )}

        {showScheduleForm && (
          <div className="schedule-panel">
            <ScheduleForm
              tr={tr}
              disabled={offlineBlocked || accountInfoScheduleSaving}
              maxReached={accountInfoScheduleLimitReached}
              submitLabel={accountInfoScheduleSaving ? tr('保存中...') : tr('创建定时任务')}
              onSubmit={onCreateAccountInfoSchedule}
            />
            {!allowStart && (
              <div className="search-action">
                <button
                  onClick={handleAccountInfoStop}
                  className="stop-button"
                  disabled={stopInProgress}
                >
                  {stopInProgress ? tr('正在停止...') : tr('停止获取')}
                </button>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: accountInfoQuotaInsufficient ? '#fff2e8' : '#f0f5ff',
            border: accountInfoQuotaInsufficient ? '1px solid #ffbb96' : '1px solid #adc6ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: accountInfoQuotaInsufficient ? '#ff4d4f' : '#1890ff',
          lineHeight: '1.5'
        }}
      >
          {accountInfoQuotaInsufficient ? '⚠️' : 'ℹ️'} {accountInfoQuotaInsufficient ? tr('quota.accountInfo.insufficient') : tr('quota.accountInfo.tip')}
        </div>

        <div className="sub-section">
          <h3>{tr('选择需要的字段')}</h3>
          <p className="field-tip">{tr('未创建的字段将被自动创建')}</p>
          <div className="field-select-list">
            {ACCOUNT_INFO_FIELD_NAMES.map(fieldName => (
              <div key={fieldName} className="field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={accountInfoRequiredFields.has(fieldName) || accountInfoSelectedFields[fieldName] || false}
                    onChange={() => handleAccountInfoFieldChange(fieldName)}
                    disabled={accountInfoLoading || accountInfoRequiredFields.has(fieldName)}
                  />
                  {tr(fieldName)}
                  {accountInfoRequiredFields.has(fieldName) && ` (${tr('必选')})`}
                </label>
              </div>
            ))}
          </div>
        </div>

        {(accountInfoRunMode !== 'online' || accountInfoOfflineTasks.length > 0) && (
          <div className="sub-section">
            <h3>{tr('后台任务进度')}</h3>
            {(accountInfoOfflineDetail || accountInfoOfflineActiveTask) && (
              <div className="offline-card">
                <div className="offline-title">{tr('当前任务详情')}</div>
                <div className="offline-meta">
                  {tr('状态')}: {formatStatus(accountInfoOfflineDetail?.status || accountInfoOfflineActiveTask?.status)}
                </div>
                <div className="offline-meta">
                  {tr('已获取')} {formatCount(accountInfoOfflineDetail?.progress?.fetched || accountInfoOfflineActiveTask?.progress?.fetched)}，
                  {tr('已写入')} {formatCount(accountInfoOfflineDetail?.progress?.written || accountInfoOfflineActiveTask?.progress?.written)}，
                  {tr('已跳过（重复内容）')} {formatCount(accountInfoOfflineDetail?.progress?.skipped || accountInfoOfflineActiveTask?.progress?.skipped)}，
                  {tr('失败')} {formatCount(accountInfoOfflineDetail?.progress?.failed || accountInfoOfflineActiveTask?.progress?.failed)}
                </div>
                <div className="offline-meta">
                  {tr('更新时间')}: {formatTime(accountInfoOfflineDetail?.updatedAt || accountInfoOfflineActiveTask?.updatedAt)}
                </div>
                {accountInfoOfflineDetail?.payload?.tableName && (
                  <div className="offline-meta">
                    {tr('写入表格')}: {accountInfoOfflineDetail.payload.tableName}
                  </div>
                )}
                {accountInfoOfflineDetail?.stopReason && (
                  <div className="offline-meta">
                    {tr('停止原因')}: {accountInfoOfflineDetail.stopReason}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
