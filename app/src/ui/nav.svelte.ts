// 极简的 hash 路由：#/library、#/reader、#/editor。
// 查询串只给样稿截图用，例如 #/reader?theme=dark&pin=1。

export type Screen = 'library' | 'reader' | 'editor';

const SCREENS: Screen[] = ['library', 'reader', 'editor'];

function parse() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const screen = (SCREENS as string[]).includes(path) ? (path as Screen) : 'library';
  return { screen, params: new URLSearchParams(query) };
}

let current = $state(parse());

addEventListener('hashchange', () => {
  current = parse();
});

export const nav = {
  get screen() {
    return current.screen;
  },
  /** 样稿用的开关参数 */
  flag(name: string): boolean {
    return current.params.has(name);
  },
  go(screen: Screen) {
    location.hash = `/${screen}`;
  },
};
