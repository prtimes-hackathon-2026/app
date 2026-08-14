/**
 * ログインの導線で、レイヤーをまたいで同じ値を見る必要があるもの。
 *
 * 入口でのふるい分け (`src/proxy.ts`)、画面、Route Handler の 3 か所が同じ Cookie 名と
 * 同じ行き先を使う。片方だけ直して気付けない事故を防ぐため、値の正はここに置く。
 */

export const sessionCookieName = 'session'

/** ログインの 1 段目 (合言葉) */
export const loginPath = '/login'

/** ログインの 2 段目 (企業の選択) */
export const companySelectPath = '/login/company'

/** ログインが成立したあとに見せる画面 */
export const afterLoginPath = '/dashboard'

/** 管理者ログイン後に見せる画面 */
export const adminPath = '/settings/sales-flow-cases'
