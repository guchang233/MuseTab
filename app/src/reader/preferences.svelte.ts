// 看谱偏好。缺省值：两侧空白不翻页，拖动前预先绘制画面外的整页。
let edgeTurn = $state(localStorage.getItem('musetab.edgeTurn') === 'true');
let richScore = $state(localStorage.getItem('musetab.richScore') !== 'false');

export const readerPrefs = {
  get edgeTurn() { return edgeTurn; },
  setEdgeTurn(on: boolean) {
    edgeTurn = on;
    localStorage.setItem('musetab.edgeTurn', String(on));
  },
  get richScore() { return richScore; },
  setRichScore(on: boolean) {
    richScore = on;
    localStorage.setItem('musetab.richScore', String(on));
  },
};
