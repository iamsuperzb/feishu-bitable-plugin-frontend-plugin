/**
 * 格式化和工具函数
 * 提供时间格式化、表名生成、字符串清理等通用功能
 */

/**
 * Promise延迟函数
 *
 * @param ms - 延迟毫秒数
 * @returns Promise，延迟后resolve
 *
 * @example
 * await sleep(1000) // 延迟1秒
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 生成当前时间的标签字符串
 *
 * 格式：YYYYMMDD-HHMMSS
 *
 * @returns 时间标签字符串
 *
 * @example
 * formatDateTimeLabel()
 * // => '20250126-143059'
 */
export const formatDateTimeLabel = (): string => {
  const now = new Date()
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/**
 * 生成账号信息默认表名
 *
 * @returns 格式：账号信息-YYYYMMDD-HHMMSS
 */
export const getDefaultAccountInfoTableName = (): string => {
  return `账号信息-${formatDateTimeLabel()}`
}

/**
 * 生成关键词视频采集默认表名
 *
 * @param keyword - 可选的关键词，包含在表名中
 * @returns 格式：关键词视频采集[-keyword]-YYYYMMDD-HHMMSS
 */
export const getDefaultKeywordTableName = (keyword?: string): string => {
  const base = '关键词视频采集'
  const timestamp = formatDateTimeLabel()
  return keyword ? `${base}-${keyword}-${timestamp}` : `${base}-${timestamp}`
}

/**
 * 生成 hashtag 监控默认表名
 *
 * @param hashtag - 可选的 hashtag，包含在表名中
 * @returns 格式：hashtag监控[-hashtag]-YYYYMMDD-HHMMSS
 */
export const getDefaultHashtagTableName = (hashtag?: string): string => {
  const base = 'hashtag监控'
  const timestamp = formatDateTimeLabel()
  return hashtag ? `${base}-${hashtag}-${timestamp}` : `${base}-${timestamp}`
}

/**
 * 生成账户视频采集默认表名
 *
 * @param username - 可选的账户名，包含在表名中
 * @returns 格式：账户视频采集[-username]-YYYYMMDD-HHMMSS
 */
export const getDefaultAccountTableName = (username?: string): string => {
  const base = '账户视频采集'
  const timestamp = formatDateTimeLabel()
  return username ? `${base}-${username}-${timestamp}` : `${base}-${timestamp}`
}

/**
 * 生成音频转写默认表名
 *
 * @returns 格式：音频转写-YYYYMMDD-HHMMSS
 */
export const getDefaultAudioTableName = (): string => {
  return `音频转写-${formatDateTimeLabel()}`
}

/**
 * 清理并验证表名
 *
 * 规则：
 * - 移除换行符，替换为空格
 * - 替换文件系统非法字符 (\/:*?"<>|) 为短横线
 * - 限制长度为50字符
 * - 空表名时使用默认表名
 *
 * @param rawName - 原始表名
 * @returns 清理后的安全表名
 *
 * @example
 * sanitizeTableName('my/table*name')
 * // => 'my-table-name'
 */
export const sanitizeTableName = (rawName: string): string => {
  const trimmed = (rawName || '').replace(/[\r\n]+/g, ' ').trim()
  const replaced = trimmed.replace(/[\\/:*?"<>|]+/g, '-')
  const limited = replaced.slice(0, 50)
  const safe = limited || getDefaultAccountInfoTableName()
  return safe
}
