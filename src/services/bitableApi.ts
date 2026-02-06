/**
 * Bitable API 服务层
 *
 * 封装所有 Bitable SDK 操作，提供类型安全的表格和字段管理功能
 * 职责：
 * - 表格创建和字段管理
 * - 字段类型转换和值规范化
 * - 批量记录操作（追加/填充空行）
 * - 数据去重和扫描
 */

import {
  bitable,
  FieldType,
  ITable,
  IField,
  ITextField,
  INumberField,
  ICheckBoxField,
  IDateTimeField,
  IUrlField,
  IAttachmentField,
  IFieldMeta,
  ToastType,
  IOpenCellValue,
  IGetRecordsParams
} from '@lark-base-open/js-sdk'
import i18n from '../i18n'
import { sleep, sanitizeTableName } from '../utils/format'
import type { FieldConfig, FieldWriter } from '../types/bitable'

const notifySwitchTableFailed = async () => {
  const message = i18n.t('table.switch.fail')
  try {
    if (bitable.ui?.showToast) {
      await bitable.ui.showToast({ toastType: ToastType.warning, message })
    } else {
      console.warn(message)
    }
  } catch (error) {
    console.warn('切换表格提示失败:', error)
  }
}

/**
 * 创建新表格
 *
 * @param tableName - 表格名称（会自动清理非法字符）
 * @param primaryFieldName - 主字段名称，默认 'TT账户名称'
 * @returns 创建的表格实例
 *
 * @remarks
 * - 自动清理表名中的非法字符
 * - 重命名默认主字段为指定名称
 * - 新表格默认包含一个文本类型的主字段
 */
export const createNewTable = async (
  tableName: string,
  primaryFieldName = 'TT账户名称'
): Promise<ITable> => {
  const safeName = sanitizeTableName(tableName)
  const result = await bitable.base.addTable({ name: safeName, fields: [] })
  const tableId = typeof result === 'string' ? result : result.tableId
  const table = await bitable.base.getTableById(tableId)

  // 新建表默认会有一列文本主字段，重命名为指定名称
  try {
    const fieldMetaList = await table.getFieldMetaList()
    if (fieldMetaList.length === 1 && fieldMetaList[0].type === FieldType.Text) {
      await table.setField(fieldMetaList[0].id, { name: primaryFieldName })
    }
  } catch (error) {
    console.warn('重命名默认主字段失败:', error)
  }

  try {
    const switched = bitable.ui?.switchToTable
      ? await bitable.ui.switchToTable(tableId)
      : false
    if (!switched) {
      await notifySwitchTableFailed()
    }
  } catch (error) {
    console.warn('切换表格失败:', error)
    await notifySwitchTableFailed()
  }

  return table
}

/**
 * 获取指定类型的字段实例
 *
 * @param table - 表格实例
 * @param id - 字段 ID
 * @param type - 字段类型
 * @returns 类型化的字段实例
 *
 * @remarks
 * 根据字段类型返回正确的泛型接口，确保类型安全
 */
export const getTypedField = async (
  table: ITable,
  id: string,
  type: FieldType
): Promise<IField> => {
  switch (type) {
    case FieldType.Url:
      return table.getField<IUrlField>(id)
    case FieldType.Number:
      return table.getField<INumberField>(id)
    case FieldType.Checkbox:
      return table.getField<ICheckBoxField>(id)
    case FieldType.DateTime:
      return table.getField<IDateTimeField>(id)
    case FieldType.Attachment:
      return table.getField<IAttachmentField>(id)
    case FieldType.Text:
    default:
      return table.getField<ITextField>(id)
  }
}

/**
 * 确保表格包含所需字段
 *
 * @param table - 表格实例
 * @param configs - 字段配置列表
 * @param selectedMap - 字段选择映射（字段名 -> 是否启用）
 * @returns 更新后的字段元数据列表
 *
 * @remarks
 * - 自动创建缺失的字段
 * - 检测字段类型不匹配并警告
 * - 创建字段后延迟 500ms 确保元数据同步
 */
