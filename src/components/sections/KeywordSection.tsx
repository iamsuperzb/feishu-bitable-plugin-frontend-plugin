type TableTarget = 'current' | 'new'

interface KeywordSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  isCollecting: boolean
  isStopping: boolean
  collectType: number
  query: string
  vtime: string
  region: string
  keywordTargetTable: TableTarget
  keywordNewTableName: string
  loading: boolean
  keywordQuotaInsufficient: boolean
  quotaRemaining: number | null | undefined
  keywordEstimatedCost: number
  keywordSelectedFields: Record<string, boolean>
  keywordRequiredFields: Set<string>
  setQuery: (val: string) => void
  setVtime: (val: string) => void
  setRegion: (val: string) => void
  setKeywordTargetTable: (val: TableTarget) => void
  setKeywordNewTableName: (val: string) => void
  handleKeywordFieldChange: (fieldName: string) => void
  writeKeywordTikTokData: () => void
  stopCollection: () => void
}

const KEYWORD_FIELD_NAMES = [
  '关键词',
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
  '视频下载链接',
  '是否带货',
  '带货产品链接',
  '带货原因',
  '带货产品数量',
  '带货产品信息'
]

export default function KeywordSection(props: KeywordSectionProps) {
  const {
    tr,
    open,
    onToggle,
    isCollecting,
    isStopping,
    collectType,
    query,
    vtime,
    region,
    keywordTargetTable,
    keywordNewTableName,
    loading,
    keywordQuotaInsufficient,
    quotaRemaining,
    keywordEstimatedCost,
    keywordSelectedFields,
    keywordRequiredFields,
    setQuery,
    setVtime,
    setRegion,
    setKeywordTargetTable,
    setKeywordNewTableName,
    handleKeywordFieldChange,
    writeKeywordTikTokData,
    stopCollection
  } = props

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('关键词下爆款视频采集')}
          {isCollecting && collectType === 1 && <span className="running-indicator">{tr('采集中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form">
          <div className="form-item full-width">
            <label>{tr('关键词:')}</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('输入搜索关键词')}
              disabled={isCollecting}
            />
          </div>
          <div className="form-item full-width">
            <label>{tr('发布时间:')}</label>
            <select
              value={vtime}
              onChange={(e) => setVtime(e.target.value)}
              disabled={isCollecting}
              className="select-styled"
            >
              <option value="1d">{tr('最近1天')}</option>
              <option value="7d">{tr('最近7天')}</option>
              <option value="30d">{tr('最近30天')}</option>
              <option value="90d">{tr('最近90天')}</option>
              <option value="180d">{tr('最近180天')}</option>
            </select>
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
            <label>{tr('写入目标:')}</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="keywordTargetTable"
                  value="new"
                  checked={keywordTargetTable === 'new'}
                  onChange={() => setKeywordTargetTable('new')}
                  disabled={isCollecting}
                />
                {tr('新建表格')}
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="keywordTargetTable"
                  value="current"
                  checked={keywordTargetTable === 'current'}
                  onChange={() => setKeywordTargetTable('current')}
                  disabled={isCollecting}
                />
                {tr('写入当前表格')}
              </label>
            </div>
          </div>

          {keywordTargetTable === 'new' && (
            <div className="form-item full-width">
              <label>{tr('新表格名称')}</label>
              <input
                type="text"
                value={keywordNewTableName}
                onChange={(e) => setKeywordNewTableName(e.target.value)}
                disabled={isCollecting}
              />
            </div>
          )}
        </div>

        <div className="search-action">
          {!isCollecting ? (
            <>
              <button
                onClick={writeKeywordTikTokData}
                disabled={loading || !query || keywordQuotaInsufficient}
              >
                {tr('开始采集')}
              </button>
              {keywordQuotaInsufficient && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    background: '#fff2e8',
                    border: '1px solid #ffbb96',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#ff4d4f'
                  }}
                >
                  ⚠️ {tr('quota.insufficient.page', { need: keywordEstimatedCost, remaining: quotaRemaining ?? 0 })}
                </div>
              )}
            </>
          ) : (
            collectType === 1 && (
              <button
                onClick={stopCollection}
                className={`stop-button ${isStopping ? 'stopping' : ''}`}
                disabled={isStopping}
              >
                {isStopping ? tr('正在停止...') : tr('停止采集')}
              </button>
            )
          )}
        </div>

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#f0f5ff',
            border: '1px solid #adc6ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1890ff',
            lineHeight: '1.5'
          }}
        >
          ℹ️ {tr('quota.keyword.tip')}
        </div>

        <div className="sub-section">
          <h3>{tr('选择需要的字段')}</h3>
          <p className="field-tip">{tr('未创建的字段将被自动创建')}</p>
          <div className="field-select-list">
            {KEYWORD_FIELD_NAMES.map(fieldName => (
              <div key={fieldName} className="field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={keywordRequiredFields.has(fieldName) || keywordSelectedFields[fieldName] || false}
                    onChange={() => handleKeywordFieldChange(fieldName)}
                    disabled={isCollecting || keywordRequiredFields.has(fieldName)}
                  />
                  {tr(fieldName)}
                  {keywordRequiredFields.has(fieldName) && ` (${tr('必选')})`}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
