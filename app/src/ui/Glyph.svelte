<!--
  SMuFL 音乐字形（Leland）。
  用 SVG <text> 画：y=0 就是字体基线，不受各平台行高度量差异影响；
  外框来自 smufl-metrics.json（scripts/build-glyph-metrics.py 生成），因此可以精确居中。
-->
<script lang="ts" module>
  import metrics from './smufl-metrics.json';
  export type GlyphName = keyof typeof metrics;
</script>

<script lang="ts">
  type Props = {
    name: GlyphName;
    /** 字号（px）。五线谱一间 = size / 4 */
    size?: number;
    /** 外框上限，超出则等比缩小 */
    maxH?: number;
    maxW?: number;
  };
  let { name, size = 28, maxH = 30, maxW = 34 }: Props = $props();

  const m = $derived(metrics[name] as unknown as [string, number, number, number, number]);
  const char = $derived(String.fromCodePoint(parseInt(m[0], 16)));
  const w = $derived(m[3] - m[1]);
  const h = $derived(m[4] - m[2]);
  const k = $derived(Math.min(size / 1000, maxH / h, maxW / w));
</script>

<svg
  class="glyph"
  viewBox="{m[1]} {-m[4]} {w} {h}"
  width={Math.max(1, w * k)}
  height={Math.max(1, h * k)}
  aria-hidden="true"
>
  <text x="0" y="0" font-size="1000">{char}</text>
</svg>

<style>
  .glyph {
    display: block;
    overflow: visible;
    flex: none;
  }
  text {
    font-family: var(--font-music);
    fill: currentColor;
  }
</style>
