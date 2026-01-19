/**
 * 商品检测服务层
 *
 * 从 TikTok 视频数据中识别电商带货信息
 * 职责：
 * - 5 维度检测逻辑（anchors、products、flags、commerce_info）
 * - 产品信息解析和标准化
 * - 产品去重和链接构建
 *
 * 参考：TikTikMCP 的带货检测逻辑
 */

/**
 * Anchor 项类型
 */
interface AnchorItem {
  component_key?: string
  extra?: unknown
}

/**
 * 带货产品信息
 */
export interface CommerceProduct {
  productId?: string
  title?: string
  price?: number
  currency?: string
  link?: string
  source?: string
  adLabel?: string
}

/**
 * 带货识别结果
 */
export interface CommerceResult {
  isCommerce: boolean
  reasons: string[]
  products: CommerceProduct[]
  productsTotal: number
  firstProduct?: CommerceProduct
  productsText: string
}

// ==================== 辅助函数 ====================

/**
 * 从 JSON 字符串中提取 product_id（避免大整数精度丢失）
 *
 * @param jsonStr - JSON 字符串
 * @returns 提取的 product_id（15 位以上整数）
 *
 * @remarks
 * JavaScript Number 类型对大于 2^53-1 的整数会丢失精度，需要用正则提取原始字符串
 */
const extractProductIdFromJson = (jsonStr: string): string | undefined => {
  // 匹配 "product_id": 1234567890123456789 格式（15位以上的整数）
  const match = jsonStr.match(/"product_id"\s*:\s*(\d{15,})/)
  return match ? match[1] : undefined
}

/**
 * 安全解析 JSON 字符串
 *
 * @param raw - 待解析的值
 * @returns 解析后的对象/数组，失败返回 null
 */
