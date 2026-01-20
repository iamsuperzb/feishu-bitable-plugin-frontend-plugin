/**
 * 标准化工具函数
 * 用于统一处理URL、账户名等标识符，确保去重的一致性
 */

/**
 * 标准化视频链接用于去重
 *
 * 策略：
 * - 保留协议+主机+路径，去除查询参数和哈希
 * - 统一转为小写
 * - 提高幂等性，避免因URL参数差异导致重复记录
 *
 * @param raw - 原始URL字符串
 * @returns 标准化后的URL，失败则返回修剪后的小写字符串
 *
 * @example
 * normalizeUrlKey('https://www.tiktok.com/@user/video/123?foo=bar#xyz')
 * // => 'https://www.tiktok.com/@user/video/123'
 */
export const normalizeUrlKey = (raw: string): string => {
  if (!raw) return ''

  try {
    const url = new URL(raw.trim())
    // 仅保留协议+主机+路径，去掉查询串/哈希，提高幂等性
    return `${url.protocol}//${url.host}${url.pathname}`.toLowerCase()
  } catch {
    // URL解析失败时，返回修剪后的小写字符串作为备选
    return raw.trim().toLowerCase()
  }
}

/**
 * 标准化账户名用于去重
 *
 * 策略：
 * - 去除开头的@符号
 * - 构建完整的TikTok账户URL
 * - 统一转为小写
 *
 * @param raw - 原始账户名（可能包含@前缀）
 * @returns 标准化后的账户URL，空名称返回空字符串
 *
 * @example
 * normalizeAccountKey('@username')
 * // => 'https://www.tiktok.com/@username'
 *
 * normalizeAccountKey('username')
 * // => 'https://www.tiktok.com/@username'
 */
export const normalizeAccountKey = (raw: string): string => {
  const input = (raw || '').trim()
  if (!input) return ''

  const cleaned = input.replace(/^@/, '')
  const toAccountUrl = (username: string) => `https://www.tiktok.com/@${username}`.toLowerCase()
  const tryParseUrl = (value: string): URL | null => {
    try {
      return new URL(value)
    } catch {
      return null
    }
  }

  let parsed: URL | null = null
  if (cleaned.includes('tiktok.com/')) {
    parsed = tryParseUrl(cleaned)
    if (!parsed) {
      parsed = tryParseUrl(`https://${cleaned.replace(/^https?:\/\//, '')}`)
    }
  }

  if (parsed && parsed.hostname.toLowerCase().includes('tiktok.com')) {
    const match = parsed.pathname.match(/@([^/]+)/)
    if (match?.[1]) {
      return toAccountUrl(match[1])
    }
    return ''
  }

  const name = cleaned.replace(/^@/, '')
  if (!name) return ''
  return toAccountUrl(name)
}

/**
 * 提取账号名称（支持账号名、@账号名、账号主页链接）
 *
 * @param raw - 原始输入
 * @returns 账号名称，失败返回空字符串
 */
export const extractAccountName = (raw: string): string => {
  const normalized = normalizeAccountKey(raw)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    const match = url.pathname.match(/@([^/]+)/)
    return match?.[1] || ''
  } catch {
    return ''
  }
}
