// 看谱页图：引擎的 renderPage 不做谱面反相，只会按谱纸色铺底、用黑色画音符。
// 暗色主题下在这里一次性把页图重新着色：黑墨 → 浅墨，白纸 → 深色谱纸，透明处保持透明。
// 结果连同主题一起进入页图缓存，拖动、缩放时只移动已着色的位图，不再逐帧跑滤镜。
import { engine } from '../bridge/engine.svelte';

type RGB = [number, number, number];

function parse(value: string, fallback: RGB): RGB {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim())?.[1];
  return hex ? [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB : fallback;
}

/** 暗色主题下的墨色与纸色，取自设计令牌，保证页图和界面同色。 */
function nightColors() {
  const css = getComputedStyle(document.documentElement);
  return { ink: parse(css.getPropertyValue('--ink'), [226, 216, 195]), paper: parse(css.getPropertyValue('--sheet'), [38, 31, 24]) };
}

export function nightMode() {
  return document.documentElement.dataset.theme === 'dark';
}

/** 逐通道线性映射：0（墨）→ ink，255（纸）→ paper；抗锯齿边缘自然过渡。 */
export async function tint(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) { bitmap.close(); return source; }
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = g.getImageData(0, 0, canvas.width, canvas.height), data = image.data;
  const { ink, paper } = nightColors();
  const lut = [0, 1, 2].map((c) => Uint8ClampedArray.from({ length: 256 }, (_, v) => ink[c] + ((paper[c] - ink[c]) * v) / 255));
  const [r, gr, b] = lut;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r[data[i]];
    data[i + 1] = gr[data[i + 1]];
    data[i + 2] = b[data[i + 2]];
  }
  g.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(Error('页图着色失败'))), 'image/png'));
}

/** 渲染一页看谱位图（PNG Blob）；暗色主题下已着色。 */
export async function readerPage(page: number, pixels: number): Promise<Blob> {
  const src = engine.renderPage(page, pixels);
  if (!src) throw Error('页面暂时未能显示');
  const blob = await (await fetch(src)).blob();
  return nightMode() ? tint(blob) : blob;
}
