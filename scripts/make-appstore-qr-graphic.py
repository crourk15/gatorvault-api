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
SOFT = (214, 224, 238)
MUTED = (160, 178, 200)

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


def build_bg(src: Image.Image) -> Image.Image:
    arr = np.zeros((H, W, 3), dtype=np.float32)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(-1, 1, W)[None, :]
    arr[:, :, 0] = 5 + yy * 6
    arr[:, :, 1] = 14 + (1 - yy) * 10
    arr[:, :, 2] = 32 + np.clip(1 - abs(yy - 0.32) * 1.4, 0, 1) * 36
    spot = np.exp(-(xx**2 * 1.35 + (yy - 0.5) ** 2 * 2.0))
    arr[:, :, 0] += spot * 16
    arr[:, :, 1] += spot * 24
    arr[:, :, 2] += spot * 58
    ember = np.exp(-(xx**2 * 2.5 + (yy - 0.08) ** 2 * 8))
    arr[:, :, 0] = np.clip(arr[:, :, 0] + ember * 72, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] + ember * 18, 0, 255)
    turf = np.exp(-(xx**2 * 0.85 + (yy - 0.97) ** 2 * 14))
    arr[:, :, 0] = np.clip(arr[:, :, 0] + turf * 50, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] + turf * 14, 0, 255)
    vig = 1 - (xx**2 * 0.45 + (yy - 0.45) ** 2 * 0.55).clip(0, 1) * 0.55
    arr *= vig[..., None]
    bg = Image.fromarray(arr.astype(np.uint8)).convert("RGBA")

    field = src.crop((120, 1220, 960, 1350)).resize((W, 220), Image.Resampling.LANCZOS)
    field = ImageEnhance.Brightness(field).enhance(0.75)
    field = ImageEnhance.Color(field).enhance(0.85).convert("RGBA")
    fy2 = np.linspace(0, 1, field.height).reshape(-1, 1)
    fa = (255 * np.clip(fy2, 0, 1)).astype(np.float32)
    fa = np.repeat(fa, field.width, axis=1)
    field.putalpha(Image.fromarray(fa.astype(np.uint8)))
    bg.alpha_composite(field, (0, H - 210))

    brick = src.crop((900, 220, 1080, 400)).resize((420, 380), Image.Resampling.LANCZOS)
    brick = brick.filter(ImageFilter.GaussianBlur(10))
    brick = ImageEnhance.Brightness(brick).enhance(0.4)
    brick = ImageEnhance.Color(brick).enhance(0.35).convert("RGBA")
    bm = Image.new("L", brick.size, 0)
    ImageDraw.Draw(bm).ellipse([(-60, -40), (brick.width + 40, brick.height + 60)], fill=160)
    brick.putalpha(bm.filter(ImageFilter.GaussianBlur(35)))
    bg.alpha_composite(brick, (W - 400, 40))

    lights = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lights)
    for x, y, r, a in [
        (140, 100, 20, 55), (240, 70, 12, 42), (920, 95, 18, 50), (1000, 140, 11, 38),
        (180, 180, 8, 30), (780, 60, 10, 34), (640, 110, 8, 28), (420, 55, 13, 36), (860, 170, 7, 26),
    ]:
        ld.ellipse([x - r, y - r, x + r, y + r], fill=(255, 205, 150, a))
    bg = Image.alpha_composite(bg, lights.filter(ImageFilter.GaussianBlur(7)))

    wm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(wm).text(
        (W // 2 - 155, H // 2 - 210),
        "F",
        font=fnt("Oswald-Bold.ttf", 580, NOTO_B),
        fill=ORANGE + (14,),
    )
    bg = Image.alpha_composite(bg, wm)

    rng = np.random.default_rng(11)
    grain = (rng.random((H, W)) * 30).astype(np.uint8)
    gimg = Image.fromarray(np.stack([grain] * 3, -1)).convert("RGBA")
    gimg.putalpha(16)
    bg = Image.alpha_composite(bg, gimg)

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for i in range(250):
        od.line([(0, i), (W, i)], fill=(0, 10, 26, int(135 * (1 - i / 250) ** 1.35)))
    for i in range(230):
        od.line([(0, H - 1 - i), (W, H - 1 - i)], fill=(0, 8, 20, int(155 * (1 - i / 230) ** 1.2)))
    return Image.alpha_composite(bg, ov)


def main() -> None:
    src_path = OUT_DIR / "izayah-vickers-ig-boost-1080x1350.png"
    src = Image.open(src_path).convert("RGB")
    img = build_bg(src)
    draw = ImageDraw.Draw(img)

    f_eye = fnt("Oswald-SemiBold.ttf", 20, NOTO_B)
    f_brand = fnt("Oswald-Bold.ttf", 102, NOTO_B)
    f_ins = fnt("Oswald-Medium.ttf", 28, NOTO_B)
    f_cta = fnt("Oswald-Bold.ttf", 72, NOTO_B)
    f_sub = fnt("Oswald-Regular.ttf", 25, NOTO_R)
    f_hint = fnt("Oswald-Regular.ttf", 22, NOTO_R)
    f_store = fnt("Oswald-Bold.ttf", 28, NOTO_B)
    f_legal = fnt("Oswald-Regular.ttf", 16, NOTO_R)
    f_bar = fnt("Oswald-SemiBold.ttf", 22, NOTO_B)
    f_gv = fnt("Oswald-Bold.ttf", 32, NOTO_B)
    f_meta = fnt("Oswald-SemiBold.ttf", 18, NOTO_B)

    center(draw, 56, "UNLOCK THE VAULT", f_eye, (176, 192, 216, 255))
    tracked(draw, 92, "GATORVAULT", f_brand, ORANGE + (255,), tracking=5)
    tracked(draw, 202, "INSIDER", f_ins, WHITE + (255,), tracking=14)
    draw.rectangle([W // 2 - 74, 248, W // 2 - 4, 252], fill=ORANGE + (255,))
    draw.rectangle([W // 2 + 4, 248, W // 2 + 74, 252], fill=UF_BLUE + (255,))
    tracked(draw, 274, "GET THE APP", f_cta, WHITE + (255,), tracking=2)
    center(draw, 356, "UF recruiting   ·   FutureCast   ·   Film", f_sub, SOFT + (245,))

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=14, border=2)
    qr.add_data(STORE_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#001A33", back_color="white").convert("RGB")
    qr_size = 400
    qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.NEAREST)
    pad = 28
    inner = qr_size + pad * 2
    top_chrome, bot_chrome, side = 56, 16, 22
    frame_w = inner + side * 2
    frame_h = top_chrome + inner + bot_chrome
    cx = W // 2
    fy0 = 418
    fx0, fx1 = cx - frame_w // 2, cx + frame_w // 2
    fy1 = fy0 + frame_h

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - 290, fy0 + 50, cx + 290, fy1 + 50], fill=UF_BLUE + (42,))
    gd.ellipse([cx - 210, fy0 - 40, cx + 210, fy0 + 110], fill=ORANGE + (30,))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(32)))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [fx0 + 10, fy0 + 20, fx1 + 10, fy1 + 20], radius=22, fill=(0, 0, 0, 170)
    )
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(18)))

    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([fx0 - 3, fy0 - 3, fx1 + 3, fy1 + 3], radius=20, fill=UF_BLUE + (255,))
    fd.rounded_rectangle([fx0, fy0, fx1, fy1], radius=18, fill=(8, 20, 40, 248))
    fd.rectangle([fx0 + 12, fy0 + 8, fx1 - 12, fy0 + 12], fill=ORANGE + (255,))
    for i, y in enumerate(range(fy0 + 38, fy1 - 16, 15)):
        fd.rectangle(
            [fx0 + 5, y, fx0 + 11, y + 7],
            fill=ORANGE + (210,) if i % 2 == 0 else (255, 255, 255, 35),
        )
    fd.rounded_rectangle([fx0 + 16, fy0 + 20, fx0 + 78, fy0 + 50], radius=6, fill=UF_BLUE + (255,))
    img = Image.alpha_composite(img, frame)
    draw = ImageDraw.Draw(img)
    draw.text((fx0 + 28, fy0 + 21), "GV", font=f_gv, fill=ORANGE + (255,))
    draw.text((fx0 + 90, fy0 + 26), "APP STORE", font=f_meta, fill=(205, 216, 230, 255))

    plate_x = cx - inner // 2
    plate_y = fy0 + top_chrome
    pl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pl)
    pd.rounded_rectangle(
        [plate_x - 2, plate_y - 2, plate_x + inner + 2, plate_y + inner + 2],
        radius=12,
        fill=ORANGE + (255,),
    )
    pd.rounded_rectangle(
        [plate_x, plate_y, plate_x + inner, plate_y + inner],
        radius=10,
        fill=(255, 255, 255, 255),
    )
    img = Image.alpha_composite(img, pl)
    img.paste(qr_img, (cx - qr_size // 2, plate_y + pad))
    draw = ImageDraw.Draw(img)

    by = fy1 + 32
    center(draw, by, "Scan to download", f_hint, MUTED + (255,))
    center(draw, by + 34, "Available on the App Store", f_store, WHITE + (255,))

    bar_y = H - 108
    bar = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rectangle([0, bar_y, W, bar_y + 54], fill=(3, 10, 24, 240))
    bd.rectangle([0, bar_y, W, bar_y + 3], fill=ORANGE + (255,))
    img = Image.alpha_composite(img, bar)
    draw = ImageDraw.Draw(img)
    bt = "OFFER INTEL   ·   FUTURECAST   ·   FILM ROOM"
    tw, _ = measure(draw, f_bar, bt)
    draw.text(((W - tw) / 2, bar_y + 15), bt, font=f_bar, fill=WHITE + (255,))
    center(
        draw,
        H - 40,
        "GatorVault Media, LLC  ·  Not affiliated with UF",
        f_legal,
        (128, 142, 160, 230),
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
    ]:
        qr_img.save(path)

    data, _, _ = cv2.QRCodeDetector().detectAndDecode(np.array(rgb)[:, :, ::-1])
    print("decode:", repr(data))
    if data != STORE_URL:
        raise SystemExit(f"QR decode mismatch: {data!r}")


if __name__ == "__main__":
    main()
