import { useEffect, useState, useRef, Fragment, CSSProperties, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  bitable,
  FieldType,
  IGetRecordsParams,
  IOpenCellValue,
  ITable
} from '@lark-base-open/js-sdk'
import './App.css'
import KeywordSection from './components/sections/KeywordSection'
import AccountSection from './components/sections/AccountSection'
import AccountInfoSection from './components/sections/AccountInfoSection'
import AudioSection from './components/sections/AudioSection'
import { useTheme } from './hooks/useTheme'
import { useUIState } from './hooks/useUIState'
import { useQuota } from './hooks/useQuota'
import { useBitable } from './hooks/useBitable'
import { useStickyHeader } from './hooks/useStickyHeader'
import { extractAccountName, normalizeAccountKey, normalizeUrlKey } from './utils/normalize'
import {
  getDefaultAccountInfoTableName,
  getDefaultAccountTableName,
  getDefaultAudioTableName,
  getDefaultKeywordTableName,
  sanitizeTableName,
  sleep
} from './utils/format'
import {
  addRecordsInBatches,
  attachPrimaryNameWriter,
  buildFieldWriters,
  collectExistingKeys,
  createNewTable,
  ensureFields,
  extractTextFromCell,
  getEmptyRecords,
  isCellValueEmpty,
  normalizeValue
} from './services/bitableApi'
import {
  createFetchWithIdentity,
  fetchAccountInfo as fetchAccountInfoApi,
  fetchAccountVideos,
  fetchCoverAsJpg,
  fetchCoverOriginal,
  fetchKeywordVideos,
  getApiBase,
  TIMEOUT_CONFIG
} from './services/tiktokApi'
import { commerceFromAweme } from './services/commerceDetection'
import {
  buildKeywordRecord,
  buildAccountRecord,
  buildAccountInfoRecord
} from './services/recordBuilder'
import type { FieldConfig, UserIdentity } from './types/bitable'
import type { CommerceResult } from './services/commerceDetection'

// Anchor 项类型（App.tsx 本地使用）
interface AnchorItem {
  component_key?: string
  extra?: unknown
}

interface VideoCoverSource {
  cover?: {
    url_list?: string[]
  }
  origin_cover?: {
    url_list?: string[]
  }
  dynamic_cover?: {
    url_list?: string[]
  }
}

const pickCoverUrl = (video?: VideoCoverSource): string => {
  const candidates = [
    video?.dynamic_cover?.url_list?.[0],
    video?.cover?.url_list?.[0],
    video?.origin_cover?.url_list?.[0]
  ]
  return candidates.find((url) => typeof url === 'string' && url.trim()) || ''
}

const buildCoverFileName = (prefix: string, awemeId?: string) => {
  const safePrefix = prefix.trim() || 'cover'
  const suffix = awemeId || Date.now().toString()
  return `${safePrefix}-${suffix}.jpg`
}

const buildVideoShareLink = ({
  shareUrl,
  shareInfoUrl,
  awemeId,
  authorId
}: {
  shareUrl?: string
  shareInfoUrl?: string
  awemeId?: string
  authorId?: string
}) => {
  const normalizeLink = (url?: string) => {
    if (!url) return ''
    const trimmed = url.trim()
    if (!trimmed) return ''
    return trimmed.split('?')[0]
  }

  const rootLink = normalizeLink(shareUrl)
  if (rootLink) return rootLink

  const shareInfoLink = normalizeLink(shareInfoUrl)
  if (shareInfoLink) return shareInfoLink

  if (awemeId && authorId) {
    return `https://www.tiktok.com/@${authorId}/video/${awemeId}`
  }

  return ''
}

interface SearchItemData {
  aweme_info?: {
    aweme_id?: string
    share_url?: string  // 根层级的 share_url（优先使用）
    author: {
      unique_id: string
    }
    desc: string
    create_time: number
    share_info?: {
      share_url?: string  // share_info 中的 share_url（备用）
    }
    video: {
      play_addr: {
        url_list: string[]
      }
      cover?: {
        url_list?: string[]
      }
      origin_cover?: {
        url_list?: string[]
      }
      dynamic_cover?: {
        url_list?: string[]
      }
    }
    statistics: {
      play_count: number
      digg_count: number
      comment_count: number
      share_count: number
      collect_count: number
    }
    anchors?: AnchorItem[]
    anchor_info?: AnchorItem[]
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
  }
}

interface UserVideoData {
  desc: string;
  create_time: number;
  share_url: string;
  download_url: string;
  region: string;
  music_title: string;
  coverUrl?: string;
  coverFile?: File;
  awemeId?: string;
  statistics: {
    play_count: number;
    digg_count: number;
    comment_count: number;
    share_count: number;
    collect_count: number;
  };
  post_type: string;
  anchors?: AnchorItem[];
  anchor_info?: AnchorItem[];
  bottom_products?: unknown[];
  products_info?: unknown[];
  right_products?: unknown[];
  has_commerce_goods?: boolean;
  existed_commerce_goods?: boolean;
  ecommerce_goods?: boolean;
  commerce_info?: {
    branded_content_type: number;
    bc_label_test_text?: string;
  };
  commerce?: CommerceResult;
}

interface AwemeItem {
  desc: string;
  create_time: number;
  aweme_id?: string;
  author?: {
    unique_id: string;
  };
  share_url?: string;
  share_info?: {
    share_url: string;
  };
  video?: {
    play_addr?: {
      url_list?: string[];
    };
    cover?: {
      url_list?: string[];
    };
    origin_cover?: {
      url_list?: string[];
    };
    dynamic_cover?: {
      url_list?: string[];
    };
  };
  region?: string;
  music?: {
    title: string;
  };
  statistics?: {
    play_count: number;
    digg_count: number;
    comment_count: number;
    share_count: number;
    collect_count: number;
  };
  anchors?: AnchorItem[];
  anchor_info?: AnchorItem[];
  bottom_products?: unknown[];
  products_info?: unknown[];
  right_products?: unknown[];
  has_commerce_goods?: boolean;
  existed_commerce_goods?: boolean;
  ecommerce_goods?: boolean;
  commerce_info?: {
    branded_content_type: number;
    bc_label_test_text?: string;
  };
}

interface AccountInfoResponse {
  username: string;
  accountName: string;
  accountUrl: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  followers?: number;
  likes?: number;
  videos?: number;
  averagePlayCount?: number;
  interactionRate?: number;
  email?: string;
  videoLocation?: string;
  hasShop?: boolean;
  lastPostTime?: number;
  postFrequency?: number;
  fetchedAt?: number;
}

const KEYWORD_FIELD_CONFIGS: FieldConfig[] = [
  { field_name: '关键词', type: FieldType.Text },
  { field_name: '发布时间', type: FieldType.DateTime },
  { field_name: '视频链接', type: FieldType.Url },
  { field_name: '视频封面', type: FieldType.Attachment },
  { field_name: '视频播放量', type: FieldType.Number },
  { field_name: '点赞数量', type: FieldType.Number },
  { field_name: '评论数量', type: FieldType.Number },
  { field_name: '分享数量', type: FieldType.Number },
  { field_name: '收藏数量', type: FieldType.Number },
  { field_name: '视频互动率', type: FieldType.Number },
  { field_name: '账号名称', type: FieldType.Text },
  { field_name: '视频标题', type: FieldType.Text },
  { field_name: '视频下载链接', type: FieldType.Url },
  { field_name: '是否带货', type: FieldType.Checkbox },
  { field_name: '带货产品链接', type: FieldType.Url },
  { field_name: '带货原因', type: FieldType.Text },
  { field_name: '带货产品数量', type: FieldType.Text },
  { field_name: '带货产品信息', type: FieldType.Text }
];

const KEYWORD_REQUIRED_FIELDS = new Set(['关键词', '视频链接'])

const ACCOUNT_FIELD_CONFIGS: FieldConfig[] = [
  { field_name: '视频标题', type: FieldType.Text },  // 主字段：视频标题（Text类型）
  { field_name: '视频链接', type: FieldType.Url },  // 超链接类型，可点击
  { field_name: '视频封面', type: FieldType.Attachment },
  { field_name: '视频发布时间', type: FieldType.DateTime },
  { field_name: '播放量', type: FieldType.Number },
  { field_name: '点赞数量', type: FieldType.Number },
  { field_name: '评论数量', type: FieldType.Number },
  { field_name: '转发数量', type: FieldType.Number },
  { field_name: '收藏数量', type: FieldType.Number },
  { field_name: '视频互动率', type: FieldType.Number },  // 互动率 = (点赞+评论+收藏+转发) / 播放量
  { field_name: '视频发布国家', type: FieldType.Text },
  { field_name: '视频BGM标题', type: FieldType.Text },
  { field_name: '视频下载链接', type: FieldType.Url },
  { field_name: '帖子类型', type: FieldType.Text },
  { field_name: '是否带货', type: FieldType.Checkbox },
  { field_name: '带货产品链接', type: FieldType.Url },
  { field_name: '带货原因', type: FieldType.Text },
  { field_name: '带货产品数量', type: FieldType.Text },
  { field_name: '带货产品信息', type: FieldType.Text }
];

const ACCOUNT_REQUIRED_FIELDS = new Set(['视频标题', '视频链接'])

const ACCOUNT_INFO_FIELD_CONFIGS: FieldConfig[] = [
  { field_name: 'TT账户名称', type: FieldType.Text },
  { field_name: 'TT账户URL', type: FieldType.Url },
  { field_name: 'Instagram URL', type: FieldType.Url },
  { field_name: 'YouTube URL', type: FieldType.Url },
  { field_name: '关注者数量', type: FieldType.Number },
  { field_name: '点赞数量', type: FieldType.Number },
  { field_name: '视频数量', type: FieldType.Number },
  { field_name: '平均播放量', type: FieldType.Number },
  { field_name: '视频互动率', type: FieldType.Number },
  { field_name: '电子邮件地址', type: FieldType.Text },
  { field_name: '视频创建位置', type: FieldType.Text },
  { field_name: '是否有小店', type: FieldType.Checkbox },
  { field_name: '最后发帖时间', type: FieldType.DateTime },
  { field_name: '发帖频率', type: FieldType.Number },
  { field_name: '最近拉取时间', type: FieldType.DateTime },
];

const ACCOUNT_INFO_REQUIRED_FIELDS = new Set(['TT账户名称'])

const AUDIO_FIELD_CONFIGS: FieldConfig[] = [
  { field_name: '转写文案', type: FieldType.Text },  // 主字段：转写文案（Text类型）
  { field_name: '视频链接', type: FieldType.Url }   // 超链接类型，可点击
];

const ensureRequiredSelections = (
  selectedFields: Record<string, boolean>,
  requiredFields: Set<string>
) => {
  if (!requiredFields.size) return selectedFields
  const normalized = { ...selectedFields }
  for (const fieldName of requiredFields) {
    normalized[fieldName] = true
  }
  return normalized
}

const logEnvConfig = () => {
  const val = import.meta.env.VITE_API_BASE_URL
  if (!val) {
    console.info('[env-check] 未设置 VITE_API_BASE_URL，将使用同源 /api/*')
    return
  }
  console.info(`[env-check] VITE_API_BASE_URL=${val}`)
}

const USER_GROUP_JOIN_LINK = 'https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=640o43c4-a2dd-4c9e-9246-76dcae37f12f'

