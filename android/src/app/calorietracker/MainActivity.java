package app.calorietracker;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Hosts the calorie tracker web app (bundled under assets/www) in a full-screen WebView.
 * Files are served from https://appassets.androidplatform.net/ so the page gets a secure
 * origin: ES modules, localStorage and calls to the Anthropic API all work as on the web.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_VOICE = 2;

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
    }

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                return HOST.equals(url.getHost()) ? serveAsset(url.getPath()) : null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String link) {
                Uri url = Uri.parse(link);
                if (HOST.equals(url.getHost())) return false;
                // Links to other sites open in the browser, not inside the app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return openPhotoPicker(callback);
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        String name = path.substring(1);
        if (name.contains("..")) return notFound();
        int dot = name.lastIndexOf('.');
        String mime = MIME.get(dot >= 0 ? name.substring(dot + 1) : "");
        if (mime == null) mime = "application/octet-stream";
        try {
            InputStream in = getAssets().open("www/" + name);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                new HashMap<String, String>(), null);
    }

    /** Offers "take photo" (camera app) and "choose from gallery" for the meal photo input. */
    private boolean openPhotoPicker(ValueCallback<Uri[]> callback) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;

        File photo = new File(FileShareProvider.shareDir(this), "meal.jpg");
        photo.delete();
        cameraUri = FileShareProvider.uriFor("meal.jpg");

        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
        camera.setClipData(ClipData.newRawUri("", cameraUri));
        int grant = Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION;
        camera.addFlags(grant);
        List<ResolveInfo> cams = getPackageManager().queryIntentActivities(camera, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo ri : cams) {
            grantUriPermission(ri.activityInfo.packageName, cameraUri, grant);
        }

        Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
        gallery.setType("image/*");
        gallery.addCategory(Intent.CATEGORY_OPENABLE);

        Intent chooser = Intent.createChooser(gallery, "Add meal photo");
        if (!cams.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        try {
            startActivityForResult(chooser, REQ_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (new File(FileShareProvider.shareDir(this), "meal.jpg").length() > 0) {
                    result = new Uri[]{cameraUri};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        } else if (requestCode == REQ_VOICE) {
            String said = null;
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (results != null && !results.isEmpty()) said = results.get(0);
            }
            callJs("window.onAndroidVoice && window.onAndroidVoice(" + (said == null ? "null" : JSONObject.quote(said)) + ")");
        }
    }

    private void callJs(String script) {
        web.evaluateJavascript(script, null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.androidBack ? window.androidBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    /** Methods callable from the page as window.AndroidBridge.*. */
    private class Bridge {
        @JavascriptInterface
        public void startVoice() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                    i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say what you ate, e.g. two roti and one bowl dal");
                    try {
                        startActivityForResult(i, REQ_VOICE);
                    } catch (ActivityNotFoundException e) {
                        callJs("window.onAndroidVoice && window.onAndroidVoice(null, 'unavailable')");
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareFile(final String name, final String mime, final String content) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                    File f = new File(FileShareProvider.shareDir(MainActivity.this), safe);
                    try {
                        OutputStream out = new FileOutputStream(f);
                        out.write(content.getBytes("UTF-8"));
                        out.close();
                    } catch (IOException e) {
                        return;
                    }
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mime);
                    Uri uri = FileShareProvider.uriFor(safe);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.setClipData(ClipData.newRawUri("", uri));
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Save or share your log"));
                }
            });
        }
    }
}
