// SPDX-License-Identifier: GPL-3.0-only
package org.musetab.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

/** Release metadata and APK transport are independent of the score-library API. */
final class AppUpdater {
    static final String META = "https://github.com/guchang233/MuseTab/releases/latest/download/update.json";
    private final MainActivity activity;
    private final AtomicBoolean busy = new AtomicBoolean();
    private volatile boolean cancelled;
    private volatile boolean verified;
    private JSONObject release;
    AppUpdater(MainActivity activity) { this.activity = activity; }
    JSONObject info() throws Exception {
        PackageInfo p = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return new JSONObject().put("version", p.versionName).put("versionCode", p.getLongVersionCode());
    }
    private void event(String status, Object value) {
        try { activity.updateEvent(new JSONObject().put("status", status).put("data", value).toString()); }
        catch (Exception ignored) { }
    }
    private static boolean allowed(URL u) {
        if (!"https".equals(u.getProtocol()) || u.getPort() != -1 || u.getUserInfo() != null) return false;
        String h = u.getHost();
        return ("github.com".equals(h) && u.getPath().startsWith("/guchang233/MuseTab/releases/"))
            || "release-assets.githubusercontent.com".equals(h) || "objects.githubusercontent.com".equals(h);
    }
    private HttpURLConnection connect(String address) throws Exception {
        URL u = new URL(address);
        for (int n = 0; n < 6; n++) {
            if (!allowed(u)) throw new IOException("更新地址不受信任");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(20000);
            c.setRequestProperty("User-Agent", "MuseTab-Android");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { String next=c.getHeaderField("Location"); c.disconnect(); if(next==null)throw new IOException("更新重定向无效"); u=new URL(u,next); continue; }
            if (code != 200) { c.disconnect(); throw new IOException(code==404 ? "暂时没有已发布的版本" : "更新服务暂时不可用（"+code+"）"); }
            return c;
        }
        throw new IOException("更新重定向过多");
    }
    private JSONObject metadata() throws Exception {
        HttpURLConnection c=connect(META);
        try (InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[8192]; int n;
            while((n=in.read(b))!=-1) { out.write(b,0,n); if(out.size()>131072)throw new IOException("版本信息过大"); }
            JSONObject j=new JSONObject(out.toString("UTF-8"));
            String url=j.getString("url"); URL u=new URL(url);
            if(!"github.com".equals(u.getHost()) || !u.getPath().startsWith("/guchang233/MuseTab/releases/download/") || !u.getPath().endsWith(".apk") || !allowed(u))throw new IOException("安装包地址无效");
            if(!j.getString("sha256").matches("[a-fA-F0-9]{64}") || j.getLong("size")<1 || j.getLong("size")>300L*1024*1024 || j.getLong("versionCode")<1)throw new IOException("版本信息无效");
            return j;
        } finally { c.disconnect(); }
    }
    void check() {
        if(!busy.compareAndSet(false,true))return;
        new Thread(()->{try { release=metadata(); event("checked",new JSONObject().put("release",release).put("current",info())); }
            catch(Exception e){event("error",e.getMessage());}finally{busy.set(false);}},"MuseTab-update-check").start();
    }
    File apk() { return new File(new File(activity.getCacheDir(),"updates"),"update.apk"); }
    void download() {
        if(!busy.compareAndSet(false,true))return;
        cancelled=false; verified=false;
        new Thread(()->{
            File file=apk(), partial=new File(file.getParentFile(),"update.part.apk");
            try {
                JSONObject j=metadata(); release=j;
                if(j.getLong("versionCode")<=info().getLong("versionCode"))throw new IOException("当前已是最新版本");
                file.getParentFile().mkdirs(); MessageDigest sha=MessageDigest.getInstance("SHA-256");
                HttpURLConnection c=connect(j.getString("url")); long count=0,last=0;
                try(InputStream in=c.getInputStream(); OutputStream out=new FileOutputStream(partial)) {
                    byte[] b=new byte[65536]; int n;
                    while((n=in.read(b))!=-1) {
                        if(cancelled)throw new IOException("已取消下载"); count+=n;
                        if(count>j.getLong("size"))throw new IOException("安装包大小不符");
                        out.write(b,0,n);sha.update(b,0,n);
                        long now=System.currentTimeMillis();if(now-last>250){event("downloading",new JSONObject().put("received",count).put("total",j.getLong("size")));last=now;}
                    }
                } finally {c.disconnect();}
                StringBuilder hex=new StringBuilder();for(byte v:sha.digest())hex.append(String.format("%02x",v&255));
                if(count!=j.getLong("size")||!hex.toString().equalsIgnoreCase(j.getString("sha256")))throw new IOException("安装包校验失败，请重新下载");
                PackageManager pm=activity.getPackageManager();
                PackageInfo candidate=pm.getPackageArchiveInfo(partial.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
                PackageInfo current=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
                if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.getLongVersionCode()!=j.getLong("versionCode")
                    ||!Arrays.equals(candidate.signingInfo.getApkContentsSigners(),current.signingInfo.getApkContentsSigners()))throw new IOException("安装包签名或版本不匹配");
                if(file.exists()&&!file.delete())throw new IOException("无法替换安装包");
                if(!partial.renameTo(file))throw new IOException("无法保存安装包");
                verified=true; event("ready",j);
            }catch(Exception e){partial.delete();event("error",e.getMessage());}finally{busy.set(false);}
        },"MuseTab-update-download").start();
    }
    void cancel(){cancelled=true;}
    void install(){activity.runOnUiThread(()->{
        try{
            if(!verified||!apk().isFile())throw new IOException("请先下载并校验更新");
            if(!activity.getPackageManager().canRequestPackageInstalls()) {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));
                event("permission","允许安装后，返回这里再点“安装更新”"); return;
            }
            Intent i=new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("content://org.musetab.app.updates/update.apk"),"application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(i);
        }catch(Exception e){event("error",e.getMessage());}
    });}
}
