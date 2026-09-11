package app.ddakdama.mobile

internal fun planHandoffErrorMessage(error: Throwable): String = when ((error as? DdakDamaApiException)?.errorCode) {
  "invalid_or_expired_claim", "not_found" -> "공유 링크가 만료됐거나 이미 사용되었습니다. 딱담아에서 새 링크를 만들어 주세요."
  "rate_limited" -> "요청이 잠시 많습니다. 잠깐 뒤 다시 열어 주세요."
  "unauthorized" -> "이 기기의 딱담아 연결을 다시 준비하지 못했습니다. 앱을 다시 열어 주세요."
  else -> "공유 목록을 열지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요."
}

internal fun executionHandoffErrorMessage(error: Throwable): String = when ((error as? DdakDamaApiException)?.errorCode) {
  "invalid_or_expired_claim", "not_found", "already_claimed_or_expired" -> "실행 링크가 만료됐거나 다른 기기에서 사용되었습니다. 새 실행 링크를 만들어 주세요."
  "rate_limited" -> "요청이 잠시 많습니다. 잠깐 뒤 다시 열어 주세요."
  "unauthorized" -> "이 기기의 딱담아 연결을 다시 준비하지 못했습니다. 앱을 다시 열어 주세요."
  else -> "실행 계획을 열지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요."
}
