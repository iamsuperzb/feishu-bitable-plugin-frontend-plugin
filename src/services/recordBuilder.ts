/**
 * 记录构建服务层
 *
 * 配置驱动的记录构建器，统一处理不同数据源的记录生成
 * 职责：
 * - 字段映射配置管理
 * - 通用记录构建逻辑
 * - 值标准化和字段写入
 *
 * 优势：
 * - 配置驱动：新增数据源只需添加配置
 * - 类型安全：完整的 TypeScript 类型支持
 * - 可测试：纯函数逻辑，易于单元测试
 */

import type { IOpenCellValue } from '@lark-base-open/js-sdk'
import type { FieldWriter } from '../types/bitable'
import { normalizeValue } from './bitableApi'
import { normalizeUrlKey, normalizeAccountKey } from '../utils/normalize'
import { commerceFromAweme, translateCommerceReason, pickProductLink } from './commerceDetection'
import type { CommerceResult } from './commerceDetection'

/**
 * 字段映射配置
 *
 * 定义如何从原始数据中提取字段值
 */
export interface FieldMapping<T = unknown> {
  /** 字段名称（与 FieldWriter 中的 name 对应） */
  name: string
  /** 值提取函数（从原始数据中提取值） */
  getValue: (data: T, context?: RecordBuildContext) => unknown
}

/**
 * 记录构建上下文
 *
 * 提供额外的上下文信息给字段映射函数
 */
export interface RecordBuildContext {
  /** 关键词（用于关键词搜索记录） */
  keyword?: string
  /** hashtag 名称（用于 hashtag 记录） */
  hashtag?: string
  /** 商品检测结果（自动计算，无需手动传入） */
  commerce?: CommerceResult
  /** 其他自定义上下文 */
  [key: string]: unknown
}

interface KeywordVideoItem {
  author: { uniqueId: string }
  desc: string
  createTime: number
  region?: string
  shareLink: string
  videoUrl: string
  coverFile?: File
  stats: {
    playCount?: number
    diggCount?: number
    commentCount?: number
    shareCount?: number
    collectCount?: number
  }
  anchors?: unknown[]
  anchor_info?: unknown[]
  bottom_products?: unknown[]
  products_info?: unknown[]
  right_products?: unknown[]
  has_commerce_goods?: boolean
  existed_commerce_goods?: boolean
  ecommerce_goods?: boolean
  commerce_info?: {
    branded_content_type: number
    bc_label_test_text?: string
  }
  commerce?: CommerceResult
}

interface AccountVideoItem {
  share_url: string
  create_time: number
  desc: string
  coverFile?: File
  statistics: {
    play_count?: number
    digg_count?: number
    comment_count?: number
    collect_count?: number
    share_count?: number
  }
  region?: string
  music_title?: string
  download_url?: string
  post_type?: string
  anchors?: unknown[]
  anchor_info?: unknown[]
  bottom_products?: unknown[]
  products_info?: unknown[]
  right_products?: unknown[]
  has_commerce_goods?: boolean
  existed_commerce_goods?: boolean
  ecommerce_goods?: boolean
  commerce_info?: {
    branded_content_type: number
    bc_label_test_text?: string
  }
  commerce?: CommerceResult
}

interface AccountInfoItem {
  username?: string
  accountName?: string
  accountUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  followers?: number
  likes?: number
  videos?: number
  averagePlayCount?: number
  interactionRate?: number
  email?: string
  videoLocation?: string
  hasShop?: boolean
  lastPostTime?: number
  postFrequency?: number
  fetchedAt?: number
}

/**
 * 计算视频互动率
 *
 * @param playCount - 播放量
 * @param diggCount - 点赞数
 * @param commentCount - 评论数
 * @param collectCount - 收藏数
 * @param shareCount - 分享数
 * @returns 互动率（0-1 之间的小数）
 *
 * @remarks
 * 公式: (点赞 + 评论 + 收藏 + 分享) / 播放量
 */
const calculateInteractionRate = (
  playCount: number,
  diggCount: number,
  commentCount: number,
  collectCount: number,
  shareCount: number
): number => {
  if (playCount <= 0) return 0
  const interactionCount = (diggCount || 0) + (commentCount || 0) + (collectCount || 0) + (shareCount || 0)
  return interactionCount / playCount
}

// ==================== 字段映射配置 ====================

/**
 * 关键词视频字段映射
 */
