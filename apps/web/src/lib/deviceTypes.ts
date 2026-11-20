/**
 * 设备类型中文映射（展示层专用）。
 *
 * 后端与数据库存的一直是英文值（DB CHECK 约束只认英文，见
 * apps/api/routers/devices.py 的 DEVICE_TYPES），这里只负责把英文值
 * 翻成中文显示，不改任何提交字段；提交时仍发英文值。
 */
export const DEVICE_TYPES = [
  'light',
  'climate',
  'water_heater',
  'speaker',
  'router',
  'other',
] as const

export type DeviceTypeValue = (typeof DEVICE_TYPES)[number]

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  light: '灯光',
  climate: '空调',
  water_heater: '热水器',
  speaker: '音响',
  router: '路由器',
  other: '其他',
}

/** 英文类型值 → 中文展示；未知值原样返回，不编造。 */
export function deviceTypeLabel(value: string | null | undefined): string {
  if (!value) return '类型未填写'
  return DEVICE_TYPE_LABELS[value] ?? value
}
