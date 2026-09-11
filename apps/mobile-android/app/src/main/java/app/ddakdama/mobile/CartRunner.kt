package app.ddakdama.mobile

import android.webkit.WebView
import org.json.JSONObject

enum class RunnerStatus {
  PENDING, VERIFYING_PRODUCT, ADDING_TO_CART, ADDED, PAUSED_FOR_USER, FAILED;

  val apiValue: String
    get() = when (this) {
      PENDING -> "PENDING"
      VERIFYING_PRODUCT -> "VERIFYING_PRODUCT"
      ADDING_TO_CART -> "ADDING_TO_CART"
      ADDED -> "ADDED"
      PAUSED_FOR_USER -> "OPTION_REQUIRED"
      FAILED -> "FAILED"
    }
}

data class FixtureCartItem(
  val productId: String,
  val title: String,
  val expectedPriceWon: Int,
  val status: RunnerStatus = RunnerStatus.PENDING,
  val executionId: String? = null,
  val executionItemId: String? = null,
)

/**
 * This runner deliberately executes only a bundled fixture. A live Coupang
 * adapter may be enabled only after policy and real-device verification.
 */
class FixtureCartRunner(private val webView: WebView) {
  fun add(item: FixtureCartItem, onResult: (FixtureCartItem) -> Unit) {
    val productId = JSONObject.quote(item.productId)
    val title = JSONObject.quote(item.title)
    val price = item.expectedPriceWon.coerceAtLeast(0)
    val script = """(() => {
      const card = document.querySelector('[data-product-id]');
      const priceNode = document.querySelector('#price');
      const count = document.querySelector('#count');
      const button = document.querySelector('#cart');
      if (!card || !priceNode || !count || !button) return JSON.stringify({ok:false,reason:'FIXTURE_MISSING'});
      card.dataset.productId = $productId; card.textContent = $title; priceNode.textContent = String($price); count.textContent = '0';
      if (card.dataset.productId !== $productId) return JSON.stringify({ok:false,reason:'PRODUCT_MISMATCH'});
      button.click();
      return JSON.stringify({ok:count.textContent === '1',price:priceNode.textContent,count:count.textContent});
    })()"""
    webView.evaluateJavascript(script) { raw ->
      val result = runCatching { JSONObject(raw.removeSurrounding("\"").replace("\\\"", "\"")) }.getOrNull()
      onResult(item.copy(status = if (result?.optBoolean("ok") == true) RunnerStatus.ADDED else RunnerStatus.FAILED))
    }
  }
}
