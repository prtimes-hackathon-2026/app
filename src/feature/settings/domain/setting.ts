export type SettingKey = string

export type Setting = {
  readonly key: SettingKey
  readonly value: unknown
  readonly updatedAt: Date
}