export const ensureFields = async (
  table: ITable,
  configs: FieldConfig[],
  selectedMap: Record<string, boolean>
): Promise<IFieldMeta[]> => {
  const fieldMetaList = await table.getFieldMetaList()
  const nameToMeta = new Map(fieldMetaList.map(meta => [meta.name, meta]))
  let created = false

  for (const config of configs) {
    // 跳过未选中的字段
    if (selectedMap && selectedMap[config.field_name] === false) continue

    const meta = nameToMeta.get(config.field_name)
    if (!meta) {
      // 字段不存在，创建新字段
      await table.addField({ type: config.type, name: config.field_name })
      created = true
      continue
    }

    // 字段存在但类型不匹配，记录警告
    if (meta.type !== config.type) {
      console.warn(
        `字段类型不匹配，期望 ${config.type} 实际 ${meta.type}: ${config.field_name}`
      )
    }
  }

  // 创建字段后延迟，确保元数据同步
  if (created) {
    await sleep(500)
  }

  return table.getFieldMetaList()
}

/**
 * 字段重命名（兼容历史字段名）
 *
 * @param table - 表格实例
 * @param fromName - 旧字段名
 * @param toName - 新字段名
 * @returns 是否发生了重命名
 *
 * @remarks
 * - 仅当新字段不存在且旧字段存在时才会重命名
 * - 用于“沿用旧列但统一新命名”的场景
 */
export const renameFieldIfExists = async (
  table: ITable,
  fromName: string,
  toName: string
): Promise<boolean> => {
  try {
    const fieldMetaList = await table.getFieldMetaList()
    if (fieldMetaList.some(meta => meta.name === toName)) return false
    const fromMeta = fieldMetaList.find(meta => meta.name === fromName)
    if (!fromMeta) return false

    await table.setField(fromMeta.id, { name: toName })
    // 重命名后延迟，确保元数据同步
    await sleep(500)
    return true
  } catch (error) {
    console.warn('重命名字段失败:', { fromName, toName, error })
    return false
  }
}

/**
 * 构建字段写入器映射
 *
 * @param table - 表格实例
 * @param configs - 字段配置列表
 * @param fieldMetaList - 字段元数据列表
 * @param selectedMap - 字段选择映射
 * @returns 字段名到 FieldWriter 的映射
 *
 * @remarks
 * - 只为已选中且类型匹配的字段创建 writer
 * - 字段类型不匹配时跳过并警告
 */
export const buildFieldWriters = async (
  table: ITable,
  configs: FieldConfig[],
  fieldMetaList: IFieldMeta[],
  selectedMap: Record<string, boolean>
): Promise<Record<string, FieldWriter>> => {
  const writers: Record<string, FieldWriter> = {}
  const nameToMeta = new Map(fieldMetaList.map(meta => [meta.name, meta]))

  for (const config of configs) {
    // 跳过未选中的字段
    if (selectedMap && selectedMap[config.field_name] === false) continue

    const meta = nameToMeta.get(config.field_name)
    if (!meta) continue

    // 字段类型不匹配，跳过
    if (meta.type !== config.type) {
      console.warn(
        `跳过字段 ${config.field_name}，类型不匹配 (期望 ${config.type} 实际 ${meta.type})`
      )
      continue
    }

    const field = await getTypedField(table, meta.id, config.type)
    writers[config.field_name] = {
      name: config.field_name,
      type: config.type,
      field,
      id: meta.id
    }
  }

  return writers
}

/**
 * 附加主字段写入器
 *
 * @param table - 表格实例
 * @param fieldMetaList - 字段元数据列表
 * @param writers - 现有的字段写入器映射
 * @returns 更新后的字段写入器映射
 *
 * @remarks
 * 如果主字段已重命名为「TT账户名称」，补充对应的 writer
 */
export const attachPrimaryNameWriter = async (
  table: ITable,
  fieldMetaList: IFieldMeta[],
  writers: Record<string, FieldWriter>
): Promise<Record<string, FieldWriter>> => {
  const primaryNameMeta = fieldMetaList.find(
    meta => meta.name === 'TT账户名称' && meta.type === FieldType.Text
  )

  if (primaryNameMeta && !writers['TT账户名称']) {
    const field = await table.getField<ITextField>(primaryNameMeta.id)
    writers['TT账户名称'] = {
      name: 'TT账户名称',
      type: FieldType.Text,
      field,
      id: primaryNameMeta.id
    }
  }

  return writers
}

/**
 * 规范化字段值
 *
 * @param writer - 字段写入器
 * @param raw - 原始值
 * @returns 规范化后的值，失败返回 undefined
 *
 * @remarks
 * - 根据字段类型进行类型转换
 * - 调用字段的 transform 方法确保 SDK 兼容性
 * - 特殊处理：视频互动率/发帖频率保留小数，其他数值字段取整
 */
