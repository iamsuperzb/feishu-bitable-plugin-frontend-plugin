type TableTarget = 'current' | 'new'
type AccountRunMode = 'online' | 'offline'

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
  username?: string
  tableName?: string
}

interface OfflineTaskDetail extends OfflineTaskSummary {
  payload?: {
    tableName?: string
  }
  stopReason?: string
}

interface AccountSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  isCollecting: boolean
  isStopping: boolean
  collectType: number
  username: string
  userRegion: string
  accountRunMode: AccountRunMode
  accountBaseId: string
  accountTargetTableId: string
  currentTableId: string
  tableOptions: { id: string; name: string }[]
  accountOfflineAuthStatus: 'ready' | 'missing' | 'loading'
  accountOfflineTasks: OfflineTaskSummary[]
  accountOfflineActiveTask: OfflineTaskSummary | null
  accountOfflineDetail: OfflineTaskDetail | null
  accountOfflineRunning: boolean
  accountOfflineStopping: boolean
  accountTargetTable: TableTarget
  accountNewTableName: string
  loading: boolean
  accountQuotaInsufficient: boolean
  accountSelectedFields: Record<string, boolean>
  accountRequiredFields: Set<string>
  setUsername: (val: string) => void
  setUserRegion: (val: string) => void
  setAccountRunMode: (val: AccountRunMode) => void
  setAccountTargetTable: (val: TableTarget) => void
  setAccountTargetTableId: (val: string) => void
  setAccountNewTableName: (val: string) => void
  handleAccountFieldChange: (fieldName: string) => void
  writeAccountTikTokData: () => void
  stopCollection: () => void
}

const ACCOUNT_FIELD_NAMES = [
  '视频链接',
  '视频封面',
  '视频发布时间',
  '视频标题',
  '播放量',
  '点赞数量',
  '评论数量',
  '转发数量',
  '收藏数量',
  '视频互动率',
  '视频发布国家',
  '视频BGM标题',
  '视频下载链接',
  '帖子类型',
  '是否带货',
  '带货产品链接',
  '带货产品链接（全部）',
  '带货原因',
  '带货产品数量',
  '带货产品信息'
]

