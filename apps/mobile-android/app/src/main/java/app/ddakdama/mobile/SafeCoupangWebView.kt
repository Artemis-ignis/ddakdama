package app.ddakdama.mobile

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONTokener

private val allowedCoupangHosts = setOf("www.coupang.com", "m.coupang.com", "cart.coupang.com", "link.coupang.com")

sealed interface CoupangPageState {
  data object Loading : CoupangPageState
  data object Ready : CoupangPageState
  data class Blocked(val message: String) : CoupangPageState
}

internal fun isTrustedCoupangUrl(rawUrl: String): Boolean = runCatching {
  val url = java.net.URI(rawUrl)
  url.scheme == "https" && url.host in allowedCoupangHosts
}.getOrDefault(false)

internal fun isCoupangBlockSignal(value: String): Boolean {
  val normalized = value.lowercase()
  return normalized.contains("access denied") ||
    normalized.contains("permission to access") ||
    normalized.contains("errors.edgesuite.net") ||
    normalized.contains("사용권한이 없습니다") ||
    normalized.contains("사용권한이 제한")
}

@SuppressLint("SetJavaScriptEnabled")
fun configureSafeCoupangWebView(
  webView: WebView,
  onStateChange: (CoupangPageState) -> Unit = {},
) {
  with(webView.settings) {
    javaScriptEnabled = true
    domStorageEnabled = true
    allowFileAccess = false
    allowContentAccess = false
    mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
  }
  WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
  webView.webViewClient = object : WebViewClient() {
    private var mainFrameFailed = false

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
      mainFrameFailed = false
      onStateChange(CoupangPageState.Loading)
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      val url = request.url
      if (url.scheme == "file" && url.path == "/android_asset/fixture-coupang.html") return false
      val allowed = url.scheme == "https" && url.host in allowedCoupangHosts
      if (!allowed && request.isForMainFrame) {
        mainFrameFailed = true
        onStateChange(CoupangPageState.Blocked("쿠팡이 앱 내부에서 이 페이지 열기를 허용하지 않았습니다."))
      }
      return !allowed
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
      if (!request.isForMainFrame) return
      mainFrameFailed = true
      onStateChange(CoupangPageState.Blocked("쿠팡 페이지를 불러오지 못했습니다. 외부 쿠팡 앱이나 브라우저에서 확인해 주세요."))
    }

    override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
      if (!request.isForMainFrame || errorResponse.statusCode < 400) return
      mainFrameFailed = true
      val message = if (errorResponse.statusCode == 401 || errorResponse.statusCode == 403) {
        "쿠팡이 앱 안에서 이 페이지 열기를 제한했습니다."
      } else {
        "쿠팡 페이지에서 오류가 발생했습니다."
      }
      onStateChange(CoupangPageState.Blocked(message))
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
      handler.cancel()
      mainFrameFailed = true
      onStateChange(CoupangPageState.Blocked("안전한 연결을 확인할 수 없어 페이지를 열지 않았습니다."))
    }

    override fun onPageFinished(view: WebView, url: String?) {
      if (mainFrameFailed) return
      view.evaluateJavascript(
        "(function(){return ((document.title||'')+'\\n'+(document.body&&document.body.innerText||'').slice(0,1200)+'\\n'+Array.from(document.querySelectorAll('img[alt]')).slice(0,8).map(function(i){return i.alt;}).join(' '));})()",
      ) { rawValue ->
        if (mainFrameFailed) return@evaluateJavascript
        val visibleText = runCatching { JSONTokener(rawValue).nextValue() as? String }.getOrNull().orEmpty()
        if (isCoupangBlockSignal(visibleText)) {
          mainFrameFailed = true
          onStateChange(CoupangPageState.Blocked("쿠팡이 앱 안에서 이 페이지 열기를 제한했습니다."))
        } else {
          onStateChange(CoupangPageState.Ready)
        }
      }
    }
  }
}
