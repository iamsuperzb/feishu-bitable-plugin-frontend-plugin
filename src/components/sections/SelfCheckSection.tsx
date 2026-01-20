interface SelfCheckItem {
  label: string
  status: 'ok' | 'warn' | 'error'
  detail?: string
}

interface SelfCheckSectionProps {
  tr: (key: string, options?: Record<string, unknown>) => string
  open: boolean
  onToggle: () => void
  running: boolean
  results: SelfCheckItem[]
  onRun: () => void
}

const getStatusIcon = (status: SelfCheckItem['status']) => {
  if (status === 'ok') return '✅'
  if (status === 'warn') return '⚠️'
  return '❌'
}

export default function SelfCheckSection(props: SelfCheckSectionProps) {
  const { tr, open, onToggle, running, results, onRun } = props

  return (
    <div className="section">
      <div className="section-header" onClick={onToggle}>
        <h2>
          {tr('基础自检')}
          {running && <span className="running-indicator">{tr('进行中')}</span>}
        </h2>
        <span className={`collapse-icon ${open ? '' : 'collapsed'}`}>▼</span>
      </div>

      <div className={`section-content ${open ? 'open' : 'collapsed'}`}>
        <div className="search-action">
          <button onClick={onRun} disabled={running}>
            {running ? tr('正在自检...') : tr('开始自检')}
          </button>
        </div>

        {results.length ? (
          <div className="self-check-list">
            {results.map((item, index) => (
              <div key={`${item.label}-${index}`} className={`self-check-item ${item.status}`}>
                <span className="self-check-icon">{getStatusIcon(item.status)}</span>
                <span className="self-check-label">{item.label}</span>
                {item.detail && <span className="self-check-detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="self-check-empty">{tr('尚未进行自检')}</div>
        )}
      </div>
    </div>
  )
}
