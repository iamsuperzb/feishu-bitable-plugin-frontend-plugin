import React from 'react'
import { createRoot } from 'react-dom/client'
import './i18n' // 确保国际化被正确初始化
import App from './App'

const rootElement = document.getElementById('root')
if (rootElement) {
  const root = createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
