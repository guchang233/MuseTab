package com.gathin.zhuiju.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.File;

/** Signed in-app updates: check the release manifest, then download, verify and hand the APK to the system installer. */
final class UpdateFlow {
    interface Listener{void onStatus(JSONObject status);}
    private static volatile boolean busy;
    /** Checks the signed manifest. Silent checks stay quiet unless a new, not-skipped version exists. */
    static void check(final Activity activity,final boolean manual,final Listener listener){
        if(busy){report(listener,status("busy","更新正在进行"));return;}
        new Thread(new Runnable(){public void run(){
            try{
                Updater.Config cfg=Updater.config(activity);if(!cfg.enabled())throw new Exception("此版本未配置更新服务");
                String text=Updater.fetch(activity,cfg);final UpdateProtocol.Release r=Updater.verify(activity,cfg,text);
                try{Updater.requireNewer(activity,r);}catch(Exception latest){report(listener,status("latest","已是最新版本 "+Updater.currentVersion(activity)));return;}
                Updater.remember(activity,r);
                final SharedPreferences prefs=Shell.prefs(activity);
                report(listener,status("available","发现新版本 "+r.version).put("version",r.version).put("notes",r.notes).put("size",r.size));
                if(!manual&&prefs.getInt("skipCode",0)==r.code)return;
                activity.runOnUiThread(new Runnable(){public void run(){
                    if(activity.isFinishing())return;
                    AlertDialog.Builder b=new AlertDialog.Builder(activity).setTitle("发现新版本 "+r.version).setMessage(r.notes+"\n\n安装包 "+mb(r.size))
                        .setPositiveButton("立即更新",new DialogInterface.OnClickListener(){public void onClick(DialogInterface d,int w){download(activity,r,listener);}})
                        .setNegativeButton("稍后",null);
                    if(!manual)b.setNeutralButton("跳过此版本",new DialogInterface.OnClickListener(){public void onClick(DialogInterface d,int w){prefs.edit().putInt("skipCode",r.code).apply();}});
                    b.show();
                }});
            }catch(Exception e){report(listener,status("error",e.getMessage()==null?"检查更新失败":e.getMessage()));}
        }},"release-check").start();
    }
    private static void download(final Activity activity,final UpdateProtocol.Release r,final Listener listener){
        busy=true;final ProgressDialog progress=new ProgressDialog(activity);
        progress.setTitle("正在下载 "+r.version);progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);progress.setMax(100);progress.setCancelable(false);progress.setProgressNumberFormat(null);progress.show();
        final Thread worker=new Thread(new Runnable(){public void run(){
            try{
                Updater.Config cfg=Updater.config(activity);
                final File apk=Updater.download(activity,cfg,r,new Updater.Progress(){long last;public void update(final long done,final long total){
                    long now=System.currentTimeMillis();if(now-last<250&&done<total)return;last=now;
                    activity.runOnUiThread(new Runnable(){public void run(){progress.setProgress((int)(done*100/Math.max(1,total)));progress.setMessage(mb(done)+" / "+mb(total));}});
                    try{report(listener,status("downloading","正在下载 "+(done*100/Math.max(1,total))+"%").put("done",done).put("total",total));}catch(Exception ignored){}
                }});
                activity.runOnUiThread(new Runnable(){public void run(){progress.setMessage("正在校验并打开系统安装器…");}});
                Updater.install(activity,apk,r);
                report(listener,status("installing","请在系统安装界面确认更新"));
            }catch(final Exception e){
                report(listener,status("error",e.getMessage()==null?"更新失败":e.getMessage()));
                activity.runOnUiThread(new Runnable(){public void run(){Toast.makeText(activity,e.getMessage()==null?"更新失败，当前版本继续可用":e.getMessage(),Toast.LENGTH_LONG).show();}});
            }finally{busy=false;activity.runOnUiThread(new Runnable(){public void run(){if(progress.isShowing())progress.dismiss();}});}
        }},"release-download");
        worker.start();
    }
    private static String mb(long bytes){return String.format(java.util.Locale.US,"%.1f MB",bytes/1048576.0);}
    private static JSONObject status(String state,String message){try{return new JSONObject().put("state",state).put("message",message);}catch(Exception e){return new JSONObject();}}
    private static void report(Listener l,JSONObject s){if(l!=null)l.onStatus(s);}
}
