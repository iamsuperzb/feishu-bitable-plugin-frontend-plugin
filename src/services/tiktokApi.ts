/**
 * TikTok API 服务层
 *
 * 封装 TikTok API 网络请求，提供标准化的接口
 * 职责：
 * - 处理 API 请求（关键词搜索、用户视频、用户信息）
 * - 管理超时和中止信号
 * - 提供带身份验证的 fetch 包装
 *
 * 注意：商品检测逻辑保留在 App.tsx 中（阶段 3.3 再提取）
 */

import type { UserIdentity } from '../types/bitable'
import type { FetchOptions, FetchWithIdentity } from '../types/tiktok'

/**
 * 获取 API 基础 URL
 *
 * @returns API 基础 URL（移除末尾斜杠）
 */
export const getApiBase = (): string => {
  const rawApiBase = import.meta.env.VITE_API_BASE_URL || ''
  return rawApiBase ? rawApiBase.replace(/\/$/, '') : ''
}

/**
 * 超时配置常量（毫秒）
 */
export const TIMEOUT_CONFIG = {
  QUOTA: parseInt(import.meta.env.VITE_TIMEOUT_QUOTA || '5000'),
  SEARCH: parseInt(import.meta.env.VITE_TIMEOUT_SEARCH || '20000'),
  AUDIO_EXTRACT: parseInt(import.meta.env.VITE_TIMEOUT_AUDIO || '180000')
} as const

/**
 * 合并多个 AbortSignal
 *
 * @param signals - AbortSignal 数组（可包含 undefined）
 * @returns 合并后的 signal 和清理函数
 *
 * @remarks
 * - 任一 signal 中止时，合并的 signal 也会中止
 * - 必须调用 cleanup 函数清理事件监听器，避免内存泄漏
 *
 * @example
 * ```ts
 * const merged = mergeSignals([signal1, signal2])
 * fetch(url, { signal: merged.signal })
 *   .finally(() => merged.cleanup())
 * ```
 */
export const mergeSignals = (
  signals: (AbortSignal | undefined)[]
): { signal: AbortSignal; cleanup: () => void } => {
  const controller = new AbortController()
  const cleanups: Array<() => void> = []

  const onAbort = (signal?: AbortSignal) => {
    if (controller.signal.aborted) return
    controller.abort(
      signal?.reason ?? new DOMException('Aborted', 'AbortError')
    )
  }

  signals.forEach(signal => {
    if (!signal) return
    if (signal.aborted) {
      onAbort(signal)
      return
    }
    const handler = () => onAbort(signal)
    signal.addEventListener('abort', handler, { once: true })
    cleanups.push(() => signal.removeEventListener('abort', handler))
  })

  const cleanup = () => cleanups.forEach(fn => fn())
  return { signal: controller.signal, cleanup }
}

/**
 * 创建带用户身份的 fetch 包装函数（工厂模式）
 *
 * @param identity - 用户身份信息
 * @returns 配置好的 fetch 函数
 *
 * @remarks
 * - 自动附加用户身份请求头（X-Base-User-Id, X-Tenant-Key）
 * - 支持超时控制和信号合并
 * - 自动清理超时定时器和信号监听器
 *
 * @throws {Error} 如果用户身份未初始化
 *
 * @example
 * ```ts
 * const fetchFn = createFetchWithIdentity(userIdentity)
 * const response = await fetchFn('/api/tiktok', {
 *   method: 'POST',
 *   body: JSON.stringify(params)
 * }, { timeout: 20000 })
 * ```
 */
export const createFetchWithIdentity = (
  identity: UserIdentity | null
): FetchWithIdentity => {
  return (url: string, options: RequestInit = {}, config?: { timeout?: number }) => {
    if (!identity) {
      throw new Error('用户身份未初始化，请刷新页面')
    }

    // 创建超时 controller
    const timeoutController = new AbortController()
    const timeoutId = config?.timeout
      ? setTimeout(() => timeoutController.abort(), config.timeout)
      : null

    // 合并已有 signal（用户手动 abort）和超时 signal
    const merged = mergeSignals(
      [options.signal, timeoutController.signal].filter(Boolean) as AbortSignal[]
    )

    return fetch(url, {
      ...options,
      signal: merged.signal,
      headers: {
        ...options.headers,
        'X-Base-User-Id': identity.baseUserId,
        'X-Tenant-Key': identity.tenantKey
      }
    }).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
      merged.cleanup()
    })
  }
}

/**
 * 关键词视频搜索
 *
 * @param params - 搜索参数
 *   - keyword: 搜索关键词
 *   - count: 返回数量
 *   - offset: 分页偏移
 *   - sort_type: 排序类型
 *   - publish_time: 发布时间筛选
 *   - region: 地区代码
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON 和处理响应头）
 *
 * @throws {Error} 网络请求失败时抛出错误
 *
 * @example
 * ```ts
 * const response = await fetchKeywordVideos(
 *   { keyword: 'cat', count: '15', offset: '0' },
 *   fetchWithIdentity,
 *   { timeout: 20000, signal: abortController.signal }
 * )
 * // 处理配额头
 * handleQuotaHeaders(response)
 * // 处理 429
 * if (response.status === 429) { ... }
 * // 解析 JSON
 * const data = await response.json()
 * ```
 */
