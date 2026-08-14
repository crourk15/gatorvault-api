#!/usr/bin/env python3
"""Generate elite GatorVault App Store QR Instagram graphic (1080x1350)."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import qrcode
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H = 1080, 1350
STORE_URL = "https://apps.apple.com/app/id6783848215"
ORANGE = (250, 70, 22)
UF_BLUE = (0, 33, 165)
WHITE = (255, 255, 255)
SOFT = (220, 228, 238)
MUTED = (168, 184, 204)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "social-exports"
ART_DIR = Path("/opt/cursor/artifacts")

OSWALD = Path("/tmp/fonts/oswald-static/OswaldFont-main/fonts/ttf")
NOTO_B = Path("/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf")
NOTO_R = Path("/usr/share/fonts/truetype/noto/NotoSansDisplay-Regular.ttf")


def fnt(name: str, size: int, fallback: Path) -> ImageFont.FreeTypeFont:
    p = OSWALD / name
    return ImageFont.truetype(str(p if p.exists() else fallback), size)


def measure(draw, font, text):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0], bb[3] - bb[1]


def center(draw, y, text, font, fill):
    tw, _ = measure(draw, font, text)
    draw.text(((W - tw) / 2, y), text, font=font, fill=fill)


def tracked(draw, y, text, font, fill, tracking=0):
    widths = [
        draw.textbbox((0, 0), ch, font=font)[2] - draw.textbbox((0, 0), ch, font=font)[0]
        for ch in text
    ]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = (W - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking


def build_bg() -> Image.Image:
    bg_path = OUT_DIR / "swamp-night-bg-1080x1350.png"
    bg = Image.open(bg_path).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    bg = ImageEnhance.Brightness(bg).enhance(0.72)
    bg = ImageEnhance.Contrast(bg).enhance(1.12)
    bg = ImageEnhance.Color(bg).enhance(1.05)
    arr = np.array(bg).astype(np.float32)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(-1, 1, W)[None, :]
    vig = 1 - (xx**2 * 0.4 + (yy - 0.42) ** 2 * 0.5).clip(0, 1) * 0.55
    arr *= vig[..., None]
    mid = np.exp(-((yy - 0.52) ** 2 * 10))
    arr = arr * (1 - mid * 0.22)[..., None]
    ember = np.exp(-(xx**2 * 1.8 + (yy - 0.08) ** 2 * 10))
    arr[:, :, 0] = np.clip(arr[:, :, 0] + ember * 28, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] + ember * 8, 0, 255)
    bg = Image.fromarray(arr.astype(np.uint8)).convert("RGBA")

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for i in range(300):
        od.line([(0, i), (W, i)], fill=(0, 10, 28, int(145 * (1 - i / 300) ** 1.25)))
    for i in range(280):
        od.line([(0, H - 1 - i), (W, H - 1 - i)], fill=(0, 8, 22, int(175 * (1 - i / 280) ** 1.15)))
    bg = Image.alpha_composite(bg, ov)

    rail = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rail)
    for i, y in enumerate(range(450, 980, 16)):
        rd.rectangle(
            [20, y, 30, y + 9],
            fill=ORANGE + (210,) if i % 2 == 0 else UF_BLUE + (150,),
        )
    return Image.alpha_composite(bg, rail)


def main() -> None:
    img = build_bg()
    draw = ImageDraw.Draw(img)

    f_eye = fnt("Oswald-SemiBold.ttf", 22, NOTO_B)
    f_brand = fnt("Oswald-Bold.ttf", 104, NOTO_B)
    f_ins = fnt("Oswald-Medium.ttf", 30, NOTO_B)
    f_cta = fnt("Oswald-Bold.ttf", 74, NOTO_B)
    f_sub = fnt("Oswald-Regular.ttf", 26, NOTO_R)
    f_hint = fnt("Oswald-Regular.ttf", 23, NOTO_R)
    f_store = fnt("Oswald-Bold.ttf", 30, NOTO_B)
    f_legal = fnt("Oswald-Regular.ttf", 16, NOTO_R)
    f_bar = fnt("Oswald-SemiBold.ttf", 22, NOTO_B)

    center(draw, 68, "UNLOCK THE VAULT", f_eye, (186, 200, 220, 255))
    tracked(draw, 104, "GATORVAULT", f_brand, ORANGE + (255,), tracking=4)
    tracked(draw, 218, "INSIDER", f_ins, WHITE + (255,), tracking=16)
    draw.rectangle([W // 2 - 80, 268, W // 2 - 4, 273], fill=ORANGE + (255,))
    draw.rectangle([W // 2 + 4, 268, W // 2 + 80, 273], fill=UF_BLUE + (255,))
    tracked(draw, 298, "GET THE APP", f_cta, WHITE + (255,), tracking=2)
    center(draw, 384, "UF recruiting   ·   FutureCast   ·   Film", f_sub, SOFT + (245,))

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=14, border=2)
    qr.add_data(STORE_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#001A33", back_color="white").convert("RGB")
    qr_size = 430
    qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.NEAREST)
    pad = 34
    card = qr_size + pad * 2
    cx = W // 2
    card_top = 450

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - 260, card_top - 30, cx + 260, card_top + card + 60], fill=UF_BLUE + (45,))
    gd.ellipse([cx - 180, card_top - 50, cx + 180, card_top + 80], fill=ORANGE + (32,))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(34)))

    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [cx - card // 2 + 12, card_top + 22, cx + card // 2 + 12, card_top + card + 22],
        radius=28,
        fill=(0, 0, 0, 180),
    )
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(24)))

    plate = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle(
        [cx - card // 2 - 3, card_top - 3, cx + card // 2 + 3, card_top + card + 3],
        radius=24,
        fill=ORANGE + (255,),
    )
    pd.rounded_rectangle(
        [cx - card // 2, card_top, cx + card // 2, card_top + card],
        radius=22,
        fill=(255, 255, 255, 255),
    )
    img = Image.alpha_composite(img, plate)
    img.paste(qr_img, (cx - qr_size // 2, card_top + pad))
    draw = ImageDraw.Draw(img)

    by = card_top + card + 40
    center(draw, by, "Scan to download", f_hint, MUTED + (255,))
    center(draw, by + 36, "Available on the App Store", f_store, WHITE + (255,))

    bar_y = H - 112
    bar = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rectangle([0, bar_y, W, bar_y + 58], fill=(3, 10, 24, 235))
    bd.rectangle([0, bar_y, W, bar_y + 3], fill=ORANGE + (255,))
    img = Image.alpha_composite(img, bar)
    draw = ImageDraw.Draw(img)
    bt = "OFFER INTEL   ·   FUTURECAST   ·   FILM ROOM"
    tw, _ = measure(draw, f_bar, bt)
    draw.text(((W - tw) / 2, bar_y + 16), bt, font=f_bar, fill=WHITE + (255,))
    center(
        draw,
        H - 40,
        "GatorVault Media, LLC  ·  Not affiliated with UF",
        f_legal,
        (130, 144, 162, 230),
    )

    rgb = img.convert("RGB")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ART_DIR.mkdir(parents=True, exist_ok=True)
    for path in [
        OUT_DIR / "gatorvault-appstore-qr-ig-1080x1350.png",
        ART_DIR / "gatorvault-appstore-qr-ig-1080x1350.png",
        OUT_DIR / "gatorvault-join-qr-ig-1080x1350.png",
        ART_DIR / "gatorvault-join-qr-ig-1080x1350.png",
    ]:
        rgb.save(path, "PNG", optimize=True)
        print("wrote", path)
    for path in [
        OUT_DIR / "gatorvault-appstore-qr.png",
        ART_DIR / "gatorvault-appstore-qr.png",
        OUT_DIR / "gatorvault-join-qr.png",
        ART_DIR / "gatorvault-join-qr.png",
    ]:
        qr_img.save(path)

    data, _, _ = cv2.QRCodeDetector().detectAndDecode(np.array(rgb)[:, :, ::-1])
    print("decode:", repr(data))
    if data != STORE_URL:
        raise SystemExit(f"QR decode mismatch: {data!r}")


if __name__ == "__main__":
    main()
