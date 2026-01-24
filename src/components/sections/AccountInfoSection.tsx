import type { IFieldMeta } from '@lark-base-open/js-sdk'

type TableTarget = 'current' | 'new'
type AccountInfoMode = 'column' | 'batch'

interface AccountInfoSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  fields: IFieldMeta[]
  accountInfoMode: AccountInfoMode
  setAccountInfoMode: (val: AccountInfoMode) => void
  accountInfoUsernameField: string
  setAccountInfoUsernameField: (val: string) => void
  accountInfoOverwrite: boolean
  setAccountInfoOverwrite: (val: boolean) => void
  accountInfoColumnTargetTable: TableTarget
  setAccountInfoColumnTargetTable: (val: TableTarget) => void
  accountInfoColumnNewTableName: string
  setAccountInfoColumnNewTableName: (val: string) => void
  batchTargetTable: TableTarget
  setBatchTargetTable: (val: TableTarget) => void
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
    accountInfoMode,
    setAccountInfoMode,
    accountInfoUsernameField,
    setAccountInfoUsernameField,
    accountInfoOverwrite,
    setAccountInfoOverwrite,
    accountInfoColumnTargetTable,
    setAccountInfoColumnTargetTable,
    accountInfoColumnNewTableName,
    setAccountInfoColumnNewTableName,
    batchTargetTable,
    setBatchTargetTable,
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
    handleAccountInfoStop
  } = props

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('账号资料批量补全')}
          {accountInfoLoading && <span className="running-indicator">{tr('获取中')}</span>}
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
                    {tr('写入当前表格')}
                  </label>
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
                    {tr('写入当前表格')}
                  </label>
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

        <div className="search-action">
          {!accountInfoLoading ? (
            <>
              <button
                onClick={handleAccountInfoFetch}
                disabled={
                  (accountInfoMode === 'column' && !accountInfoUsernameField) ||
                  (accountInfoMode === 'batch' && !accountInfoBatchInput.trim()) ||
                  accountInfoQuotaInsufficient
                }
              >
                {tr('开始获取')}
              </button>
            </>
          ) : (
            <button
              onClick={handleAccountInfoStop}
              className="stop-button"
            >
              {tr('停止获取')}
            </button>
          )}
        </div>

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
      </div>
    </div>
  )
}