export const fetchKeywordVideos = async (
  params: {
    keyword: string
    count: string
    offset: string
    sort_type: string
    publish_time: string
    region: string
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/tiktok`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 用户视频列表
 *
 * @param params - 请求参数
 *   - username: 用户名
 *   - count: 返回数量
 *   - offset: 分页偏移
 *   - region: 地区代码
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON 和处理响应头）
 *
 * @throws {Error} 网络请求失败时抛出错误
 *
 * @example
 * ```ts
 * const response = await fetchAccountVideos(
 *   { username: 'testuser', count: '20', offset: '0', region: 'US' },
 *   fetchWithIdentity,
 *   { timeout: 20000 }
 * )
 * handleQuotaHeaders(response)
 * const data = await response.json()
 * ```
 */
export const fetchAccountVideos = async (
  params: {
    username: string
    count: string
    offset?: string
    max_cursor?: string
    region: string
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/tiktok-user`
  const resolvedOffset = params.offset ?? params.max_cursor ?? '0'

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: params.username,
        count: params.count,
        offset: resolvedOffset,
        region: params.region
      }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 用户信息查询
 *
 * @param username - 用户名
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON 和处理响应头）
 *
 * @throws {Error} 网络请求失败时抛出错误
 *
 * @example
 * ```ts
 * const response = await fetchAccountInfo(
 *   'testuser',
 *   fetchWithIdentity,
 *   { timeout: 20000 }
 * )
 * handleQuotaHeaders(response)
 * const data = await response.json()
 * ```
 */
export const fetchAccountInfo = async (
  username: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/tiktok-user-info`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 封面图片转 JPG
 *
 * @param coverUrl - 原始封面链接
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（成功时为 image/jpeg）
 */
export const fetchCoverAsJpg = async (
  coverUrl: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/cover-to-jpg`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: coverUrl }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 原始封面下载（不转码）
 *
 * @param coverUrl - 原始封面链接
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（成功时为原始图片内容）
 */
export const fetchCoverOriginal = async (
  coverUrl: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/cover-download`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: coverUrl }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 后台任务授权状态
 *
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const fetchOfflineAuthorizationStatus = async (
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/authorization/status`

  return fetchFn(
    apiUrl,
    { method: 'GET', signal: options.signal },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}

/**
 * 保存后台任务授权码
 *
 * @param token - 授权码
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const saveOfflineAuthorization = async (
  token: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/authorization/save`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}

/**
 * 发起关键词后台任务
 *
 * @param payload - 任务参数
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const startKeywordOfflineTask = async (
  payload: {
    keyword: string
    region: string
    vtime?: string
    sort_type?: string
    baseId: string
    targetTable: 'current' | 'new'
    tableId?: string
    tableName?: string
    selectedFields?: string[]
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/keyword/start`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 发起账号采集后台任务
 */
export const startAccountOfflineTask = async (
  payload: {
    username: string
    region: string
    baseId: string
    targetTable: 'current' | 'new'
    tableId?: string
    tableName?: string
    selectedFields?: string[]
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/account/start`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 发起账号信息后台任务
 */
export const startAccountInfoOfflineTask = async (
  payload: {
    baseId: string
    mode: 'column' | 'batch'
    targetTable: 'current' | 'new'
    tableId?: string
    tableName?: string
    sourceTableId?: string
    usernameFieldId?: string
    usernameFieldName?: string
    overwrite?: boolean
    batchUsernames?: string[]
    selectedFields?: string[]
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/account-info/start`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 发起音频后台任务
 */
export const startAudioOfflineTask = async (
  payload: {
    baseId: string
    mode: 'column' | 'batch'
    targetTable: 'current' | 'new'
    tableId?: string
    tableName?: string
    sourceTableId?: string
    videoFieldId?: string
    videoFieldName?: string
    outputFieldId?: string
    outputFieldName?: string
    batchUrls?: string[]
  },
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/audio/start`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.SEARCH }
  )
}

/**
 * 后台任务列表
 *
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const fetchOfflineTasks = async (
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/tasks/list`

  return fetchFn(
    apiUrl,
    { method: 'GET', signal: options.signal },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}

/**
 * 后台任务详情
 *
 * @param taskId - 任务 ID
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const fetchOfflineTaskDetail = async (
  taskId: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/tasks/detail?taskId=${encodeURIComponent(taskId)}`

  return fetchFn(
    apiUrl,
    { method: 'GET', signal: options.signal },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}

/**
 * 后台任务发送记录
 *
 * @param taskId - 任务 ID
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const fetchOfflineTaskLogs = async (
  taskId: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/tasks/logs?taskId=${encodeURIComponent(taskId)}`

  return fetchFn(
    apiUrl,
    { method: 'GET', signal: options.signal },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}

/**
 * 停止后台任务
 *
 * @param taskId - 任务 ID
 * @param fetchFn - 带身份的 fetch 函数
 * @param options - 请求选项（超时、中止信号）
 * @returns Response 对象（需要调用方解析 JSON）
 */
export const stopOfflineTask = async (
  taskId: string,
  fetchFn: FetchWithIdentity,
  options: FetchOptions = {}
): Promise<Response> => {
  const apiUrl = `${getApiBase()}/api/offline/tasks/stop`

  return fetchFn(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
      signal: options.signal
    },
    { timeout: options.timeout ?? TIMEOUT_CONFIG.QUOTA }
  )
}