export const KEYWORD_VIDEO_MAPPINGS: FieldMapping<KeywordVideoItem>[] = [
  { name: '关键词', getValue: (_, ctx) => ctx?.keyword },
  { name: '发布时间', getValue: item => item.createTime * 1000 },
  { name: '视频链接', getValue: item => item.shareLink },
  { name: '视频封面', getValue: item => item.coverFile },
  { name: '视频播放量', getValue: item => item.stats.playCount },
  { name: '点赞数量', getValue: item => item.stats.diggCount },
  { name: '评论数量', getValue: item => item.stats.commentCount },
  { name: '分享数量', getValue: item => item.stats.shareCount },
  { name: '收藏数量', getValue: item => item.stats.collectCount },
  {
    name: '视频互动率',
    getValue: item => calculateInteractionRate(
      item.stats.playCount || 0,
      item.stats.diggCount || 0,
      item.stats.commentCount || 0,
      item.stats.collectCount || 0,
      item.stats.shareCount || 0
    )
  },
  { name: '账号名称', getValue: item => item.author.uniqueId },
  { name: '视频标题', getValue: item => item.desc },
  { name: '视频发布国家', getValue: item => item.region || '' },
  { name: '视频下载链接', getValue: item => item.videoUrl },
  { name: '是否带货', getValue: (_, ctx) => ctx?.commerce?.isCommerce ?? false },
  {
    name: '带货产品链接',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link)[0] || ''
    }
  },
  {
    name: '带货产品链接（全部）',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link).join('\n')
    }
  },
  {
    name: '带货原因',
    getValue: (_, ctx) => {
      const reasons = ctx?.commerce?.reasons || []
      return reasons.map(r => translateCommerceReason(r)).join('、')
    }
  },
  {
    name: '带货产品数量',
    getValue: (_, ctx) => {
      const commerce = ctx?.commerce
      return commerce?.isCommerce ? Math.floor(commerce?.productsTotal || 0) : ''
    }
  },
  { name: '带货产品信息', getValue: (_, ctx) => ctx?.commerce?.productsText || '' }
]

/**
 * hashtag 视频字段映射
 */
export const HASHTAG_VIDEO_MAPPINGS: FieldMapping<KeywordVideoItem>[] = [
  { name: 'hashtag', getValue: (_, ctx) => ctx?.hashtag },
  { name: '发布时间', getValue: item => item.createTime * 1000 },
  { name: '视频链接', getValue: item => item.shareLink },
  { name: '视频封面', getValue: item => item.coverFile },
  { name: '视频播放量', getValue: item => item.stats.playCount },
  { name: '点赞数量', getValue: item => item.stats.diggCount },
  { name: '评论数量', getValue: item => item.stats.commentCount },
  { name: '分享数量', getValue: item => item.stats.shareCount },
  { name: '收藏数量', getValue: item => item.stats.collectCount },
  {
    name: '视频互动率',
    getValue: item => calculateInteractionRate(
      item.stats.playCount || 0,
      item.stats.diggCount || 0,
      item.stats.commentCount || 0,
      item.stats.collectCount || 0,
      item.stats.shareCount || 0
    )
  },
  { name: '账号名称', getValue: item => item.author.uniqueId },
  { name: '视频标题', getValue: item => item.desc },
  { name: '视频发布国家', getValue: item => item.region || '' },
  { name: '视频下载链接', getValue: item => item.videoUrl },
  { name: '是否带货', getValue: (_, ctx) => ctx?.commerce?.isCommerce ?? false },
  {
    name: '带货产品链接',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link)[0] || ''
    }
  },
  {
    name: '带货产品链接（全部）',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link).join('\n')
    }
  },
  {
    name: '带货原因',
    getValue: (_, ctx) => {
      const reasons = ctx?.commerce?.reasons || []
      return reasons.map(r => translateCommerceReason(r)).join('、')
    }
  },
  {
    name: '带货产品数量',
    getValue: (_, ctx) => {
      const commerce = ctx?.commerce
      return commerce?.isCommerce ? Math.floor(commerce?.productsTotal || 0) : ''
    }
  },
  { name: '带货产品信息', getValue: (_, ctx) => ctx?.commerce?.productsText || '' }
]

/**
 * 账号视频字段映射
 */
