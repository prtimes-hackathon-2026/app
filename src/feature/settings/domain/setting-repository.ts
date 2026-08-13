import type { Setting, SettingKey } from './setting'

export interface SettingRepository {
  list(): Promise<readonly Setting[]>
  findByKey(key: SettingKey): Promise<Setting | null>
  upsert(key: SettingKey, value: unknown): Promise<Setting>
}