export const normalizeValue = async (
  writer: FieldWriter,
  raw: unknown
): Promise<unknown> => {
  try {
    if (writer.type === FieldType.Number) {
      if (raw === undefined || raw === null) return undefined
      const num = Number(raw)
      if (Number.isNaN(num)) return undefined

      // 计数类字段转换为整数，比率/频率类字段保留小数
      const shouldBeInteger = !['视频互动率', '发帖频率'].includes(writer.name)
      const finalNum = shouldBeInteger ? Math.floor(num) : num

      return writer.field.transform
        ? await writer.field.transform(finalNum)
        : finalNum
    }

    if (writer.type === FieldType.Checkbox) {
      const boolVal = Boolean(raw)
      return writer.field.transform
        ? await writer.field.transform(boolVal)
        : boolVal
    }

    if (writer.type === FieldType.DateTime) {
      if (raw === undefined || raw === null) return undefined
      const ts = Number(raw)
      if (Number.isNaN(ts)) return undefined
      return writer.field.transform ? await writer.field.transform(ts) : ts
    }

    if (writer.type === FieldType.Url) {
      const link = raw ? (typeof raw === 'string' ? raw : String(raw)) : ''
      return writer.field.transform ? await writer.field.transform(link) : link
    }

    if (writer.type === FieldType.Attachment) {
      if (!raw) return undefined
      return writer.field.transform
        ? await writer.field.transform(raw as unknown as File | File[] | IOpenCellValue)
        : raw
    }

    // 默认文本类型
    const textVal = raw === undefined || raw === null ? '' : String(raw)
    return writer.field.transform
      ? await writer.field.transform(textVal)
      : textVal
  } catch (error) {
    console.error('转换字段值失败', writer.name, error)
    return undefined
  }
}

/**
 * 判断单元格值是否为空
 *
 * @param value - 单元格值
 * @returns 是否为空
 *
 * @remarks
 * - 支持字符串、数组、对象等多种类型
 * - URL 字段格式: [{ link: string, text?: string }]
 */
export const isCellValueEmpty = (value: IOpenCellValue): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) {
    if (value.length === 0) return true
    // URL 字段格式检查
    const firstItem = value[0]
    if (typeof firstItem === 'object' && firstItem !== null) {
      const obj = firstItem as Record<string, unknown>
      if ('link' in obj)
        return (
          !obj.link || (typeof obj.link === 'string' && obj.link.trim() === '')
        )
      if ('text' in obj)
        return (
          !obj.text || (typeof obj.text === 'string' && obj.text.trim() === '')
        )
    }
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if ('link' in obj)
      return (
        !obj.link || (typeof obj.link === 'string' && obj.link.trim() === '')
      )
    if ('text' in obj)
      return (
        !obj.text || (typeof obj.text === 'string' && obj.text.trim() === '')
      )
  }
  return false
}

/**
 * 判断一行记录是否为空行
 *
 * @param fields - 记录的字段映射
 * @returns 是否为空行（所有字段都为空）
 */
export const isRecordEmpty = (
  fields: Record<string, IOpenCellValue> | undefined
): boolean => {
  if (!fields) return true
  // 检查所有字段是否都为空
  for (const value of Object.values(fields)) {
    if (!isCellValueEmpty(value)) {
      return false // 只要有一个字段有值，就不是空行
    }
  }
  return true
}

/**
 * 获取表格中完全空白的记录 ID 列表
 *
 * @param table - 表格实例
 * @param stopRef - 停止标志
 * @param options - 选项 { maxScan: 最大扫描行数 }
 * @returns 空行 ID 数组
 *
 * @remarks
 * - 只有当一行的所有字段都为空时，才认为是空行
 * - 支持通过 stopRef 提前终止扫描
 * - 使用分页扫描，避免一次性加载大量数据
 */
export const getEmptyRecords = async (
  table: ITable,
  stopRef?: React.MutableRefObject<boolean>,
  options: { maxScan?: number } = {}
): Promise<string[]> => {
  const { maxScan = 500 } = options
  const emptyRecordIds: string[] = []
  let pageToken: string | undefined
  let hasMore = true
  const pageSize = 200
  let scanned = 0

  console.log('开始扫描空行（检查整行是否为空）')

  while (hasMore) {
    // 检查是否需要停止
    if (stopRef?.current) {
      console.log('检测到停止标志，终止空行扫描')
      break
    }

    const params: IGetRecordsParams = { pageSize, pageToken }
    const result = await table.getRecords(params)
    const currentRecords = result.records || []
    scanned += currentRecords.length

    for (const record of currentRecords) {
      // 检查整行是否为空（所有字段都为空）
      if (isRecordEmpty(record.fields)) {
        emptyRecordIds.push(record.recordId)
      }
    }

    hasMore = result.hasMore && scanned < maxScan
    pageToken = result.pageToken
  }

  console.log(
    `扫描完成，检查行数 ${scanned}（上限 ${maxScan}），发现 ${emptyRecordIds.length} 个空行`
  )
  return emptyRecordIds
}