export const ACCOUNT_VIDEO_MAPPINGS: FieldMapping<AccountVideoItem>[] = [
  { name: '视频链接', getValue: item => item.share_url },
  { name: '视频封面', getValue: item => item.coverFile },
  { name: '视频发布时间', getValue: item => item.create_time * 1000 },
  { name: '视频标题', getValue: item => item.desc },
  { name: '播放量', getValue: item => item.statistics.play_count },
  { name: '点赞数量', getValue: item => item.statistics.digg_count },
  { name: '评论数量', getValue: item => item.statistics.comment_count },
  { name: '转发数量', getValue: item => item.statistics.share_count },
  { name: '收藏数量', getValue: item => item.statistics.collect_count },
  {
    name: '视频互动率',
    getValue: item => calculateInteractionRate(
      item.statistics.play_count || 0,
      item.statistics.digg_count || 0,
      item.statistics.comment_count || 0,
      item.statistics.collect_count || 0,
      item.statistics.share_count || 0
    )
  },
  { name: '视频发布国家', getValue: item => item.region },
  { name: '视频BGM标题', getValue: item => item.music_title },
  { name: '视频下载链接', getValue: item => item.download_url },
  { name: '帖子类型', getValue: item => item.post_type },
  { name: '是否带货', getValue: (_, ctx) => ctx?.commerce?.isCommerce ?? false },
  {
    name: '带货产品链接',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link)[0] || ''
    }
  },
  {
    name: '带货产品链接（全部）',
    getValue: (_, ctx) => {
      const products = ctx?.commerce?.products || []
      return products.map(p => pickProductLink(p)).filter(link => link).join('\n')
    }
  },
  {
    name: '带货原因',
    getValue: (_, ctx) => {
      const reasons = ctx?.commerce?.reasons || []
      return reasons.map(r => translateCommerceReason(r)).join('、')
    }
  },
  {
    name: '带货产品数量',
    getValue: (_, ctx) => {
      const commerce = ctx?.commerce
      return commerce?.isCommerce ? Math.floor(commerce?.productsTotal || 0) : ''
    }
  },
  { name: '带货产品信息', getValue: (_, ctx) => ctx?.commerce?.productsText || '' }
]

/**
 * 账号信息字段映射
 */
export const ACCOUNT_INFO_MAPPINGS: FieldMapping<AccountInfoItem>[] = [
  { name: 'TT账户名称', getValue: info => info.accountName || info.username },
  { name: 'TT账户URL', getValue: info => normalizeAccountKey(info.accountUrl || info.username || info.accountName || '') },
  { name: 'Instagram URL', getValue: info => info.instagramUrl || '' },
  { name: 'YouTube URL', getValue: info => info.youtubeUrl || '' },
  { name: '关注者数量', getValue: info => info.followers ?? 0 },
  { name: '点赞数量', getValue: info => info.likes ?? 0 },
  { name: '视频数量', getValue: info => info.videos ?? 0 },
  { name: '平均播放量', getValue: info => info.averagePlayCount ?? 0 },
  { name: '视频互动率', getValue: info => info.interactionRate ?? 0 },
  { name: '电子邮件地址', getValue: info => info.email || '' },
  { name: '视频创建位置', getValue: info => info.videoLocation || '' },
  { name: '是否有小店', getValue: info => info.hasShop ?? false },
  { name: '最后发帖时间', getValue: info => info.lastPostTime || undefined },
  { name: '发帖频率', getValue: info => info.postFrequency ?? 0 },
  { name: '最近拉取时间', getValue: info => info.fetchedAt || Date.now() }
]

// ==================== 通用记录构建器 ====================

/**
 * 通用记录构建器
 *
 * @param data - 原始数据（任意类型）
 * @param mappings - 字段映射配置数组
 * @param writers - 字段写入器映射
 * @param context - 额外的上下文信息
 * @returns 构建的记录字段映射，失败返回 null
 *
 * @remarks
 * - 自动处理字段值标准化
 * - 跳过缺失的字段（writer 不存在）
 * - 跳过值为 undefined 的字段（标准化失败）
 * - 对于视频数据，自动执行商品检测并注入上下文
 *
 * @example
 * ```ts
 * const record = await buildRecord(
 *   videoData,
 *   KEYWORD_VIDEO_MAPPINGS,
 *   writers,
 *   { keyword: '测试关键词' }
 * )
 * if (record) {
 *   await table.addRecord({ fields: record })
 * }
 * ```
 */
