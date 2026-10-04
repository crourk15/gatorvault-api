#!/usr/bin/env python3
"""15s 9:16 elite App Install — full-bleed product, no hand."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
OUT = Path(__file__).resolve().parent / "creatives"
FRAMES = Path("/tmp/gv-elite-ad-frames")
W, H = 1080, 1920
FPS = 24
DUR = 15.0

NAVY = (7, 15, 28)
NAVY2 = (5, 12, 24)
ORANGE = (250, 70, 22)
WHITE = (245, 246, 248)
MUTED = (168, 178, 190)

SCREENS = {
    "home": ASSETS / "e6189363-5c7c-45cc-8e52-323065e8c458.png",
    "futurecast": ASSETS / "df8a4058-f9ad-4eb3-a705-c49ed384b73c.png",
    "film": ASSETS / "87fd3132-0935-4141-9f22-97116a1fbaeb.png",
}

# Pixels on the 295x640 home shot: Game Week only (NOW / Bailey stays off).
HOME_Y0, HOME_Y1 = 278, 555


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )
    return ImageFont.truetype(path, size)


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def sharpen(im: Image.Image) -> Image.Image:
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=140, threshold=2))


def cover(im: Image.Image, size: tuple[int, int], zoom: float = 1.0) -> Image.Image:
    tw, th = size
    z = max(1.0, zoom)
    scale = max(tw / im.size[0], th / im.size[1]) * z
    nw, nh = int(im.size[0] * scale), int(im.size[1] * scale)
    im = sharpen(im.resize((nw, nh), Image.Resampling.LANCZOS))
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return im.crop((x, y, x + tw, y + th))


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0], im.size[1]), radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), mask)
    return out


def canvas() -> Image.Image:
    im = Image.new("RGB", (W, H), NAVY)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-240, -280, 900, 620), fill=(0, 36, 150, 48))
    gd.ellipse((200, 1280, 1500, 2300), fill=(250, 70, 22, 22))
    return Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")


def load_home_card() -> Image.Image:
    im = Image.open(SCREENS["home"]).convert("RGB")
    w, h = im.size
    return im.crop((0, HOME_Y0, w, HOME_Y1))


def gameweek_frame(t: float) -> Image.Image:
    """Editorial Game Week — real UI card, perfectly fitted, no device warp."""
    im = canvas()
    d = ImageDraw.Draw(im)
    zoom = 1.0 + 0.035 * t

    card = load_home_card()
    card_w = 980
    card_h = int(card.size[1] * card_w / card.size[0])
    card = sharpen(card.resize((int(card_w * zoom), int(card_h * zoom)), Image.Resampling.LANCZOS))
    # center-crop back to card box if zoomed
    if zoom > 1.0:
        x0 = (card.size[0] - card_w) // 2
        y0 = (card.size[1] - card_h) // 2
        card = card.crop((x0, y0, x0 + card_w, y0 + card_h))
    pad = 14
    padded = Image.new("RGB", (card.size[0] + pad * 2, card.size[1] + pad * 2), NAVY)
    padded.paste(card, (pad, pad))
    card = rounded(padded, 32)
    card_w, card_h = card.size

    # type
    d.text((W / 2, 168), "SAT  ·  OCT 10  ·  12:45 ET", font=font(22, False), fill=ORANGE, anchor="mm")
    d.text((W / 2, 248), "SOUTH CAROLINA", font=font(58), fill=WHITE, anchor="mm")
    d.text((W / 2, 318), "SEC NETWORK  ·  THE SWAMP", font=font(20, False), fill=MUTED, anchor="mm")

    cx = (W - card_w) // 2
    cy = 390
    # drop shadow
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((cx + 8, cy + 18, cx + card_w - 8, cy + card_h + 18), 28, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    im = Image.alpha_composite(im.convert("RGBA"), shadow)
    im.paste(card, (cx, cy), card)
    d = ImageDraw.Draw(im)
    d.text((W / 2, 1720), "ALREADY IN THE APP", font=font(18), fill=MUTED, anchor="mm")
    d.rectangle((0, H - 8, W, H), fill=ORANGE)
    return im.convert("RGB")


def fullbleed(key: str, zoom: float) -> Image.Image:
    src = Image.open(SCREENS[key]).convert("RGB")
    im = cover(src, (W, H), zoom)
    ImageDraw.Draw(im).rectangle((0, H - 8, W, H), fill=ORANGE)
    return im


def tap_ripple(base: Image.Image, cx: float, cy: float, t: float) -> Image.Image:
    if t <= 0 or t >= 1:
        return base
    layer = base.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    r = 22 + 78 * ease(t)
    a = int(200 * (1 - t))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, a), width=6)
    return Image.alpha_composite(layer, overlay).convert("RGB")


def end_card() -> Image.Image:
    im = canvas()
    d = ImageDraw.Draw(im)
    d.text((W / 2, 700), "GATORVAULT", font=font(58), fill=WHITE, anchor="mm")
    d.text((W / 2, 772), "INSIDER", font=font(20), fill=ORANGE, anchor="mm")
    d.rounded_rectangle((250, 980, 830, 1092), 56, fill=ORANGE)
    d.text((W / 2, 1036), "GET THE APP", font=font(32), fill=WHITE, anchor="mm")
    d.text((W / 2, 1200), "iOS  ·  South Carolina week", font=font(20, False), fill=MUTED, anchor="mm")
    d.rectangle((0, H - 8, W, H), fill=ORANGE)
    return im


def scene_at(sec: float) -> str:
    if sec < 5.1:
        return "home"
    if sec < 5.55:
        return "fade_fc"
    if sec < 9.15:
        return "futurecast"
    if sec < 9.55:
        return "fade_film"
    if sec < 12.25:
        return "film"
    return "end"


def blend(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    t = ease(t)
    return Image.blend(a.convert("RGB"), b.convert("RGB"), t)


def main() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    OUT.mkdir(parents=True, exist_ok=True)

    end = end_card()
    still_saved = False
    last_live = None
    n = int(DUR * FPS)

    # Film play button after cover-crop of 295x640 -> 1080x1920
    # cover scale = 1080/295; crop (2342-1920)/2 = 211 off top of scaled
    scale = 1080 / 295
    crop_top = (640 * scale - 1920) / 2
    # play button ~ (146.3, 444.8) on the raw film screenshot
    tap_x = 146.3 * scale
    tap_y = 444.8 * scale - crop_top

    for i in range(n):
        sec = i / FPS
        kind = scene_at(sec)
        if kind == "home":
            frame = gameweek_frame(sec / 5.1)
            if not still_saved:
                frame.save(OUT / "fb-elite-gameweek-still.jpg", quality=94, optimize=True)
                still_saved = True
        elif kind == "fade_fc":
            a = gameweek_frame(1.0)
            b = fullbleed("futurecast", 1.0)
            frame = blend(a, b, (sec - 5.1) / 0.45)
        elif kind == "futurecast":
            z = 1.0 + 0.03 * ((sec - 5.55) / 3.6)
            frame = fullbleed("futurecast", z)
        elif kind == "fade_film":
            a = fullbleed("futurecast", 1.03)
            b = fullbleed("film", 1.0)
            frame = blend(a, b, (sec - 9.15) / 0.40)
        elif kind == "film":
            z = 1.0 + 0.025 * ((sec - 9.55) / 2.7)
            frame = fullbleed("film", z)
            frame = tap_ripple(frame, tap_x, tap_y, (sec - 10.15) / 0.55)
        else:
            t = ease((sec - 12.25) / 0.40)
            src = last_live if last_live is not None else end
            frame = blend(src, end, t)
            if t >= 1.0:
                frame = end

        if kind != "end":
            last_live = frame
        frame.save(FRAMES / f"f{i:04d}.jpg", quality=91)

    mp4 = OUT / "fb-elite-sc-week-15s.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(FRAMES / "f%04d.jpg"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            str(mp4),
        ]
    )
    print("wrote", mp4, "still", OUT / "fb-elite-gameweek-still.jpg")


if __name__ == "__main__":
    main()
