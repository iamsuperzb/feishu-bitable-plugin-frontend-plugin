/**
 * 配额管理 Hook
 *
 * 管理应用的 TikTok API 配额状态，包括配额查询、头部解析、429错误处理等
 * 职责：
 * - 配额信息状态管理
 * - 配额详情展开/折叠状态
 * - 主动查询配额信息
 * - 解析响应头更新配额
 * - 处理 429 配额超限错误
 * - 定期刷新配额（10分钟轮询）
 *
 * @remarks
 * 配额系统支持三种状态：
 * - available: 配额可用（正常运行）
 * - unavailable: 配额未配置（禁用采集功能）
 * - degraded: 配额系统降级（允许采集但不显示配额）
 */

import { useState, useCallback, useEffect } from 'react'
import type { UserIdentity } from '../types/bitable'
import { getApiBase, TIMEOUT_CONFIG } from '../services/tiktokApi'
import i18n from '../i18n'

/**
 * 配额信息类型
 */
export interface QuotaInfo {
  /** 剩余配额 */
  remaining: number | null
  /** 总配额 */
  quota: number | null
  /** 配额状态 */
  status?: 'available' | 'unavailable' | 'degraded'
}

/**
 * Fetch 函数类型（带用户身份验证）
 */
export type FetchWithIdentity = (
  url: string,
  options: RequestInit,
  config?: { timeout?: number }
) => Promise<Response>

/**
 * 配额管理 Hook 参数
 */
export interface UseQuotaOptions {
  /** 用户身份信息 */
  userIdentity: UserIdentity | null
  /** 带身份验证的 fetch 函数 */
  fetchWithIdentity: FetchWithIdentity
  /** 设置消息函数 */
  setMessage: (message: string) => void
  /** 关键词采集停止标志 */
  keywordShouldStopRef: React.MutableRefObject<boolean>
  /** 账号采集停止标志 */
  accountShouldStopRef: React.MutableRefObject<boolean>
  /** 音频提取停止标志 */
  audioShouldStopRef: React.MutableRefObject<boolean>
}

/**
 * 配额管理 Hook
 *
 * @param options - Hook 配置选项
 * @returns 配额状态和操作方法
 *
 * @example
 * ```tsx
 * const {
 *   quotaInfo,
 *   quotaDetailsOpen,
 *   setQuotaDetailsOpen,
 *   handleQuotaHeaders,
 *   handle429Error
 * } = useQuota({
 *   userIdentity,
 *   fetchWithIdentity,
 *   setMessage,
 *   keywordShouldStopRef,
 *   accountShouldStopRef,
 *   audioShouldStopRef
 * })
 * ```
 */
