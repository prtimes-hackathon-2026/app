import 'server-only'

import { getSetting } from './application/get-setting'
import { updateSetting } from './application/update-setting'
import { drizzleSettingRepository } from './infrastructure/setting-repository.drizzle'

export type { Setting, SettingKey } from './domain/setting'

const repository = drizzleSettingRepository()

export const settingsFeature = {
  getSetting: getSetting(repository),
  updateSetting: updateSetting(repository),
} as const
