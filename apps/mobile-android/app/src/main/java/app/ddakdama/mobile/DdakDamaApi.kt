package app.ddakdama.mobile

import android.content.Context
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MobileInstallation(val id: String, val token: String)
data class ShoppingListSuggestion(val text: String)

class DdakDamaApiException(
  val statusCode: Int,
  val errorCode: String,
) : IllegalStateException(errorCode)

data class ClaimedExecution(
  val id: String,
  val items: List<FixtureCartItem>,
)

data class MobileCandidate(
  val id: String,
  val title: String,
  val priceWon: Int?,
  val imageUrl: String?,
  val seller: String?,
  val fulfillment: String,
  val shippingFeeWon: Int?,
  val deliveryPromise: String?,
  val deliveryCertainty: String,
  val affiliateVerified: Boolean,
  val canonicalUrl: String,
)

data class MobileClarificationOption(val id: String, val label: String)

data class MobileClarification(
  val status: String,
  val question: String,
  val options: List<MobileClarificationOption>,
  val allowFreeText: Boolean,
)

data class MobilePlanItem(
  val id: String,
  val title: String,
  val rawText: String,
  val selectedCandidateId: String?,
  val candidates: List<MobileCandidate>,
  val clarification: MobileClarification?,
)

data class MobilePlan(
  val id: String,
  val accessToken: String,
  val version: Int,
  val items: List<MobilePlanItem>,
  val browserSearchFallback: Boolean,
)

internal fun restoredShoppingText(product: String, size: String?, strength: String?, content: String?, quantity: Int): String =
  listOfNotNull(product, size, strength, content, "${quantity.coerceAtLeast(1)}개")
    .filter { it.isNotBlank() }.joinToString(" ")

private fun JSONObject.optionalText(key: String): String? =
  optString(key, "").trim().takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }

/**
 * The app owns only its DdakDama device token. Coupang credentials, cookies,
 * and payment data never leave WebView and are never sent through this client.
 */
