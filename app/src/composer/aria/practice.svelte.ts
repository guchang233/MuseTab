type Timing={bpm?:number;numerator?:number;denominator?:number};
let countInBars=$state(Math.max(0,Math.min(2,Number(localStorage.getItem('Aria.CountInBars')||0))));
let counting=$state(false),beat=$state(0),total=$state(0);
let context:AudioContext|undefined,timer:ReturnType<typeof setTimeout>,beatTimer:ReturnType<typeof setInterval>,finish:((result:boolean)=>void)|undefined;
const oscillators:OscillatorNode[]=[];
function cancel(){clearTimeout(timer);clearInterval(beatTimer);for(const node of oscillators.splice(0))try{node.stop();}catch{}counting=false;finish?.(false);finish=undefined;}
export const practice={
 get bars(){return countInBars;},get counting(){return counting;},get beat(){return beat;},get total(){return total;},
 setBars(value:number){countInBars=Math.max(0,Math.min(2,value));localStorage.setItem('Aria.CountInBars',String(countInBars));},
 cancel,
 async beforePlay(timing:Timing,speed:number){
  cancel();if(!countInBars)return true;
  context??=new AudioContext({latencyHint:'interactive'});await context.resume();
  if(context.state!=='running')throw Error('无法启动预备拍，请检查设备声音设置。');
  const numerator=Math.max(1,timing.numerator||4),denominator=Math.max(1,timing.denominator||4),seconds=60/Math.max(1,(timing.bpm||120)*speed)*4/denominator;
  total=numerator*countInBars;beat=1;counting=true;const start=context.currentTime+.025;
  for(let i=0;i<total;i++){
   const oscillator=context.createOscillator(),gain=context.createGain(),when=start+i*seconds;oscillator.type='sine';oscillator.frequency.value=i%numerator===0?1760:1175;gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.18,when+.002);gain.gain.exponentialRampToValueAtTime(.0001,when+.04);oscillator.connect(gain).connect(context.destination);oscillator.start(when);oscillator.stop(when+.05);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillators.push(oscillator);
  }
  beatTimer=setInterval(()=>{beat=Math.min(total,1+Math.floor(Math.max(0,context!.currentTime-start)/seconds));},50);
  return new Promise<boolean>(resolve=>{finish=resolve;timer=setTimeout(()=>{clearInterval(beatTimer);counting=false;oscillators.length=0;finish=undefined;resolve(true);},(total*seconds+.025)*1000);});
 }
};
