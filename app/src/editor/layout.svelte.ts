// 编辑模式下，引擎画布四边要让出的距离（顶栏、底部拇指区、左侧符号面板）。
let value = $state({ top: 60, right: 0, bottom: 64, left: 0 });
export const editorInset = {
  get value() {
    return value;
  },
  set(v: { top: number; right: number; bottom: number; left: number }) {
    value = v;
  },
};
