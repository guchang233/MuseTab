// SPDX-License-Identifier: GPL-3.0-only
// MuseTab Android container: a full-screen WebView that serves the app from
// the APK's assets under https://musetab.local/. GitHub HTTPS data requests
// are allowed; navigation stays on the local origin. Adds the system file picker and
// "save as" on top of the web app.
package org.musetab.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String HOST = "musetab.local";
    private static final int PICK_FILES = 10, SAVE_FILE = 11;
    private static final int MAX_BYTES = 32 * 1024 * 1024;

    private WebView web;
    private AppUpdater updater;
    void updateEvent(String json) { runOnUiThread(() -> web.evaluateJavascript("window.onNativeUpdate?.("+json+")",null)); }
    private FrameLayout root;
    private int barColor = 0xFFF7F6F2;
    private boolean lightBars = true;
    private ValueCallback<Uri[]> pickCallback;
    private byte[] pendingSave;
    private boolean pageReady = false;
    private boolean immersiveMode = false;
    private Uri pendingOpen;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        updater = new AppUpdater(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new Bridge(), "Android");
        WebView.setWebContentsDebuggingEnabled(true);
        web.setBackgroundColor(0xFFF3ECDD);

        web.setWebChromeClient(new WebChromeClient() {
            // <input type="file"> → system document picker
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pickCallback != null) {
                    pickCallback.onReceiveValue(null);
                }
                pickCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(pick, PICK_FILES);
                } catch (Exception e) {
                    pickCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOST.equals(req.getUrl().getHost());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serveAsset(req);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (pendingOpen != null) {
                    Uri u = pendingOpen;
                    pendingOpen = null;
                    deliver(u);
                }
            }
        });

        // Android 15 enforces edge-to-edge. Keep regular UI outside system bars;
        // fullscreen hides the bars and lets the score occupy the entire window.
        root = new FrameLayout(this);
        root.setBackgroundColor(barColor);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
            }
            FrameLayout.LayoutParams layout = (FrameLayout.LayoutParams) web.getLayoutParams();
            if (layout.leftMargin != left || layout.topMargin != top || layout.rightMargin != right || layout.bottomMargin != bottom) {
                layout.setMargins(left, top, right, bottom);
                web.setLayoutParams(layout);
            }
            return insets;
        });
        setContentView(root);
        showBars();
        web.loadUrl("https://" + HOST + "/index.html");
        handleIntent(getIntent());
    }

    // ---------------------------------------------------------------- assets
    private WebResourceResponse serveAsset(WebResourceRequest req) {
        if (!HOST.equals(req.getUrl().getHost())) {
            String host = req.getUrl().getHost();
            if ("https".equals(req.getUrl().getScheme()) && "GET".equals(req.getMethod())
                    && "raw.githubusercontent.com".equals(host)) {
                return null;
            }
            return plain(403, "Forbidden");
        }
        String file = req.getUrl().getPath();
        if (file == null || file.contains("..")) {
            return plain(403, "Forbidden");
        }
        file = file.replaceAll("/+", "/");
        if (file.endsWith("/")) {
            file += "index.html";
        }
        file = Uri.decode(file.substring(1));
        try {
            // Assets are stored uncompressed, so large WASM / SF3 files can be ranged.
            long size;
            try (AssetFileDescriptor d = getAssets().openFd(file)) {
                size = d.getLength();
            }
            InputStream stream = getAssets().open(file);
            String range = null;
            for (Map.Entry<String, String> h : req.getRequestHeaders().entrySet()) {
                if (h.getKey().equalsIgnoreCase("Range")) {
                    range = h.getValue();
                }
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Cache-Control", "no-store");
            headers.put("Access-Control-Allow-Origin", "https://" + HOST);
            int status = 200;
            String reason = "OK";
            if (range != null && range.matches("bytes=\\d+-\\d*")) {
                String[] n = range.substring(6).split("-", -1);
                long start = Long.parseLong(n[0]);
                long end = n[1].isEmpty() ? size - 1 : Math.min(size - 1, Long.parseLong(n[1]));
                if (start > end || start >= size) {
                    stream.close();
                    return plain(416, "Range Not Satisfiable");
                }
                long left = start;
                while (left > 0) {
                    long skipped = stream.skip(left);
                    if (skipped <= 0) {
                        throw new IOException("cannot seek asset");
                    }
                    left -= skipped;
                }
                final long limit = end - start + 1;
                stream = new FilterInputStream(stream) {
                    long remaining = limit;

                    @Override
                    public int read() throws IOException {
                        if (remaining <= 0) {
                            return -1;
                        }
                        int b = super.read();
                        if (b >= 0) {
                            remaining--;
                        }
                        return b;
                    }

                    @Override
                    public int read(byte[] b, int off, int len) throws IOException {
                        if (remaining <= 0) {
                            return -1;
                        }
                        int r = super.read(b, off, (int) Math.min(len, remaining));
                        if (r > 0) {
                            remaining -= r;
                        }
                        return r;
                    }
                };
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
                headers.put("Content-Length", Long.toString(limit));
                status = 206;
                reason = "Partial Content";
            } else {
                headers.put("Content-Length", Long.toString(size));
            }
            return new WebResourceResponse(mime(file), null, status, reason, headers, stream);
        } catch (Exception ex) {
            android.util.Log.w("MuseTabAssets", file, ex);
            return plain(404, "Not Found");
        }
    }

    private WebResourceResponse plain(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, new HashMap<>(),
                new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js") || name.endsWith(".mjs")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".wasm")) return "application/wasm";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".woff")) return "font/woff";
        if (name.endsWith(".otf")) return "font/otf";
        if (name.endsWith(".ttf")) return "font/ttf";
        if (name.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------- open with
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) {
            return;
        }
        if (pageReady) {
            deliver(uri);
        } else {
            pendingOpen = uri;
        }
    }

    /** Hands an external file to the page: window.onNativeOpen(name, base64) */
    private void deliver(Uri uri) {
        try {
            String name = displayName(uri);
            byte[] bytes = readAll(uri);
            js("window.onNativeOpen && window.onNativeOpen(" + JSONObject.quote(name) + ","
                    + JSONObject.quote(Base64.encodeToString(bytes, Base64.NO_WRAP)) + ")");
        } catch (Exception ex) {
            alert(ex.getMessage());
        }
    }

    private String displayName(Uri uri) {
        String name = uri.getLastPathSegment() != null ? uri.getLastPathSegment() : "score.mscz";
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int col = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (col >= 0 && c.getString(col) != null) {
                    name = c.getString(col);
                }
            }
        } catch (Exception ignored) {
        }
        return name;
    }

    private byte[] readAll(Uri uri) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) {
                throw new IOException("无法读取这个文件");
            }
            byte[] part = new byte[65536];
            int n;
            while ((n = in.read(part)) != -1) {
                if (buf.size() + n > MAX_BYTES) {
                    throw new IOException("文件超过 32 MB，暂时打不开");
                }
                buf.write(part, 0, n);
            }
        }
        return buf.toByteArray();
    }

    // ---------------------------------------------------------------- bridge
    public final class Bridge {
        @JavascriptInterface public String appInfo() { try { return updater.info().toString(); } catch(Exception e){ return "{}"; } }
        @JavascriptInterface public void checkUpdate(){updater.check();}
        @JavascriptInterface public void downloadUpdate(){updater.download();}
        @JavascriptInterface public void cancelUpdate(){updater.cancel();}
        @JavascriptInterface public void installUpdate(){updater.install();}
        @JavascriptInterface
        public void setSystemBars(String color, boolean light) {
            final int next;
            try { next = Color.parseColor(color); } catch (IllegalArgumentException ex) { return; }
            runOnUiThread(() -> {
                barColor = next; lightBars = light;
                root.setBackgroundColor(barColor);
                getWindow().setStatusBarColor(barColor);
                getWindow().setNavigationBarColor(barColor);
                if (!immersiveMode) showBars();
            });
        }
        /** Export / save as: opens the system "save as" dialog */
        @JavascriptInterface
        public void saveFile(String name, String base64) {
            pendingSave = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(() -> {
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType("application/octet-stream");
                save.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                startActivityForResult(save, SAVE_FILE);
            });
        }

        @JavascriptInterface
        public void setImmersive(boolean on) {
            runOnUiThread(() -> {
                immersiveMode = on;
                if (on) {
                    immersive();
                } else {
                    showBars();
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(MainActivity.this::finish);
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILES) {
            Uri[] picked = null;
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    picked = new Uri[data.getClipData().getItemCount()];
                    for (int i = 0; i < picked.length; i++) {
                        picked[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    picked = new Uri[] { data.getData() };
                }
            }
            // WebView cannot read content:// URIs once file access is off, so
            // the files go through the same path as "open with".
            if (pickCallback != null) {
                pickCallback.onReceiveValue(null);
                pickCallback = null;
            }
            if (picked != null) {
                for (Uri u : picked) {
                    deliver(u);
                }
            }
        } else if (request == SAVE_FILE) {
            boolean ok = false;
            if (result == RESULT_OK && data != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    out.write(pendingSave);
                    ok = true;
                } catch (Exception ex) {
                    alert(ex.getMessage());
                }
            }
            pendingSave = null;
            js("window.onNativeSaved && window.onNativeSaved(" + ok + ")");
        }
    }

    // ------------------------------------------------------------------ misc
    @Override
    public void onBackPressed() {
        // The page decides: close a panel, go back to the shelf, or leave the app.
        web.evaluateJavascript("window.onNativeBack ? window.onNativeBack() : false", handled -> {
            if (!"true".equals(handled)) {
                finish();
            }
        });
    }

    private void immersive() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    private void showBars() {
        getWindow().getDecorView().setSystemUiVisibility(lightBars ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            if (immersiveMode) immersive();
            else showBars();
        }
    }

    private void js(String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private void alert(String message) {
        runOnUiThread(() -> new AlertDialog.Builder(this).setMessage(message).setPositiveButton("好", null).show());
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
