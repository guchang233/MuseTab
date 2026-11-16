// ScoreReaderChordBuilderDraft: preserve original token typing/backspace semantics.
export const chordComplete=(s:string)=>/^[A-G]/.test(s)&&!/(?:\/|add|no|\(maj)$/.test(s)&&!endsWithAlteration(s);
export function chordType(text:string,token:string){if(token==='maj'&&/(?:min|m|-|°)$/.test(text))return text+'(maj';if(text.endsWith('(maj')&&/^\d+$/.test(token))return text+token+')';return text+token;}
export function chordErase(text:string){if(/\(maj\d+\)$/.test(text))return text.replace(/\d+\)$/,'');if(text.endsWith('(maj'))return text.slice(0,-4);const token=['maj','min','sus','add','no','11','13','b5','#5','dim','aug'].find(t=>text.endsWith(t));return text.slice(0,-(token?.length||1));}

function endsWithAlteration(text:string){const match=/[b#♭♯]+$/.exec(text);return !!match&&match.index>0&&!"ABCDEFG".includes(text[match.index-1]);}
