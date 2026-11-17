<!-- 分段切换（如 看谱 | 编辑）。发丝外框，选中项赭红字加底线。 -->
<script lang="ts" generics="T extends string">
  type Props = {
    options: { value: T; label: string }[];
    value: T;
    label: string;
    compact?: boolean;
    onchange?: (v: T) => void;
  };
  let { options, value, label, compact = false, onchange }: Props = $props();
</script>

<div class="seg" class:compact role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button role="radio" aria-checked={o.value === value} class:on={o.value === value} onclick={() => onchange?.(o.value)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    padding: 4px;
    gap: 2px;
    border-radius: var(--toolbar-radius);
    background: var(--material);
    box-shadow: var(--island-ring), var(--island-shadow);
    backdrop-filter: blur(18px);
  }
  button {
    position: relative;
    min-width: 64px;
    height: calc(var(--tap) - 8px);
    padding: 0 14px;
    border-radius: var(--chip-radius);
    font: 500 var(--text-sm) / 1.2 var(--font-ui);
    color: var(--ink-soft);
    transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .compact button {
    min-width: 0;
    flex: 1;
    padding: 0 10px;
    letter-spacing: 0.08em;
  }
  .compact {
    display: flex;
  }
  .on {
    color: var(--rubric);
    background: var(--rubric-wash);
    box-shadow: var(--chip-ring);
  }
</style>
