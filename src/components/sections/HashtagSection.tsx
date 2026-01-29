import { adjustHelpTipWithinRoot } from '../../utils/helpTip'
import ScheduleForm from './ScheduleForm'
import type { OfflineScheduleConfig, OfflineScheduleSummary } from '../../types/offline'

type TableTarget = 'current' | 'new'
type HashtagRunMode = 'online' | 'offline' | 'schedule'

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
  hashtag?: string
  tableName?: string
}

interface OfflineTaskDetail extends OfflineTaskSummary {
  payload?: {
    hashtag?: string
    tableName?: string
  }
  stopReason?: string
}

interface HashtagSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  isCollecting: boolean
  isStopping: boolean
  collectType: number
  hashtagQuery: string
  region: string
  hashtagRunMode: HashtagRunMode
  hashtagBaseId: string
  hashtagTargetTable: TableTarget
  hashtagTargetTableId: string
  currentTableId: string
  tableOptions: { id: string; name: string }[]
  hashtagNewTableName: string
  loading: boolean
  hashtagQuotaInsufficient: boolean
  hashtagSelectedFields: Record<string, boolean>
  hashtagRequiredFields: Set<string>
  hashtagOfflineAuthStatus: 'loading' | 'missing' | 'ready'
  hashtagOfflineTasks: OfflineTaskSummary[]
  hashtagOfflineActiveTask: OfflineTaskSummary | null
  hashtagOfflineDetail: OfflineTaskDetail | null
  hashtagOfflineRunning: boolean
  hashtagOfflineStopping: boolean
  hashtagScheduleCount: number
  hashtagScheduleNextRunAt: string
  hashtagNextSchedule: OfflineScheduleSummary | null
  hashtagScheduleLimitReached: boolean
  hashtagScheduleSaving: boolean
  setHashtagQuery: (val: string) => void
  setRegion: (val: string) => void
  setHashtagRunMode: (val: HashtagRunMode) => void
  setHashtagTargetTable: (val: TableTarget) => void
  setHashtagTargetTableId: (val: string) => void
  setHashtagNewTableName: (val: string) => void
  handleHashtagFieldChange: (fieldName: string) => void
  writeHashtagTikTokData: () => void
  stopCollection: () => void
  onCreateHashtagSchedule: (value: OfflineScheduleConfig) => void
}

const HASHTAG_FIELD_NAMES = [
  'hashtag',
  '发布时间',
  '视频链接',
  '视频封面',
  '视频播放量',
  '点赞数量',
  '评论数量',
  '分享数量',
  '收藏数量',
  '视频互动率',
  '账号名称',
  '视频标题',
  '视频发布国家',
  '视频下载链接',
  '是否带货',
  '带货产品链接',
  '带货产品链接（全部）',
  '带货原因',
  '带货产品数量',
  '带货产品信息'
]

