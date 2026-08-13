import type { Setting, SettingKey } from '../domain/setting'
import type { SettingRepository } from '../domain/setting-repository'

export type GetSetting = (key: SettingKey) => Promise<Setting | null>

export function getSetting(repository: SettingRepository): GetSetting {
  return (key) => repository.findByKey(key)
}
