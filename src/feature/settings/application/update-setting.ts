import type { Setting, SettingKey } from '../domain/setting'
import type { SettingRepository } from '../domain/setting-repository'

export type UpdateSetting = (
  key: SettingKey,
  value: unknown,
) => Promise<Setting>

export function updateSetting(repository: SettingRepository): UpdateSetting {
  return (key, value) => repository.upsert(key, value)
}
