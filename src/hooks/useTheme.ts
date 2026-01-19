import { useEffect, useState } from 'react'
import { bitable } from '@lark-base-open/js-sdk'

export type Theme = 'LIGHT' | 'DARK'

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('LIGHT')

  useEffect(() => {
    let cancelled = false
    let off: (() => void) | undefined

    const normalizeTheme = (raw?: string): Theme => {
      const normalized = (raw || '').toLowerCase()
      return normalized === 'dark' ? 'DARK' : 'LIGHT'
    }

    const init = async () => {
      try {
        const currentTheme = await bitable.bridge.getTheme()
        if (!cancelled) setTheme(normalizeTheme(currentTheme))
      } catch (error) {
        console.warn('[theme] 获取主题失败:', error)
      }

      try {
        const bridge = bitable.bridge as unknown as {
          onThemeChange?: (cb: (event: { data?: { theme?: string } }) => void) => (() => void) | Promise<() => void>
        }
        if (typeof bridge.onThemeChange !== 'function') return

        const unsubscribe = bridge.onThemeChange(event => {
          if (cancelled) return
          setTheme(normalizeTheme(event?.data?.theme))
        })
        off = await Promise.resolve(unsubscribe)
      } catch (error) {
        console.warn('[theme] 监听主题变化失败:', error)
      }
    }

    init()

    return () => {
      cancelled = true
      off?.()
    }
  }, [])

  return theme
}
