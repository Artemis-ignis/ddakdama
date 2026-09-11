package app.ddakdama.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.RecognizerIntent
import android.app.Activity
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private var incomingUri by mutableStateOf<Uri?>(null)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    incomingUri = intent?.data
    setContent { DdakDamaMobile(incomingUri) }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    incomingUri = intent.data
  }
}

private const val PUBLIC_WORKER_HOST = "ddakdama.artemis-clunk.workers.dev"
private val DdakBlue = Color(0xFF1769E8)
private val DdakInk = Color(0xFF17233B)
private val DdakMuted = Color(0xFF62708A)
private val DdakSurface = Color(0xFFF7FAFF)
private val DdakBlueSurface = Color(0xFFEAF2FF)

private enum class MobileDestination { HOME, PLAN, COUPANG, EXECUTION }
private data class ExecutionLink(val executionId: String, val claimToken: String)
private data class PlanLink(val planId: String, val accessToken: String? = null, val claimToken: String? = null)
private data class CoupangQueueEntry(val title: String, val url: String)

private fun coupangSearchUrl(query: String): String = Uri.Builder()
  .scheme("https")
  .authority("m.coupang.com")
  .path("np/search")
  .appendQueryParameter("q", query)
  .build()
  .toString()

private fun openExternalCoupang(context: Context, url: String): Boolean {
  if (!isTrustedCoupangUrl(url)) return false
  return runCatching {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
  }.isSuccess
}

private fun executionLink(uri: Uri?): ExecutionLink? {
  if (uri == null) return null
  val executionId = when {
    uri.scheme == "ddakdama" && uri.host == "execute" -> uri.pathSegments.firstOrNull()
    uri.scheme == "https" && uri.host == PUBLIC_WORKER_HOST && uri.pathSegments.take(2) == listOf("open", "execute") -> uri.pathSegments.getOrNull(2)
    else -> null
  } ?: return null
  return uri.getQueryParameter("claim")?.let { ExecutionLink(executionId, it) }
}

