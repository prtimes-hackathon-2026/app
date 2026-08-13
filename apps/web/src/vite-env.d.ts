/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API のベース URL。未指定なら同一オリジン（dev では Vite の proxy）へ投げる。 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
