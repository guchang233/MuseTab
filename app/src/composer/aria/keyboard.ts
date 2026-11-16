// ScoreReaderWidePitchKeyboard: integer range/drag/hit rules, ported from Aria.
const classes=[0,2,4,5,7,9,11];
export const naturalIndex=(pitch:number)=>Math.floor(pitch/12)*7+[0,0,1,1,2,3,3,4,4,5,5,6][((pitch%12)+12)%12];
export const naturalPitch=(index:number)=>Math.floor(index/7)*12+classes[((index%7)+7)%7];
export const visibleCount=(width:number,phone:boolean,landscape=false)=>Math.max(phone?(landscape?5:7):14,Math.min(phone?(landscape?7:8):22,Math.floor(width/(phone?(landscape?35:42):48))));
export const clampStart=(index:number,count:number)=>Math.max(naturalIndex(21),Math.min(index,Math.max(naturalIndex(21),naturalIndex(108)-count+1)));
export const pitchName=(pitch:number,flats=false)=>[("C"),flats?'D♭':'C♯','D',flats?'E♭':'D♯','E','F',flats?'G♭':'F♯','G',flats?'A♭':'G♯','A',flats?'B♭':'A♯','B'][pitch%12]+(Math.floor(pitch/12)-1);
export function hitPitch(x:number,y:number,width:number,height:number,start:number,count:number){
 if(x<0||x>width||y<0||y>height)return null;
 const w=width/count,blackWidth=Math.min(w*.58,34),hitWidth=Math.max(blackWidth,Math.min(w*.72,44));
 if(y<=72)for(let offset=count;offset>=-1;offset--){const left=naturalPitch(start+offset),right=naturalPitch(start+offset+1),center=(offset+1)*w;if(right-left===2&&left>=21&&right<=108&&Math.abs(x-center)<=hitWidth/2)return left+1;}
 const pitch=naturalPitch(start+Math.min(count-1,Math.floor(x/w)));return pitch>=21&&pitch<=108?pitch:null;
}