private fun planLink(uri: Uri?): PlanLink? {
  if (uri == null) return null
  val planId = when {
    uri.scheme == "ddakdama" && uri.host == "plan" -> uri.pathSegments.firstOrNull()
    uri.scheme == "https" && uri.host == PUBLIC_WORKER_HOST && uri.pathSegments.take(2) == listOf("open", "plan") -> uri.pathSegments.getOrNull(2)
    else -> null
  } ?: return null
  val grant = uri.getQueryParameter("grant")
  val claim = uri.getQueryParameter("claim")
  return if (grant.isNullOrBlank() && claim.isNullOrBlank()) null else PlanLink(planId, grant, claim)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DdakDamaMobile(uri: Uri?) {
  val context = androidx.compose.ui.platform.LocalContext.current
  val api = remember { DdakDamaApi() }
  val scope = rememberCoroutineScope()
  var destination by remember { mutableStateOf(MobileDestination.HOME) }
  var itemEntry by remember { mutableStateOf("") }
  var shoppingItems by remember { mutableStateOf<List<String>>(emptyList()) }
  var plan by remember { mutableStateOf<MobilePlan?>(null) }
  var claimedExecution by remember { mutableStateOf<ClaimedExecution?>(null) }
  var loading by remember { mutableStateOf(false) }
  var selectionSaving by remember { mutableStateOf(false) }
  var message by remember { mutableStateOf<String?>(null) }
  var browserQueue by remember { mutableStateOf<List<CoupangQueueEntry>>(emptyList()) }
  var browserIndex by remember { mutableIntStateOf(0) }
  val voiceLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
    if (result.resultCode == Activity.RESULT_OK) {
      val transcript = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim().orEmpty()
      if (transcript.isNotBlank()) itemEntry = if (itemEntry.isBlank()) transcript else "$itemEntry $transcript"
    } else {
      message = "음성 입력을 사용하지 못했어요. 글자로 입력해 주세요."
    }
  }
  fun startVoiceInput() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
      putExtra(RecognizerIntent.EXTRA_PROMPT, "장볼 상품을 말씀해 주세요")
    }
    runCatching { voiceLauncher.launch(intent) }
      .onFailure { message = "이 기기에서는 음성 입력을 지원하지 않아요. 글자로 입력해 주세요." }
  }

  fun showPlan(loaded: MobilePlan, source: String) {
    plan = loaded
    destination = MobileDestination.PLAN
    message = if (loaded.browserSearchFallback) {
      "$source 목록을 준비했어요. 지금은 쿠팡 검색에서 상품을 직접 골라 확인해 주세요."
    } else {
      "$source 상품 후보를 찾았어요. 원하는 상품을 골라 주세요."
    }
  }

  LaunchedEffect(uri) {
    executionLink(uri)?.let { link ->
      loading = true
      message = "딱담아 계획을 여는 중이에요"
      runCatching { api.claim(context, link.executionId, link.claimToken) }
        .onSuccess {
          claimedExecution = it
          destination = MobileDestination.EXECUTION
          message = "실행 계획 ${it.items.size}개를 불러왔어요. 아래에서 상품과 예상 금액을 확인해 주세요."
        }
        .onFailure { message = executionHandoffErrorMessage(it) }
      loading = false
    }
    planLink(uri)?.let { link ->
      loading = true
      message = "공유한 쇼핑 목록을 여는 중이에요"
      runCatching {
        link.accessToken?.let { api.openPlan(link.planId, it) }
          ?: api.claimPlan(context, link.planId, link.claimToken ?: error("MISSING_CLAIM_TOKEN"))
      }.onSuccess { showPlan(it, "공유한") }
        .onFailure { message = planHandoffErrorMessage(it) }
      loading = false
    }
  }

  val createPlan: () -> Unit = {
    if (shoppingItems.isEmpty() || loading) {
      Unit
    } else {
      scope.launch {
      loading = true
      message = null
      runCatching { api.createPlan(shoppingItems.joinToString("\n")) }
        .onSuccess { showPlan(it, "내") }
        .onFailure { message = "목록을 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요." }
      loading = false
      }
      Unit
    }
  }

  fun openCoupangQueue(entries: List<CoupangQueueEntry>, startAt: Int = 0) {
    if (entries.isEmpty()) return
    browserQueue = entries
    browserIndex = startAt.coerceIn(0, entries.lastIndex)
    destination = MobileDestination.COUPANG
  }

  MaterialTheme {
    Scaffold(
      topBar = {
        CenterAlignedTopAppBar(
          title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Image(painterResource(R.drawable.ddakdama_chatgpt_icon), contentDescription = "딱담아", modifier = Modifier.size(30.dp))
              Spacer(Modifier.width(8.dp))
              Text("딱담아", fontWeight = FontWeight.ExtraBold, letterSpacing = (-1).sp)
            }
          },
          navigationIcon = {
            if (destination == MobileDestination.PLAN) {
              TextButton(onClick = {
                destination = MobileDestination.HOME
                plan = null
                itemEntry = ""
                shoppingItems = emptyList()
                message = null
              }) { Text("‹ 홈", color = DdakBlue) }
            } else if (destination == MobileDestination.COUPANG) {
              TextButton(onClick = { destination = MobileDestination.PLAN }) { Text("‹ 목록", color = DdakBlue) }
            } else if (destination == MobileDestination.EXECUTION) {
              TextButton(onClick = { destination = MobileDestination.HOME; claimedExecution = null }) { Text("‹ 홈", color = DdakBlue) }
            }
          },
          actions = {
            TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.GPT_URL))) }) { Text("GPT", color = DdakBlue) }
          },
          colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = DdakSurface, titleContentColor = DdakInk),
        )
      },
    ) { padding ->
      Box(
        Modifier.fillMaxSize().padding(padding).background(DdakSurface),
      ) {
        when (destination) {
          MobileDestination.HOME -> DdakDamaHome(
            entry = itemEntry,
            items = shoppingItems,
            onEntryChange = { itemEntry = it },
            onAdd = {
              val added = itemEntry.split(',', '\n', '，').map(String::trim).filter(String::isNotBlank)
              if (added.isNotEmpty()) {
                shoppingItems = shoppingItems + added
                itemEntry = ""
              }
            },
            onVoiceInput = ::startVoiceInput,
            onRemove = { index -> shoppingItems = shoppingItems.filterIndexed { itemIndex, _ -> itemIndex != index } },
            onCreate = createPlan,
            onGpt = { prompt ->
              val gptUri = Uri.parse(BuildConfig.GPT_URL).buildUpon()
                .apply { if (prompt.isNotBlank()) appendQueryParameter("q", prompt) }
                .build()
              context.startActivity(Intent(Intent.ACTION_VIEW, gptUri))
            },
            loading = loading,
            message = message,
          )
          MobileDestination.PLAN -> DdakDamaPlan(
            plan = plan,
            loading = loading,
            message = message,
            selectionSaving = selectionSaving,
            onClarify = { itemId, optionId, answerText ->
              val current = plan ?: return@DdakDamaPlan
              scope.launch {
                selectionSaving = true
                runCatching { api.answerClarification(current, itemId, optionId, answerText) }
                  .onSuccess { showPlan(it, "확인한") }
                  .onFailure { message = "확인 내용을 저장하지 못했어요. 다시 시도해 주세요." }
                selectionSaving = false
              }
            },
            onSelect = { itemId, candidateId ->
              val current = plan ?: return@DdakDamaPlan
              scope.launch {
                selectionSaving = true
                runCatching { api.selectCandidate(current, itemId, candidateId) }
                  .onSuccess { showPlan(it, "선택한") }
                  .onFailure { message = "상품 선택을 저장하지 못했어요. 다시 시도해 주세요." }
                selectionSaving = false
              }
            },
            onOpenSearch = { itemIndex, query ->
              val entries = plan?.items?.map { item -> CoupangQueueEntry(item.title, coupangSearchUrl(item.rawText)) }.orEmpty()
              openCoupangQueue(entries, itemIndex)
            },
            onOpenProduct = { title, url -> openCoupangQueue(listOf(CoupangQueueEntry(title, url))) },
            onStartQueue = {
              val entries = plan?.items?.map { item -> CoupangQueueEntry(item.title, coupangSearchUrl(item.rawText)) }.orEmpty()
              openCoupangQueue(entries)
            },
          )
          MobileDestination.COUPANG -> CoupangQueueScreen(
            entries = browserQueue,
            currentIndex = browserIndex,
            onNext = {
              if (browserIndex < browserQueue.lastIndex) browserIndex += 1
              else {
                browserQueue = listOf(CoupangQueueEntry("쿠팡 장바구니", "https://cart.coupang.com/cartView.pang"))
                browserIndex = 0
              }
            },
            onExit = { destination = MobileDestination.PLAN },
            onOpenExternal = { url -> openExternalCoupang(context, url) },
          )
          MobileDestination.EXECUTION -> ExecutionHandoffScreen(
            execution = claimedExecution,
            message = message,
            onExit = { destination = MobileDestination.HOME; claimedExecution = null; message = null },
          )
        }
      }
    }
  }
}

