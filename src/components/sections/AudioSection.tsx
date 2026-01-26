import type { IFieldMeta } from '@lark-base-open/js-sdk'
import { adjustHelpTipWithinRoot } from '../../utils/helpTip'

type TableTarget = 'current' | 'new'
type AudioMode = 'column' | 'batch'
type AudioRunMode = 'online' | 'offline'

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

interface AudioSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  fields: IFieldMeta[]
  audioRunMode: AudioRunMode
  audioBaseId: string
  audioTargetTableId: string
  currentTableId: string
  tableOptions: { id: string; name: string }[]
  audioOfflineAuthStatus: 'ready' | 'missing' | 'loading'
  audioOfflineTasks: OfflineTaskSummary[]
  audioOfflineActiveTask: OfflineTaskSummary | null
  audioOfflineDetail: OfflineTaskDetail | null
  audioOfflineRunning: boolean
  audioOfflineStopping: boolean
  audioMode: AudioMode
  setAudioMode: (val: AudioMode) => void
  audioVideoUrlField: string
  setAudioVideoUrlField: (val: string) => void
  audioBatchInput: string
  setAudioBatchInput: (val: string) => void
  audioOutputField: string
  setAudioOutputField: (val: string) => void
  audioTargetTable: TableTarget
  setAudioTargetTable: (val: TableTarget) => void
  audioNewTableName: string
  setAudioNewTableName: (val: string) => void
  audioLoading: boolean
  audioQuotaInsufficient: boolean
  handleAudioExtract: () => void
  handleAudioStop: () => void
  setAudioRunMode: (val: AudioRunMode) => void
  setAudioTargetTableId: (val: string) => void
}

