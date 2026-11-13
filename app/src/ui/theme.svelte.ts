// 主题：随系统，并可手动切换。偏好存本地，解析结果写到 <html data-theme>。

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'musetab.theme';
const media = matchMedia('(prefers-color-scheme: dark)');

function initial(): ThemePref {
  // 样稿截图用：#/reader?theme=dark
  const m = /[?&]theme=(light|dark|auto)/.exec(location.hash);
  if (m) return m[1] as ThemePref;
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'auto';
  } catch {
    return 'auto';
  }
}

let pref = $state<ThemePref>(initial());
let systemDark = $state(media.matches);

function resolved(): 'light' | 'dark' {
  return pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
}

function apply() {
  document.documentElement.dataset.theme = resolved();
}

media.addEventListener('change', (e) => {
  systemDark = e.matches;
  apply();
});

export const theme = {
  get pref() {
    return pref;
  },
  get resolved() {
    return resolved();
  },
  set(next: ThemePref) {
    pref = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 隐私模式下忽略 */
    }
    apply();
  },
  /** 随系统 → 明 → 暗 → 随系统 */
  cycle() {
    theme.set(pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto');
  },
  get label() {
    return pref === 'auto' ? '随系统' : pref === 'light' ? '明' : '暗';
  },
};

apply();