export default function AccountSection(props: AccountSectionProps) {
  const {
    tr,
    open,
    onToggle,
    isCollecting,
    isStopping,
    collectType,
    username,
    userRegion,
    accountRunMode,
    accountBaseId,
    accountTargetTableId,
    currentTableId,
    tableOptions,
    accountOfflineAuthStatus,
    accountOfflineTasks,
    accountOfflineActiveTask,
    accountOfflineDetail,
    accountOfflineRunning,
    accountOfflineStopping,
    accountTargetTable,
    accountNewTableName,
    loading,
    accountQuotaInsufficient,
    accountSelectedFields,
    accountRequiredFields,
    setUsername,
    setUserRegion,
    setAccountRunMode,
    setAccountTargetTable,
    setAccountTargetTableId,
    setAccountNewTableName,
    handleAccountFieldChange,
    writeAccountTikTokData,
    stopCollection
  } = props

  const showOnlineStop = isCollecting && collectType === 2
  const showOfflineStop = accountOfflineRunning
  const showStop = showOnlineStop || showOfflineStop
  const allowStart = !isCollecting && !accountOfflineRunning
  const offlineBlocked = accountRunMode === 'offline' && (
    !accountBaseId.trim() || accountOfflineAuthStatus !== 'ready'
  )
  const stopInProgress = isStopping || accountOfflineStopping

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
  const selectedTargetTableId = accountTargetTableId || currentTableId

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('单账号作品表现')}
          {isCollecting && collectType === 2 && <span className="running-indicator">{tr('采集中')}</span>}
          {!isCollecting && accountOfflineRunning && <span className="running-indicator">{tr('后台运行中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form">
          <div className="form-item full-width">
            <label>{tr('账号名称:')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tr('输入TikTok账号名称')}
              disabled={isCollecting}
            />
          </div>
          <div className="form-item full-width">
            <label>{tr('国家地区 (必选):')}</label>
            <select
              value={userRegion}
              onChange={(e) => setUserRegion(e.target.value)}
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
                  name="accountRunMode"
                  value="online"
                  checked={accountRunMode === 'online'}
                  onChange={() => setAccountRunMode('online')}
                  disabled={isCollecting || accountOfflineRunning}
                />
                {tr('立即执行')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountRunMode"
                  value="offline"
                  checked={accountRunMode === 'offline'}
                  onChange={() => setAccountRunMode('offline')}
                  disabled={isCollecting}
                />
                {tr('后台执行')}
              </label>
            </div>
          </div>

          <div className="form-item full-width">
            <label>{tr('写入目标:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountTargetTable"
                  value="new"
                  checked={accountTargetTable === 'new'}
                  onChange={() => setAccountTargetTable('new')}
                  disabled={isCollecting}
                />
                {tr('新建表格')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="accountTargetTable"
                  value="current"
                  checked={accountTargetTable === 'current'}
                  onChange={() => setAccountTargetTable('current')}
                  disabled={isCollecting}
                />
                {tr('写入表格')}
              </label>
              {accountTargetTable === 'current' && (
                <select
                  value={selectedTargetTableId}
                  onChange={(e) => setAccountTargetTableId(e.target.value)}
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

          {accountTargetTable === 'new' && (
            <div className="form-item full-width">
              <label>{tr('新表格名称')}</label>
              <input
                type="text"
                value={accountNewTableName}
                onChange={(e) => setAccountNewTableName(e.target.value)}
                disabled={isCollecting}
              />
            </div>
          )}
        </div>

        {accountRunMode === 'offline' && offlineBlocked && (
          <div className="offline-auth-tip missing">
            {tr('请先在后台任务中心填写表格编号和授权码')}
          </div>
        )}

        <div className="search-action">
          {allowStart ? (
            <>
              <button
                onClick={writeAccountTikTokData}
                disabled={loading || !username || accountQuotaInsufficient || offlineBlocked}
              >
                {tr('开始采集')}
              </button>
            </>
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

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: accountQuotaInsufficient ? '#fff2e8' : '#f0f5ff',
            border: accountQuotaInsufficient ? '1px solid #ffbb96' : '1px solid #adc6ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: accountQuotaInsufficient ? '#ff4d4f' : '#1890ff',
            lineHeight: '1.5'
          }}
        >
          {accountQuotaInsufficient ? '⚠️' : 'ℹ️'} {accountQuotaInsufficient ? tr('quota.account.insufficient') : tr('quota.account.tip')}
        </div>

        <div className="sub-section">
          <h3>{tr('选择需要的字段')}</h3>
          <p className="field-tip">{tr('未创建的字段将被自动创建')}</p>
          <div className="field-select-list">
            {ACCOUNT_FIELD_NAMES.map(fieldName => (
              <div key={fieldName} className="field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={accountRequiredFields.has(fieldName) || accountSelectedFields[fieldName] || false}
                    onChange={() => handleAccountFieldChange(fieldName)}
                    disabled={isCollecting || accountRequiredFields.has(fieldName)}
                  />
                  {tr(fieldName)}
                  {accountRequiredFields.has(fieldName) && ` (${tr('必选')})`}
                </label>
              </div>
            ))}
          </div>
        </div>

        {(accountRunMode === 'offline' || accountOfflineTasks.length > 0) && (
          <div className="sub-section">
            <h3>{tr('后台任务进度')}</h3>
            {(accountOfflineDetail || accountOfflineActiveTask) && (
              <div className="offline-card">
                <div className="offline-title">{tr('当前任务详情')}</div>
                <div className="offline-meta">
                  {tr('状态')}: {formatStatus(accountOfflineDetail?.status || accountOfflineActiveTask?.status)}
                </div>
                <div className="offline-meta">
                  {tr('已获取')} {formatCount(accountOfflineDetail?.progress?.fetched || accountOfflineActiveTask?.progress?.fetched)}，
                  {tr('已写入')} {formatCount(accountOfflineDetail?.progress?.written || accountOfflineActiveTask?.progress?.written)}，
                  {tr('已跳过（重复内容）')} {formatCount(accountOfflineDetail?.progress?.skipped || accountOfflineActiveTask?.progress?.skipped)}，
                  {tr('失败')} {formatCount(accountOfflineDetail?.progress?.failed || accountOfflineActiveTask?.progress?.failed)}
                </div>
                <div className="offline-meta">
                  {tr('更新时间')}: {formatTime(accountOfflineDetail?.updatedAt || accountOfflineActiveTask?.updatedAt)}
                </div>
                {accountOfflineDetail?.payload?.tableName && (
                  <div className="offline-meta">
                    {tr('写入表格')}: {accountOfflineDetail.payload.tableName}
                  </div>
                )}
                {accountOfflineDetail?.stopReason && (
                  <div className="offline-meta">
                    {tr('停止原因')}: {accountOfflineDetail.stopReason}
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
