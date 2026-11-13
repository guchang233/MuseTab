<!-- 滑块：发丝轨道，已走过的一段是墨线，滑钮是一枚小菱形。整行高 44px 便于手指拖动。 -->
<script lang="ts">
  type Props = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    label: string;
    oninput?: (v: number) => void;
  };
  let { value = $bindable(), min = 0, max = 100, step = 1, label, oninput }: Props = $props();
  const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<input
  class="slider"
  type="range"
  aria-label={label}
  {min}
  {max}
  {step}
  bind:value
  oninput={() => oninput?.(value)}
  style="--p: {pct}%"
/>

<style>
  .slider {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: 100%;
    height: var(--tap);
    margin: 0;
    background: transparent;
    cursor: pointer;
    touch-action: pan-y;
  }
  .slider:focus-visible {
    outline: none;
  }
  .slider::-webkit-slider-runnable-track {
    height: 1px;
    /* 硬边分段：左段墨线，右段发丝线 */
    background: linear-gradient(to right, var(--ink) var(--p), var(--hairline) var(--p));
  }
  .slider::-moz-range-track {
    height: 1px;
    background: linear-gradient(to right, var(--ink) var(--p), var(--hairline) var(--p));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 11px;
    height: 11px;
    margin-top: -5px;
    background: var(--ink);
    border: 0;
    border-radius: 1px;
    transform: rotate(45deg);
    box-shadow: 0 0 0 3px var(--paper);
    transition: transform var(--dur) var(--ease);
  }
  .slider::-moz-range-thumb {
    width: 11px;
    height: 11px;
    background: var(--ink);
    border: 0;
    border-radius: 1px;
    transform: rotate(45deg);
  }
  .slider:active::-webkit-slider-thumb {
    transform: rotate(45deg) scale(1.25);
  }
  .slider:focus-visible::-webkit-slider-thumb {
    background: var(--rubric);
  }
</style>
