/**
 * Bitable SDK 集成 Hook
 *
 * 管理 Bitable 表格的状态和监听
 * 职责：
 * - 表格初始化（获取字段和表格 ID）
 * - 监听字段增删改
 * - 监听表格切换
 *
 * @remarks
 * 这是一个核心基础设施 Hook，为所有采集功能提供表格元数据支持
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { bitable, IFieldMeta, ITable } from '@lark-base-open/js-sdk'

/**
 * useBitable Hook 选项
 */
export interface UseBitableOptions {
  /** 设置加载状态（来自 useUIState） */
  setLoading: (loading: boolean) => void
}

/**
 * Bitable SDK 集成 Hook
 *
 * @param options - Hook 选项
 * @returns Bitable 状态和操作方法
 *
 * @example
 * ```tsx
 * const { fields, tableId, initTable } = useBitable({
 *   setLoading
 * })
 *
 * // 初始化表格
 * await initTable()
 *
 * // 使用字段列表
 * console.log('当前字段:', fields)
 * ```
 */
export const useBitable = (options: UseBitableOptions) => {
  const { setLoading } = options

  // 表格字段列表
  const [fields, setFields] = useState<IFieldMeta[]>([])

  // 表格 ID
  const [tableId, setTableId] = useState('')

  // 字段监听器取消订阅函数列表
  const fieldUnsubsRef = useRef<(() => void)[]>([])

  /**
   * 手动刷新字段列表
   *
   * @remarks
   * 用于在字段创建后立即更新字段列表，不依赖监听器的异步回调
   */
  const refreshFields = useCallback(async () => {
    try {
      const table = await bitable.base.getActiveTable()
      if (table) {
        const fieldMetaList = await table.getFieldMetaList()
        setFields(fieldMetaList)
      }
    } catch (error) {
      console.error('刷新字段列表失败:', error)
    }
  }, [])

  /**
   * 初始化表格
   *
   * @returns 当前激活的表格实例
   *
   * @remarks
   * - 获取当前激活表格的 ID 和字段列表
   * - 在初始化和表格切换时调用
   */
  const initTable = useCallback(async () => {
    try {
      setLoading(true)
      // 获取当前表格
      const table = await bitable.base.getActiveTable()
      if (!table) {
        throw new Error('无法获取当前表格')
      }
      if (!table) {
        throw new Error('无法获取当前表格')
      }
      // 获取表格 ID
      const tableId = table.id
      console.log('当前表格 ID:', tableId)
      setTableId(tableId)

      // 获取字段列表
      const fieldMetaList = await table.getFieldMetaList()
      console.log('当前字段列表:', fieldMetaList)
      setFields(fieldMetaList)

      return table
    } catch (error) {
      console.error('初始化表格失败:', error)
      if (error instanceof Error) {
        console.error('错误详情:', error.message)
        console.error('错误堆栈:', error.stack)
      }
      throw error
    } finally {
      setLoading(false)
    }
  }, [setLoading])

  /**
   * 附加字段监听器
   *
   * @param table - 要监听的表格实例
   *
   * @remarks
   * - 监听字段增加、删除、修改事件
   * - 自动更新字段列表
   * - 在组件卸载或表格切换时自动解绑
   */
  const attachFieldListeners = useCallback(async (table: ITable | null) => {
    try {
      // 先解绑旧监听，避免跨表回调
      fieldUnsubsRef.current.forEach(fn => fn?.())
      fieldUnsubsRef.current = []

      if (!table) return

      const updateFieldList = () => {
        table
          .getFieldMetaList()
          .then(next => setFields(next))
          .catch(err => console.error('获取字段列表失败:', err))
      }

      const offAdd = await table.onFieldAdd(updateFieldList)
      const offDelete = await table.onFieldDelete(updateFieldList)
      const offModify = await table.onFieldModify(updateFieldList)

      fieldUnsubsRef.current = [offAdd, offDelete, offModify].filter(Boolean) as (() => void)[]
    } catch (error) {
      console.error('监听字段变化失败:', error)
    }
  }, [])

  // 监听字段变化（当前表）
  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      const table = await bitable.base.getActiveTable()
      if (cancelled) return
      await attachFieldListeners(table)
    }

    setup()

    return () => {
      cancelled = true
      fieldUnsubsRef.current.forEach(fn => fn?.())
      fieldUnsubsRef.current = []
    }
  }, [attachFieldListeners])

  // 监听表格切换（只监听 selection 变化，不监听记录/单元格变化以避免性能问题）
  useEffect(() => {
    let off: (() => void) | undefined

    const setup = async () => {
      try {
        const base = bitable.base as unknown as {
          onSelectionChange?: (cb: () => void) => (() => void) | Promise<() => void>
        }
        if (typeof base.onSelectionChange === 'function') {
          const unsubscribe = base.onSelectionChange(async () => {
            const nextTable = await initTable()
            await attachFieldListeners(nextTable)
          })
          off = await Promise.resolve(unsubscribe)
        }
      } catch (error) {
        console.error('监听表格切换失败:', error)
      }
    }

    setup()
    return () => {
      off?.()
    }
  }, [attachFieldListeners, initTable])

  return {
    fields,
    tableId,
    initTable,
    refreshFields
  }
}
