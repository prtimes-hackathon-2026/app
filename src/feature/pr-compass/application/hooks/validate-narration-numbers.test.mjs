import assert from 'node:assert/strict'
import test from 'node:test'

import { validateNarrationNumbers } from './validate-narration-numbers.ts'

test('表記だけが異なる同じ数値を許可する', () => {
  const result = validateNarrationNumbers(
    '３本で1,000PV、上位12.5%です。',
    '3本で1000PV、上位12.5%です。',
  )

  assert.equal(result.passed, true)
})

test('数値の欠落を検出する', () => {
  const result = validateNarrationNumbers(
    '3本を3か月で出します。',
    '3本を目標にします。',
  )

  assert.equal(result.passed, false)
  assert.deepEqual(result.missing, ['3'])
})

test('数値の追加を検出する', () => {
  const result = validateNarrationNumbers(
    '当たり率は17%です。',
    '当たり率は17%、成功率は80%です。',
  )

  assert.equal(result.passed, false)
  assert.deepEqual(result.unexpected, ['80'])
})

test('数値の変更を欠落と追加の両方として検出する', () => {
  const result = validateNarrationNumbers(
    '当たり率は17%です。',
    '当たり率は87%です。',
  )

  assert.equal(result.passed, false)
  assert.deepEqual(result.missing, ['17'])
  assert.deepEqual(result.unexpected, ['87'])
})
