/**
 * TikTok API 相关类型定义
 *
 * 提供 TikTok API 请求和响应的类型接口
 */

/**
 * 商品信息
 *
 * 从视频中检测到的电商产品信息
 */
export interface CommerceProduct {
  /** 产品 ID */
  productId?: string
  /** 产品标题 */
  title?: string
  /** 产品价格 */
  price?: number
  /** 货币单位 */
  currency?: string
  /** 产品链接 */
  link?: string
  /** 来源平台 */
  source?: string
  /** 广告标签 */
  adLabel?: string
}

/**
 * 商品检测结果
 *
 * 视频是否包含商品信息及检测到的产品列表
 */
export interface CommerceResult {
  /** 是否包含商品 */
  isCommerce: boolean
  /** 触发原因 */
  reasons: string[]
  /** 检测到的商品列表 */
  products: CommerceProduct[]
  /** 商品数量 */
  productsTotal: number
  /** 首个商品 */
  firstProduct?: CommerceProduct
  /** 商品摘要文本 */
  productsText: string
}

/**
 * 作者信息
 *
 * TikTok 用户/作者的基本信息
 */
export interface AuthorInfo {
  /** 用户唯一标识符 */
  uniqueId: string
  /** 用户昵称 */
  nickname?: string
  /** 头像 URL */
  avatarUrl?: string
  /** 签名 */
  signature?: string
  /** 粉丝数 */
  followerCount?: number
  /** 关注数 */
  followingCount?: number
  /** 获赞数 */
  totalLiked?: number
  /** 视频数 */
  videoCount?: number
}

/**
 * 视频统计数据
 *
 * 视频的互动数据统计
 */
export interface VideoStats {
  /** 播放量 */
  playCount: number
  /** 点赞数 */
  diggCount: number
  /** 评论数 */
  commentCount: number
  /** 分享数 */
  shareCount: number
  /** 收藏数 */
  collectCount?: number
}

/**
 * 标准化后的 TikTok 视频数据
 *
 * 从 API 响应中提取并标准化的视频信息
 */
export interface TikTokVideoData {
  /** 作者信息 */
  author: AuthorInfo
  /** 视频描述 */
  desc: string
  /** 创建时间（Unix 时间戳） */
  createTime: number
  /** 分享链接 */
  shareLink: string
  /** 视频 URL */
  videoUrl: string
  /** 统计数据 */
  stats: VideoStats
  /** 商品信息（可选） */
  commerce?: CommerceResult
}

/**
 * 搜索 API 响应中的视频项
 *
 * /api/tiktok 端点返回的搜索结果项结构
 */
export interface SearchItemData {
  /** 视频信息 */
  aweme_info: {
    /** 作者信息 */
    author: {
      unique_id: string
      nickname?: string
      avatar_thumb?: { url_list?: string[] }
      signature?: string
    }
    /** 视频描述 */
    desc: string
    /** 创建时间 */
    create_time: number
    /** 统计数据 */
    statistics?: {
      play_count?: number
      digg_count?: number
      comment_count?: number
      share_count?: number
      collect_count?: number
    }
    /** 视频信息 */
    video?: {
      play_addr?: { url_list?: string[] }
      download_addr?: { url_list?: string[] }
    }
    /** 分享 URL */
    share_url?: string
  }
}

/**
 * 关键词搜索 API 响应
 */
export interface KeywordSearchResponse {
  /** 搜索结果列表 */
  search_item_list: SearchItemData[]
  /** 是否有更多结果 */
  has_more: boolean
  /** 下一页游标 */
  cursor?: number
}

/**
 * 用户视频 API 响应中的视频项
 *
 * /api/tiktok-user 端点返回的视频列表项结构
 */
export interface AwemeData {
  /** 作者信息 */
  author: {
    unique_id: string
    nickname?: string
    avatar_thumb?: { url_list?: string[] }
    signature?: string
  }
  /** 视频描述 */
  desc: string
  /** 创建时间 */
  create_time: number
  /** 统计数据 */
  statistics: {
    play_count?: number
    digg_count?: number
    comment_count?: number
    share_count?: number
    collect_count?: number
  }
  /** 视频信息 */
  video?: {
    play_addr?: { url_list?: string[] }
    download_addr?: { url_list?: string[] }
  }
  /** 分享 URL */
  share_url?: string
}

/**
 * 用户视频列表 API 响应
 */
export interface UserVideosResponse {
  /** 视频列表 */
  aweme_list: AwemeData[]
  /** 是否有更多结果 */
  has_more: boolean
  /** 下一页游标 */
  max_cursor?: number
}

/**
 * 用户信息 API 响应
 *
 * 支持多种响应格式的包装结构
 */
export interface UserInfoResponse {
  /** 用户信息（格式1） */
  user?: AuthorInfo
  /** 用户信息（格式2） */
  user_info?: AuthorInfo
  /** 用户信息（格式3） */
  userInfo?: AuthorInfo
  /** 数据包装层 */
  data?: {
    user?: AuthorInfo
    user_info?: AuthorInfo
    userInfo?: AuthorInfo
  }
}

/**
 * API 请求选项
 *
 * 用于控制 API 请求行为的配置
 */
export interface FetchOptions {
  /** 超时时间（毫秒） */
  timeout?: number
  /** 中止信号 */
  signal?: AbortSignal
}

/**
 * 带身份信息的 Fetch 函数类型
 *
 * 自动附加用户身份头的 fetch 包装函数
 */
export type FetchWithIdentity = (
  url: string,
  options?: RequestInit,
  config?: { timeout?: number }
) => Promise<Response>