export const useQuota = (options: UseQuotaOptions) => {
  const {
    userIdentity,
    fetchWithIdentity,
    setMessage,
    keywordShouldStopRef,
    accountShouldStopRef,
    audioShouldStopRef
  } = options

  // 配额信息状态
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null)

  // 配额详情展开状态
  const [quotaDetailsOpen, setQuotaDetailsOpen] = useState(false)

  /**
   * 处理响应头中的配额信息
   *
   * @param response - HTTP 响应对象
   *
   * @remarks
   * 从响应头提取 X-RateLimit-Remaining 和 X-RateLimit-Limit，更新配额状态
   */
  const handleQuotaHeaders = useCallback((response: Response) => {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const limit = response.headers.get('X-RateLimit-Limit')
    if (remaining && limit) {
      const remainingNum = parseInt(remaining, 10)
      const limitNum = parseInt(limit, 10)
      if (!Number.isNaN(remainingNum) && !Number.isNaN(limitNum)) {
        setQuotaInfo({ remaining: remainingNum, quota: limitNum, status: 'available' })
        console.log(`📊 配额更新: ${remainingNum}/${limitNum} 次`)
      }
    }
  }, [])

  /**
   * 处理 429 配额超限错误
   *
   * @param response - HTTP 响应对象
   * @returns 是否为 429 错误
   *
   * @remarks
   * - 更新配额显示为 0 剩余
   * - 显示配额耗尽提示
   * - 设置所有采集任务的停止标志
   * - 统一使用 UTC 00:00 重置时间提示
   */
  const handle429Error = useCallback(async (response: Response): Promise<boolean> => {
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))

      // 更新配额显示（配额已耗尽）
      handleQuotaHeaders(response)
      setQuotaInfo({
        remaining: errorData.remaining ?? 0,
        quota: errorData.quota ?? quotaInfo?.quota ?? null,
        status: 'available'
      })

      // 统一使用UTC 00:00的重置时间提示
      const fallbackQuota = errorData.quota ?? quotaInfo?.quota
      const fallbackRemaining = errorData.remaining ?? 0
      const messageText = errorData.message ||
        (typeof fallbackQuota === 'number'
          ? `今日数据点已用完（${fallbackRemaining}/${fallbackQuota}个），将于次日00:00（UTC）自动重置`
          : '今日数据点已用完，将于次日00:00（UTC）自动重置')
      setMessage(messageText)
      keywordShouldStopRef.current = true
      accountShouldStopRef.current = true
      audioShouldStopRef.current = true
      return true
    }
    return false
  }, [handleQuotaHeaders, quotaInfo?.quota, setMessage, keywordShouldStopRef, accountShouldStopRef, audioShouldStopRef])

  /**
   * 主动获取配额信息
   *
   * @remarks
   * - 不消耗配额
   * - 用于页面加载时和定期刷新
   * - 支持三种配额状态：available、unavailable、degraded
   */
  const fetchQuotaInfo = useCallback(async () => {
    if (!userIdentity) {
      console.warn('[quota] 用户身份未就绪，跳过配额查询')
      return
    }

    try {
      console.log('[quota] 开始查询配额信息')
      const response = await fetchWithIdentity(`${getApiBase()}/api/quota`, {}, { timeout: TIMEOUT_CONFIG.QUOTA })

      // 处理所有非200状态
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 503 && data?.status === 'unavailable') {
          console.error('[quota] 配额未配置，已禁用采集功能')
          setQuotaInfo({ remaining: null, quota: null, status: 'unavailable' })
          setMessage(data?.message || i18n.t('配额未配置，请联系管理员后再试'))
          return
        }
        console.warn('[quota] 配额系统降级:', data.message)
        setQuotaInfo({ remaining: null, quota: null, status: 'degraded' })
        setMessage(data?.message || i18n.t('暂时无法获取配额，请稍后重试'))
        return
      }

      // 从响应头更新配额（优先使用响应头数据）
      handleQuotaHeaders(response)

      // 解析响应体
      const data = await response.json().catch(() => ({}))

      // 处理不可用状态
      if (data?.status === 'unavailable') {
        console.info('[quota] 配额系统未启用')
        setQuotaInfo({ remaining: null, quota: null, status: 'unavailable' })
        setMessage(i18n.t('配额未配置，请联系管理员后再试'))
      } else if (data?.status === 'available' && typeof data?.remaining === 'number' && typeof data?.quota === 'number') {
        // 使用响应体中的精确数据
        setQuotaInfo({
          remaining: data.remaining,
          quota: data.quota,
          status: 'available'
        })
        setMessage('') // 清除之前的错误消息
        console.log(`[quota] 配额查询成功: ${data.remaining}/${data.quota}`)
      }
    } catch (error) {
      console.error('[quota] 配额查询失败:', error)
      setQuotaInfo({ remaining: null, quota: null, status: 'degraded' })
      setMessage(i18n.t('网络错误，无法获取配额信息'))
    }
  }, [userIdentity, fetchWithIdentity, handleQuotaHeaders, setMessage])

  // 用户身份就绪后主动获取配额，并每10分钟定期刷新
  useEffect(() => {
    if (!userIdentity) return

    console.log('[quota] 用户身份就绪，开始查询配额')
    fetchQuotaInfo()

    // 定期刷新配额（防止多端并发导致显示滞后）
    const timer = window.setInterval(() => {
      console.log('[quota] 定期刷新配额')
      fetchQuotaInfo()
    }, 10 * 60 * 1000) // 10分钟

    return () => {
      clearInterval(timer)
    }
  }, [userIdentity, fetchQuotaInfo])

  return {
    quotaInfo,
    quotaDetailsOpen,
    setQuotaDetailsOpen,
    handleQuotaHeaders,
    handle429Error
  }
}
