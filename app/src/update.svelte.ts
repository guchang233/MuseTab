import pkg from '../package.json';
type Release={version:string;versionCode:number;size:number;sha256:string;url:string;notes?:string};
type Event={status:string;data:any};
class Updates {
  current=$state({version:pkg.version,versionCode:0});
  release=$state<Release|null>(null);
  status=$state('idle');message=$state('');progress=$state(0);
  dialogOpen=$state(false);private presentResult=false;
  auto=$state(localStorage.getItem('musetab.autoUpdate')!=='false');
  get available(){return !!this.release&&this.release.versionCode>this.current.versionCode;}
  get busy(){return ['checking','downloading'].includes(this.status);}
  constructor(){
    try{if(window.Android?.appInfo)this.current=JSON.parse(window.Android.appInfo());}catch{}
    window.onNativeUpdate=(e:Event)=>{
      this.status=e.status;
      if(e.status==='checked'){
        this.current=e.data.current;this.release=e.data.release;
        this.message=this.available?'发现新版本 '+this.release!.version:'当前已是最新版本';
        this.dialogOpen=this.available&&(this.dialogOpen||this.presentResult);
        this.presentResult=false;
        localStorage.setItem('musetab.lastUpdateCheck',String(Date.now()));
      }else if(e.status==='downloading'){this.progress=Math.round(e.data.received/e.data.total*100);this.message='正在下载 '+this.progress+'%';}
      else if(e.status==='ready'){this.release=e.data;this.progress=100;this.message='校验完成，可以安装更新';}
      else this.message=String(e.data||'');
    };
    setTimeout(()=>{if(this.auto&&Date.now()-Number(localStorage.getItem('musetab.lastUpdateCheck')||0)>86400000&&window.Android)this.check(true);},12000);
  }
  setAuto(on:boolean){this.auto=on;localStorage.setItem('musetab.autoUpdate',String(on));}
  async check(quiet=false){
    if(this.busy)return;this.presentResult=!quiet;this.status='checking';this.message='正在检查更新…';
    if(window.Android?.checkUpdate){window.Android.checkUpdate();return;}
    this.status='idle';this.message=quiet?'':'请在 Android App 中检查并安装更新';
  }
  download(){if(!this.available||this.busy)return;this.status='downloading';this.progress=0;this.message='正在连接下载…';window.Android?.downloadUpdate?.();}
  cancel(){window.Android?.cancelUpdate?.();}
  install(){window.Android?.installUpdate?.();}
  show(){if(this.available)this.dialogOpen=true;}
  dismiss(){this.dialogOpen=false;}
}
export const updates=new Updates();