export const buildRecord = async <T = unknown>(
  data: T,
  mappings: FieldMapping<T>[],
  writers: Record<string, FieldWriter>,
  context: RecordBuildContext = {}
): Promise<Record<string, IOpenCellValue> | null> => {
  // 如果数据包含商品检测所需的字段，自动执行检测
  const rawData = data as Record<string, unknown>
  if (
    !context.commerce
    && (
      rawData.anchors
      || rawData.anchor_info
      || rawData.bottom_products
      || rawData.products_info
      || rawData.right_products
      || rawData.has_commerce_goods
      || rawData.existed_commerce_goods
      || rawData.ecommerce_goods
      || rawData.commerce_info
    )
  ) {
    context.commerce = commerceFromAweme(rawData)
  }

  const recordFields: Record<string, IOpenCellValue> = {}

  for (const mapping of mappings) {
    const writer = writers[mapping.name]
    if (!writer) continue

    try {
      const value = mapping.getValue(data, context)
      const normalized = await normalizeValue(writer, value)
      if (normalized === undefined) continue
      recordFields[writer.id] = normalized as IOpenCellValue
    } catch (error) {
      console.warn(`字段 ${mapping.name} 值提取失败:`, error)
      continue
    }
  }

  return Object.keys(recordFields).length ? recordFields : null
}

// ==================== 兼容性包装函数 ====================

/**
 * 构建关键词视频记录（兼容性包装）
 *
 * @param item - TikTok 视频数据
 * @param writers - 字段写入器
 * @param keyword - 搜索关键词
 * @returns 记录字段映射
 *
 * @remarks
 * 保留原有函数签名以确保向后兼容，内部调用通用构建器
 */
export const buildKeywordRecord = async (
  item: KeywordVideoItem,
  writers: Record<string, FieldWriter>,
  keyword: string
): Promise<Record<string, IOpenCellValue> | null> => {
  // 验证视频链接
  const linkKey = normalizeUrlKey(item.shareLink)
  if (!linkKey) {
    console.warn('[buildKeywordRecord] 视频链接为空，跳过该记录')
    return null
  }

  return buildRecord(item, KEYWORD_VIDEO_MAPPINGS, writers, { keyword, commerce: item.commerce })
}

/**
 * 构建 hashtag 视频记录（兼容性包装）
 *
 * @param item - TikTok 视频数据
 * @param writers - 字段写入器
 * @param hashtag - hashtag 名称
 * @returns 记录字段映射
 */
export const buildHashtagRecord = async (
  item: KeywordVideoItem,
  writers: Record<string, FieldWriter>,
  hashtag: string
): Promise<Record<string, IOpenCellValue> | null> => {
  const linkKey = normalizeUrlKey(item.shareLink)
  if (!linkKey) {
    console.warn('[buildHashtagRecord] 视频链接为空，跳过该记录')
    return null
  }

  return buildRecord(item, HASHTAG_VIDEO_MAPPINGS, writers, { hashtag, commerce: item.commerce })
}

/**
 * 构建账号视频记录（兼容性包装）
 *
 * @param item - 用户视频数据
 * @param writers - 字段写入器
 * @returns 记录字段映射
 *
 * @remarks
 * 保留原有函数签名以确保向后兼容，内部调用通用构建器
 */
export const buildAccountRecord = async (
  item: AccountVideoItem,
  writers: Record<string, FieldWriter>
): Promise<Record<string, IOpenCellValue> | null> => {
  // 验证视频链接
  const linkKey = normalizeUrlKey(item.share_url)
  if (!linkKey) {
    console.warn('[buildAccountRecord] 视频链接为空，跳过该记录')
    return null
  }

  return buildRecord(item, ACCOUNT_VIDEO_MAPPINGS, writers, { commerce: item.commerce })
}

/**
 * 构建账号信息记录（兼容性包装）
 *
 * @param info - 账号信息数据
 * @param writers - 字段写入器
 * @returns 记录字段映射
 *
 * @remarks
 * 保留原有函数签名以确保向后兼容，内部调用通用构建器
 */
export const buildAccountInfoRecord = async (
  info: AccountInfoItem,
  writers: Record<string, FieldWriter>
): Promise<Record<string, IOpenCellValue> | null> => {
  // 验证账号 URL
  const accountKey = normalizeAccountKey(info.accountUrl || info.username || info.accountName || '')
  if (!accountKey) {
    console.warn('[buildAccountInfoRecord] 账号 URL 为空，跳过该记录')
    return null
  }

  return buildRecord(info, ACCOUNT_INFO_MAPPINGS, writers)
}
