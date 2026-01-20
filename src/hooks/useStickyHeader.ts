/**
 * 顶部固定区域管理 Hook
 *
 * 管理顶部固定区域的滚动状态
 * 职责：
 * - 监听固定区域尺寸变化
 * - 判断固定区域是否已吸顶
 *
 * @remarks
 * 仅控制吸顶状态，不做缩放处理
 */

import { useState, useRef, useEffect } from 'react'

/**
 * 顶部固定区域管理 Hook
 *
 * @returns Header 引用、状态和样式参数
 *
 * @example
 * ```tsx
 * const {
 *   appRef,
 *   mainHeaderRef,
 *   mainHeaderHeight,
 *   headerPinned
 * } = useStickyHeader()
 *
 * return (
 *   <div ref={appRef}>
 *     <div ref={mainHeaderRef}>
 *       顶部固定区域
 *     </div>
 *     <div style={{ top: `${mainHeaderHeight}px` }}>
 *       二级 Header（粘性）
 *     </div>
 *   </div>
 * )
 * ```
 */
type UseStickyHeaderOptions = {
  onScroll?: (scrollTop: number) => void
}

export const useStickyHeader = (options: UseStickyHeaderOptions = {}) => {
  // 主容器和主Header的引用
  const appRef = useRef<HTMLDivElement>(null)
  const mainHeaderRef = useRef<HTMLDivElement>(null)

  // 滚动动画帧的引用，用于requestAnimationFrame节流
  const scrollRafRef = useRef<number | null>(null)
  const onScrollRef = useRef<UseStickyHeaderOptions['onScroll']>(options.onScroll)

  // 主Header的实际高度（px）
  const [mainHeaderHeight, setMainHeaderHeight] = useState(0)

  // Header是否已吸顶
  const [headerPinned, setHeaderPinned] = useState(false)

  useEffect(() => {
    onScrollRef.current = options.onScroll
  }, [options.onScroll])

  // ==================== 监听主Header尺寸变化 ====================
  // 使用ResizeObserver动态监听主Header高度，驱动二级Header的sticky top偏移
  useEffect(() => {
    const el = mainHeaderRef.current
    if (!el) return

    // 降级方案：浏览器不支持ResizeObserver时使用getBoundingClientRect
    if (typeof ResizeObserver === 'undefined') {
      setMainHeaderHeight(el.getBoundingClientRect().height || 0)
      return
    }

    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setMainHeaderHeight(rect.height)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ==================== 监听滚动控制Header吸顶状态 ====================
  // 使用requestAnimationFrame节流
  useEffect(() => {
    // 直接获取#root元素作为滚动容器
    const scrollElement = document.getElementById('root')
    if (!scrollElement) {
      console.error('[Scroll] #root element not found')
      return
    }

    // ✅ 在初始化时保存header的初始位置（sticky元素的offsetTop会随滚动变化）
    const initialHeaderTop = mainHeaderRef.current?.offsetTop ?? 0

    const handleScroll = () => {
      // 防止多次触发，使用RAF节流
      if (scrollRafRef.current) return

      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null

        const scrollY = scrollElement.scrollTop

        // 判断是否已吸顶（滚动超过header顶部2px）
        const pinned = scrollY > initialHeaderTop + 2
        setHeaderPinned(prev => (prev === pinned ? prev : pinned))
        onScrollRef.current?.(scrollY)
      })
    }

    // 监听滚动容器
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // 初始化时执行一次

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null // ✅ 重置ref，否则Strict Mode下第二次mount会跳过
      }
    }
  }, [])

  return {
    appRef,
    mainHeaderRef,
    mainHeaderHeight,
    headerPinned
  }
}
