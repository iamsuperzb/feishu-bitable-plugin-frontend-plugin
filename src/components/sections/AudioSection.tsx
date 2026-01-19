import type { IFieldMeta } from '@lark-base-open/js-sdk'

type TableTarget = 'current' | 'new'
type AudioMode = 'column' | 'batch'

interface AudioSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  fields: IFieldMeta[]
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
  handleAudioExtract: () => void
  handleAudioStop: () => void
}

export default function AudioSection(props: AudioSectionProps) {
  const {
    tr,
    open,
    onToggle,
    fields,
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
    handleAudioExtract,
    handleAudioStop
  } = props

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('提取视频音频')}
          {audioLoading && <span className="running-indicator">{tr('提取中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-form">
          <div className="form-item">
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

          {audioMode === 'column' ? (
            <div className="form-item">
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
            <div className="form-item">
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

          <div className="form-item">
            {audioMode === 'column' && audioTargetTable === 'current' ? (
              <>
                <label>{tr('输出文案:')}</label>
                <select
                  value={audioOutputField}
                  onChange={(e) => setAudioOutputField(e.target.value)}
                  disabled={audioLoading}
                  className="select-styled"
                >
                  <option value="">{tr('请选择输出文案列')}</option>
                  {fields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label>{tr('输出文案:')}</label>
                <input
                  type="text"
                  value={audioTargetTable === 'new' ? tr('将自动写入新表') : tr('写入当前表格')}
                  disabled
                />
              </>
            )}
          </div>

          <div className="form-item">
            <label>{tr('写入目标:')}</label>
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
                {tr('写入当前表格')}
              </label>
            </div>
          </div>

          {audioTargetTable === 'new' && (
            <div className="form-item">
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

        <div className="search-action">
          {!audioLoading ? (
            <button
              onClick={handleAudioExtract}
              disabled={
                (audioMode === 'column' && (!audioVideoUrlField || (audioTargetTable === 'current' && !audioOutputField))) ||
                (audioMode === 'batch' && !audioBatchInput.trim())
              }
            >
              {tr('开始提取')}
            </button>
          ) : (
            <button
              onClick={handleAudioStop}
              className="stop-button"
            >
              {tr('停止提取')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
