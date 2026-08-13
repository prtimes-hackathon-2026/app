import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  // ワークスペース内のパッケージは TS ソースのまま公開しているので、成果物に取り込む。
  // node_modules の実依存は external のままにしておく。
  noExternal: [/^@repo\//],
})
