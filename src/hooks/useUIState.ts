/**
 * UI 状态管理 Hook
 *
 * 管理应用的全局 UI 状态，包括加载状态、消息提示、采集状态等
 * 职责：
 * - 加载和消息状态管理
 * - 采集状态跟踪（isCollecting, isStopping, collectType）
 * - 手风琴式区域折叠状态管理
 *
 * @remarks
 * 这是一个轻量级的状态管理 Hook，用于替代 App.tsx 中分散的 UI 状态
 */

import { useState } from 'react'

/**
 * 区域类型定义
 */
export type SectionKey = 'keyword' | 'hashtag' | 'account' | 'accountInfo' | 'audio'

/**
 * UI 状态管理 Hook
 *
 * @returns UI 状态和操作方法
 *
 * @example
 * ```tsx
 * const {
 *   message,
 *   setMessage,
 *   isCollecting,
 *   setIsCollecting,
 *   activeSection,
 *   toggleSection
 * } = useUIState()
 *
 * // 显示消息
 * setMessage('数据加载完成')
 *
 * // 切换区域展开状态
 * toggleSection('keyword')
 * ```
 */
export const useUIState = () => {
  // 加载状态
  const [loading, setLoading] = useState(false)

  // 消息提示
  const [message, setMessage] = useState('')

  // 采集状态
  const [isCollecting, setIsCollecting] = useState(false)

  // 停止中状态
  const [isStopping, setIsStopping] = useState(false)

  // 当前采集类型：1-关键词采集，2-账号采集，3-hashtag采集
  const [collectType, setCollectType] = useState(1)

  // UI折叠状态（手风琴模式：同一时间只有一个区域展开）
  const [activeSection, setActiveSection] = useState<SectionKey | null>('keyword')

  /**
   * 切换区域折叠状态（手风琴模式）
   *
   * @param section - 要切换的区域
   *
   * @remarks
   * - 点击已打开的区域则关闭
   * - 点击未打开的区域则打开并关闭其他区域
   */
  const toggleSection = (section: SectionKey) => {
    setActiveSection(prev => (prev === section ? null : section))
  }

  return {
    // 加载状态
    loading,
    setLoading,

    // 消息提示
    message,
    setMessage,

    // 采集状态
    isCollecting,
    setIsCollecting,
    isStopping,
    setIsStopping,
    collectType,
    setCollectType,

    // 区域折叠状态
    activeSection,
    toggleSection
  }
}
