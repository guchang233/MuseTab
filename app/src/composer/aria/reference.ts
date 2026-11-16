// Geometry transcribed from the pinned Aria Android/shared sources.
// See docs/references/aria-editor/manifest.json for provenance.
export const ARIA_COMMIT='9dffd7f3feea6d5af068723d5cfff47e7283a69c';
export type AriaCategory='notes'|'select'|'repeats'|'text'|'expression'|'layout'|'more'|'chord'|'lyrics'|'fingering';
export const tabletCategories=['notes','select','repeats','text','expression','layout','more'] as const;
export const phoneCategories=['notes','select','text','repeats','expression','layout','more'] as const;
export const ariaMetrics={
  chromeHeight:62,compactHeaderWidth:1180,condensedPlaybackWidth:900,
  modeCellHeight:62,modeIconSlot:24,modeLabelSize:9,modeHighlightRadius:10,
  regularModeHeight:34,regularModeRadius:9,
  floating:{noteWidth:52,otherWidth:92,paddingX:7,paddingY:9,gap:5,radius:12,edge:16,noteLandscapeTop:108,otherTop:148},
  keyboard:{tabletHeight:92,tabletNudgeWidth:74,tabletNudgeHeight:122,tabletSideGap:18,tabletPaddingX:24,tabletPaddingBottom:18,phoneHeight:86,phoneWhiteWidth:42,phoneMinNaturals:7,phoneMaxNaturals:8},
} as const;
export function ariaCategoryActive(selected:AriaCategory,category:AriaCategory){return category==='text'?['text','chord','lyrics','fingering'].includes(selected):selected===category;}
export function ariaCategoryEnabled(category:AriaCategory,busy:boolean,measureSelection:boolean,singleMeasure:boolean){
  if(busy)return false;if(category==='select')return true;
  return !measureSelection||singleMeasure||['repeats','expression','layout','more'].includes(category);
}
