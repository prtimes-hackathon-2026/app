import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * レイヤー間の依存方向を Lint で機械的に固定する。
 *
 *   app  ->  feature  ->  external
 *              |             |
 *              +--> shared <-+
 *
 * - app       : ルーティング / HTTP 境界のみ。feature の公開 API だけを呼ぶ
 * - feature   : ドメインごとの実装。domain(型・ポート) / application(ユースケース) / infrastructure(アダプタ)
 * - external  : 外部システム(DB など)への接続。ドメインを知らない
 * - shared    : どこからでも使える横断的な部品。他レイヤーに依存しない
 */
const layerBoundaries = [
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/external', '@/external/**'],
              message:
                'app から external を直接使わない。feature の公開 API を経由すること。',
            },
            {
              group: ['@/feature/*/*'],
              message:
                'feature の内部実装ではなく @/feature/<domain> の公開 API を import すること。',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/feature/*/domain/**/*.{ts,tsx}',
      'src/feature/*/application/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/external', '@/external/**', '@/app', '@/app/**'],
              message:
                'domain / application は外側のレイヤーに依存しない。ポート(interface)を定義して infrastructure に実装させること。',
            },
            {
              group: [
                'next',
                'next/*',
                'react',
                'react-dom',
                'drizzle-orm',
                'drizzle-orm/*',
                'postgres',
              ],
              message:
                'domain / application はフレームワークと ORM に依存しない。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/feature/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app', '@/app/**'],
              message: 'feature は app に依存しない。',
            },
            {
              group: ['@/feature/*/*'],
              message:
                '他の feature の内部には触れない。必要なら @/feature/<domain> の公開 API を使うこと。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/external/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/feature', '@/feature/**', '@/app', '@/app/**'],
              message: 'external はドメインとルーティングを知らない。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/feature',
                '@/feature/**',
                '@/app',
                '@/app/**',
                '@/external',
                '@/external/**',
              ],
              message: 'shared は他のレイヤーに依存しない。',
            },
          ],
        },
      ],
    },
  },
]

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      // drizzle-kit の生成物。手で直すものではないので対象外にする
      'drizzle/**/migrations/**',
      'drizzle/stats/**',
      // 別アーキテクチャの試作。この設定 (Next.js 前提) の対象外にする
      'voice-agent/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  ...layerBoundaries,
]

export default eslintConfig