/**
 * 填充空行数据
 *
 * @param table - 表格实例
 * @param emptyRecordIds - 空行 ID 列表
 * @param records - 待写入的记录数据
 * @param stopRef - 停止标志
 * @returns 填充的记录数量和剩余未填充的记录
 *
 * @remarks
 * - 只更新指定的字段，不影响空行中已有的其他数据
 * - 填充失败的记录会放回队列末尾，后续通过追加方式写入
 */
export const fillEmptyRecords = async (
  table: ITable,
  emptyRecordIds: string[],
  records: { index: number; fields: Record<string, IOpenCellValue> }[],
  stopRef: React.MutableRefObject<boolean>
): Promise<{
  filledCount: number
  remainingRecords: { index: number; fields: Record<string, IOpenCellValue> }[]
  filledRecordIds: { index: number; recordId: string }[]
}> => {
  const remaining = [...records]
  let filledCount = 0
  const filledRecordIds: { index: number; recordId: string }[] = []

  console.log(
    `开始填充空行，可用空行: ${emptyRecordIds.length}，待写入数据: ${records.length}`
  )

  for (const recordId of emptyRecordIds) {
    // 检查是否需要停止
    if (stopRef.current) {
      console.log('检测到停止标志，终止填充空行')
      break
    }

    const nextRecord = remaining.shift()
    if (!nextRecord) break

    try {
      // 使用 setCellValue 逐字段设置，确保不覆盖空行中已有的其他数据
      for (const [fieldId, value] of Object.entries(nextRecord.fields)) {
        if (stopRef.current) break
        await table.setCellValue(fieldId, recordId, value as IOpenCellValue)
      }
      filledCount++
      filledRecordIds.push({ index: nextRecord.index, recordId })
    } catch (error) {
      console.error('填充空行失败:', { recordId, error })
      // 失败的记录放回队列末尾，后续追加
      remaining.push(nextRecord)
    }
  }

  console.log(
    `空行填充完成，成功填充: ${filledCount}，剩余待追加: ${remaining.length}`
  )
  return { filledCount, remainingRecords: remaining, filledRecordIds }
}

/**
 * 批量添加/填充记录
 *
 * @param table - 表格实例
 * @param records - 待写入的记录数据
 * @param options - 选项
 *   - batchSize: 批量写入大小，默认 50
 *   - emptyRecordIds: 预扫描的空行 ID 列表（可变数组，函数会从中移除已使用的 ID）
 *   - stopRef: 停止标志
 * @returns 填充的记录数、追加的记录数、插入的记录 ID 列表
 *
 * @remarks
 * - 优先填充空行，空行用完后追加新行
 * - 支持通过 stopRef 提前终止操作
 * - 使用 addRecords 批量接口提高性能，降级到 addRecord 单条接口
 */
