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
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
  }
  button {
    position: relative;
    min-width: 64px;
    height: calc(var(--tap) - 2px);
    padding: 0 16px;
    font-size: var(--text-sm);
    letter-spacing: 0.14em;
    color: var(--ink-soft);
    transition: color var(--dur) var(--ease);
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
  button + button {
    border-left: 1px solid var(--hairline);
  }
  .on {
    color: var(--rubric);
    background: var(--rubric-wash);
  }
  .on::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 6px;
    width: 16px;
    height: 1px;
    margin-left: -8px;
    background: var(--rubric);
  }
</style>