@Composable
private fun DdakDamaHome(
  entry: String,
  items: List<String>,
  onEntryChange: (String) -> Unit,
  onAdd: () -> Unit,
  onVoiceInput: () -> Unit,
  onRemove: (Int) -> Unit,
  onCreate: () -> Unit,
  onGpt: (String) -> Unit,
  loading: Boolean,
  message: String?,
) {
  val prompts = listOf(
    "더운 날 먹기 좋은 간식과 음료를 골라줘",
    "이번 주 저녁 반찬 재료를 담아줘",
    "지성 피부용 기초 화장품을 찾아줘",
  )
  Column(
    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(18.dp),
  ) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text("오늘, 무엇을\n담아드릴까요?", color = DdakInk, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.ExtraBold, letterSpacing = (-2).sp, lineHeight = 42.sp)
      Text("필요한 물건은 바로 목록으로, 추천이 필요하면 대화로 시작하세요.", color = DdakMuted, style = MaterialTheme.typography.bodyLarge, lineHeight = 23.sp)
    }

    Surface(shape = RoundedCornerShape(26.dp), color = Color.White, shadowElevation = 1.dp, tonalElevation = 0.dp) {
      Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("장보기 목록", fontWeight = FontWeight.Bold, color = DdakInk, modifier = Modifier.weight(1f))
          Text("${items.size}개", color = DdakBlue, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
        }
        OutlinedTextField(
          value = entry,
          onValueChange = onEntryChange,
          modifier = Modifier.fillMaxWidth(),
          singleLine = true,
          placeholder = { Text("상품명과 규격을 입력하세요  예: 생수 2L 6병") },
          shape = RoundedCornerShape(16.dp),
          trailingIcon = { TextButton(onClick = onAdd, enabled = entry.isNotBlank()) { Text("추가", color = DdakBlue, fontWeight = FontWeight.Bold) } },
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
          TextButton(onClick = onVoiceInput) { Text("음성 입력", color = DdakBlue, fontWeight = FontWeight.Bold) }
        }
        if (items.isEmpty()) {
          Surface(shape = RoundedCornerShape(16.dp), color = DdakSurface, modifier = Modifier.fillMaxWidth()) {
            Text("필요한 상품을 하나씩 추가해 보세요. 쉼표로 여러 개를 한 번에 넣어도 됩니다.", Modifier.padding(14.dp), color = DdakMuted, style = MaterialTheme.typography.bodySmall)
          }
        } else {
          Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            items.forEachIndexed { index, item ->
              Surface(shape = RoundedCornerShape(14.dp), color = DdakSurface, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                  Surface(shape = CircleShape, color = DdakBlueSurface, modifier = Modifier.size(24.dp)) { Box(contentAlignment = Alignment.Center) { Text("${index + 1}", color = DdakBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp) } }
                  Spacer(Modifier.width(10.dp))
                  Text(item, color = DdakInk, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                  TextButton(onClick = { onRemove(index) }) { Text("삭제", color = DdakMuted) }
                }
              }
            }
          }
        }
        Button(
          onClick = onCreate,
          enabled = items.isNotEmpty() && !loading,
          modifier = Modifier.fillMaxWidth().height(54.dp),
          shape = RoundedCornerShape(16.dp),
          colors = ButtonDefaults.buttonColors(containerColor = DdakBlue),
        ) { Text(if (loading) "상품을 찾는 중…" else "상품 찾기", fontWeight = FontWeight.Bold) }
      }
    }

    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
      Text("추천이 필요하신가요?", color = DdakInk, fontWeight = FontWeight.Bold)
      for (prompt in prompts) {
        AssistChip(
          onClick = { onGpt(prompt) },
          label = { Text(prompt, maxLines = 1, overflow = TextOverflow.Ellipsis) },
          colors = AssistChipDefaults.assistChipColors(containerColor = DdakBlueSurface, labelColor = Color(0xFF2459AB)),
        )
      }
    }

    if (message != null) {
      Surface(shape = RoundedCornerShape(16.dp), color = Color(0xFFEFF6FF)) {
        Text(message, Modifier.padding(14.dp), color = Color(0xFF31547A), style = MaterialTheme.typography.bodyMedium)
      }
    }

    HorizontalDivider(color = Color(0xFFDCE7F7))
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
      Column(Modifier.weight(1f)) {
        Text("GPT로 더 자세히 고르기", color = DdakInk, fontWeight = FontWeight.Bold)
        Text("취향·예산·사용 상황까지 대화로 정리하고 싶을 때", color = DdakMuted, style = MaterialTheme.typography.bodySmall)
      }
      TextButton(onClick = { onGpt("") }) { Text("대화하기", color = DdakBlue) }
    }
    Text("결제 전에는 쿠팡에서 가격·배송·옵션을 직접 확인합니다.", color = DdakMuted, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 26.dp))
  }
}

