package app.ddakdama.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class MobileSafetyTest {
  @Test
  public void detectsCoupangAccessDeniedPages() {
    assertTrue(SafeCoupangWebViewKt.isCoupangBlockSignal("Access Denied - You don't have permission to access this page"));
    assertTrue(SafeCoupangWebViewKt.isCoupangBlockSignal("Reference errors.edgesuite.net"));
    assertFalse(SafeCoupangWebViewKt.isCoupangBlockSignal("쿠팡 상품 상세 페이지"));
    assertTrue(SafeCoupangWebViewKt.isCoupangBlockSignal("요청하신 페이지의 사용권한이 없습니다."));
  }

  @Test
  public void restoresSearchTextWithoutUsingRedactedRawProse() {
    assertEquals("닥터스베스트 고흡수 마그네슘 100mg 240정 1개",
      DdakDamaApiKt.restoredShoppingText("닥터스베스트 고흡수 마그네슘", null, "100mg", "240정", 1));
    assertEquals("스킨1004 선 세럼 50mL 4개",
      DdakDamaApiKt.restoredShoppingText("스킨1004 선 세럼", "50mL", null, null, 4));
  }

  @Test
  public void onlyAllowsTrustedHttpsCoupangUrlsForExternalHandoff() {
    assertTrue(SafeCoupangWebViewKt.isTrustedCoupangUrl("https://m.coupang.com/np/search?q=water"));
    assertTrue(SafeCoupangWebViewKt.isTrustedCoupangUrl("https://cart.coupang.com/cartView.pang"));
    assertFalse(SafeCoupangWebViewKt.isTrustedCoupangUrl("http://www.coupang.com/np/search?q=water"));
    assertFalse(SafeCoupangWebViewKt.isTrustedCoupangUrl("https://coupang.example.com/steal"));
  }

  @Test
  public void explainsExpiredAndNetworkPlanLinksDifferently() {
    assertEquals(
      "공유 링크가 만료됐거나 이미 사용되었습니다. 딱담아에서 새 링크를 만들어 주세요.",
      MobileErrorMessagesKt.planHandoffErrorMessage(new DdakDamaApiException(404, "invalid_or_expired_claim"))
    );
    assertEquals(
      "공유 목록을 열지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
      MobileErrorMessagesKt.planHandoffErrorMessage(new IllegalStateException("network"))
    );
  }
}
