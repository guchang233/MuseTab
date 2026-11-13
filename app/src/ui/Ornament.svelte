<!-- 分隔花饰：细双线中间一枚小花饰（对生双叶 + 菱形花心）。 -->
<script lang="ts">
  let { plain = false }: { plain?: boolean } = $props();
</script>

<div class="ornament" role="separator" class:plain>
  <span class="rule"></span>
  <svg viewBox="0 0 56 16" width="56" height="16" aria-hidden="true">
    <!-- 左右对生的叶 -->
    <path d="M22 8C17 2.500 9.500 3 5 8c4.500 5 12 5.500 17 0z" />
    <path d="M34 8c5-5.500 12.500-5 17 0-4.500 5-12 5.500-17 0z" />
    <path class="vein" d="M8 8h11M37 8h11" />
    <!-- 花心 -->
    <path class="heart" d="M28 3.500 32 8l-4 4.500L24 8z" />
    <circle cx="1.500" cy="8" r=".9" class="heart" />
    <circle cx="54.500" cy="8" r=".9" class="heart" />
  </svg>
  <span class="rule"></span>
</div>

<style>
  .ornament {
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--ink-mute);
  }
  .rule {
    flex: 1;
    height: 3px;
    border-top: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
  }
  svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 0.9;
    stroke-linejoin: round;
  }
  .vein {
    stroke-width: 0.6;
  }
  .heart {
    fill: currentColor;
    stroke: none;
  }
  .plain svg {
    display: none;
  }
  .plain {
    gap: 0;
  }
</style>
