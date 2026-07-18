"""Build Devpost-ready 3:2 gallery images from real DdakDama UI captures.

This intentionally composes only source screenshots from the project.  It does
not generate or mock product UI, so every frame in the gallery is traceable to
the running preview or public landing page.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "devpost-gallery" / "source"
OUTPUT = ROOT / "artifacts" / "devpost-gallery" / "upload"
CANVAS = (1800, 1200)  # 3:2, as recommended by Devpost


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"
    return ImageFont.truetype(path, size)


def fit(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    image = image.convert("RGB")
    image.thumbnail(box, Image.Resampling.LANCZOS)
    return image


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *size), radius=radius, fill=255)
    return mask


def background(dark: bool) -> Image.Image:
    base = Image.new("RGB", CANVAS, "#0E1728" if dark else "#F5F8FD")
    glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    color = (40, 115, 255, 90) if dark else (48, 130, 255, 50)
    draw.ellipse((950, -420, 2150, 780), fill=color)
    draw.ellipse((-520, 780, 520, 1740), fill=color)
    return Image.alpha_composite(base.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(90))).convert("RGB")


def add_header(canvas: Image.Image, title: str, subtitle: str, dark: bool) -> None:
    draw = ImageDraw.Draw(canvas)
    primary = "#F8FAFF" if dark else "#0D1B34"
    secondary = "#B6C2D4" if dark else "#60708A"
    icon = fit(Image.open(SOURCE / "icon.png"), (76, 76))
    canvas.paste(icon, (90, 74), icon if icon.mode == "RGBA" else None)
    draw.text((186, 78), "딱담아", font=font(38, True), fill=primary)
    draw.rounded_rectangle((90, 182, 326, 232), radius=25, fill="#196BFF")
    draw.text((117, 193), "OPENAI BUILD WEEK", font=font(20, True), fill="white")
    draw.text((90, 275), title, font=font(58, True), fill=primary)
    draw.text((90, 354), subtitle, font=font(28), fill=secondary)


def panel(canvas: Image.Image, image: Image.Image, anchor: tuple[int, int], dark: bool) -> None:
    x, y = anchor
    img = fit(image, (720, 760))
    shadow = Image.new("RGBA", (img.width + 44, img.height + 44), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((22, 22, img.width + 22, img.height + 22), radius=30, fill=(0, 0, 0, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(shadow, (x - 22, y + 14), shadow)
    card = Image.new("RGB", (img.width + 24, img.height + 24), "#1C2637" if dark else "#FFFFFF")
    card.paste(img, (12, 12))
    canvas.paste(card, (x, y), rounded_mask(card.size, 28))


def single(name: str, source: str, title: str, subtitle: str, dark: bool = False) -> None:
    canvas = background(dark)
    add_header(canvas, title, subtitle, dark)
    panel(canvas, Image.open(SOURCE / source), (975, 220), dark)
    canvas.save(OUTPUT / name, quality=92, optimize=True, progressive=True)


def dual(name: str, left: str, right: str, title: str, subtitle: str, dark: bool = False) -> None:
    canvas = background(dark)
    add_header(canvas, title, subtitle, dark)
    panel(canvas, Image.open(SOURCE / left), (690, 240), dark)
    panel(canvas, Image.open(SOURCE / right), (1225, 355), dark)
    canvas.save(OUTPUT / name, quality=92, optimize=True, progressive=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    single("01-public-landing.jpg", "public-landing.png", "쇼핑 목록을, 정확한 장바구니로.", "공개 랜딩 페이지와 사용자 가치 제안", False)
    single("02-list-parsing.jpg", "list-preview-win32.png", "자연어 목록을 구조화합니다", "제품명·규격·실물 수량을 사용자가 바로 확인", False)
    single("03-chatgpt-handoff.jpg", "gpt-connection-code-preview-win32.png", "ChatGPT에서 이어서 담기", "일회성 페어링 후 검토 계획을 확장 프로그램으로 전달", False)
    single("04-candidate-comparison.jpg", "candidates-preview-win32.png", "후보와 가격을 비교합니다", "비슷한 상품을 숨기지 않고 사용자가 직접 고를 수 있게", False)
    single("05-dark-mode.jpg", "candidates-dark-preview-win32.png", "다크 모드도 자연스럽게", "ChatGPT와 확장 프로그램 환경에서 읽기 쉬운 화면", True)
    single("06-preflight.jpg", "preflight-preview-win32.png", "담기 전에 한 번 더 확인", "규격·묶음 수량·가격·옵션을 사전 검사", False)
    single("07-partial-safety.jpg", "preflight-partial-preview-win32.png", "불확실하면 멈춥니다", "문제 상품을 숨기지 않고, 가능한 항목만 분리", False)
    single("08-result-success.jpg", "result-success-preview-win32.png", "결과를 명확히 보여줍니다", "요청 수량과 실제 추가 결과를 분리해 확인", False)
    single("09-result-partial.jpg", "result-partial-failure-preview-win32.png", "부분 실패도 성공처럼 보이지 않게", "재시도와 상품 페이지 확인 경로를 남김", False)
    dual("10-end-to-end-flow.jpg", "demo-thumbnail.png", "demo-contact-sheet.png", "ChatGPT부터 장바구니 검증까지", "실제 딱담아 화면으로 구성한 전체 흐름", False)
    (OUTPUT / "README-GALLERY-KO.md").write_text(
        "# Devpost 이미지 갤러리\n\n"
        "모든 JPG는 1800×1200(3:2)이며 5MB 미만입니다.\\n\\n"
        "권장 업로드 순서: 01 → 10.\\n"
        "- 01: 공개 랜딩\n- 02: 목록 해석\n- 03: ChatGPT handoff\n- 04: 후보 비교\n- 05: 다크 모드\n- 06: 사전 검사\n- 07: 안전한 부분 처리\n- 08: 완료 결과\n- 09: 실패 결과\n- 10: 전체 흐름\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