const safeJsonParse = (raw: unknown): Record<string, unknown> | unknown[] | null => {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 判断是否为有效的 HTTP/HTTPS URL
 *
 * @param str - 待检查的字符串
 * @returns 是否为 HTTP(S) URL
 */
const isHttpUrl = (str: string): boolean => {
  return /^https?:\/\/.+/.test(str)
}

/**
 * 解析价格字段
 *
 * @param raw - 原始价格值
 * @returns 解析后的数字，失败返回 undefined
 */
const parsePrice = (raw: unknown): number | undefined => {
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/**
 * 安全转换为可选字符串
 *
 * @param val - 待转换的值
 * @returns 字符串或 undefined
 */
const toOptionalString = (val: unknown): string | undefined => {
  return val ? String(val) : undefined
}

/**
 * 将带货原因代码转换为中文可读文本
 *
 * @param reason - 原因代码
 * @returns 中文翻译
 *
 * @example
 * ```ts
 * translateCommerceReason('anchor:anchor_product') // => '商品锚点(产品)'
 * translateCommerceReason('bottom_products') // => '底部商品栏'
 * ```
 */
export const translateCommerceReason = (reason: string): string => {
  const translations: Record<string, string> = {
    'anchor:anchor_complex_shop': '商品锚点(复合店铺)',
    'anchor:anchor_shop': '商品锚点(店铺)',
    'anchor:anchor_product': '商品锚点(产品)',
    'anchor:anchor_commerce': '商品锚点(电商)',
    'bottom_products': '底部商品栏',
    'products_info': '商品信息列表',
    'right_products': '右侧商品栏',
    'commerce_goods_flag': '电商商品标记',
    'commerce_info_commission': '佣金信息',
  }

  // 处理 branded_type 类型
  if (reason.startsWith('commerce_info_branded_type:')) {
    return '品牌内容标记'
  }

  // 处理其他 anchor 类型
  if (reason.startsWith('anchor:')) {
    const anchorType = reason.substring(7) // 去掉 "anchor:" 前缀
    return translations[reason] || `商品锚点(${anchorType})`
  }

  return translations[reason] || reason
}

/**
 * 格式化单个产品为摘要文本
 *
 * @param product - 产品信息
 * @param index - 序号（从 1 开始）
 * @returns 格式化的产品摘要
 *
 * @remarks
 * 格式: [序号] 标题 (来源) [价格>0时显示价格]
 * 只有当价格大于 0 时才显示价格信息（TikTok API 搜索结果中价格通常为 0）
 */
const formatProductSummary = (product: CommerceProduct, index: number): string => {
  const parts: string[] = [`[${index}]`]
  if (product.title) parts.push(product.title)
  // 只有当价格大于0时才显示价格信息（TikTok API搜索结果中价格通常为0）
  if (product.price !== undefined && product.price > 0 && product.currency) {
    parts.push(`- ${product.currency}${product.price}`)
  }
  if (product.source) parts.push(`(${product.source})`)
  return parts.join(' ')
}

/**
 * 标准化产品信息
 *
 * @param raw - 原始产品数据
 * @returns 标准化后的产品对象
 *
 * @remarks
 * - 支持多种字段名变体（price/sale_price/market_price）
 * - 自动提取嵌套的货币符号
 * - 支持多种链接字段（schema/detail_url/final_url/short_url）
 */
const normalizeProduct = (raw: Record<string, unknown>): CommerceProduct => {
  const price = parsePrice(raw.price ?? raw.sale_price ?? raw.market_price)
  const currencyObj = raw.currency_format as Record<string, unknown> | undefined
  const currency = toOptionalString(raw.currency ?? currencyObj?.currency_symbol)
  const link = toOptionalString(
    raw.schema ?? raw.detail_url ?? raw.final_url ?? raw.short_url
  )
  const extraObj = raw.extra as Record<string, unknown> | undefined
  const adLabel = toOptionalString(raw.ad_label_name ?? extraObj?.ad_label_name)

  return {
    productId: toOptionalString(raw.product_id ?? raw.id),
    title: toOptionalString(raw.title ?? raw.elastic_title ?? raw.keyword),
    price,
    currency,
    link,
    source: toOptionalString(raw.source ?? raw.source_from),
    adLabel
  }
}

/**
 * 从 Anchor 项中提取产品列表
 *
 * @param anchor - Anchor 项
 * @returns 提取的产品列表
 *
 * @remarks
 * - 处理嵌套的 extra 字段（可能是 JSON 字符串或对象数组）
 * - 自动展开多层嵌套结构
 * - 保留大整数 product_id 的精度
 */
const parseAnchorProducts = (anchor: AnchorItem): CommerceProduct[] => {
  const out: CommerceProduct[] = []
  const extraRaw = anchor?.extra
  let arr: unknown[] = []

  if (typeof extraRaw === 'string') {
    const parsed = safeJsonParse(extraRaw)
    if (Array.isArray(parsed)) arr = parsed
    else if (parsed && typeof parsed === 'object') arr = [parsed]
  } else if (extraRaw && typeof extraRaw === 'object') {
    arr = Array.isArray(extraRaw) ? extraRaw : [extraRaw]
  }

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    let merged = { ...item } as Record<string, unknown>

    // 如果产品对象内部还有嵌套的 extra，也需要展开
    const itemObj = item as Record<string, unknown>
    if (typeof itemObj.extra === 'string') {
      // 先提取真实的product_id（避免精度丢失）
      const realProductId = extractProductIdFromJson(itemObj.extra)
      const nested = safeJsonParse(itemObj.extra)
      if (nested && typeof nested === 'object') {
        merged = { ...nested, ...merged }
        // 用真实的product_id覆盖（如果提取成功）
        if (realProductId) {
          merged.product_id = realProductId
        }
      }
    } else if (itemObj.extra && typeof itemObj.extra === 'object') {
      merged = { ...itemObj.extra, ...merged }
    }

    const prod = normalizeProduct(merged)
    if (prod.productId || prod.title || prod.link) {
      out.push(prod)
    }
  }

  return out
}

/**
 * 从产品列表数组中解析产品
 *
 * @param list - 产品列表（可能是任意类型）
 * @returns 解析后的产品数组
 */
const parseProductList = (list: unknown): CommerceProduct[] => {
  if (!list || !Array.isArray(list)) return []
  return list
    .map(item => {
      if (!item || typeof item !== 'object') return null
      return normalizeProduct(item as Record<string, unknown>)
    })
    .filter((p): p is CommerceProduct => {
      return !!p && !!(p.productId || p.title || p.link)
    })
}

/**
 * 产品去重
 *
 * @param products - 产品列表
 * @returns 去重后的产品列表
 *
 * @remarks
 * - 优先使用 productId 作为唯一键
 * - 其次使用 title + index 组合键
 * - 保留第一个出现的产品
 */
const dedupeProducts = (products: CommerceProduct[]): CommerceProduct[] => {
  const seen = new Map<string, CommerceProduct>()
  products.forEach((p, idx) => {
    const key = p.productId || `${p.title || ''}#${idx}`
    if (!seen.has(key)) seen.set(key, p)
  })
  return Array.from(seen.values())
}

/**
 * 选择产品链接
 *
 * @param product - 产品信息
 * @returns 产品链接 URL
 *
 * @remarks
 * - 优先使用 product.link（如果是有效的 HTTP URL）
 * - 其次根据 productId 构造 TikTok Shop 链接
 * - 都不可用时返回空字符串
 */
export const pickProductLink = (product: CommerceProduct): string => {
  if (product.link && isHttpUrl(product.link)) return product.link
  if (product.productId) return buildProductLink(product.productId)
  return ''
}

/**
 * 根据 productId 构造产品链接
 *
 * @param productId - 产品 ID
 * @returns TikTok Shop 产品页链接
 */
const buildProductLink = (productId: string): string => {
  return `https://www.tiktok.com/shop/pdp/${productId}`
}

// ==================== 核心检测函数 ====================

/**
 * 从视频数据中识别带货信息
 *
 * @param v - 视频原始数据（Record 格式）
 * @returns 带货检测结果
 *
 * @remarks
 * 参考 TikTikMCP 的 5 维度检测逻辑：
 * 1. anchors/anchor_info - 商品锚点
 * 2. bottom_products - 底部商品栏
 * 3. products_info - 商品信息列表
 * 4. right_products - 右侧商品栏
 * 5. 布尔标志 - has_commerce_goods/existed_commerce_goods/ecommerce_goods
 * 6. commerce_info - 佣金信息和品牌内容标记
 *
 * @example
 * ```ts
 * const result = commerceFromAweme(videoData)
 * if (result.isCommerce) {
 *   console.log('检测到带货视频')
 *   console.log('原因:', result.reasons.map(translateCommerceReason).join('、'))
 *   console.log('产品数量:', result.productsTotal)
 * }
 * ```
 */
export const commerceFromAweme = (v: Record<string, unknown>): CommerceResult => {
  const reasons: string[] = []
  const products: CommerceProduct[] = []

  // 1. 检查 anchors/anchor_info
  const anchors = Array.isArray(v.anchors)
    ? v.anchors
    : Array.isArray(v.anchor_info)
    ? v.anchor_info
    : []
  for (const anchor of anchors as AnchorItem[]) {
    const compKey = String(anchor?.component_key || '').toLowerCase()
    const isCommerceAnchor = /shop|product|commerce/.test(compKey)
    if (!isCommerceAnchor) continue

    products.push(...parseAnchorProducts(anchor))
    if (anchor?.component_key) {
      reasons.push(`anchor:${anchor.component_key}`)
    } else {
      reasons.push('anchor')
    }
  }

  // 2. 检查 bottom_products
  const bottom = parseProductList(v.bottom_products)
  if (bottom.length) {
    products.push(...bottom)
    reasons.push('bottom_products')
  }

  // 3. 检查 products_info
  const infoProducts = parseProductList(v.products_info)
  if (infoProducts.length) {
    products.push(...infoProducts)
    reasons.push('products_info')
  }

  // 4. 检查 right_products
  const rightProducts = parseProductList(v.right_products)
  if (rightProducts.length) {
    products.push(...rightProducts)
    reasons.push('right_products')
  }

  // 5. 检查布尔标志
  const hasGoodsFlag = Boolean(
    v.has_commerce_goods || v.existed_commerce_goods || v.ecommerce_goods
  )
  if (hasGoodsFlag) reasons.push('commerce_goods_flag')

  // 6. 检查 commerce_info
  const commerceInfo = (v.commerce_info || {}) as Record<string, unknown>
  const commissionText = String(commerceInfo.bc_label_test_text || '').toLowerCase()
  const brandedType = commerceInfo.branded_content_type
  const commission = commissionText.includes('commission')
  const branded =
    typeof brandedType === 'number' ? brandedType > 0 : Boolean(brandedType)

  if (commission) reasons.push('commerce_info_commission')
  if (branded) reasons.push(`commerce_info_branded_type:${brandedType}`)

  // 去重产品（不限制数量，找到几个显示几个）
  const uniqueProducts = dedupeProducts(products)

  // 最终判断：有产品、有标志、有佣金/品牌标记、或任一维度命中（reasons 不为空）
  const isCommerce =
    uniqueProducts.length > 0 || hasGoodsFlag || commission || branded || reasons.length > 0

  // 格式化产品文本
  const productsText = uniqueProducts
    .map((p, idx) => formatProductSummary(p, idx + 1))
    .join('\n')

  return {
    isCommerce,
    reasons: Array.from(new Set(reasons)),
    products: uniqueProducts,
    productsTotal: uniqueProducts.length,
    firstProduct: uniqueProducts[0],
    productsText
  }
}