export default function HashtagSection(props: HashtagSectionProps) {
  const {
    tr,
    open,
    onToggle,
    isCollecting,
    isStopping,
    collectType,
    hashtagQuery,
    region,
    hashtagRunMode,
    hashtagBaseId,
    hashtagTargetTable,
    hashtagTargetTableId,
    currentTableId,
    tableOptions,
    hashtagNewTableName,
    loading,
    hashtagQuotaInsufficient,
    hashtagSelectedFields,
    hashtagRequiredFields,
    hashtagOfflineAuthStatus,
    hashtagOfflineTasks,
    hashtagOfflineActiveTask,
    hashtagOfflineDetail,
    hashtagOfflineRunning,
    hashtagOfflineStopping,
    hashtagScheduleCount,
    hashtagScheduleNextRunAt,
    hashtagNextSchedule,
    hashtagScheduleLimitReached,
    hashtagScheduleSaving,
    setHashtagQuery,
    setRegion,
    setHashtagRunMode,
    setHashtagTargetTable,
    setHashtagTargetTableId,
    setHashtagNewTableName,
    handleHashtagFieldChange,
    writeHashtagTikTokData,
    stopCollection,
    onCreateHashtagSchedule
  } = props

  const showOnlineStop = isCollecting && collectType === 3
  const showOfflineStop = hashtagOfflineRunning
  const showStop = showOnlineStop || showOfflineStop
  const allowStart = !isCollecting && !hashtagOfflineRunning
  const showScheduleForm = hashtagRunMode === 'schedule'
  const offlineBlocked = (hashtagRunMode === 'offline' || hashtagRunMode === 'schedule') && (
    !hashtagBaseId.trim() || hashtagOfflineAuthStatus !== 'ready'
  )
  const stopInProgress = isStopping || hashtagOfflineStopping

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
  const selectedTargetTableId = hashtagTargetTableId || currentTableId

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('监控对标hashtag')}
          {isCollecting && collectType === 3 && <span className="running-indicator">{tr('采集中')}</span>}
          {!isCollecting && hashtagOfflineRunning && <span className="running-indicator">{tr('后台运行中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form">
          <div className="form-item full-width">
            <label>{tr('hashtag:')}</label>
            <input
              type="text"
              value={hashtagQuery}
              onChange={(e) => setHashtagQuery(e.target.value)}
              placeholder={tr('输入hashtag关键词')}
              disabled={isCollecting}
            />
          </div>
          <div className="form-item full-width">
            <label>{tr('国家地区 (必选):')}</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isCollecting}
              className="select-styled"
            >
              <option value="US">{tr('美国 (US)')}</option>
              <option value="JP">{tr('日本 (JP)')}</option>
              <option value="TH">{tr('泰国 (TH)')}</option>
              <option value="VN">{tr('越南 (VN)')}</option>
              <option value="ID">{tr('印尼 (ID)')}</option>
              <option value="MY">{tr('马来西亚 (MY)')}</option>
              <option value="PH">{tr('菲律宾 (PH)')}</option>
              <option value="SG">{tr('新加坡 (SG)')}</option>
              <option value="KR">{tr('韩国 (KR)')}</option>
              <option value="TW">{tr('台湾 (TW)')}</option>
              <option value="GB">{tr('英国 (GB)')}</option>
              <option value="FR">{tr('法国 (FR)')}</option>
              <option value="DE">{tr('德国 (DE)')}</option>
              <option value="IT">{tr('意大利 (IT)')}</option>
              <option value="ES">{tr('西班牙 (ES)')}</option>
              <option value="BR">{tr('巴西 (BR)')}</option>
              <option value="CA">{tr('加拿大 (CA)')}</option>
              <option value="AU">{tr('澳大利亚 (AU)')}</option>
            </select>
          </div>

          <div className="form-item full-width">
            <label>{tr('运行方式:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="hashtagRunMode"
                  value="online"
                  checked={hashtagRunMode === 'online'}
                  onChange={() => setHashtagRunMode('online')}
                  disabled={isCollecting || hashtagOfflineRunning}
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
                  name="hashtagRunMode"
                  value="offline"
                  checked={hashtagRunMode === 'offline'}
                  onChange={() => setHashtagRunMode('offline')}
                  disabled={isCollecting}
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
                  name="hashtagRunMode"
                  value="schedule"
                  checked={hashtagRunMode === 'schedule'}
                  onChange={() => setHashtagRunMode('schedule')}
                  disabled={isCollecting}
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
                {tr('已设置')} {hashtagScheduleCount} {tr('个定时任务')}
              </div>
              <div className="offline-meta">
                {tr('下次执行')}: {formatTime(hashtagScheduleNextRunAt)}
              </div>
              <div className="offline-meta">
                {tr('频率')}: {formatScheduleMode(hashtagNextSchedule?.schedule)}
              </div>
              <div className="offline-meta">
                {tr('开始时间')}: {formatTime(hashtagNextSchedule?.schedule?.startAt)}
              </div>
            </div>
          )}

          <div className="form-item full-width">
            <label>{tr('写入目标:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="hashtagTargetTable"
                  value="new"
                  checked={hashtagTargetTable === 'new'}
                  onChange={() => setHashtagTargetTable('new')}
                  disabled={isCollecting}
                />
                {tr('新建表格')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="hashtagTargetTable"
                  value="current"
                  checked={hashtagTargetTable === 'current'}
                  onChange={() => setHashtagTargetTable('current')}
                  disabled={isCollecting}
                />
                {tr('写入表格')}
              </label>
              {hashtagTargetTable === 'current' && (
                <select
                  value={selectedTargetTableId}
                  onChange={(e) => setHashtagTargetTableId(e.target.value)}
                  disabled={isCollecting}
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

          {hashtagTargetTable === 'new' && (
            <div className="form-item full-width">
              <label>{tr('新表格名称')}</label>
              <input
                type="text"
                value={hashtagNewTableName}
                onChange={(e) => setHashtagNewTableName(e.target.value)}
                disabled={isCollecting}
              />
            </div>
          )}
        </div>

        {hashtagRunMode !== 'online' && offlineBlocked && (
          <div className="offline-auth-tip missing">
            {tr('请先在后台任务中心填写表格编号和授权码')}
          </div>
        )}

        {!showScheduleForm && (
          <div className="search-action">
            {allowStart ? (
              <button
                onClick={writeHashtagTikTokData}
                disabled={loading || !hashtagQuery || hashtagQuotaInsufficient || offlineBlocked}
              >
                {tr('开始采集')}
              </button>
            ) : (
              showStop && (
                <button
                  onClick={stopCollection}
                  className={`stop-button ${stopInProgress ? 'stopping' : ''}`}
                  disabled={stopInProgress}
                >
                  {stopInProgress ? tr('正在停止...') : tr('停止采集')}
                </button>
              )
            )}
          </div>
        )}

        {showScheduleForm && (
          <div className="schedule-panel">
            <ScheduleForm
              tr={tr}
              disabled={offlineBlocked || hashtagScheduleSaving}
              maxReached={hashtagScheduleLimitReached}
              submitLabel={hashtagScheduleSaving ? tr('保存中...') : tr('创建定时任务')}
              onSubmit={onCreateHashtagSchedule}
            />
            {showStop && (
              <div className="search-action">
                <button
                  onClick={stopCollection}
                  className={`stop-button ${stopInProgress ? 'stopping' : ''}`}
                  disabled={stopInProgress}
                >
                  {stopInProgress ? tr('正在停止...') : tr('停止采集')}
                </button>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: hashtagQuotaInsufficient ? '#fff2e8' : '#f0f5ff',
            border: hashtagQuotaInsufficient ? '1px solid #ffbb96' : '1px solid #adc6ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: hashtagQuotaInsufficient ? '#ff4d4f' : '#1890ff',
            lineHeight: '1.5'
          }}
        >
          {hashtagQuotaInsufficient ? '⚠️' : 'ℹ️'} {hashtagQuotaInsufficient ? tr('quota.keyword.insufficient') : tr('quota.keyword.tip')}
        </div>

        <div className="sub-section">
          <h3>{tr('选择需要的字段')}</h3>
          <p className="field-tip">{tr('未创建的字段将被自动创建')}</p>
          <div className="field-select-list">
            {HASHTAG_FIELD_NAMES.map(fieldName => (
              <div key={fieldName} className="field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={hashtagRequiredFields.has(fieldName) || hashtagSelectedFields[fieldName] || false}
                    onChange={() => handleHashtagFieldChange(fieldName)}
                    disabled={isCollecting || hashtagRequiredFields.has(fieldName)}
                  />
                  {tr(fieldName)}
                  {hashtagRequiredFields.has(fieldName) && ` (${tr('必选')})`}
                </label>
              </div>
            ))}
          </div>
        </div>

        {(hashtagRunMode !== 'online' || hashtagOfflineTasks.length > 0) && (
          <div className="sub-section">
            <h3>{tr('后台任务进度')}</h3>
            {(hashtagOfflineDetail || hashtagOfflineActiveTask) && (
              <div className="offline-card">
                <div className="offline-title">{tr('当前任务详情')}</div>
                <div className="offline-meta">
                  {tr('状态')}: {formatStatus(hashtagOfflineDetail?.status || hashtagOfflineActiveTask?.status)}
                </div>
                <div className="offline-meta">
                  {tr('已获取')} {formatCount(hashtagOfflineDetail?.progress?.fetched || hashtagOfflineActiveTask?.progress?.fetched)}，
                  {tr('已写入')} {formatCount(hashtagOfflineDetail?.progress?.written || hashtagOfflineActiveTask?.progress?.written)}，
                  {tr('已跳过（重复内容）')} {formatCount(hashtagOfflineDetail?.progress?.skipped || hashtagOfflineActiveTask?.progress?.skipped)}，
                  {tr('失败')} {formatCount(hashtagOfflineDetail?.progress?.failed || hashtagOfflineActiveTask?.progress?.failed)}
                </div>
                <div className="offline-meta">
                  {tr('更新时间')}: {formatTime(hashtagOfflineDetail?.updatedAt || hashtagOfflineActiveTask?.updatedAt)}
                </div>
                {hashtagOfflineDetail?.payload?.tableName && (
                  <div className="offline-meta">
                    {tr('写入表格')}: {hashtagOfflineDetail.payload.tableName}
                  </div>
                )}
                {hashtagOfflineDetail?.stopReason && (
                  <div className="offline-meta">
                    {tr('停止原因')}: {hashtagOfflineDetail.stopReason}
                  </div>
                )}
              </div>
            )}

            {hashtagOfflineTasks.length === 0 && (
              <div className="offline-empty">{tr('暂无任务')}</div>
            )}

            {hashtagOfflineTasks.length > 0 && (
              <div className="offline-list">
                {hashtagOfflineTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="offline-item">
                    <div className="offline-meta">
                      {tr('状态')}: {formatStatus(task.status)}
                    </div>
                    <div className="offline-meta">
                      {tr('已获取')} {formatCount(task.progress?.fetched)}，
                      {tr('已写入')} {formatCount(task.progress?.written)}，
                      {tr('已跳过（重复内容）')} {formatCount(task.progress?.skipped)}，
                      {tr('失败')} {formatCount(task.progress?.failed)}
                    </div>
                    <div className="offline-meta">
                      {tr('更新时间')}: {formatTime(task.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
