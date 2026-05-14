package com.kupot.collector;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app APK updater.
 *
 * Downloads an APK from the given URL into the app's cache directory and
 * launches the Android package installer via FileProvider. The user stays
 * inside the app's process context — no browser navigation involved.
 *
 * JS API:
 *   ApkInstaller.installFromUrl({ url: "https://.../collector-1.0.2.apk" })
 *     → resolves with { path } once the installer is launched
 *     → rejects with an error on download / launch failure
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

  @PluginMethod
  public void installFromUrl(final PluginCall call) {
    final String url = call.getString("url");
    if (url == null || url.isEmpty()) {
      call.reject("url is required");
      return;
    }

    // Network + file I/O off the main thread.
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          File apk = downloadToCache(url);
          launchInstaller(apk);
          JSObject ret = new JSObject();
          ret.put("path", apk.getAbsolutePath());
          call.resolve(ret);
        } catch (Exception e) {
          call.reject("APK install failed: " + e.getMessage(), e);
        }
      }
    }).start();
  }

  private File downloadToCache(String urlStr) throws Exception {
    File dir = new File(getContext().getCacheDir(), "updates");
    if (!dir.exists()) dir.mkdirs();

    // Strip query-string so the saved file keeps a clean .apk extension.
    String fileName = "update.apk";
    try {
      String pathOnly = new URL(urlStr).getPath();
      int slash = pathOnly.lastIndexOf('/');
      String tail = slash >= 0 ? pathOnly.substring(slash + 1) : pathOnly;
      if (!tail.isEmpty()) fileName = tail;
    } catch (Exception ignored) { /* keep default */ }

    File out = new File(dir, fileName);
    if (out.exists()) out.delete();

    HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
    conn.setConnectTimeout(20_000);
    conn.setReadTimeout(60_000);
    conn.setInstanceFollowRedirects(true);
    conn.connect();
    int status = conn.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new RuntimeException("HTTP " + status + " while downloading APK");
    }

    InputStream in = conn.getInputStream();
    FileOutputStream fos = new FileOutputStream(out);
    try {
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
      fos.flush();
    } finally {
      try { fos.close(); } catch (Exception ignored) {}
      try { in.close();  } catch (Exception ignored) {}
      conn.disconnect();
    }
    return out;
  }

  private void launchInstaller(File apk) {
    String authority = getContext().getPackageName() + ".fileprovider";
    Uri uri = FileProvider.getUriForFile(getContext(), authority, apk);

    Intent intent = new Intent(Intent.ACTION_VIEW);
    intent.setDataAndType(uri, "application/vnd.android.package-archive");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    // On API 26+ the system uses the in-app installer when the source is
    // granted REQUEST_INSTALL_PACKAGES (declared in AndroidManifest.xml).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    }
    getContext().startActivity(intent);
  }
}
