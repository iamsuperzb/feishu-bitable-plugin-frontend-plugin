/**
 * Bitable 相关类型定义
 *
 * 提供 Bitable SDK 操作所需的类型接口，包括字段配置、字段写入器等
 */

import { FieldType, IField } from '@lark-base-open/js-sdk'

/**
 * 允许使用的字段类型
 *
 * 限制为插件支持的基础类型，确保类型安全
 */
export type AllowedFieldType =
  | FieldType.Text
  | FieldType.Number
  | FieldType.DateTime
  | FieldType.Checkbox
  | FieldType.Url
  | FieldType.Attachment

/**
 * 字段配置
 *
 * 定义创建或查找字段时所需的配置信息
 */
export interface FieldConfig {
  /** 字段名称，用于显示和查找 */
  field_name: string
  /** 字段类型，必须是允许的类型之一 */
  type: AllowedFieldType
}

/**
 * 字段写入器
 *
 * 封装字段的元数据和实例，用于类型安全的字段操作
 */
export interface FieldWriter {
  /** 字段名称 */
  name: string
  /** 字段类型 */
  type: FieldType
  /** 字段实例，用于调用 SDK 方法 */
  field: IField
  /** 字段 ID，用于记录操作 */
  id: string
}

/**
 * 用户身份信息
 *
 * 用于 API 请求的身份识别
 */
export interface UserIdentity {
  /** 基础用户 ID */
  baseUserId: string
  /** 租户密钥 */
  tenantKey: string
}