class DdakDamaApi(private val origin: String = BuildConfig.API_ORIGIN) {
  private fun preferences(context: Context) = EncryptedSharedPreferences.create(
    context,
    "ddakdama-mobile",
    MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  suspend fun installation(context: Context): MobileInstallation = withContext(Dispatchers.IO) {
    val preferences = preferences(context)
    val existingId = preferences.getString("installation_id", null)
    val existingToken = preferences.getString("device_token", null)
    if (existingId != null && existingToken != null) return@withContext MobileInstallation(existingId, existingToken)

    val response = request("POST", "/api/mobile/installations/register", null, "{}")
    val installation = MobileInstallation(
      response.getString("installationId"),
      response.getString("deviceToken"),
    )
    preferences.edit()
      .putString("installation_id", installation.id)
      .putString("device_token", installation.token)
      .apply()
    installation
  }

  private fun forgetInstallation(context: Context) {
    preferences(context).edit()
      .remove("installation_id")
      .remove("device_token")
      .commit()
  }

  private suspend fun <T> withInstallationRetry(
    context: Context,
    operation: (MobileInstallation) -> T,
  ): T {
    val current = installation(context)
    return try {
      operation(current)
    } catch (error: DdakDamaApiException) {
      if (error.statusCode != 401) throw error
      forgetInstallation(context)
      operation(installation(context))
    }
  }

  suspend fun createPlan(shoppingList: String): MobilePlan = withContext(Dispatchers.IO) {
    val created = request(
      "POST",
      "/api/plans",
      null,
      JSONObject().put("shoppingList", shoppingList).toString(),
    )
    val token = created.getString("accessToken")
    val plan = created.getJSONObject("plan")
    val resolved = request("POST", "/api/plans/${plan.getString("id")}/resolve", token, "{}")
    mobilePlan(resolved.getJSONObject("plan"), token, resolved.optString("fallback") == "BROWSER_SEARCH")
  }

  suspend fun suggestShoppingList(instruction: String, currentList: String): ShoppingListSuggestion = withContext(Dispatchers.IO) {
    val response = request(
      "POST",
      "/api/ai/shopping-list",
      null,
      JSONObject().put("instruction", instruction).put("currentList", currentList).toString(),
    )
    if (!response.optBoolean("available", false)) throw IllegalStateException(response.optString("error", "AI_PROVIDER_UNAVAILABLE"))
    ShoppingListSuggestion(response.getString("suggestedShoppingList"))
  }

  /** Claims only a short-lived plan handoff. The Android device receives its
   * own capability; the ChatGPT widget capability is never embedded in a URL. */
  suspend fun claimPlan(context: Context, planId: String, claimToken: String): MobilePlan = withContext(Dispatchers.IO) {
    val claimed = withInstallationRetry(context) { installation ->
      request(
        "POST",
        "/api/plans/$planId/claim",
        installation.token,
        JSONObject().put("claimToken", claimToken).toString(),
      )
    }
    val token = claimed.getString("accessToken")
    val resolved = request("POST", "/api/plans/$planId/resolve", token, "{}")
    mobilePlan(resolved.getJSONObject("plan"), token, resolved.optString("fallback") == "BROWSER_SEARCH")
  }

  /** Opens a plan link created by the web beta or Custom GPT. The grant is
   * scoped only to this one plan; it is not an Android device credential. */
  suspend fun openPlan(planId: String, accessToken: String): MobilePlan = withContext(Dispatchers.IO) {
    val opened = request("GET", "/api/plans/$planId", accessToken, "")
    val resolved = request("POST", "/api/plans/$planId/resolve", accessToken, "{}")
    val plan = resolved.optJSONObject("plan") ?: opened.getJSONObject("plan")
    mobilePlan(plan, accessToken, resolved.optString("fallback") == "BROWSER_SEARCH")
  }

  suspend fun selectCandidate(plan: MobilePlan, itemId: String, candidateId: String): MobilePlan = withContext(Dispatchers.IO) {
    val selections = JSONObject()
    plan.items.forEach { item ->
      val selected = if (item.id == itemId) candidateId else item.selectedCandidateId
      if (selected != null) selections.put(item.id, selected)
    }
    val response = request(
      "PATCH",
      "/api/plans/${plan.id}",
      plan.accessToken,
      JSONObject().put("expectedVersion", plan.version).put("selectedCandidateIds", selections).toString(),
    )
    mobilePlan(response.getJSONObject("plan"), plan.accessToken, false)
  }

  suspend fun answerClarification(plan: MobilePlan, itemId: String, optionId: String? = null, answerText: String? = null): MobilePlan = withContext(Dispatchers.IO) {
    val body = JSONObject().put("itemId", itemId)
    if (optionId != null) body.put("optionId", optionId)
    if (answerText != null) body.put("answerText", answerText)
    val answered = request("POST", "/api/plans/${plan.id}/clarify", plan.accessToken, body.toString())
    val resolved = request("POST", "/api/plans/${plan.id}/resolve", plan.accessToken, "{}")
    mobilePlan(resolved.getJSONObject("plan"), plan.accessToken, resolved.optString("fallback") == "BROWSER_SEARCH")
  }

  suspend fun prepareAffiliateLinks(plan: MobilePlan): MobilePlan = withContext(Dispatchers.IO) {
    val response = request("POST", "/api/plans/${plan.id}/finalize-affiliate-links", plan.accessToken, "{}")
    mobilePlan(response.getJSONObject("plan"), plan.accessToken, response.optString("fallback") == "CANONICAL_URL")
  }

  suspend fun createAndClaimExecution(context: Context, plan: MobilePlan, userApproved: Boolean): ClaimedExecution = withContext(Dispatchers.IO) {
    if (!userApproved) throw IllegalStateException("USER_APPROVAL_REQUIRED")
    val preflight = request("POST", "/api/plans/${plan.id}/preflight", plan.accessToken, "{}")
    if (!preflight.optBoolean("ok", false)) throw IllegalStateException("PREFLIGHT_BLOCKED")
    val preflightToken = preflight.optString("preflightToken").takeIf { it.isNotBlank() }
      ?: throw IllegalStateException("PREFLIGHT_TOKEN_MISSING")
    val created = request(
      "POST",
      "/api/executions",
      plan.accessToken,
      JSONObject()
        .put("planId", plan.id)
        .put("planVersion", plan.version)
        .put("allowCanonicalFallback", true)
        .put("userApproved", true)
        .put("preflightToken", preflightToken)
        .put("executionMode", "BATCH_CART_ADD")
        .toString(),
    )
    val executionId = created.getJSONObject("execution").getString("id")
    val link = request("POST", "/api/executions/$executionId/claim-link", plan.accessToken, "{}")
    val appLink = Uri.parse(link.getString("appLink"))
    val claimToken = appLink.getQueryParameter("claim") ?: throw IllegalStateException("MISSING_CLAIM_TOKEN")
    claim(context, executionId, claimToken)
  }

  suspend fun claim(context: Context, executionId: String, claimToken: String): ClaimedExecution = withContext(Dispatchers.IO) {
    val response = withInstallationRetry(context) { installation ->
      request(
        "POST",
        "/api/executions/$executionId/claim",
        installation.token,
        JSONObject().put("claimToken", claimToken).toString(),
      )
    }
    val execution = response.getJSONObject("execution")
    val items = execution.getJSONArray("items")
    ClaimedExecution(
      id = execution.getString("id"),
      items = List(items.length()) { index ->
        val item = items.getJSONObject(index)
        val candidate = item.getJSONObject("candidate")
        FixtureCartItem(
          productId = candidate.getString("productId"),
          title = candidate.getString("title"),
          expectedPriceWon = candidate.optInt("currentPrice", 0),
          executionId = execution.getString("id"),
          executionItemId = item.getString("id"),
        )
      },
    )
  }

  suspend fun report(context: Context, item: FixtureCartItem, message: String? = null) = withContext(Dispatchers.IO) {
    val executionId = item.executionId ?: return@withContext
    val executionItemId = item.executionItemId ?: return@withContext
    withInstallationRetry(context) { installation ->
      request(
        "PATCH",
        "/api/executions/$executionId/items/$executionItemId",
        installation.token,
        JSONObject().put("status", item.status.apiValue).put("message", message).toString(),
      )
    }
  }

  private fun request(method: String, path: String, deviceToken: String?, body: String): JSONObject {
    val connection = (URL(origin.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = 12_000
      readTimeout = 12_000
      setRequestProperty("content-type", "application/json")
      if (deviceToken != null) setRequestProperty("authorization", "Bearer $deviceToken")
      doOutput = method != "GET"
    }
    return try {
      if (connection.doOutput) connection.outputStream.bufferedWriter().use { it.write(body) }
      val statusCode = connection.responseCode
      val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
      val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
      val response = runCatching { JSONObject(text) }
        .getOrElse { JSONObject().put("error", "INVALID_RESPONSE") }
      if (statusCode !in 200..299) {
        throw DdakDamaApiException(statusCode, response.optString("error", "REQUEST_FAILED"))
      }
      response
    } finally {
      connection.disconnect()
    }
  }

  private fun mobilePlan(raw: JSONObject, accessToken: String, browserSearchFallback: Boolean): MobilePlan {
    val items = raw.getJSONArray("items")
    return MobilePlan(
      id = raw.getString("id"),
      accessToken = accessToken,
      version = raw.getInt("version"),
      browserSearchFallback = browserSearchFallback,
      items = List(items.length()) { index ->
        val item = items.getJSONObject(index)
        val request = item.getJSONObject("request")
        val candidates = item.getJSONArray("candidates")
        MobilePlanItem(
          id = item.getString("id"),
          title = request.getString("productName"),
          // Original prose is deliberately redacted unless the user consents.
          // Search with the structured product, specs and current quantity.
          rawText = restoredShoppingText(
            request.getString("productName"),
            if (!request.isNull("unitSizeValue")) request.optString("unitSizeValue") + request.optString("unitSizeUnit") else null,
            if (!request.isNull("strengthValue")) request.optString("strengthValue") + request.optString("strengthUnit") else null,
            if (!request.isNull("packageContentCount")) request.optString("packageContentCount") + request.optString("packageContentUnit") else null,
            request.optInt("requestedPhysicalUnits", 1),
          ),
          selectedCandidateId = item.optString("selectedCandidateId").takeIf { it.isNotBlank() },
          clarification = item.optJSONObject("clarification")?.let { clarification ->
            val options = clarification.optJSONArray("options")
            MobileClarification(
              status = clarification.optString("status", "REQUIRED"),
              question = clarification.optString("question", "원하는 조건을 알려주시겠어요?"),
              options = options?.let { values -> List(values.length()) { optionIndex ->
                val option = values.getJSONObject(optionIndex)
                MobileClarificationOption(option.optString("id"), option.optString("label"))
              } } ?: emptyList(),
              allowFreeText = clarification.optBoolean("allowFreeText", true),
            )
          },
          candidates = List(candidates.length()) { candidateIndex ->
            val candidate = candidates.getJSONObject(candidateIndex)
            MobileCandidate(
              id = candidate.getString("id"),
              title = candidate.getString("title"),
              priceWon = candidate.optInt("currentPrice", 0).takeIf { it > 0 },
              imageUrl = candidate.optionalText("imageUrl"),
              seller = candidate.optionalText("seller"),
              fulfillment = candidate.optString("fulfillmentType", "UNKNOWN"),
              shippingFeeWon = candidate.optInt("shippingFee", -1).takeIf { it >= 0 },
              deliveryPromise = candidate.optionalText("deliveryPromise"),
              deliveryCertainty = candidate.optString("deliveryCertainty", "UNKNOWN"),
              affiliateVerified = candidate.optBoolean("affiliateVerified", false),
              canonicalUrl = candidate.getString("canonicalUrl"),
            )
          },
        )
      },
    )
  }
}
