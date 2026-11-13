// 动效时长：系统开启「减少动态效果」时一律为 0。

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function ms(duration: number): number {
  return reduced.matches ? 0 : duration;
}

/** 慢而轻的缓出曲线，供 Svelte 过渡使用 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
