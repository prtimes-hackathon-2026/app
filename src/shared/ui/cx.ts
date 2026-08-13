/**
 * クラス名の結合。false / null / undefined は落とす。
 * 条件付きのクラス指定を `cx(styles.a, isOn && styles.b)` と書けるようにするだけの道具。
 */
export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}