@Composable
private fun ExecutionHandoffScreen(
  execution: ClaimedExecution?,
  message: String?,
  onExit: () -> Unit,
) {
  Column(
    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 18.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Text("장바구니 실행 계획", color = DdakInk, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1.5).sp)
    Text("상품·수량·예상 금액을 확인한 뒤 진행합니다. 결제와 주문 확정은 실행하지 않습니다.", color = DdakMuted, style = MaterialTheme.typography.bodyMedium, lineHeight = 22.sp)
    if (message != null) Surface(shape = RoundedCornerShape(16.dp), color = DdakBlueSurface) { Text(message, Modifier.padding(14.dp), color = Color(0xFF2459AB)) }
    if (execution == null) {
      Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Text("실행 계획을 불러오지 못했어요. 링크를 다시 열어 주세요.", Modifier.padding(18.dp), color = DdakMuted)
      }
    } else {
      execution.items.forEachIndexed { index, item ->
        Surface(shape = RoundedCornerShape(18.dp), color = Color.White, shadowElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
          Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Surface(shape = CircleShape, color = DdakBlueSurface, modifier = Modifier.size(28.dp)) { Box(contentAlignment = Alignment.Center) { Text("${index + 1}", color = DdakBlue, fontWeight = FontWeight.Bold, fontSize = 13.sp) } }
              Spacer(Modifier.width(9.dp))
              Text(item.title, color = DdakInk, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
              Text(item.status.name, color = if (item.status == RunnerStatus.FAILED) Color(0xFFC83D4A) else DdakBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
            Text(if (item.expectedPriceWon > 0) "예상 상품가 ${item.expectedPriceWon}원" else "가격 확인 필요", color = DdakMuted, style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
    Button(onClick = onExit, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = DdakBlue)) {
      Text("딱담아 홈으로 돌아가기", fontWeight = FontWeight.Bold)
    }
  }
}

@Composable
private fun DdakDamaPlan(
  plan: MobilePlan?,
  loading: Boolean,
  message: String?,
  selectionSaving: Boolean,
  onClarify: (String, String?, String?) -> Unit,
  onSelect: (String, String) -> Unit,
  onOpenSearch: (Int, String) -> Unit,
  onOpenProduct: (String, String) -> Unit,
  onStartQueue: () -> Unit,
) {
  Column(
    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Text("담을 상품을\n골라주세요", color = DdakInk, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1.5).sp)
    Text("규격, 구성, 배송 조건을 보고 최종 선택하세요.", color = DdakMuted, style = MaterialTheme.typography.bodyMedium)
    if (message != null) Surface(shape = RoundedCornerShape(16.dp), color = DdakBlueSurface) { Text(message, Modifier.padding(14.dp), color = Color(0xFF2459AB)) }

    if (loading && plan == null) {
      Surface(shape = RoundedCornerShape(20.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Text("계획을 불러오는 중이에요", Modifier.padding(24.dp), style = MaterialTheme.typography.titleMedium)
      }
    }

    plan?.items?.forEachIndexed { index, item ->
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Surface(shape = CircleShape, color = DdakBlue, modifier = Modifier.size(27.dp)) { Box(contentAlignment = Alignment.Center) { Text("${index + 1}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp) } }
          Spacer(Modifier.width(9.dp))
          Column {
            Text(item.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(item.rawText, color = DdakMuted, style = MaterialTheme.typography.bodySmall)
          }
        }
        if (item.clarification?.status == "REQUIRED") {
          var freeText by remember(item.id) { mutableStateOf("") }
          Surface(shape = RoundedCornerShape(18.dp), color = DdakBlueSurface, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
              Text(item.clarification.question, color = DdakInk, fontWeight = FontWeight.Bold)
              item.clarification.options.forEach { option ->
                OutlinedButton(onClick = { onClarify(item.id, option.id, null) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) { Text(option.label) }
              }
              if (item.clarification.allowFreeText) {
                OutlinedTextField(value = freeText, onValueChange = { freeText = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("원하는 조건을 직접 입력") }, shape = RoundedCornerShape(13.dp))
                Button(onClick = { onClarify(item.id, null, freeText) }, enabled = freeText.isNotBlank() && !selectionSaving, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp), colors = ButtonDefaults.buttonColors(containerColor = DdakBlue)) { Text("이 조건으로 찾기") }
              }
            }
          }
        } else if (item.candidates.isEmpty()) {
          Surface(shape = RoundedCornerShape(18.dp), color = Color.White, shadowElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Text("상품을 확인해 주세요", color = DdakInk, fontWeight = FontWeight.SemiBold)
              Text("쿠팡에서 구성·가격·배송을 확인한 뒤 선택할 수 있어요.", color = DdakMuted, style = MaterialTheme.typography.bodySmall)
              OutlinedButton(onClick = { onOpenSearch(index, item.rawText) }) { Text("쿠팡에서 상품 보기") }
            }
          }
        } else {
          item.candidates.take(3).forEach { candidate ->
            CandidateCard(candidate, candidate.id == item.selectedCandidateId, selectionSaving, { onSelect(item.id, candidate.id) }, onOpenProduct)
          }
        }
        HorizontalDivider(color = Color(0xFFDCE7F7))
      }
    }
    if (!plan?.items.isNullOrEmpty()) {
      Button(
        onClick = onStartQueue,
        modifier = Modifier.fillMaxWidth().height(54.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = DdakBlue),
      ) { Text("쿠팡에서 순서대로 확인하기", fontWeight = FontWeight.Bold) }
    }
    Text("상품마다 쿠팡에서 직접 장바구니에 담은 뒤 다음 상품으로 넘어갑니다. 결제는 쿠팡에서만 진행합니다.", color = DdakMuted, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 26.dp))
  }
}

@Composable
private fun CandidateCard(
  candidate: MobileCandidate,
  selected: Boolean,
  disabled: Boolean,
  onSelect: () -> Unit,
  onOpenProduct: (String, String) -> Unit,
) {
  val border = if (selected) DdakBlue else Color(0xFFDCE7F7)
  Card(
    onClick = onSelect,
    enabled = !disabled,
    shape = RoundedCornerShape(18.dp),
    colors = CardDefaults.cardColors(containerColor = if (selected) DdakBlueSurface else Color.White),
    border = androidx.compose.foundation.BorderStroke(if (selected) 2.dp else 1.dp, border),
  ) {
    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
      Surface(shape = RoundedCornerShape(14.dp), color = DdakBlueSurface, modifier = Modifier.size(68.dp)) {
        if (candidate.imageUrl != null) AsyncImage(candidate.imageUrl, null, Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop)
        else Box(contentAlignment = Alignment.Center) { Text("상품", color = DdakMuted, fontSize = 12.sp) }
      }
      Spacer(Modifier.width(12.dp))
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        if (selected) Text("선택됨", color = DdakBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Text(candidate.title, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
        Text(candidate.priceWon?.let { "${it}원" } ?: "가격 확인 필요", fontWeight = FontWeight.Bold)
        val shipping = candidate.shippingFeeWon?.let { "배송비 ${it}원" } ?: "배송비 확인 필요"
        Text("${candidate.fulfillment} · $shipping", color = DdakMuted, style = MaterialTheme.typography.labelSmall)
      }
    }
    if (selected) {
      TextButton(onClick = { onOpenProduct(candidate.title, candidate.canonicalUrl) }, modifier = Modifier.padding(start = 10.dp, bottom = 7.dp)) { Text("쿠팡 상품 확인") }
    }
  }
}

@Composable
private fun CoupangQueueScreen(
  entries: List<CoupangQueueEntry>,
  currentIndex: Int,
  onNext: () -> Unit,
  onExit: () -> Unit,
  onOpenExternal: (String) -> Boolean,
) {
  val entry = entries.getOrNull(currentIndex) ?: return
  val isCart = entry.url.contains("cart.coupang.com")
  var pageState by remember(entry.url) { mutableStateOf<CoupangPageState>(CoupangPageState.Loading) }
  var externalOpened by remember(entry.url) { mutableStateOf(false) }
  val blocked = pageState as? CoupangPageState.Blocked
  Column(Modifier.fillMaxSize().background(DdakSurface)) {
    Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
      Text(if (isCart) "쿠팡 장바구니" else "쿠팡에서 상품 확인", color = DdakInk, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
      Text(
        if (isCart) "상품과 결제 조건을 쿠팡에서 최종 확인해 주세요."
        else "${currentIndex + 1} / ${entries.size} · ${entry.title}",
        color = DdakMuted,
        style = MaterialTheme.typography.bodyMedium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
    Box(Modifier.weight(1f).fillMaxWidth()) {
      key(entry.url) {
        AndroidView(
          modifier = Modifier.fillMaxSize(),
          factory = { context ->
            WebView(context).apply {
              configureSafeCoupangWebView(this) { state -> pageState = state }
              loadUrl(entry.url)
            }
          },
        )
      }
      if (blocked != null) {
        Surface(
          color = DdakSurface,
          modifier = Modifier.fillMaxSize(),
        ) {
          Column(
            Modifier.padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
          ) {
            Surface(shape = CircleShape, color = DdakBlueSurface, modifier = Modifier.size(48.dp)) {
              Box(contentAlignment = Alignment.Center) { Text("!", color = DdakBlue, fontWeight = FontWeight.ExtraBold) }
            }
            Spacer(Modifier.height(16.dp))
            Text("쿠팡 앱에서 이어서 확인해 주세요", color = DdakInk, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(blocked.message, color = DdakMuted, style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
    }
    Surface(color = Color.White, shadowElevation = 10.dp) {
      Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (isCart) {
          Button(
            onClick = { externalOpened = onOpenExternal(entry.url) || externalOpened },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = DdakBlue),
          ) { Text("쿠팡 장바구니 앱·브라우저로 열기", fontWeight = FontWeight.Bold) }
          TextButton(onClick = onExit, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("딱담아 목록으로 돌아가기", color = DdakMuted) }
        } else if (blocked != null) {
          Text("앱 내부 페이지가 차단되어 자동으로 완료 처리하지 않습니다.", color = DdakMuted, style = MaterialTheme.typography.labelMedium)
          Button(
            onClick = { externalOpened = onOpenExternal(entry.url) || externalOpened },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = DdakBlue),
          ) { Text("쿠팡 앱·브라우저에서 열기", fontWeight = FontWeight.Bold) }
          if (externalOpened) {
            OutlinedButton(onClick = onNext, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(16.dp)) {
              Text(if (currentIndex < entries.lastIndex) "외부에서 확인했어요 · 다음" else "외부에서 확인했어요 · 장바구니 열기", fontWeight = FontWeight.Bold)
            }
          }
          TextButton(onClick = onExit, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("목록으로 돌아가기", color = DdakMuted) }
        } else {
          Text(
            if (pageState == CoupangPageState.Loading) "쿠팡 페이지를 안전하게 확인하는 중입니다."
            else "상품 구성·가격·배송을 확인하고 쿠팡에서 직접 장바구니에 담아 주세요.",
            color = DdakMuted,
            style = MaterialTheme.typography.labelMedium,
          )
          Button(
            onClick = onNext,
            enabled = pageState == CoupangPageState.Ready,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = DdakBlue),
          ) { Text(if (currentIndex < entries.lastIndex) "직접 확인했어요 · 다음 상품" else "직접 확인했어요 · 장바구니 열기", fontWeight = FontWeight.Bold) }
          OutlinedButton(
            onClick = { externalOpened = onOpenExternal(entry.url) || externalOpened },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(16.dp),
          ) { Text("쿠팡 앱·브라우저에서 열기") }
          TextButton(onClick = onExit, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("목록으로 돌아가기", color = DdakMuted) }
        }
      }
    }
  }
}