function App() {
  const { t } = useTranslation()
  const tr = useCallback(
    (key: string, options?: Record<string, unknown>) => t(key, { defaultValue: key, ...(options || {}) }),
    [t]
  )
  const theme = useTheme()

  // 用户身份状态
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)

  // 关键词搜索相关状态
  const [query, setQuery] = useState('')
  const [vtime, setVtime] = useState('7d')
  const [region, setRegion] = useState('US')

  // 账号视频搜索相关状态
  const [username, setUsername] = useState('')
  const [userRegion, setUserRegion] = useState('US')

  // UI 状态管理
  const {
    loading,
    setLoading,
    message,
    setMessage,
    isCollecting,
    setIsCollecting,
    isStopping,
    setIsStopping,
    collectType,
    setCollectType,
    activeSection,
    toggleSection
  } = useUIState()

  // Bitable 表格管理
  const { fields, tableId, initTable, refreshFields } = useBitable({
    setLoading
  })

  // 关键词采集字段选择
  const [keywordSelectedFields, setKeywordSelectedFields] = useState<{[key: string]: boolean}>({
    '关键词': true,
    '发布时间': true,
    '视频链接': true,
    '视频封面': false,
    '视频播放量': true,
    '点赞数量': true,
    '评论数量': true,
    '分享数量': true,
    '收藏数量': true,
    '视频互动率': true,
    '账号名称': true,
    '视频标题': true,
    '视频下载链接': true,
    '是否带货': true,
    '带货产品链接': true,
    '带货原因': true,
    '带货产品数量': true,
    '带货产品信息': true
  })

  // 关键词写入目标
  const [keywordTargetTable, setKeywordTargetTable] = useState<'current' | 'new'>('new')
  const [keywordNewTableName, setKeywordNewTableName] = useState(getDefaultKeywordTableName())
  const [keywordTableNameAuto, setKeywordTableNameAuto] = useState(true)
  
  // 账号视频采集字段选择
  const [accountSelectedFields, setAccountSelectedFields] = useState<{[key: string]: boolean}>({
    '视频链接': true,
    '视频封面': false,
    '视频发布时间': true,
    '视频标题': true,
    '播放量': true,
    '点赞数量': true,
    '评论数量': true,
    '转发数量': true,
    '收藏数量': true,
    '视频互动率': true,
    '视频发布国家': true,
    '视频BGM标题': true,
    '视频下载链接': true,
    '帖子类型': true,
    '是否带货': true,
    '带货产品链接': true,
    '带货原因': true,
    '带货产品数量': true,
    '带货产品信息': true
  })

  // 账号写入目标
  const [accountTargetTable, setAccountTargetTable] = useState<'current' | 'new'>('new')
  const [accountNewTableName, setAccountNewTableName] = useState(getDefaultAccountTableName())
  const [accountTableNameAuto, setAccountTableNameAuto] = useState(true)

  // 账号信息采集相关状态
  const [accountInfoMode, setAccountInfoMode] = useState<'column' | 'batch'>('column')
  const [accountInfoUsernameField, setAccountInfoUsernameField] = useState('')
  const [accountInfoBatchInput, setAccountInfoBatchInput] = useState('')
  const [accountInfoLoading, setAccountInfoLoading] = useState(false)
  const [accountInfoOverwrite, setAccountInfoOverwrite] = useState(false)
  const [accountInfoColumnTargetTable, setAccountInfoColumnTargetTable] = useState<'current' | 'new'>('new')
  const [accountInfoColumnNewTableName, setAccountInfoColumnNewTableName] = useState(getDefaultAccountInfoTableName())
  const [accountInfoColumnTableNameAuto, setAccountInfoColumnTableNameAuto] = useState(true)
  const [batchTargetTable, setBatchTargetTable] = useState<'current' | 'new'>('new')
  const [newTableName, setNewTableName] = useState(getDefaultAccountInfoTableName())
  const [accountInfoBatchTableNameAuto, setAccountInfoBatchTableNameAuto] = useState(true)
  const [accountInfoSelectedFields, setAccountInfoSelectedFields] = useState<{[key: string]: boolean}>({
    'TT账户名称': true,
    'TT账户URL': true,
    'Instagram URL': true,
    'YouTube URL': true,
    '关注者数量': true,
    '点赞数量': true,
    '视频数量': true,
    '平均播放量': true,
    '视频互动率': true,
    '电子邮件地址': true,
    '视频创建位置': true,
    '是否有小店': true,
    '最后发帖时间': true,
    '发帖频率': true,
    '最近拉取时间': true
  })
  const accountInfoStopRef = useRef(false)
  const [accountInfoEstimatedRows, setAccountInfoEstimatedRows] = useState(0)

  // 提取视频音频相关状态
  const [audioMode, setAudioMode] = useState<'column' | 'batch'>('column')
  const [audioVideoUrlField, setAudioVideoUrlField] = useState('')
  const [audioOutputField, setAudioOutputField] = useState('')
  const [audioBatchInput, setAudioBatchInput] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioTargetTable, setAudioTargetTable] = useState<'current' | 'new'>('new')
  const [audioNewTableName, setAudioNewTableName] = useState(getDefaultAudioTableName())
  const [audioTableNameAuto, setAudioTableNameAuto] = useState(true)

  const handleKeywordNewTableNameChange = (val: string) => {
    setKeywordNewTableName(val)
    setKeywordTableNameAuto(false)
  }

  const handleAccountNewTableNameChange = (val: string) => {
    setAccountNewTableName(val)
    setAccountTableNameAuto(false)
  }

  const handleAccountInfoColumnNewTableNameChange = (val: string) => {
    setAccountInfoColumnNewTableName(val)
    setAccountInfoColumnTableNameAuto(false)
  }

  const handleAccountInfoBatchNewTableNameChange = (val: string) => {
    setNewTableName(val)
    setAccountInfoBatchTableNameAuto(false)
  }

  const handleAudioNewTableNameChange = (val: string) => {
    setAudioNewTableName(val)
    setAudioTableNameAuto(false)
  }

  // 模块级 AbortController 和停止标志
  const keywordAbortControllerRef = useRef<AbortController | null>(null);
  const keywordShouldStopRef = useRef(false);

  const accountAbortControllerRef = useRef<AbortController | null>(null);
  const accountShouldStopRef = useRef(false);

  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const audioShouldStopRef = useRef(false);

  // 初始化
  useEffect(() => {
    logEnvConfig()

    const initIdentity = async () => {
      try {
        const baseUserId = await bitable.bridge.getBaseUserId()
        const tenantKey = await bitable.bridge.getTenantKey()

        console.log('✅ 用户身份获取成功:', { baseUserId, tenantKey })
        setUserIdentity({ baseUserId, tenantKey })
      } catch (error) {
        console.error('❌ 获取用户身份失败:', error)
        setMessage(tr('获取用户身份失败，请刷新页面重试'))
      }
    }

    const init = async () => {
      try {
        await initTable()
        await initIdentity()
      } catch (error) {
        console.error('初始化失败:', error)
      }
    }
    init()
  }, [initTable, setMessage, tr])

  /**
   * 封装带用户身份的fetch请求（支持超时）
   */
  const fetchWithIdentity = useMemo(
    () => createFetchWithIdentity(userIdentity),
    [userIdentity]
  )

  const fetchCoverFile = useCallback(
    async (
      coverUrl: string,
      fileName: string,
      options?: { signal?: AbortSignal; convert?: boolean }
    ): Promise<File | undefined> => {
      if (!coverUrl) return undefined
      const shouldConvert = options?.convert ?? false
      const maxAttempts = 3
      const baseDelayMs = 400
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (options?.signal?.aborted) {
          console.info('[cover] 请求已中止')
          return undefined
        }
        try {
          const response = shouldConvert
            ? await fetchCoverAsJpg(coverUrl, fetchWithIdentity, {
              timeout: TIMEOUT_CONFIG.SEARCH,
              signal: options?.signal
            })
            : await fetchCoverOriginal(coverUrl, fetchWithIdentity, {
              timeout: TIMEOUT_CONFIG.SEARCH,
              signal: options?.signal
            })
          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            if (attempt < maxAttempts) {
              const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
              console.warn(`[cover] 获取封面失败(${response.status})，${delayMs}ms 后重试`)
              await sleep(delayMs)
              continue
            }
            console.warn('[cover] 获取封面失败:', response.status, response.statusText, errorText)
            return undefined
          }
          const buffer = await response.arrayBuffer()
          if (!buffer.byteLength) {
            if (attempt < maxAttempts) {
              const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
              console.warn(`[cover] 封面内容为空，${delayMs}ms 后重试`)
              await sleep(delayMs)
              continue
            }
            console.warn('[cover] 封面内容为空，跳过')
            return undefined
          }
          const contentType = shouldConvert
            ? 'image/jpeg'
            : response.headers.get('content-type') || 'image/jpeg'
          const blob = new Blob([buffer], { type: contentType })
          return new File([blob], fileName, { type: contentType })
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError' && options?.signal?.aborted) {
            console.info('[cover] 请求已中止')
            return undefined
          }
          if (attempt < maxAttempts) {
            const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
            console.warn(`[cover] 获取封面异常，${delayMs}ms 后重试`)
            await sleep(delayMs)
            continue
          }
          console.warn('[cover] 获取封面异常:', error)
          return undefined
        }
      }
      return undefined
    },
    [fetchWithIdentity]
  )

  /**
   * 配额管理
   */
  const {
    quotaInfo,
    quotaDetailsOpen,
    setQuotaDetailsOpen,
    handle429Error,
    consumeQuotaPoints,
    refreshQuota
  } = useQuota({
    userIdentity,
    fetchWithIdentity,
    setMessage,
    keywordShouldStopRef,
    accountShouldStopRef,
    audioShouldStopRef
  })

  const quotaDetailsRef = useRef<HTMLDivElement>(null)
  const quotaDetailsHeightRef = useRef(0)
  const [quotaDetailsHeight, setQuotaDetailsHeight] = useState(0)
  const quotaOpenScrollTopRef = useRef(0)
  const quotaScrollTopRef = useRef(0)
  const [quotaCollapseProgress, setQuotaCollapseProgress] = useState(0)
  const isTesterPlan = useMemo(() => {
    const code = quotaInfo?.planCode?.toLowerCase() ?? ''
    const name = quotaInfo?.planName ?? ''
    return code === 'tester' || name.includes('测试') || name.toLowerCase().includes('test')
  }, [quotaInfo?.planCode, quotaInfo?.planName])
  const quotaPlanLabel = useMemo(() => {
    if (isTesterPlan) return tr('plan.tester')
    if (quotaInfo?.planType === 'monthly') return tr('plan.monthly')
    if (quotaInfo?.planType === 'points') return tr('plan.points')
    return tr('plan.trial')
  }, [isTesterPlan, quotaInfo?.planType, tr])
  const quotaResetLabel = useMemo(() => (
    quotaInfo?.planType && quotaInfo.planType !== 'trial'
      ? tr('quota.expire.label')
      : tr('quota.reset.label')
  ), [quotaInfo?.planType, tr])
  const formatQuotaDate = useCallback((value?: string | null) => {
    if (!value) return tr('quota.time.unknown')
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return tr('quota.time.unknown')
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }, [tr])
  const quotaResetValue = useMemo(() => (
    formatQuotaDate(quotaInfo?.resetAt)
  ), [formatQuotaDate, quotaInfo?.resetAt])
  const pointsExpiringSoon = useMemo(() => {
    if (quotaInfo?.planType !== 'points' || !quotaInfo?.resetAt) return false
    const expireAt = new Date(quotaInfo.resetAt).getTime()
    if (Number.isNaN(expireAt)) return false
    const diff = expireAt - Date.now()
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000
    return diff > 0 && diff <= twoDaysMs
  }, [quotaInfo?.planType, quotaInfo?.resetAt])

  useEffect(() => {
    if (!quotaDetailsOpen) {
      setQuotaCollapseProgress(0)
      return
    }

    quotaOpenScrollTopRef.current = quotaScrollTopRef.current
    setQuotaCollapseProgress(0)

    const frame = window.requestAnimationFrame(() => {
      const detailsHeight = quotaDetailsRef.current?.scrollHeight ?? 0
      quotaDetailsHeightRef.current = detailsHeight
      setQuotaDetailsHeight(detailsHeight)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [quotaDetailsOpen])

  const handleQuotaScroll = useCallback(
    (scrollTop: number) => {
      quotaScrollTopRef.current = scrollTop
      if (!quotaDetailsOpen) return

      const collapseDistance = quotaDetailsHeightRef.current > 0 ? quotaDetailsHeightRef.current : 80
      const delta = Math.max(0, scrollTop - quotaOpenScrollTopRef.current)
      const nextProgress = Math.min(Math.max(delta / collapseDistance, 0), 1)

      setQuotaCollapseProgress(prev => (
        Math.abs(nextProgress - prev) >= 0.01 ? nextProgress : prev
      ))

      if (nextProgress >= 1) {
        setQuotaDetailsOpen(false)
      }
    },
    [quotaDetailsOpen, setQuotaDetailsOpen]
  )

  // 顶部固定区域管理
  const {
    appRef,
    mainHeaderRef: quotaStickyRef,
    mainHeaderHeight: quotaStickyHeight,
    headerPinned: quotaStickyPinned
  } = useStickyHeader({ onScroll: handleQuotaScroll })

  // 处理关键词字段选择
  const handleKeywordFieldChange = (fieldName: string) => {
    if (KEYWORD_REQUIRED_FIELDS.has(fieldName)) return
    setKeywordSelectedFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }
  
  // 处理账号字段选择
  const handleAccountFieldChange = (fieldName: string) => {
    if (ACCOUNT_REQUIRED_FIELDS.has(fieldName)) return
    setAccountSelectedFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  // 处理账号信息字段选择
  const handleAccountInfoFieldChange = (fieldName: string) => {
    if (ACCOUNT_INFO_REQUIRED_FIELDS.has(fieldName)) return
    setAccountInfoSelectedFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  // 估算账号信息需处理的行数（用于剩余额度提示，最多扫描200行）
  useEffect(() => {
    let stopped = false

    const estimateRows = async () => {
        if (accountInfoMode === 'batch') {
          const names = Array.from(
            new Set(
              accountInfoBatchInput
                .split(/[\n,\r]+/)
                .map(item => extractAccountName(item))
                .filter(Boolean)
            )
          )
          if (!stopped) setAccountInfoEstimatedRows(names.length)
          return
        }

      if (!accountInfoUsernameField) {
        setAccountInfoEstimatedRows(0)
        return
      }

      try {
        const table = await bitable.base.getActiveTable()
        if (!table) return

        const pageSize = 100
        const maxScan = 200
        let pageToken: string | undefined
        let hasMore = true
        let count = 0

        while (hasMore && count < maxScan && !stopped) {
          const result = await table.getRecords({ pageSize, pageToken })
          const records = result.records || []

          for (const record of records) {
            if (stopped || count >= maxScan) break
            const cellValue = await table.getCellValue(accountInfoUsernameField, record.recordId)
            const name = extractAccountName(extractTextFromCell(cellValue))
            if (name) count++
          }

          hasMore = result.hasMore && count < maxScan
          pageToken = result.pageToken
        }

        if (!stopped) setAccountInfoEstimatedRows(count)
      } catch (error) {
        console.error('估算账号行数失败:', error)
        if (!stopped) setAccountInfoEstimatedRows(0)
      }
    }

    estimateRows()

    return () => {
      stopped = true
    }
  }, [accountInfoMode, accountInfoBatchInput, accountInfoUsernameField])

  // 模块级停止函数
  const stopKeywordCollection = () => {
    keywordShouldStopRef.current = true;
    if (keywordAbortControllerRef.current) {
      keywordAbortControllerRef.current.abort();
    }
    setIsStopping(true);
    setMessage(tr('正在停止关键词采集...'));
  };

  const stopAccountCollection = () => {
    accountShouldStopRef.current = true;
    if (accountAbortControllerRef.current) {
      accountAbortControllerRef.current.abort();
    }
    setIsStopping(true);
    setMessage(tr('正在停止账户采集...'));
  };

  const stopAudioExtraction = () => {
    audioShouldStopRef.current = true;
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
      audioAbortControllerRef.current = null;
    }
    setAudioLoading(false);
    setMessage(tr('正在停止音频提取...'));

    setTimeout(() => {
      setMessage(tr('音频提取已停止'));
    }, 500);
  };

  // 创建进度更新节流函数
  const makeProgressThrottler = (intervalMs = 5000, batchSize = 10) => {
    let lastUpdate = 0
    return (count: number, update: () => void) => {
      const now = Date.now()
      if (count % batchSize === 0 || now - lastUpdate >= intervalMs) {
        lastUpdate = now
        update()
      }
    }
  }

  const applyQuotaConsumption = (currentRemaining: number | null, count: number) => {
    if (!count || count <= 0) return currentRemaining
    consumeQuotaPoints(count)
    if (typeof currentRemaining !== 'number') return null
    return Math.max(currentRemaining - count, 0)
  }

  const formatRemaining = (remaining: number | null) => (
    typeof remaining === 'number' ? remaining : '-'
  )

  // 写入关键词搜索 TikTok 数据
  const writeKeywordTikTokData = async () => {
    if (!query) return
    if (quotaUnavailable) {
      setMessage(tr('配额未配置，请联系管理员后再试'))
      return
    }

    try {
      setCollectType(1)
      setIsCollecting(true)
      keywordShouldStopRef.current = false
      setIsStopping(false)
      setMessage(tr('正在获取数据...'))
      const activeTable = await bitable.base.getActiveTable()
      if (!activeTable) {
        throw new Error('无法获取当前表格');
      }

      let targetTable = activeTable
      let targetTableName = ''
      if (keywordTargetTable === 'new') {
        let nextTableName = keywordNewTableName
        if (keywordTableNameAuto) {
          const trimmedQuery = query.trim()
          nextTableName = trimmedQuery
            ? getDefaultKeywordTableName(trimmedQuery)
            : getDefaultKeywordTableName()
          setKeywordNewTableName(nextTableName)
        }
        const safeName = sanitizeTableName(nextTableName)
        if (safeName !== nextTableName) setKeywordNewTableName(safeName)
        try {
          targetTable = await createNewTable(safeName, '关键词')
          targetTableName = safeName
        } catch (error) {
          console.error('创建表格失败:', error)
          const msg = error instanceof Error && error.message?.includes('TableNameInvalid')
            ? tr('表名无效，请重试')
            : tr('创建表格失败，请检查权限')
          setMessage(msg)
          return
        }
      }

      const keywordSelection = ensureRequiredSelections(keywordSelectedFields, KEYWORD_REQUIRED_FIELDS)
      const keywordFieldMetaList = await ensureFields(targetTable, KEYWORD_FIELD_CONFIGS, keywordSelection)
      await refreshFields()
      let keywordWriters = await buildFieldWriters(targetTable, KEYWORD_FIELD_CONFIGS, keywordFieldMetaList, keywordSelection)
      // 收集已有视频链接用于去重
      const existingLinks = await collectExistingKeys(targetTable, '视频链接', normalizeUrlKey, { maxScan: 5000 })
      let totalWritten = 0
      let remainingAfterWrite = typeof quotaInfo?.remaining === 'number' ? quotaInfo.remaining : null
      let hasMore = true
      let offset = '0'
      let pageCount = 0
      let missingNextCursorOffset: string | null = null
      const maxPages = 100 // 最大页数限制

      // 在采集开始前扫描空行（只扫描一次，检查整行是否为空）
      setMessage(tr('正在扫描空行...'))
      const emptyRecordIds = await getEmptyRecords(targetTable, keywordShouldStopRef, { maxScan: 500 })
      if (emptyRecordIds.length > 0) {
        setMessage(tr('发现 {{count}} 个空行，将优先填充', { count: emptyRecordIds.length }))
      }

      // 主循环
      mainLoop: while (hasMore && !keywordShouldStopRef.current && pageCount < maxPages) {
        // 检查是否需要停止
        if (keywordShouldStopRef.current) break;

        const params = {
          keyword: query,
          count: '15',
          offset,
          sort_type: '0',
          publish_time: vtime,
          region: region || 'US'
        }

        // 创建新的AbortController
        keywordAbortControllerRef.current = new AbortController();

        try {
          const response = await fetchKeywordVideos(params, fetchWithIdentity, {
            timeout: TIMEOUT_CONFIG.SEARCH,
            signal: keywordAbortControllerRef.current.signal
          })

          // 处理429配额超限错误
          if (await handle429Error(response)) {
            break mainLoop;
          }

          if (!response.ok) {
            const errorText = await response.text()
            console.error('API 响应错误:', errorText)
            throw new Error(`API 请求失败: ${response.status} ${response.statusText || ''}`)
          }

          const data = await response.json()
          console.log('API 返回数据:', data)

          // 处理新的 API 返回格式（使用可选链式操作提高安全性）
          if (data?.search_item_list && Array.isArray(data.search_item_list)) {
            const validItems = data.search_item_list.filter((item: SearchItemData) => {
              return item && item.aweme_info && item.aweme_info.author
            }).map((item: SearchItemData) => {
              const awemeInfo = item.aweme_info!

              // 获取视频链接：优先级 1) 根层级 share_url 2) share_info.share_url 3) aweme_id 构建
              console.log('[DEBUG 视频链接提取] aweme_id:', awemeInfo.aweme_id)
              console.log('[DEBUG 视频链接提取] 根层级 share_url:', awemeInfo.share_url)
              console.log('[DEBUG 视频链接提取] share_info.share_url:', awemeInfo.share_info?.share_url)
              console.log('[DEBUG 视频链接提取] author.unique_id:', awemeInfo.author?.unique_id)

              const videoUrl = buildVideoShareLink({
                shareUrl: awemeInfo.share_url,
                shareInfoUrl: awemeInfo.share_info?.share_url,
                awemeId: awemeInfo.aweme_id,
                authorId: awemeInfo.author?.unique_id
              })

              console.log('[DEBUG 视频链接提取] 最终 videoUrl:', videoUrl)

              // 封面链接优先级：dynamic -> cover -> origin
              const coverUrl = pickCoverUrl(awemeInfo.video)

              // 使用带货检测函数分析视频数据
              const commerce = commerceFromAweme(awemeInfo as unknown as Record<string, unknown>)

              return {
                author: {
                  uniqueId: awemeInfo.author.unique_id || ''
                },
                awemeId: awemeInfo.aweme_id || '',
                desc: awemeInfo.desc || '',
                createTime: awemeInfo.create_time || 0,
                shareLink: videoUrl,
                videoUrl: awemeInfo.video?.play_addr?.url_list?.[0] || '',
                coverUrl,
                stats: {
                  playCount: awemeInfo.statistics?.play_count || 0,
                  diggCount: awemeInfo.statistics?.digg_count || 0,
                  commentCount: awemeInfo.statistics?.comment_count || 0,
                  shareCount: awemeInfo.statistics?.share_count || 0,
                  collectCount: awemeInfo.statistics?.collect_count || 0
                },
                anchors: awemeInfo.anchors,
                anchor_info: awemeInfo.anchor_info,
                bottom_products: awemeInfo.bottom_products,
                products_info: awemeInfo.products_info,
                right_products: awemeInfo.right_products,
                has_commerce_goods: awemeInfo.has_commerce_goods,
                existed_commerce_goods: awemeInfo.existed_commerce_goods,
                ecommerce_goods: awemeInfo.ecommerce_goods,
                commerce_info: awemeInfo.commerce_info,
                commerce
              }
            })

            if (validItems.length === 0) {
              console.warn('当前页没有有效的数据项（可能author缺失），检查是否还有更多页');
              // 不直接停止，让后续的has_more判断决定是否继续
            } else {
              // 批量写入记录
              console.log(`开始写入 ${validItems.length} 条记录`);
              const recordsToInsert: Record<string, IOpenCellValue>[] = [];
              if (!Object.keys(keywordWriters).length) {
                const refreshedMeta = await targetTable.getFieldMetaList();
                keywordWriters = await buildFieldWriters(targetTable, KEYWORD_FIELD_CONFIGS, refreshedMeta, keywordSelection);
                await refreshFields();
              }
              const coverEnabled = Boolean(keywordWriters['视频封面'])
              for (const item of validItems) {
                if (keywordShouldStopRef.current) {
                  console.log('检测到停止标志，终止写入');
                  break mainLoop;
                }
                const linkKey = normalizeUrlKey(item.shareLink)
                if (!linkKey || existingLinks.has(linkKey)) continue
                existingLinks.add(linkKey)
                let coverFile: File | undefined
                if (coverEnabled && item.coverUrl) {
                  coverFile = await fetchCoverFile(
                    item.coverUrl,
                    buildCoverFileName('keyword', item.awemeId),
                    {
                      signal: keywordAbortControllerRef.current?.signal,
                      convert: false
                    }
                  )
                  if (keywordShouldStopRef.current) {
                    console.log('检测到停止标志，终止写入');
                    break mainLoop;
                  }
                }
                const record = await buildKeywordRecord({ ...item, coverFile }, keywordWriters, query);
                if (!record) continue
                recordsToInsert.push(record);
              }

              if (recordsToInsert.length) {
                const { appendedCount, filledCount } = await addRecordsInBatches(targetTable, recordsToInsert, {
                  emptyRecordIds,
                  stopRef: keywordShouldStopRef
                });
                const writtenCount = appendedCount + filledCount
                remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, writtenCount)
                totalWritten += writtenCount;
                setMessage(tr(keywordTargetTable === 'new'
                  ? '已写入新表 {{table}} 共 {{count}} 条'
                  : '已写入 {{count}} 条数据', {
                  table: targetTableName || '',
                  count: totalWritten,
                  used: totalWritten,
                  remaining: formatRemaining(remainingAfterWrite)
                }));
              }
            }

            // 数据页处理完成，检查是否有更多
            if (keywordShouldStopRef.current) {
              console.log('检测到停止标志，终止分页处理');
              break mainLoop;
            }

            if (data.has_more) {
              const nextCursor = data.max_cursor ?? data.cursor
              const nextCursorText = nextCursor === undefined || nextCursor === null
                ? ''
                : String(nextCursor).trim()
              const isMissingNextCursor = !nextCursorText || nextCursorText === offset
              if (isMissingNextCursor) {
                if (missingNextCursorOffset === offset) {
                  setMessage(tr('仍未获得下一批起点，已结束当前关键词'))
                  hasMore = false
                } else {
                  missingNextCursorOffset = offset
                  setMessage(tr('还有更多但没有下一批起点，已重试当前批次'))
                }
              } else {
                missingNextCursorOffset = null
                offset = nextCursorText
                pageCount++;
                console.log(`获取第 ${pageCount} 页数据完成`);
                setMessage(tr('已获取第 {{page}} 页数据，共 {{total}} 条', { page: pageCount, total: totalWritten }));
              }
            } else {
              hasMore = false;
              console.log('没有更多数据，结束采集');
            }
          } else {
            console.error('返回数据格式错误:', data);
            setMessage(tr('API 返回数据格式错误'));
            break;
          }

          // 页面处理完成，添加延时
          if (keywordShouldStopRef.current) {
            console.log('检测到停止标志，终止分页处理');
            break mainLoop;
          }

          // 减少页面间延时
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('API请求已被中止');
            break mainLoop;
          }
          throw error;
        }
      }

      // 采集完成或停止
      console.log(`采集结束，共写入 ${totalWritten} 条数据，停止状态: ${keywordShouldStopRef.current}`);
      setMessage(tr(keywordShouldStopRef.current ? '已停止采集，成功写入 {{count}} 条数据' : '成功写入 {{count}} 条数据', {
        count: totalWritten,
        used: totalWritten,
        remaining: formatRemaining(remainingAfterWrite)
      }));
    } catch (error) {
      console.error('写入数据失败:', error);
      setMessage(tr('写入数据失败: {{error}}', { error: error instanceof Error ? error.message : '未知错误' }));
    } finally {
      // 清理状态
      if (keywordAbortControllerRef.current) {
        keywordAbortControllerRef.current = null;
      }
      setIsCollecting(false);
      setIsStopping(false);
    }
  }
  
  // 修改账号视频采集函数
  const writeAccountTikTokData = async () => {
    const resolvedUsername = extractAccountName(username)
    if (!resolvedUsername) {
      setMessage(tr('请输入账号名称'))
      return
    }
    if (quotaUnavailable) {
      setMessage(tr('配额未配置，请联系管理员后再试'))
      return
    }
    
    try {
      // 重置停止状态
      accountShouldStopRef.current = false;
      setCollectType(2);
      setIsCollecting(true);
      setIsStopping(false);
      setMessage(tr('正在获取数据...'));

      const activeTable = await bitable.base.getActiveTable();
      if (!activeTable) {
        throw new Error('无法获取当前表格');
      }

      let targetTable = activeTable
      let targetTableName = ''
      if (accountTargetTable === 'new') {
        let nextTableName = accountNewTableName
        if (accountTableNameAuto) {
          const trimmedName = resolvedUsername.trim()
          nextTableName = trimmedName
            ? getDefaultAccountTableName(trimmedName)
            : getDefaultAccountTableName()
          setAccountNewTableName(nextTableName)
        }
        console.info('[table-name] account create', {
          auto: accountTableNameAuto,
          input: accountNewTableName,
          next: nextTableName
        })
        const safeName = sanitizeTableName(nextTableName)
        if (safeName !== nextTableName) setAccountNewTableName(safeName)
        try {
          targetTable = await createNewTable(safeName, '视频标题')
          targetTableName = safeName
        } catch (error) {
          console.error('创建表格失败:', error)
          const msg = error instanceof Error && error.message?.includes('TableNameInvalid')
            ? tr('表名无效，请重试')
            : tr('创建表格失败，请检查权限')
          setMessage(msg)
          return
        }
      }

      const accountSelection = ensureRequiredSelections(accountSelectedFields, ACCOUNT_REQUIRED_FIELDS)
      const accountFieldMetaList = await ensureFields(targetTable, ACCOUNT_FIELD_CONFIGS, accountSelection);
      await refreshFields();
      let accountWriters = await buildFieldWriters(targetTable, ACCOUNT_FIELD_CONFIGS, accountFieldMetaList, accountSelection);
      console.log('[DEBUG 账号采集] accountWriters 包含的字段:', Object.keys(accountWriters))
      console.log('[DEBUG 账号采集] "视频链接" 字段是否在 writers 中:', '视频链接' in accountWriters)

      const existingLinks = await collectExistingKeys(targetTable, '视频链接', normalizeUrlKey, { maxScan: 5000 })
      let totalWritten = 0;
      let remainingAfterWrite = typeof quotaInfo?.remaining === 'number' ? quotaInfo.remaining : null
      let hasMore = true;
      let offset = '0';
      let pageCount = 0;
      let missingNextCursorOffset: string | null = null
      const maxPages = 100;

      // 在采集开始前扫描空行（只扫描一次，检查整行是否为空）
      setMessage(tr('正在扫描空行...'))
      const emptyRecordIds = await getEmptyRecords(targetTable, accountShouldStopRef, { maxScan: 500 })
      if (emptyRecordIds.length > 0) {
        setMessage(tr('发现 {{count}} 个空行，将优先填充', { count: emptyRecordIds.length }))
      }

      // 主循环
      mainLoop: while (hasMore && !accountShouldStopRef.current && pageCount < maxPages) {
        // 检查是否需要停止
        if (accountShouldStopRef.current) break;

        const params = {
          username: resolvedUsername,
          count: '30',
          offset,
          region: userRegion || 'US'
        };

        // 再次检查
        if (accountShouldStopRef.current) break;

        // 创建新的AbortController
        accountAbortControllerRef.current = new AbortController();

        try {
          console.log('开始请求API...');
          const response = await fetchAccountVideos(params, fetchWithIdentity, {
            timeout: TIMEOUT_CONFIG.SEARCH,
            signal: accountAbortControllerRef.current.signal
          })

          // 处理429配额超限错误
          if (await handle429Error(response)) {
            break mainLoop;
          }

          // 检查是否请求被中止或应该停止
          if (accountShouldStopRef.current) {
            console.log('检测到停止标志，终止处理');
            break mainLoop;
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 请求失败: ${response.status} ${response.statusText || ''} ${errorText}`);
          }

          console.log('API请求成功，解析数据...');
          const data = await response.json();

          if (accountShouldStopRef.current) {
            console.log('检测到停止标志，终止处理');
            break mainLoop;
          }

          if (data?.aweme_list && Array.isArray(data.aweme_list)) {
            console.log(`获取到 ${data.aweme_list.length} 条记录`);
            // 处理获取到的数据
            const validItems: UserVideoData[] = [];

            // 预处理数据（使用可选链式操作提高安全性）
            for (const item of data.aweme_list as AwemeItem[]) {
              if (!item || !item.author || accountShouldStopRef.current) continue;

              // 获取视频链接：优先级 1) 根层级 share_url 2) share_info.share_url 3) aweme_id 构建
              const videoUrl = buildVideoShareLink({
                shareUrl: item.share_url,
                shareInfoUrl: item.share_info?.share_url,
                awemeId: item.aweme_id,
                authorId: item.author?.unique_id
              })

              // 使用带货检测函数分析视频数据
              const commerce = commerceFromAweme(item as unknown as Record<string, unknown>)

              // 封面链接优先级：dynamic -> cover -> origin
              const coverUrl = pickCoverUrl(item.video)

              validItems.push({
                awemeId: item.aweme_id || '',
                desc: item.desc || '',
                create_time: item.create_time || 0,
                share_url: videoUrl,
                download_url: item.video?.play_addr?.url_list?.[0] || '',
                coverUrl,
                region: item.region || '',
                music_title: item.music?.title || '',
                statistics: {
                  play_count: item.statistics?.play_count || 0,
                  digg_count: item.statistics?.digg_count || 0,
                  comment_count: item.statistics?.comment_count || 0,
                  share_count: item.statistics?.share_count || 0,
                  collect_count: item.statistics?.collect_count || 0
                },
                post_type: commerce.isCommerce ? '带货视频' : '内容视频',
                anchors: item.anchors,
                anchor_info: item.anchor_info,
                bottom_products: item.bottom_products,
                products_info: item.products_info,
                right_products: item.right_products,
                has_commerce_goods: item.has_commerce_goods,
                existed_commerce_goods: item.existed_commerce_goods,
                ecommerce_goods: item.ecommerce_goods,
                commerce_info: item.commerce_info,
                commerce
              });

              // 检查是否需要停止
              if (accountShouldStopRef.current) {
                console.log('检测到停止标志，终止数据处理');
                break mainLoop;
              }
            }

            if (validItems.length === 0) {
              console.warn('当前页没有有效的数据项（可能author缺失），检查是否还有更多页');
              // 不直接停止，让后续的has_more判断决定是否继续
            } else {
              // 批量写入记录
              console.log(`开始写入 ${validItems.length} 条记录`);
              const recordsToInsert: Record<string, IOpenCellValue>[] = [];
              if (!Object.keys(accountWriters).length) {
                const refreshedMeta = await targetTable.getFieldMetaList();
                accountWriters = await buildFieldWriters(targetTable, ACCOUNT_FIELD_CONFIGS, refreshedMeta, accountSelection);
                await refreshFields();
              }
              const coverEnabled = Boolean(accountWriters['视频封面'])
              for (const item of validItems) {
                if (accountShouldStopRef.current) {
                  console.log('检测到停止标志，终止写入');
                  break mainLoop;
                }
                const linkKey = normalizeUrlKey(item.share_url)
                if (!linkKey || existingLinks.has(linkKey)) continue
                existingLinks.add(linkKey)
                let coverFile: File | undefined
                if (coverEnabled && item.coverUrl) {
                  coverFile = await fetchCoverFile(
                    item.coverUrl,
                    buildCoverFileName('account', item.awemeId),
                    {
                      signal: accountAbortControllerRef.current?.signal,
                      convert: true
                    }
                  )
                  if (accountShouldStopRef.current) {
                    console.log('检测到停止标志，终止写入');
                    break mainLoop;
                  }
                }
                const record = await buildAccountRecord({ ...item, coverFile }, accountWriters);
                if (!record) continue
                recordsToInsert.push(record);
              }

              if (recordsToInsert.length) {
                const { appendedCount, filledCount } = await addRecordsInBatches(targetTable, recordsToInsert, {
                  emptyRecordIds,
                  stopRef: accountShouldStopRef
                });
                const writtenCount = appendedCount + filledCount
                remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, writtenCount)
                totalWritten += writtenCount;
                setMessage(tr(accountTargetTable === 'new'
                  ? '已写入新表 {{table}} 共 {{count}} 条'
                  : '已写入 {{count}} 条数据', {
                  table: targetTableName || '',
                  count: totalWritten,
                  used: totalWritten,
                  remaining: formatRemaining(remainingAfterWrite)
                }));
              }
            }

            // 数据页处理完成，检查是否有更多
            if (accountShouldStopRef.current) {
              console.log('检测到停止标志，终止分页处理');
              break mainLoop;
            }

            if (data.has_more) {
              const nextCursor = data.max_cursor ?? data.cursor
              const nextCursorText = nextCursor === undefined || nextCursor === null
                ? ''
                : String(nextCursor).trim()
              const isMissingNextCursor = !nextCursorText || nextCursorText === offset
              if (isMissingNextCursor) {
                if (missingNextCursorOffset === offset) {
                  setMessage(tr('仍未获得下一批起点，已结束当前账号'))
                  hasMore = false
                } else {
                  missingNextCursorOffset = offset
                  setMessage(tr('还有更多但没有下一批起点，已重试当前批次'))
                }
              } else {
                missingNextCursorOffset = null
                offset = nextCursorText
                pageCount++;
                console.log(`获取第 ${pageCount} 页数据完成`);
                setMessage(tr('已获取第 {{page}} 页数据，共 {{total}} 条', { page: pageCount, total: totalWritten }));
              }
            } else {
              hasMore = false;
              console.log('没有更多数据，结束采集');
            }
          } else {
            console.error('返回数据格式错误:', data);
            setMessage(tr('API 返回数据格式错误'));
            break;
          }

          // 页面处理完成，添加延时
          if (accountShouldStopRef.current) {
            console.log('检测到停止标志，终止分页处理');
            break mainLoop;
          }

          // 减少页面间延时
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('API请求已被中止');
            break mainLoop;
          }
          throw error;
        }
      }

      // 采集完成或停止
      console.log(`采集结束，共写入 ${totalWritten} 条数据，停止状态: ${accountShouldStopRef.current}`);
      setMessage(tr(accountShouldStopRef.current ? '已停止采集，成功写入 {{count}} 条数据' : '成功写入 {{count}} 条数据', {
        count: totalWritten,
        used: totalWritten,
        remaining: formatRemaining(remainingAfterWrite)
      }));
    } catch (error) {
      console.error('写入数据失败:', error);
      setMessage(tr('写入数据失败: {{error}}', { error: error instanceof Error ? error.message : '未知错误' }));
    } finally {
      // 清理状态
      if (accountAbortControllerRef.current) {
        accountAbortControllerRef.current = null;
      }
      setIsCollecting(false);
      setIsStopping(false);
    }
  }

  // 处理账号信息获取
  const handleAccountInfoFetch = async () => {
    if (accountInfoLoading) return
    if (quotaUnavailable) {
      setMessage(tr('配额未配置，请联系管理员后再试'))
      return
    }
    if (accountInfoMode === 'column' && !accountInfoUsernameField) {
      setMessage(tr('请选择账号列'))
      return
    }
    if (accountInfoMode === 'batch' && !accountInfoBatchInput.trim()) {
      setMessage(tr('请输入账号名称'))
      return
    }

    const accountInfoSelection = ensureRequiredSelections(
      accountInfoSelectedFields,
      ACCOUNT_INFO_REQUIRED_FIELDS
    )

    // 包装 fetchAccountInfoApi，处理 Response 并返回解析后的数据
    const fetchAccountInfo = async (name: string): Promise<AccountInfoResponse> => {
      const response = await fetchAccountInfoApi(name, fetchWithIdentity, { timeout: TIMEOUT_CONFIG.SEARCH })

      // 统一处理429配额超限错误
      if (await handle429Error(response)) {
        accountInfoStopRef.current = true
        throw new Error('今日配额已用完')
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} ${text || ''}`)
      }

      const data = await response.json()
      return data as AccountInfoResponse
    }

    try {
      setAccountInfoLoading(true)
      accountInfoStopRef.current = false
      setMessage(tr('正在获取账号信息...'))
      let remainingAfterWrite = typeof quotaInfo?.remaining === 'number' ? quotaInfo.remaining : null
      const activeTable = await bitable.base.getActiveTable()
      if (!activeTable) throw new Error('无法获取当前表格')

      if (accountInfoMode === 'column') {
        let targetTable = activeTable
        let targetTableName = ''
        if (accountInfoColumnTargetTable === 'new') {
          let nextTableName = accountInfoColumnNewTableName
          if (accountInfoColumnTableNameAuto) {
            nextTableName = getDefaultAccountInfoTableName()
            setAccountInfoColumnNewTableName(nextTableName)
          }
          const safeName = sanitizeTableName(nextTableName)
          if (safeName !== nextTableName) setAccountInfoColumnNewTableName(safeName)
          try {
            targetTable = await createNewTable(safeName, 'TT账户名称')
            targetTableName = safeName
          } catch (error) {
            console.error('创建表格失败:', error)
            const msg = error instanceof Error && error.message?.includes('TableNameInvalid')
              ? tr('表名无效，请重试')
              : tr('创建表格失败，请检查权限')
            setMessage(msg)
            return
          }
        }

        const fieldMetaList = await ensureFields(targetTable, ACCOUNT_INFO_FIELD_CONFIGS, accountInfoSelection)
        await refreshFields()
        let writers = await buildFieldWriters(targetTable, ACCOUNT_INFO_FIELD_CONFIGS, fieldMetaList, accountInfoSelection)
        writers = await attachPrimaryNameWriter(targetTable, fieldMetaList, writers)
        const isNewTargetTable = accountInfoColumnTargetTable === 'new'
        const seenAccounts = new Set<string>()
        if (isNewTargetTable) {
          const existingAccounts = await collectExistingKeys(targetTable, 'TT账户URL', normalizeAccountKey, { maxScan: 5000 })
          existingAccounts.forEach(accountKey => seenAccounts.add(accountKey))
        }
        const newTableRecords: Record<string, IOpenCellValue>[] = []

        let pageToken: string | undefined
        let hasMore = true
        let processed = 0
        let skipped = 0
        const cache = new Map<string, AccountInfoResponse>()
        const concurrency = 1
        const reportProgress = makeProgressThrottler()

        // 批量写入新表数据
        const flushNewTableRecords = async () => {
          if (!isNewTargetTable || !newTableRecords.length || accountInfoStopRef.current) return
          const batch = newTableRecords.splice(0, newTableRecords.length)
          const { appendedCount, filledCount } = await addRecordsInBatches(targetTable, batch, { stopRef: accountInfoStopRef })
          const writtenCount = appendedCount + filledCount
          processed += writtenCount
          remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, writtenCount)
          setMessage(tr('已更新 {{count}} 条账号信息', {
            count: processed,
            used: processed,
            remaining: formatRemaining(remainingAfterWrite)
          }) + (skipped > 0 ? tr('，跳过 {{skipped}} 条', { skipped }) : ''))
        }

        // 辅助函数：将账号信息写入指定记录
        const applyRecordFields = async (recordId: string, record: Record<string, IOpenCellValue>) => {
          for (const [fieldId, value] of Object.entries(record)) {
            if (accountInfoStopRef.current) break
            await targetTable.setCellValue(fieldId, recordId, value as IOpenCellValue)
          }
        }

        // 检查记录是否有数据（用于判断是否跳过）- 仅当前表时有效，写入新表默认跳过检查
        const hasExistingData = async (record: { recordId: string; fields?: Record<string, IOpenCellValue> }): Promise<boolean> => {
          if (isNewTargetTable) return false

          if (record.fields) {
            for (const [fieldId, value] of Object.entries(record.fields)) {
              if (fieldId === accountInfoUsernameField) continue
              if (!isCellValueEmpty(value as IOpenCellValue)) return true
            }
            return false
          }

          for (const fieldMeta of fieldMetaList) {
            if (fieldMeta.id === accountInfoUsernameField) continue
            const value = await targetTable.getCellValue(fieldMeta.id, record.recordId)
            if (!isCellValueEmpty(value)) return true
          }
          return false
        }

        // 模式1: 从表格列读取账号

        const processRecord = async (record: { recordId: string; fields?: Record<string, IOpenCellValue> }) => {
          if (accountInfoStopRef.current) return

          const cellValue = await activeTable.getCellValue(accountInfoUsernameField, record.recordId)
          const name = extractAccountName(extractTextFromCell(cellValue))
          if (!name) return

          const accountKey = normalizeAccountKey(name)
          if (!accountKey) return
          if (isNewTargetTable && seenAccounts.has(accountKey)) {
            skipped++
            return
          }

          // 检查是否跳过已有数据的行
          if (!accountInfoOverwrite) {
            const hasData = await hasExistingData(record)
            if (hasData) {
              skipped++
              return
            }
          }

          try {
            // 使用缓存避免重复请求
            let info = cache.get(name)
            if (!info) {
              info = await fetchAccountInfo(name)
              cache.set(name, info)
            }
            const recordData = await buildAccountInfoRecord(info, writers)
            if (!recordData) return

            if (isNewTargetTable) {
              seenAccounts.add(accountKey)
              newTableRecords.push(recordData)
              if (newTableRecords.length >= 50) {
                await flushNewTableRecords()
              }
            } else {
              await applyRecordFields(record.recordId, recordData)
              processed++
              remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, 1)
              reportProgress(processed, () => {
                setMessage(tr('已更新 {{count}} 条账号信息', {
                  count: processed,
                  used: processed,
                  remaining: formatRemaining(remainingAfterWrite)
                }) + (skipped > 0 ? tr('，跳过 {{skipped}} 条', { skipped }) : ''))
              })
            }
          } catch (error) {
            console.error(`获取账号 ${name} 信息失败:`, error)
          }
        }

        while (hasMore && !accountInfoStopRef.current) {
          const result = await activeTable.getRecords({ pageSize: 100, pageToken })
          const currentRecords = result.records || []

          for (let i = 0; i < currentRecords.length && !accountInfoStopRef.current; i += concurrency) {
            const slice = currentRecords.slice(i, i + concurrency)
            await Promise.all(slice.map(record => processRecord(record)))
          }

          hasMore = result.hasMore
          pageToken = result.pageToken
        }

        if (isNewTargetTable && newTableRecords.length && !accountInfoStopRef.current) {
          await flushNewTableRecords()
        }

        if (accountInfoStopRef.current) {
          setMessage(tr('已停止，成功更新 {{count}} 条账号信息', {
            count: processed,
            used: processed,
            remaining: formatRemaining(remainingAfterWrite)
          }))
        } else if (isNewTargetTable) {
          setMessage(tr('已写入新表格「{{tableName}}」，共 {{count}} 条记录', {
            tableName: targetTableName || accountInfoColumnNewTableName,
            count: processed,
            used: processed,
            remaining: formatRemaining(remainingAfterWrite)
          }))
        } else {
          setMessage(tr('账号信息更新完成，共 {{count}} 条', {
            count: processed,
            used: processed,
            remaining: formatRemaining(remainingAfterWrite)
          }) + (skipped > 0 ? tr('，跳过 {{skipped}} 条', { skipped }) : ''))
        }
      } else {
        // 模式2: 批量输入账号
        let targetTable = activeTable
        let nextTableName = newTableName
        if (batchTargetTable === 'new' && accountInfoBatchTableNameAuto) {
          nextTableName = getDefaultAccountInfoTableName()
          setNewTableName(nextTableName)
        }
        const targetTableName = sanitizeTableName(nextTableName)
        if (batchTargetTable === 'new' && targetTableName !== nextTableName.trim()) {
          setNewTableName(targetTableName)
        }

        if (batchTargetTable === 'new') {
          if (accountInfoStopRef.current) {
            return
          }
          try {
            targetTable = await createNewTable(targetTableName)
          } catch (error) {
            console.error('创建表格失败:', error)
            const msg = error instanceof Error && error.message?.includes('TableNameInvalid')
              ? tr('表名无效，请重试')
              : tr('创建表格失败，请检查权限')
            setMessage(msg)
            return
          }
        }

        const names = Array.from(
          new Set(
            accountInfoBatchInput
              .split(/[,\n\r]+/)
              .map(item => extractAccountName(item))
              .filter(Boolean)
          )
        )

        if (!names.length) {
          setMessage(tr('请输入账号名称'))
          return
        }

        const fieldMetaList = await ensureFields(targetTable, ACCOUNT_INFO_FIELD_CONFIGS, accountInfoSelection)
        await refreshFields()
        let writers = await buildFieldWriters(targetTable, ACCOUNT_INFO_FIELD_CONFIGS, fieldMetaList, accountInfoSelection)
        writers = await attachPrimaryNameWriter(targetTable, fieldMetaList, writers)

        // 获取空行（新表直接追加，不扫描）
        const emptyRecordIds = batchTargetTable === 'new' ? [] : await getEmptyRecords(targetTable, accountInfoStopRef, { maxScan: 500 })
        const recordsToInsert: Record<string, IOpenCellValue>[] = []
        let processed = 0
        const reportProgress = makeProgressThrottler()

        for (const name of names) {
          if (accountInfoStopRef.current) break

          try {
            const info = await fetchAccountInfo(name)
            const record = await buildAccountInfoRecord(info, writers)
            if (record) {
              recordsToInsert.push(record)
              processed++
              reportProgress(processed, () => {
                setMessage(tr('已获取 {{count}}/{{total}} 个账号信息', { count: processed, total: names.length }))
              })
            }
          } catch (error) {
            console.error(`获取账号 ${name} 信息失败:`, error)
            if (accountInfoStopRef.current) {
              break
            }
          }
        }

        if (recordsToInsert.length && !accountInfoStopRef.current) {
          const { appendedCount, filledCount } = await addRecordsInBatches(targetTable, recordsToInsert, {
            emptyRecordIds,
            stopRef: accountInfoStopRef
          })
          const writtenCount = appendedCount + filledCount
          remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, writtenCount)
          if (batchTargetTable === 'new') {
            setMessage(tr('已写入新表格「{{tableName}}」，共 {{count}} 条记录', {
              tableName: targetTableName,
              count: writtenCount,
              used: writtenCount,
              remaining: formatRemaining(remainingAfterWrite)
            }))
          } else {
            setMessage(tr('账号信息获取完成，新增 {{count}} 条记录', {
              count: writtenCount,
              used: writtenCount,
              remaining: formatRemaining(remainingAfterWrite)
            }))
          }
        } else if (accountInfoStopRef.current) {
          setMessage(tr('已停止，获取了 {{count}} 条账号信息', { count: processed }))
        } else {
          setMessage(tr('未生成可写入的账号信息'))
        }
      }
    } catch (error) {
      console.error('获取账号信息失败:', error)
      setMessage(tr('获取账号信息失败: {{error}}', { error: error instanceof Error ? error.message : '未知错误' }))
    } finally {
      setAccountInfoLoading(false)
    }
  }

  // 停止账号信息获取
  const handleAccountInfoStop = () => {
    accountInfoStopRef.current = true
    setMessage(tr('正在停止...'))
  }

  // 提取视频音频
  const handleAudioExtract = async () => {
    if (quotaUnavailable) {
      setMessage(tr('配额未配置，请联系管理员后再试'))
      return
    }
    if (audioMode === 'column') {
      if (!audioVideoUrlField) {
        console.error('请选择输入字段');
        setMessage(tr('请选择输入字段'));
        return;
      }
      if (audioTargetTable === 'current' && !audioOutputField) {
        console.error('请选择输出字段');
        setMessage(tr('请选择输出字段'));
        return;
      }
    } else {
      if (!audioBatchInput.trim()) {
        setMessage(tr('请输入视频链接'));
        return;
      }
    }

    const targetTableMode = audioMode === 'batch' ? 'new' : audioTargetTable
    if (audioMode === 'batch' && audioTargetTable !== 'new') {
      setAudioTargetTable('new')
    }

    setAudioLoading(true);
    audioShouldStopRef.current = false;
    audioAbortControllerRef.current = new AbortController();
    const audioSignal = audioAbortControllerRef.current.signal;
    type AudioTranscriptResult =
      | { status: 'ok'; text: string; empty: boolean }
      | { status: 'quota' }
      | { status: 'aborted' }
      | { status: 'error'; error: string };

    const resolveTranscriptText = (text: string | undefined, empty?: boolean) => {
      const normalized = (text ?? '').trim();
      if (normalized) return normalized;
      if (empty) return tr('未识别到有效内容');
      return tr('转录失败');
    };

    const parseResponseError = async (response: Response) => {
      const rawText = await response.text().catch(() => '');
      if (!rawText) return { data: {}, rawText: '' };
      try {
        const data = JSON.parse(rawText);
        return { data, rawText };
      } catch {
        return { data: {}, rawText };
      }
    };

    const getAudioEndpoints = () => {
      const directBase = getApiBase();
      const directUrl = directBase ? `${directBase}/api/extract-audio` : '';
      const fallbackUrl = '/api/extract-audio';
      if (!directUrl) return [fallbackUrl];
      if (directUrl === fallbackUrl) return [directUrl];
      return [fallbackUrl, directUrl];
    };

    const fetchAudioTranscript = async (videoUrl: string): Promise<AudioTranscriptResult> => {
      const maxAttempts = 2;
      const baseDelayMs = 1200;
      const endpoints = getAudioEndpoints();
      for (const endpoint of endpoints) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (audioShouldStopRef.current || audioSignal.aborted) return { status: 'aborted' };

          let response: Response;
          try {
            response = await fetchWithIdentity(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl }),
              signal: audioSignal
            }, { timeout: TIMEOUT_CONFIG.AUDIO_EXTRACT });
          } catch {
            if (audioShouldStopRef.current || audioSignal.aborted) return { status: 'aborted' };
            if (attempt >= maxAttempts) break;
            const delayMs = baseDelayMs * attempt;
            await sleep(delayMs);
            continue;
          }

          if (await handle429Error(response)) {
            return { status: 'quota' };
          }

          if (!response.ok) {
            const { data, rawText } = await parseResponseError(response);
            if (response.status === 503 && data?.code === 'TRANSCRIBE_BUSY' && attempt < maxAttempts) {
              const retryAfter = parseInt(data?.retryAfter, 10);
              const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : baseDelayMs * attempt;
              await sleep(delayMs);
              continue;
            }
            const errorMessage = data?.error || rawText || tr('转录失败');
            return { status: 'error', error: errorMessage };
          }

          const payload = await response.json().catch(() => ({}));
          return {
            status: 'ok',
            text: payload?.text ?? '',
            empty: Boolean(payload?.empty)
          };
        }
      }
      return { status: 'error', error: tr('转录失败') };
    };

    try {
      const activeTable = await bitable.base.getActiveTable();
      if (!activeTable) {
        throw new Error('无法获取当前表格');
      }
      let remainingAfterWrite = typeof quotaInfo?.remaining === 'number' ? quotaInfo.remaining : null

      // 目标表
      let targetTable = activeTable;
      let targetTableName = '';
      if (targetTableMode === 'new') {
        let nextTableName = audioNewTableName;
        if (audioTableNameAuto) {
          nextTableName = getDefaultAudioTableName();
          setAudioNewTableName(nextTableName);
        }
        const safeName = sanitizeTableName(nextTableName);
        if (safeName !== nextTableName) setAudioNewTableName(safeName);
        try {
          targetTable = await createNewTable(safeName, '转写文案');
          targetTableName = safeName;
        } catch (error) {
          console.error('创建表格失败:', error);
          const msg = error instanceof Error && error.message?.includes('TableNameInvalid')
            ? tr('表名无效，请重试')
            : tr('创建表格失败，请检查权限');
          setMessage(msg);
          return;
        }
      }

      if (audioMode === 'column' && targetTableMode === 'current') {
        const outputMeta = await activeTable.getFieldMetaById(audioOutputField)
        if (outputMeta.type !== FieldType.Text) {
          setMessage(tr('输出字段类型不支持，请选择文本字段'))
          return
        }
      }

      // 目标表字段（仅在需要写入新行时创建/确保）
      const audioSelectedMap = (targetTableMode === 'new' || audioMode === 'batch')
        ? { '视频链接': true, '转写文案': true }
        : { '视频链接': false, '转写文案': false }
      const audioFieldMeta = await ensureFields(targetTable, AUDIO_FIELD_CONFIGS, audioSelectedMap);
      const audioWriters = await buildFieldWriters(targetTable, AUDIO_FIELD_CONFIGS, audioFieldMeta, audioSelectedMap);

      // 列模式：遍历当前表记录
      if (audioMode === 'column') {
        const pageSize = 200;
        const concurrency = 1;
        let pageToken: string | undefined;
        let processedCount = 0;
        let hasMore = true;
        const reportProgress = makeProgressThrottler();

        const processRecord = async (record: { recordId: string }) => {
          if (audioShouldStopRef.current) return;

          const cellValue = await activeTable.getCellValue(audioVideoUrlField, record.recordId);
          const videoUrl = extractTextFromCell(cellValue);
          if (!videoUrl) return;

          if (targetTableMode === 'current') {
            const outputValue = await activeTable.getCellValue(audioOutputField, record.recordId);
            if (!isCellValueEmpty(outputValue)) return;
            await activeTable.setCellValue(audioOutputField, record.recordId, tr('获取文案中..'));
          }

          try {
            const result = await fetchAudioTranscript(videoUrl);
            if (result.status === 'quota') {
              if (targetTableMode === 'current') {
                await activeTable.setCellValue(audioOutputField, record.recordId, '');
              }
              return;
            }

            if (audioShouldStopRef.current || result.status === 'aborted') {
              if (targetTableMode === 'current') {
                await activeTable.setCellValue(audioOutputField, record.recordId, '');
              }
              return;
            }

            if (result.status === 'error') {
              console.error('提取失败:', result.error);
              if (targetTableMode === 'current') {
                await activeTable.setCellValue(audioOutputField, record.recordId, '');
              }
              return;
            }

            const transcript = resolveTranscriptText(result.text, result.empty);

            if (targetTableMode === 'current') {
              const fieldMeta = await activeTable.getFieldMetaById(audioOutputField);
              if (fieldMeta.type === FieldType.Text) {
                await activeTable.setCellValue(audioOutputField, record.recordId, transcript);
                processedCount++;
                remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, 1)
                reportProgress(processedCount, () => {
                  setMessage(tr('成功写入数据，已处理 {{count}} 条记录', {
                    count: processedCount,
                    used: processedCount,
                    remaining: formatRemaining(remainingAfterWrite)
                  }));
                });
              } else {
                console.warn('输出字段类型不支持，请选择文本字段');
                await activeTable.setCellValue(audioOutputField, record.recordId, '');
              }
            } else {
              const recordFields: Record<string, IOpenCellValue> = {};
              const videoWriter = audioWriters['视频链接'];
              const transcriptWriter = audioWriters['转写文案'];
              if (videoWriter) {
                recordFields[videoWriter.id] = await normalizeValue(videoWriter, videoUrl) as IOpenCellValue;
              }
              if (transcriptWriter) {
                recordFields[transcriptWriter.id] = await normalizeValue(transcriptWriter, transcript) as IOpenCellValue;
              }
              const payload = { fields: recordFields };
              const tableWithBatch = targetTable as ITable & { addRecords?: (records: { fields: Record<string, IOpenCellValue> }[]) => Promise<void> };
              if (typeof tableWithBatch.addRecords === 'function') {
                await tableWithBatch.addRecords([payload]);
              } else {
                await targetTable.addRecord(payload);
              }
              processedCount++;
              remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, 1)
              setMessage(tr('已写入新表 {{table}}，处理 {{count}} 条记录', {
                table: targetTableName || '',
                count: processedCount,
                used: processedCount,
                remaining: formatRemaining(remainingAfterWrite)
              }));
            }
          } catch (error) {
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                console.error('请求超时');
              } else if (error.message === 'Load failed') {
                console.error('网络连接失败，请检查网络');
              } else {
                console.error('处理单条记录失败:', error);
              }
              if (error.message === 'Load failed' || error.name === 'AbortError') {
                if (targetTableMode === 'current') {
                  await activeTable.setCellValue(audioOutputField, record.recordId, '');
                }
                await sleep(5000);
                return;
              }
            } else {
              console.error('处理单条记录失败:', error);
            }
            if (targetTableMode === 'current') {
              await activeTable.setCellValue(audioOutputField, record.recordId, '');
            }
          }
        };

        while (!audioShouldStopRef.current && hasMore) {
          const params: IGetRecordsParams = { pageSize, pageToken };
          const records = await activeTable.getRecords(params);
          const currentRecords = records.records || [];
          for (let i = 0; i < currentRecords.length && !audioShouldStopRef.current; i += concurrency) {
            const slice = currentRecords.slice(i, i + concurrency);
            await Promise.all(slice.map(record => processRecord(record)));
          }
          hasMore = records.hasMore;
          pageToken = records.pageToken;
        }

        if (audioShouldStopRef.current) {
          setMessage(tr('用户停止了提取，已处理 {{count}} 条记录', {
            count: processedCount,
            used: processedCount,
            remaining: formatRemaining(remainingAfterWrite)
          }));
        } else {
          setMessage(tr(targetTableMode === 'new'
            ? '处理完成，已写入新表 {{table}} 共 {{count}} 条记录'
            : '处理完成，共处理 {{count}} 条记录', {
            table: targetTableName || '',
            count: processedCount,
            used: processedCount,
            remaining: formatRemaining(remainingAfterWrite)
          }));
        }
      } else {
        // 批量模式：从输入框解析视频链接列表
        const urls = Array.from(
          new Set(
            audioBatchInput
              .split(/[,\n\r]+/)
              .map(item => item.trim())
              .filter(Boolean)
          )
        );
        if (!urls.length) {
          setMessage(tr('请输入视频链接'));
          return;
        }

        const recordsToInsert: Record<string, IOpenCellValue>[] = [];
        for (const link of urls) {
          if (audioShouldStopRef.current) break;
          const recordFields: Record<string, IOpenCellValue> = {};
          const videoWriter = audioWriters['视频链接'];
          if (videoWriter) {
            recordFields[videoWriter.id] = await normalizeValue(videoWriter, link) as IOpenCellValue;
          }
          // 先占位，稍后补充转写结果
          const transcriptWriter = audioWriters['转写文案'];
          if (transcriptWriter) {
            recordFields[transcriptWriter.id] = await normalizeValue(transcriptWriter, '') as IOpenCellValue;
          }
          recordsToInsert.push(recordFields);
        }

        // 先写入空文案占位，避免转写失败导致整批失败
        const emptyIds: string[] = [];
        const addResult = await addRecordsInBatches(targetTable, recordsToInsert, { emptyRecordIds: emptyIds, stopRef: audioShouldStopRef });
        const insertedRecordIds = addResult.recordIds;
        const writtenCount = addResult.appendedCount + addResult.filledCount
        remainingAfterWrite = applyQuotaConsumption(remainingAfterWrite, writtenCount)
        const remainingText = formatRemaining(remainingAfterWrite)

        // 按顺序转写并回填文案（简单串行，避免超时）
        let processedCount = 0;
        const reportProgress = makeProgressThrottler();
        for (let i = 0; i < urls.length && !audioShouldStopRef.current; i++) {
          const videoUrl = urls[i];
          try {
            const result = await fetchAudioTranscript(videoUrl);
            if (result.status === 'quota') {
              break;
            }
            if (result.status === 'aborted') {
              break;
            }
            if (result.status === 'error') {
              console.error('批量转写失败:', result.error);
              continue;
            }
            const transcript = resolveTranscriptText(result.text, result.empty);
            const transcriptWriter = audioWriters['转写文案'];
            const recordId = insertedRecordIds[i];
            if (transcriptWriter && recordId) {
              await targetTable.setCellValue(transcriptWriter.id, recordId, transcript);
            }
            processedCount++;
            reportProgress(processedCount, () => {
              setMessage(tr('已写入新表 {{table}}，处理 {{count}} 条记录', {
                table: targetTableName || '',
                count: processedCount,
                used: writtenCount,
                remaining: remainingText
              }));
            });
          } catch (error) {
            console.error('批量转写失败:', error);
          }
        }
      }
    } catch (error) {
      console.error('处理失败:', error);
      setMessage(tr('处理失败: {{error}}', { error: error instanceof Error ? error.message : '未知错误' }));
    } finally {
      audioAbortControllerRef.current = null;
      setAudioLoading(false);
    }
  };

  // 派生状态：各区域是否展开
  const keywordOpen = activeSection === 'keyword'
  const accountOpen = activeSection === 'account'
  const accountInfoOpen = activeSection === 'accountInfo'
  const audioOpen = activeSection === 'audio'
  // 配额提示：剩余为0时提醒，但不阻断写入
  const quotaUnavailable = quotaInfo?.status === 'unavailable'
  const quotaAvailable = quotaInfo?.status === 'available' && typeof quotaInfo?.remaining === 'number'
  const quotaZero = quotaAvailable && (quotaInfo?.remaining ?? 0) <= 0
  const keywordQuotaInsufficient = quotaZero
  const accountQuotaInsufficient = quotaZero
  const accountInfoQuotaInsufficient = quotaZero && accountInfoEstimatedRows > 0
  const audioQuotaInsufficient = quotaZero

  // 批量输入仅支持新建表格
  useEffect(() => {
    if (audioMode !== 'batch') return
    if (audioTargetTable === 'new') return
    setAudioTargetTable('new')
  }, [audioMode, audioTargetTable])

  // 自动匹配当前表中的视频链接/转写文案字段，减少手动选择
  useEffect(() => {
    if (!fields.length) return

    if (audioMode === 'column') {
      const urlField = fields.find(meta => meta.name === '视频链接' && meta.type === FieldType.Url)
      const videoFieldValid = audioVideoUrlField && fields.some(meta => meta.id === audioVideoUrlField)
      if (!videoFieldValid) {
        if (urlField) {
          setAudioVideoUrlField(urlField.id)
        } else if (audioVideoUrlField) {
          setAudioVideoUrlField('')
        }
      }
    }

    // 写入列仅在列模式且写入当前表格时需要
    if (audioMode === 'column' && audioTargetTable === 'current' && !audioOutputField) {
      const textField = fields.find(meta => meta.name === '转写文案' && meta.type === FieldType.Text)
      if (textField) setAudioOutputField(textField.id)
    }
  }, [audioTargetTable, audioMode, fields, audioOutputField, audioVideoUrlField])

  // 账号信息：列模式 + 当前表时自动预选账号列
  useEffect(() => {
    if (accountInfoMode !== 'column') return
    if (accountInfoColumnTargetTable !== 'current') return
    if (accountInfoUsernameField) return
    if (!fields.length) return

    const byName = fields.find(meta => meta.name === 'TT账户名称' && (meta.type === FieldType.Text || meta.type === FieldType.Url))
    if (byName) {
      setAccountInfoUsernameField(byName.id)
      return
    }

    const firstText = fields.find(meta => meta.type === FieldType.Text)
    if (firstText) setAccountInfoUsernameField(firstText.id)
  }, [accountInfoMode, accountInfoColumnTargetTable, accountInfoUsernameField, fields])

  // 关键词变化时自动更新表格名称（仅当选择新建表格时）
  useEffect(() => {
    if (keywordTargetTable !== 'new') return
    if (!keywordTableNameAuto) return
    if (!query.trim()) {
      setKeywordNewTableName(getDefaultKeywordTableName())
      return
    }
    setKeywordNewTableName(getDefaultKeywordTableName(query.trim()))
  }, [query, keywordTargetTable, keywordTableNameAuto])

  // 账号名变化时自动更新表格名称（仅当选择新建表格时）
  useEffect(() => {
    if (accountTargetTable !== 'new') return
    if (!accountTableNameAuto) return
    const resolvedUsername = extractAccountName(username)
    if (!resolvedUsername) {
      setAccountNewTableName(getDefaultAccountTableName())
      return
    }
    setAccountNewTableName(getDefaultAccountTableName(resolvedUsername.trim()))
  }, [username, accountTargetTable, accountTableNameAuto])

  const quotaDetailVisibility = quotaDetailsOpen ? Math.max(0, 1 - quotaCollapseProgress) : 0
  const quotaDetailSpacing = Math.round(8 * quotaDetailVisibility)
  const quotaDetailStyle = {
    maxHeight: `${Math.max(0, Math.round(quotaDetailsHeight * quotaDetailVisibility))}px`,
    opacity: quotaDetailVisibility,
    marginTop: `${quotaDetailSpacing}px`,
    paddingTop: `${quotaDetailSpacing}px`,
    borderTopWidth: quotaDetailVisibility > 0.05 ? '1px' : '0px'
  } as CSSProperties

  const handleJoinGroupClick = useCallback(() => {
    window.open(USER_GROUP_JOIN_LINK, '_blank', 'noopener,noreferrer')
  }, [])

  const handleRedeemCode = useCallback(async () => {
    const code = redeemCode.trim()
    if (!code) {
      setMessage(tr('redeem.empty'))
      return
    }
    if (!userIdentity) {
      setMessage(tr('获取用户身份失败，请刷新页面重试'))
      return
    }

    setRedeemLoading(true)
    try {
      const response = await fetchWithIdentity(
        `${getApiBase()}/api/redeem`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        },
        { timeout: TIMEOUT_CONFIG.QUOTA }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data?.message || tr('redeem.failed'))
        return
      }
      const remaining = data?.remaining
      const quota = data?.quota
      setRedeemCode('')
      if (typeof remaining === 'number' && typeof quota === 'number') {
        setMessage(tr('redeem.success', { remaining, quota }))
      } else {
        setMessage(tr('redeem.success.simple'))
      }
      refreshQuota()
    } catch (error) {
      console.error('[redeem] 使用码兑换失败:', error)
      setMessage(tr('redeem.failed'))
    } finally {
      setRedeemLoading(false)
    }
  }, [fetchWithIdentity, redeemCode, refreshQuota, setMessage, tr, userIdentity])

  return (
    <Fragment>
      <div
        ref={appRef}
        className={`app ${theme.toLowerCase()}`}
        style={{
          // 通过CSS变量驱动子元素的sticky定位
          // 二级header的top = 顶部固定区域的实际高度
          '--section-sticky-top': `${quotaStickyHeight + 6}px`
        } as CSSProperties}
      >
        {/* ==================== 主标题（随内容滚动） ====================  */}
        <div className="main-header">
          <div className="main-header-inner">
            <h1 className="app-title">{t('title')}</h1>
          </div>
        </div>

        <div className="quota-card join-group-card">
          <div className="join-group-row">
            <div className="join-group-title">{tr('加入用户群，领取新手试用')}</div>
            <button type="button" onClick={handleJoinGroupClick}>
              {tr('加入用户群')}
            </button>
          </div>
        </div>

        <div className="quota-card redeem-card">
          <div className="redeem-title">{tr('redeem.title')}</div>
          <div className="redeem-form">
            <input
              type="text"
              className="redeem-input"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder={tr('redeem.placeholder')}
              disabled={redeemLoading || !userIdentity}
            />
            <button
              type="button"
              onClick={handleRedeemCode}
              disabled={redeemLoading || !redeemCode.trim() || !userIdentity}
            >
              {redeemLoading ? tr('redeem.loading') : tr('redeem.button')}
            </button>
          </div>
          <div className="redeem-tip">{tr('redeem.tip')}</div>
        </div>

        {/* ==================== 数据点（置顶固定） ====================  */}
        <div
          ref={quotaStickyRef}
          className={`quota-sticky ${quotaStickyPinned ? 'pinned' : ''}`}
        >
          {quotaInfo && quotaInfo.status === 'available' && quotaInfo.remaining !== null && quotaInfo.quota !== null ? (
            <div
              className="quota-card"
              onClick={() => setQuotaDetailsOpen(prev => !prev)}
            >
              <div className="quota-card-header">
                <div className="quota-card-title">📊 {tr('quota.title')}</div>

                <div className="quota-progress-bar">
                  <div
                    className={`quota-progress-fill ${
                      quotaInfo.remaining <= 5 ? 'danger' :
                      quotaInfo.remaining <= 10 ? 'warning' : ''
                    }`}
                    style={{
                      width: `${((quotaInfo.quota - quotaInfo.remaining) / quotaInfo.quota) * 100}%`
                    }}
                  />
                </div>

                <div
                  className={`quota-remaining ${
                    quotaInfo.remaining <= 5 ? 'danger' :
                    quotaInfo.remaining <= 10 ? 'warning' : ''
                  }`}
                >
                  {quotaInfo.remaining}/{quotaInfo.quota}
                </div>

                <button
                  className={`quota-toggle-btn ${quotaDetailsOpen ? 'open' : ''}`}
                  onClick={event => {
                    event.stopPropagation()
                    setQuotaDetailsOpen(prev => !prev)
                  }}
                  aria-label={quotaDetailsOpen ? tr('quota.collapse') : tr('quota.expand')}
                >
                  ▼
                </button>
              </div>

              <div ref={quotaDetailsRef} className="quota-card-details" style={quotaDetailStyle}>
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{tr('quota.plan.label')}</span>
                  <span className="quota-detail-value">{quotaPlanLabel}</span>
                </div>
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{quotaResetLabel}</span>
                  <span className="quota-detail-value">{quotaResetValue}</span>
                </div>
                {pointsExpiringSoon && (
                  <div className="quota-detail-item">
                    <span className="quota-detail-label">{tr('quota.expire.notice.label')}</span>
                    <span className="quota-detail-value">{tr('quota.expire.notice')}</span>
                  </div>
                )}
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{tr('quota.keyword.label')}</span>
                  <span className="quota-detail-value">{tr('quota.keyword.desc')}</span>
                </div>
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{tr('quota.account.label')}</span>
                  <span className="quota-detail-value">{tr('quota.account.desc')}</span>
                </div>
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{tr('quota.accountInfo.label')}</span>
                  <span className="quota-detail-value">{tr('quota.accountInfo.desc')}</span>
                </div>
                <div className="quota-detail-item">
                  <span className="quota-detail-label">{tr('quota.audio.label')}</span>
                  <span className="quota-detail-value">{tr('quota.audio.desc')}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>


        {/* ==================== 功能板块（带二级粘性Header）====================  */}
        <KeywordSection
          tr={tr}
          open={keywordOpen}
          onToggle={() => toggleSection('keyword')}
          isCollecting={isCollecting}
          isStopping={isStopping}
          collectType={collectType}
          query={query}
          vtime={vtime}
          region={region}
          keywordTargetTable={keywordTargetTable}
          keywordNewTableName={keywordNewTableName}
          loading={loading}
          keywordQuotaInsufficient={keywordQuotaInsufficient}
          keywordSelectedFields={keywordSelectedFields}
          keywordRequiredFields={KEYWORD_REQUIRED_FIELDS}
          setQuery={setQuery}
          setVtime={setVtime}
          setRegion={setRegion}
          setKeywordTargetTable={setKeywordTargetTable}
          setKeywordNewTableName={handleKeywordNewTableNameChange}
          handleKeywordFieldChange={handleKeywordFieldChange}
          writeKeywordTikTokData={writeKeywordTikTokData}
          stopCollection={stopKeywordCollection}
        />

        <AccountSection
          tr={tr}
          open={accountOpen}
          onToggle={() => toggleSection('account')}
          isCollecting={isCollecting}
          isStopping={isStopping}
          collectType={collectType}
          username={username}
          userRegion={userRegion}
          accountTargetTable={accountTargetTable}
          accountNewTableName={accountNewTableName}
          loading={loading}
          accountQuotaInsufficient={accountQuotaInsufficient}
          accountSelectedFields={accountSelectedFields}
          accountRequiredFields={ACCOUNT_REQUIRED_FIELDS}
          setUsername={setUsername}
          setUserRegion={setUserRegion}
          setAccountTargetTable={setAccountTargetTable}
          setAccountNewTableName={handleAccountNewTableNameChange}
          handleAccountFieldChange={handleAccountFieldChange}
          writeAccountTikTokData={writeAccountTikTokData}
          stopCollection={stopAccountCollection}
        />

        <AccountInfoSection
          tr={tr}
          open={accountInfoOpen}
          onToggle={() => toggleSection('accountInfo')}
          fields={fields}
          accountInfoMode={accountInfoMode}
          setAccountInfoMode={setAccountInfoMode}
          accountInfoUsernameField={accountInfoUsernameField}
          setAccountInfoUsernameField={setAccountInfoUsernameField}
          accountInfoOverwrite={accountInfoOverwrite}
          setAccountInfoOverwrite={setAccountInfoOverwrite}
          accountInfoColumnTargetTable={accountInfoColumnTargetTable}
          setAccountInfoColumnTargetTable={setAccountInfoColumnTargetTable}
          accountInfoColumnNewTableName={accountInfoColumnNewTableName}
          setAccountInfoColumnNewTableName={handleAccountInfoColumnNewTableNameChange}
          batchTargetTable={batchTargetTable}
          setBatchTargetTable={setBatchTargetTable}
          newTableName={newTableName}
          setNewTableName={handleAccountInfoBatchNewTableNameChange}
          accountInfoBatchInput={accountInfoBatchInput}
          setAccountInfoBatchInput={setAccountInfoBatchInput}
          accountInfoLoading={accountInfoLoading}
          accountInfoQuotaInsufficient={accountInfoQuotaInsufficient}
          accountInfoSelectedFields={accountInfoSelectedFields}
          accountInfoRequiredFields={ACCOUNT_INFO_REQUIRED_FIELDS}
          handleAccountInfoFieldChange={handleAccountInfoFieldChange}
          handleAccountInfoFetch={handleAccountInfoFetch}
          handleAccountInfoStop={handleAccountInfoStop}
        />

        <AudioSection
          tr={tr}
          open={audioOpen}
          onToggle={() => toggleSection('audio')}
          fields={fields}
          audioMode={audioMode}
          setAudioMode={setAudioMode}
          audioVideoUrlField={audioVideoUrlField}
          setAudioVideoUrlField={setAudioVideoUrlField}
          audioBatchInput={audioBatchInput}
          setAudioBatchInput={setAudioBatchInput}
          audioOutputField={audioOutputField}
          setAudioOutputField={setAudioOutputField}
          audioTargetTable={audioTargetTable}
          setAudioTargetTable={setAudioTargetTable}
          audioNewTableName={audioNewTableName}
          setAudioNewTableName={handleAudioNewTableNameChange}
          audioLoading={audioLoading}
          audioQuotaInsufficient={audioQuotaInsufficient}
          handleAudioExtract={handleAudioExtract}
          handleAudioStop={stopAudioExtraction}
        />

        {/* 处理状态板块 - 固定在底部 */}
        <div className="status-bar">
          <div className="status-content">
            {(loading || message || isCollecting || accountInfoLoading || audioLoading) ? (
              <>
                {loading && <span className="status-loading">{tr('加载中...')}</span>}
                {message && <span className="status-message">{message}</span>}
                {isCollecting && !loading && !message && <span className="status-loading">{tr('正在采集数据...')}</span>}
                {accountInfoLoading && !message && <span className="status-loading">{tr('正在获取账号信息...')}</span>}
                {audioLoading && !message && <span className="status-loading">{tr('正在提取音频...')}</span>}
              </>
            ) : (
              <span className="status-idle">{tr('就绪')} | {tableId ? `ID: ${tableId.slice(0, 8)}...` : ''}</span>
            )}
          </div>
        </div>
      </div>
    </Fragment>
  )
}

export default App
