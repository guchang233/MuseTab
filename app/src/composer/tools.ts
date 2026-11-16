export const categories=[['select','选择'],['notes','音符'],['chord','和弦'],['lyrics','歌词'],['fingering','指法'],['repeats','反复'],['text','文本'],['expression','表情'],['layout','排版'],['more','更多']] as const;
export type ToolCategory=typeof categories[number][0];
export const tools:Record<ToolCategory,[string,string][]>={
  select:[['select-next-chord','后一个'],['select-prev-chord','前一个'],['action://notation/copy','复制'],['action://notation/cut','剪切'],['action://notation/paste','粘贴'],['action://notation/delete','删除'],['pitch-up','升半音'],['pitch-down','降半音'],['pitch-up-octave','升八度'],['pitch-down-octave','降八度'],['half-duration','时值减半'],['double-duration','时值加倍'],['flip','翻转'],['toggle-visible','显示 / 隐藏'],['reset','重置位置']],
  notes:[['flat','降号'],['nat','还原号'],['sharp','升号'],['tie','延音线'],['add-slur','连音线'],['triplet','三连音'],['pad-rest','休止符']],
  chord:[['chord-text','和弦名称'],['roman-numeral-text','罗马数字分析']],
  lyrics:[['lyrics','添加歌词']],
  fingering:[],
  repeats:[],
  text:[['staff-text','谱表文字'],['system-text','系统文字'],['tempo','速度'],['rehearsalmark-text','排练标记']],
  expression:[['add-slur','连音线'],['add-hairpin','渐强'],['add-hairpin-reverse','渐弱'],['add-staccato','跳音'],['add-tenuto','保持音'],['add-accent','重音']],
  layout:[['append-measure','末尾添加小节'],['insert-measure','插入小节'],['system-break','换行'],['page-break','换页'],['section-break','分段']],
  more:[['notation-select-all','全选'],['concert-pitch','实际音高'],['show-invisible','显示隐藏元素'],['show-frames','显示框架']],
};
export const paletteGroups:Partial<Record<ToolCategory,string[]>>={
  notes:['Accidentals','Grace notes','Noteheads','Beam properties','Tremolos'],
  chord:['Fretboard diagrams','Arpeggios & glissandi','Arpeggios'],
  fingering:['Fingering','Fingerings'],repeats:['Repeats & jumps','Barlines'],
  text:['Text','Tempo'],expression:['Dynamics','Articulations','Ornaments','Lines','Keyboard','Breaths & pauses'],
  layout:['Layout','Clefs','Key signatures','Time signatures','Brackets'],
};
