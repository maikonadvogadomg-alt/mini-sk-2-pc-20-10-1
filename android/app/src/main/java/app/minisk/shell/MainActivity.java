package app.minisk.shell;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.content.pm.PackageManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * App de uma tela só: abre o index.html que vai DENTRO do APK (pasta assets/www).
 * Usa um endereço https "de mentira" (appassets.androidplatform.net) para o
 * navegador interno liberar tudo: banco do navegador, módulos, service worker.
 */
public class MainActivity extends Activity {
    private static final String INICIO = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int ESCOLHER_ARQUIVO = 41;
    private WebView web;
    private ValueCallback<Uri[]> retornoArquivo;
    private static final int PEDIR_MICROFONE = 42;
    private PermissionRequest pedidoPendente;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        try { getWindow().setStatusBarColor(getResources().getColor(R.color.tema, null)); } catch (Exception ignorado) { }

        final WebViewAssetLoader carregador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // O service worker do app (sw.js) também precisa achar os arquivos que vão DENTRO
        // do APK. Sem isto, da 2ª vez que abre ele tenta buscar na internet um endereço
        // que não existe e a página/prévia fica em branco.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                    WebResourceResponse r = carregador.shouldInterceptRequest(req.getUrl());
                    String c = req.getUrl().getPath();
                    if (r != null && c != null && (c.toLowerCase().endsWith(".html") || c.toLowerCase().endsWith(".htm"))) r = comPonte(r);
                    return comLacre(r);
                }
            });
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // 📱 Termux: a página (https interno) precisa poder abrir ws://127.0.0.1
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                WebResourceResponse r = carregador.shouldInterceptRequest(req.getUrl());
                String c = req.getUrl().getPath();
                if (r != null && c != null && (c.toLowerCase().endsWith(".html") || c.toLowerCase().endsWith(".htm"))) r = comPonte(r);
                return comLacre(r);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                String esquema = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                // páginas montadas dentro do app (preview, playground): blob:, data:, about:
                if (esquema.equals("blob") || esquema.equals("data") || esquema.equals("about") || esquema.equals("javascript")) return false;
                // quadros internos (iframe) carregam dentro do app
                if (!req.isForMainFrame()) return false;
                // links de fora (sites) abrem no navegador do celular
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignorado) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> retorno, FileChooserParams p) {
                if (retornoArquivo != null) retornoArquivo.onReceiveValue(null);
                retornoArquivo = retorno;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolher arquivo"), ESCOLHER_ARQUIVO);
                } catch (Exception e) {
                    retornoArquivo = null;
                    return false;
                }
                return true;
            }

            // microfone/câmera: o Android pergunta ao usuário quando a página pede
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(() -> {
                    List<String> falta = new ArrayList<>();
                    for (String r : req.getResources()) {
                        String p = null;
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) p = android.Manifest.permission.RECORD_AUDIO;
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) p = android.Manifest.permission.CAMERA;
                        if (p != null && checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) falta.add(p);
                    }
                    if (falta.isEmpty()) { req.grant(req.getResources()); return; }
                    pedidoPendente = req;
                    requestPermissions(falta.toArray(new String[0]), PEDIR_MICROFONE);
                });
            }
        });

        web.addJavascriptInterface(new Ponte(), "AndroidBridge");
        setContentView(web);
        if (salvo != null) web.restoreState(salvo);
        else web.loadUrl(INICIO);
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        if (pedido == ESCOLHER_ARQUIVO && retornoArquivo != null) {
            Uri[] lista = null;
            if (resultado == RESULT_OK && dados != null) {
                if (dados.getClipData() != null) {
                    int n = dados.getClipData().getItemCount();
                    lista = new Uri[n];
                    for (int k = 0; k < n; k++) lista[k] = dados.getClipData().getItemAt(k).getUri();
                } else if (dados.getData() != null) {
                    lista = new Uri[]{ dados.getData() };
                }
            }
            retornoArquivo.onReceiveValue(lista);
            retornoArquivo = null;
            return;
        }
        super.onActivityResult(pedido, resultado, dados);
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permissoes, int[] resultados) {
        super.onRequestPermissionsResult(pedido, permissoes, resultados);
        if (pedido == PEDIR_MICROFONE && pedidoPendente != null) {
            boolean ok = resultados.length > 0;
            for (int r : resultados) if (r != PackageManager.PERMISSION_GRANTED) ok = false;
            if (ok) pedidoPendente.grant(pedidoPendente.getResources()); else pedidoPendente.deny();
            pedidoPendente = null;
        }
    }

    /** 🔒 Lacre (COOP/COEP): o que o sw.js fazia no navegador. Liga o "terminal real" (WebContainer). */
    private WebResourceResponse comLacre(WebResourceResponse r) {
        if (r == null) return null;
        boolean ligado = false;
        try { ligado = getResources().getBoolean(R.bool.lacre); } catch (Exception ignorado) { }
        if (!ligado) return r;
        java.util.Map<String, String> h = new java.util.HashMap<>();
        if (r.getResponseHeaders() != null) h.putAll(r.getResponseHeaders());
        h.put("Cross-Origin-Opener-Policy", "same-origin");
        h.put("Cross-Origin-Embedder-Policy", "credentialless");
        h.put("Cross-Origin-Resource-Policy", "cross-origin");
        r.setResponseHeaders(h);
        return r;
    }

    /** Coloca a ponte (assets/__ponte.js) no começo de cada página: faz "baixar" e "imprimir" funcionarem em qualquer HTML. */
    private WebResourceResponse comPonte(WebResourceResponse r) {
        try {
            InputStream in = r.getData();
            if (in == null) return r;
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            in.close();
            String html = new String(b.toByteArray(), StandardCharsets.UTF_8);
            String tag = "<script src=\"/assets/__ponte.js\"></script>";
            String baixo = html.toLowerCase();
            int i = baixo.indexOf("<head");
            if (i >= 0) { int f = baixo.indexOf('>', i); html = html.substring(0, f + 1) + tag + html.substring(f + 1); }
            else html = tag + html;
            return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return r;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        if (web != null) web.saveState(saida);
    }

    @Override
    protected void onPause() {
        // avisa a página para salvar tudo antes do app ir para o fundo (ou ser fechado)
        if (web != null) web.evaluateJavascript("try{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('app-pausa'));}catch(e){}", null);
        super.onPause();
        CookieManager.getInstance().flush();
    }

    /** Ponte JavaScript → Android: salva arquivos baixados na pasta Downloads. */
    class Ponte {
        @JavascriptInterface
        public String salvar(String nome, String base64, String tipo) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, nome);
                    cv.put(MediaStore.Downloads.MIME_TYPE, (tipo == null || tipo.isEmpty()) ? "application/octet-stream" : tipo);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (u == null) return "sem acesso a Downloads";
                    try (OutputStream os = getContentResolver().openOutputStream(u)) { os.write(bytes); }
                } else {
                    File pasta = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    try (FileOutputStream os = new FileOutputStream(new File(pasta, nome))) { os.write(bytes); }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Salvo em Downloads: " + nome, Toast.LENGTH_LONG).show());
                return "ok";
            } catch (Exception e) {
                return String.valueOf(e.getMessage());
            }
        }

        @JavascriptInterface
        public void aviso(String m) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_LONG).show());
        }
    }
}