export default function AudioSection(props: AudioSectionProps) {
  const {
    tr,
    open,
    onToggle,
    fields,
    audioRunMode,
    audioBaseId,
    audioTargetTableId,
    currentTableId,
    tableOptions,
    audioOfflineAuthStatus,
    audioOfflineTasks,
    audioOfflineActiveTask,
    audioOfflineDetail,
    audioOfflineRunning,
    audioOfflineStopping,
    audioMode,
    setAudioMode,
    audioVideoUrlField,
    setAudioVideoUrlField,
    audioBatchInput,
    setAudioBatchInput,
    audioOutputField,
    setAudioOutputField,
    audioTargetTable,
    setAudioTargetTable,
    audioNewTableName,
    setAudioNewTableName,
    audioLoading,
    audioQuotaInsufficient,
    handleAudioExtract,
    handleAudioStop,
    setAudioRunMode,
    setAudioTargetTableId
  } = props

  const allowStart = !audioLoading && !audioOfflineRunning
  const offlineBlocked = audioRunMode === 'offline' && (
    !audioBaseId.trim() || audioOfflineAuthStatus !== 'ready'
  )
  const stopInProgress = audioOfflineStopping

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

  const formatCount = (value?: number) => (
    typeof value === 'number' ? value : 0
  )

  const resolvedTableOptions = tableOptions.length
    ? tableOptions
    : (currentTableId ? [{ id: currentTableId, name: tr('当前表格') }] : [])
  const selectedTargetTableId = audioTargetTableId || currentTableId

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('提取视频音频')}
          {audioLoading && <span className="running-indicator">{tr('提取中')}</span>}
          {!audioLoading && audioOfflineRunning && <span className="running-indicator">{tr('后台运行中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form audio-search-form">
          <div className="form-item full-width">
            <label>{tr('数据来源:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="audioMode"
                  value="column"
                  checked={audioMode === 'column'}
                  onChange={() => setAudioMode('column')}
                  disabled={audioLoading}
                />
                {tr('从表格列获取')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="audioMode"
                  value="batch"
                  checked={audioMode === 'batch'}
                  onChange={() => setAudioMode('batch')}
                  disabled={audioLoading}
                />
                {tr('批量输入视频链接')}
              </label>
            </div>
          </div>

          <div className="form-item full-width">
            <label>{tr('运行方式:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="audioRunMode"
                  value="online"
                  checked={audioRunMode === 'online'}
                  onChange={() => setAudioRunMode('online')}
                  disabled={audioLoading || audioOfflineRunning}
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
                  name="audioRunMode"
                  value="offline"
                  checked={audioRunMode === 'offline'}
                  onChange={() => setAudioRunMode('offline')}
                  disabled={audioLoading}
                />
                {tr('后台执行')}
                <span className="help-tip align-right" onMouseEnter={adjustHelpTipWithinRoot}>
                  <span className="help-icon">?</span>
                  <span className="help-bubble">
                    {tr('关闭页面或关闭插件也会继续运行')}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {audioMode === 'column' ? (
            <div className="form-item full-width">
              <label>{tr('TikTok 视频链接:')}</label>
              <select
                value={audioVideoUrlField}
                onChange={(e) => setAudioVideoUrlField(e.target.value)}
                disabled={audioLoading}
                className="select-styled"
              >
                <option value="">{tr('请选择视频链接列')}</option>
                {fields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-item full-width">
              <label>{tr('视频列表:')}</label>
              <textarea
                value={audioBatchInput}
                onChange={(e) => setAudioBatchInput(e.target.value)}
                placeholder={tr('每行一个视频链接，或用逗号分隔')}
                disabled={audioLoading}
                rows={3}
                className="textarea-styled"
              />
            </div>
          )}

          <div className="form-item full-width">
            <label>{tr('写入目标:')}</label>
            {audioMode === 'batch' ? (
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="audioTargetTable"
                    value="new"
                    checked
                    disabled
                  />
                  {tr('新建表格')}
                </label>
              </div>
            ) : (
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="audioTargetTable"
                    value="new"
                    checked={audioTargetTable === 'new'}
                    onChange={() => setAudioTargetTable('new')}
                    disabled={audioLoading}
                  />
                  {tr('新建表格')}
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="audioTargetTable"
                    value="current"
                    checked={audioTargetTable === 'current'}
                    onChange={() => setAudioTargetTable('current')}
                    disabled={audioLoading}
                  />
                  {tr('写入表格')}
                </label>
                {audioTargetTable === 'current' && (
                  <select
                    value={selectedTargetTableId}
                    onChange={(e) => setAudioTargetTableId(e.target.value)}
                    disabled={audioLoading}
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
            )}
          </div>

          {audioMode === 'column' && audioTargetTable === 'current' && selectedTargetTableId === currentTableId && (
            <div className="form-item full-width">
              <label>{tr('写入列:')}</label>
              <select
                value={audioOutputField}
                onChange={(e) => setAudioOutputField(e.target.value)}
                disabled={audioLoading}
                className="select-styled"
              >
                <option value="">{tr('请选择写入列')}</option>
                {fields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audioTargetTable === 'new' && (
            <div className="form-item full-width">
              <label>{tr('新表格名称')}</label>
              <input
                type="text"
                value={audioNewTableName}
                onChange={(e) => setAudioNewTableName(e.target.value)}
                disabled={audioLoading}
              />
            </div>
          )}
        </div>

        {audioRunMode === 'offline' && offlineBlocked && (
          <div className="offline-auth-tip missing">
            {tr('请先在后台任务中心填写表格编号和授权码')}
          </div>
        )}

        <div className="search-action">
          {allowStart ? (
            <button
              onClick={handleAudioExtract}
              disabled={
                (audioMode === 'column' && (!audioVideoUrlField || (audioTargetTable === 'current' && !audioOutputField))) ||
                (audioMode === 'batch' && !audioBatchInput.trim()) ||
                audioQuotaInsufficient ||
                offlineBlocked
              }
            >
              {tr('开始提取')}
            </button>
          ) : (
            <button
              onClick={handleAudioStop}
              className="stop-button"
              disabled={stopInProgress}
            >
              {stopInProgress ? tr('正在停止...') : tr('停止提取')}
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: audioQuotaInsufficient ? '#fff2e8' : '#f0f5ff',
            border: audioQuotaInsufficient ? '1px solid #ffbb96' : '1px solid #adc6ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: audioQuotaInsufficient ? '#ff4d4f' : '#1890ff',
            lineHeight: '1.5'
          }}
        >
          {audioQuotaInsufficient ? '⚠️' : 'ℹ️'} {audioQuotaInsufficient ? tr('quota.audio.insufficient') : tr('quota.audio.tip')}
        </div>

        {(audioRunMode === 'offline' || audioOfflineTasks.length > 0) && (
          <div className="sub-section">
            <h3>{tr('后台任务进度')}</h3>
            {(audioOfflineDetail || audioOfflineActiveTask) && (
              <div className="offline-card">
                <div className="offline-title">{tr('当前任务详情')}</div>
                <div className="offline-meta">
                  {tr('状态')}: {formatStatus(audioOfflineDetail?.status || audioOfflineActiveTask?.status)}
                </div>
                <div className="offline-meta">
                  {tr('已获取')} {formatCount(audioOfflineDetail?.progress?.fetched || audioOfflineActiveTask?.progress?.fetched)}，
                  {tr('已写入')} {formatCount(audioOfflineDetail?.progress?.written || audioOfflineActiveTask?.progress?.written)}，
                  {tr('已跳过（重复内容）')} {formatCount(audioOfflineDetail?.progress?.skipped || audioOfflineActiveTask?.progress?.skipped)}，
                  {tr('失败')} {formatCount(audioOfflineDetail?.progress?.failed || audioOfflineActiveTask?.progress?.failed)}
                </div>
                <div className="offline-meta">
                  {tr('更新时间')}: {formatTime(audioOfflineDetail?.updatedAt || audioOfflineActiveTask?.updatedAt)}
                </div>
                {audioOfflineDetail?.payload?.tableName && (
                  <div className="offline-meta">
                    {tr('写入表格')}: {audioOfflineDetail.payload.tableName}
                  </div>
                )}
                {audioOfflineDetail?.stopReason && (
                  <div className="offline-meta">
                    {tr('停止原因')}: {audioOfflineDetail.stopReason}
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
