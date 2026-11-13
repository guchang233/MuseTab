<!-- 统一线宽的细线图标（24 格，线宽 1.25）。只放音乐字体里没有的界面图标。 -->
<script lang="ts" module>
  const dot = (x: number, y: number, r = 1.1) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

  const icons = {
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/>',
    history: '<path d="M3 11a9 9 0 1 1 2.6 7M3 5v6h6"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6-1.5A4.8 4.8 0 0 0 7 18z"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
    refresh: '<path d="M20 10a8 8 0 0 0-14-4L3 9m0-6v6h6M4 14a8 8 0 0 0 14 4l3-3m0 6v-6h-6"/>',
    fullscreen: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
    'exit-fullscreen': '<path d="M4 9h5V4m6 0v5h5M9 20v-5H4m16 0h-5v5"/>',
    eraser: '<path d="m4 14 9-10 7 7-8 9H9zm4-4 7 7m-3 3h9"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    forward: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    down: '<path d="M6 9.5l6 6 6-6"/>',
    up: '<path d="M6 14.5l6-6 6 6"/>',
    collapse: '<path d="M12 6.5 6.5 12l5.5 5.5M17.5 6.5 12 12l5.5 5.5"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    play: '<path d="M8.5 5.5v13L19 12z" fill="currentColor"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2"/>',
    undo: '<path d="M10 18.5h4.5a4.75 4.75 0 0 0 0-9.5H6.5"/><path d="M10 5.5 6.5 9l3.5 3.5"/>',
    redo: '<path d="M14 18.5H9.5a4.75 4.75 0 0 1 0-9.5h8"/><path d="M14 5.5 17.5 9 14 12.5"/>',
    save: '<path d="M5.5 4.5h10.5l2.5 2.5v12.5h-13z"/><path d="M8.5 4.5v4.5h6V4.5M8.5 19.5v-6h7v6"/>',
    more: dot(6, 12, 1.2) + dot(12, 12, 1.2) + dot(18, 12, 1.2),
    pen: '<path d="M5 19l1.2-4.4L16.6 4.2l3.2 3.2L9.4 17.8z"/><path d="M14.6 6.2l3.2 3.2"/>',
    book: '<path d="M12 7C10 5.7 7.5 5.4 4.5 6v12c3-.6 5.5-.3 7.5 1 2-1.3 4.5-1.6 7.5-1V6c-3-.6-5.5-.3-7.5 1z"/><path d="M12 7v12"/>',
    'view-single': '<path d="M7.5 4.5h9v15h-9z"/>',
    'view-spread': '<path d="M3.5 5.5H12v13H3.5zM12 5.5h8.5v13H12z"/>',
    'view-scroll': '<path d="M7.5 3v18M16.5 3v18M12 7.5v9M9.8 9.7 12 7.5l2.2 2.2M9.8 14.3 12 16.5l2.2-2.2"/>',
    sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>',
    moon: '<path d="M19 14.2A7.6 7.6 0 0 1 9.8 5 7.6 7.6 0 1 0 19 14.2z"/>',
    auto: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor"/>',
    import: '<path d="M12 4.5v10.5M8 11l4 4 4-4M5 19.5h14"/>',
    export: '<path d="M12 15V4.5M8 8.5l4-4 4 4M5 19.5h14"/>',
    search: '<circle cx="11" cy="11" r="5.5"/><path d="M15.2 15.2l4.3 4.3"/>',
    sliders:
      '<path d="M4.5 8h8M18 8h1.5M4.5 16H6M11.5 16h8"/><circle cx="15.2" cy="8" r="2"/><circle cx="8.8" cy="16" r="2"/>',
    check: '<path d="M6 12.5l4 4 8-9"/>',
    // —— 记谱类：音乐字体里没有单独字形的线条记号 ——
    tie: '<path d="M4 10c3.6 5.6 12.4 5.6 16 0-3.6 3.8-12.4 3.8-16 0z" fill="currentColor" stroke-width=".6"/>',
    slur: '<path d="M3.5 16C6 6.5 18 6.5 20.5 16 17.5 8.6 6.5 8.6 3.5 16z" fill="currentColor" stroke-width=".6"/>',
    gliss: '<path d="M4.5 18.5q2.2.2 2.5-2.5t2.5-2.5 2.5-2.5 2.5-2.5 2.5-2.5"/>',
    'pedal-line': '<path d="M4.500 8v8h15V8"/>',
    'ottava-line': '<path d="M4.500 8h3M10 8h3M15.500 8h4v5" />',
    volta: '<path d="M4.500 17V7.500h15"/>',
    'arpeggio': '<path d="M12 3.500c-2 1.400-2 2.800 0 4.250s2 2.850 0 4.250-2 2.850 0 4.250 2 2.850 0 4.250"/>',
    'arpeggio-up':
      '<path d="M12 6.500c-2 1.200-2 2.400 0 3.600s2 2.400 0 3.600-2 2.400 0 3.600 2 2.400 0 3.200"/><path d="M9.500 5.500 12 3l2.500 2.500"/>',
    'arpeggio-down':
      '<path d="M12 3.500c-2 1.200-2 2.400 0 3.600s2 2.400 0 3.600-2 2.400 0 3.600 2 2.400 0 3.200"/><path d="M9.500 18.500 12 21l2.500-2.500"/>',
    'arpeggio-bracket': '<path d="M14 4.500h-3.500v15H14"/>',
    'bar-single': '<path d="M12 5v14"/>',
    'bar-double': '<path d="M10.250 5v14M13.750 5v14"/>',
    'bar-final': '<path d="M9.500 5v14"/><path d="M14 5v14" stroke-width="3"/>',
    'bar-dashed': '<path d="M12 5v14" stroke-dasharray="2.200 2.200"/>',
    'repeat-start':
      '<path d="M7 5v14" stroke-width="3"/><path d="M11.500 5v14"/>' + dot(15.500, 9.750, 1.300) + dot(15.500, 14.250, 1.300),
    'repeat-end':
      '<path d="M17 5v14" stroke-width="3"/><path d="M12.500 5v14"/>' + dot(8.500, 9.750, 1.300) + dot(8.500, 14.250, 1.300),
    'line-break': '<path d="M19 6v6.500H6.500M10 9l-3.500 3.500L10 16"/>',
    'page-break': '<path d="M6.500 4v5h11V4M6.500 20v-5h11v5"/><path d="M4 12h16" stroke-dasharray="2 2"/>',
    frame: '<path d="M4.500 6.500h15v11h-15z" stroke-dasharray="2.500 2"/>',
    spacer: '<path d="M12 5v14M9 8l3-3 3 3M9 16l3 3 3-3"/>',
  } as const;

  export type IconName = keyof typeof icons;
</script>

<script lang="ts">
  let { name, size = 22 }: { name: IconName; size?: number } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
  <!-- 内容全部来自上面的静态表 -->
  {@html icons[name]}
</svg>

<style>
  .icon {
    display: block;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