export const addRecordsInBatches = async (
  table: ITable,
  records: Record<string, IOpenCellValue>[],
  options: {
    batchSize?: number
    emptyRecordIds?: string[]
    stopRef?: React.MutableRefObject<boolean>
  } = {}
): Promise<{ filledCount: number; appendedCount: number; recordIds: string[] }> => {
  const { batchSize = 50, emptyRecordIds, stopRef } = options
  let remainingRecords = records.map((record, index) => ({ index, fields: record }))
  let filledCount = 0
  let appendedCount = 0
  const recordIdsByIndex = new Array(records.length).fill('') as string[]

  // 阶段一：填充空行
  if (emptyRecordIds && emptyRecordIds.length > 0 && stopRef) {
    const idsToUse = emptyRecordIds.splice(0, remainingRecords.length)
    if (idsToUse.length > 0) {
      const result = await fillEmptyRecords(
        table,
        idsToUse,
        remainingRecords,
        stopRef
      )
      filledCount = result.filledCount
      remainingRecords = result.remainingRecords
      result.filledRecordIds.forEach(({ index, recordId }) => {
        recordIdsByIndex[index] = recordId
      })
    }
  }

  // 阶段二：追加剩余记录
  if (remainingRecords.length > 0 && (!stopRef || !stopRef.current)) {
    const chunks: { index: number; fields: Record<string, IOpenCellValue> }[][] = []
    for (let i = 0; i < remainingRecords.length; i += batchSize) {
      chunks.push(remainingRecords.slice(i, i + batchSize))
    }

    for (const chunk of chunks) {
      if (stopRef?.current) break

      const payload = chunk.map(item => ({ fields: item.fields }))

      // 尝试使用批量接口
      const tableWithBatch = table as ITable & {
        addRecords?: (
          records: { fields: Record<string, IOpenCellValue> }[]
        ) => Promise<
          { recordId?: string }[] | string[] | void
        >
      }

      if (typeof tableWithBatch.addRecords === 'function') {
        const res = await tableWithBatch.addRecords(payload)
        if (Array.isArray(res)) {
          res.forEach((id, idx) => {
            const target = chunk[idx]
            if (!target || !id) return
            if (typeof id === 'string') {
              recordIdsByIndex[target.index] = id
              return
            }
            if (
              typeof id === 'object' &&
              'recordId' in id &&
              typeof (id as { recordId?: string }).recordId === 'string'
            ) {
              recordIdsByIndex[target.index] =
                (id as { recordId?: string }).recordId as string
            }
          })
        }
      } else {
        // 降级到单条插入
        for (const record of chunk) {
          const res = await table.addRecord({ fields: record.fields })
          if (typeof res === 'string') {
            recordIdsByIndex[record.index] = res
          } else if (
            res &&
            typeof res === 'object' &&
            'recordId' in res &&
            typeof (res as { recordId?: string }).recordId === 'string'
          ) {
            recordIdsByIndex[record.index] =
              (res as { recordId?: string }).recordId as string
          }
        }
      }
      appendedCount += chunk.length
    }
  }

  console.log(
    `批量写入完成，填充空行: ${filledCount}，追加新行: ${appendedCount}`
  )
  return { filledCount, appendedCount, recordIds: recordIdsByIndex }
}

/**
 * 从单元格值中提取文本
 *
 * @param cellValue - 单元格值
 * @returns 提取的文本字符串
 *
 * @remarks
 * 支持多种单元格值类型：字符串、数字、数组、对象
 */
export const extractTextFromCell = (cellValue: IOpenCellValue): string => {
  if (!cellValue) return ''
  if (typeof cellValue === 'string') return cellValue
  if (typeof cellValue === 'number') return String(cellValue)
  if (Array.isArray(cellValue) && cellValue.length > 0) {
    const first = cellValue[0]
    if (typeof first === 'object' && first !== null) {
      if ('text' in first && typeof first.text === 'string') return first.text
      if ('link' in first && typeof first.link === 'string') return first.link
    }
    return String(first)
  }
  if (typeof cellValue === 'object') {
    const obj = cellValue as { text?: string; link?: string }
    return obj.text || obj.link || ''
  }
  return ''
}

/**
 * 收集现有唯一键（按字段名），返回 Set 用于去重
 *
 * @param table - 表格实例
 * @param fieldName - 字段名称
 * @param normalizer - 标准化函数，用于统一键格式
 * @param options - 选项 { maxScan: 最大扫描行数 }
 * @returns 唯一键集合
 *
 * @remarks
 * - 用于去重场景：扫描已有数据，避免重复插入
 * - 使用标准化函数确保键的一致性（如 URL 标准化）
 */
export const collectExistingKeys = async (
  table: ITable,
  fieldName: string,
  normalizer: (raw: string) => string,
  options: { maxScan?: number } = {}
): Promise<Set<string>> => {
  const { maxScan = 5000 } = options
  const keys = new Set<string>()
  const fieldMetaList = await table.getFieldMetaList()
  const targetMeta = fieldMetaList.find(meta => meta.name === fieldName)
  if (!targetMeta) return keys

  let pageToken: string | undefined
  let hasMore = true
  const pageSize = 200
  let scanned = 0

  while (hasMore && scanned < maxScan) {
    const result = await table.getRecords({ pageSize, pageToken })
    const records = result.records || []
    scanned += records.length

    for (const record of records) {
      const val = record.fields?.[targetMeta.id]
      const text = extractTextFromCell(val as IOpenCellValue)
      const key = normalizer(text)
      if (key) keys.add(key)
    }

    hasMore = result.hasMore && scanned < maxScan
    pageToken = result.pageToken
  }

  return keys
}
