#!/usr/bin/env python3
"""15s 9:16 live-cut twin — South Carolina week, winner language, no Bailey."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
OUT = Path(__file__).resolve().parent / "creatives"
STADIUM = OUT / "stadium-night-plate.jpg"
FRAMES = Path("/tmp/gv-livecut-frames")
W, H = 1080, 1920
FPS = 24
DUR = 15.0

NAVY = (7, 15, 28)
CARD = (17, 24, 38)
ORANGE = (250, 70, 22)
WHITE = (245, 246, 248)
MUTED = (170, 178, 190)
LABEL = (130, 140, 155)

HOME_SRC = ASSETS / "e6189363-5c7c-45cc-8e52-323065e8c458.png"
FILM_SRC = ASSETS / "87fd3132-0935-4141-9f22-97116a1fbaeb.png"
FC_SRC = ASSETS / "df8a4058-f9ad-4eb3-a705-c49ed384b73c.png"


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
    return im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=2))


def upscale_width(path: Path, width: int) -> Image.Image:
    im = Image.open(path).convert("RGB")
    nh = int(im.size[1] * width / im.size[0])
    return sharpen(im.resize((width, nh), Image.Resampling.LANCZOS))


def patch_home() -> Image.Image:
    """Full home UI at width 1080. NOW rows are this week. Bailey stays off."""
    im = upscale_width(HOME_SRC, 1080)
    d = ImageDraw.Draw(im)
    s = 1080 / 295
    # Cover the whole NOW card through the leftover Season line, stop before Game Week.
    y0, y1 = int(174 * s), int(278 * s)
    x0, x1 = int(6 * s), int(289 * s)
    d.rectangle((x0, y0, x1, y1), fill=CARD)
    lx = x0 + 22
    vx = x0 + 210
    d.text((lx, y0 + 10), "NOW", font=font(16), fill=ORANGE)
    rows = [
        ("GAME", "South Carolina  ·  12:45 PM  ·  SECN", WHITE),
        ("VISITORS", "Easton Royal", WHITE),
        ("SEASON", "4-1  ·  SEC home Saturday", WHITE),
    ]
    y = y0 + 42
    for lab, val, col in rows:
        d.text((lx, y), lab, font=font(16), fill=LABEL)
        d.text((vx, y), val, font=font(19, False), fill=col)
        y += 32
    return im


def cover(im: Image.Image, size: tuple[int, int], zoom: float = 1.0) -> Image.Image:
    tw, th = size
    z = max(1.0, zoom)
    scale = max(tw / im.size[0], th / im.size[1]) * z
    nw, nh = max(tw, int(im.size[0] * scale)), max(th, int(im.size[1] * scale))
    im = sharpen(im.resize((nw, nh), Image.Resampling.LANCZOS))
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return im.crop((x, y, x + tw, y + th))


def rounded_screen(im: Image.Image, radius: int = 42) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), mask)
    return out


def home_viewport(home: Image.Image, t: float, caption: bool = False) -> Image.Image:
    """Pan down the patched home so Game Week lands in frame. t=0 top, t=1 bottom."""
    t = ease(t)
    max_y = max(0, home.size[1] - H)
    y = int(max_y * t)
    frame = home.crop((0, y, W, y + H))
    # phone-screen rounded top
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, W, 28), fill=(0, 0, 0, 180))
    frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")
    # clip to rounded device
    frame = rounded_screen(frame, 48).convert("RGB")
    # fill behind corners
    bg = Image.new("RGB", (W, H), (3, 6, 14))
    bg.paste(rounded_screen(frame, 48), (0, 0), rounded_screen(frame, 48))
    if caption:
        d = ImageDraw.Draw(bg)
        d.text((W / 2, 1848), "SOUTH CAROLINA WEEK", font=font(22), fill=WHITE, anchor="mm")
    return bg


def floating_phone(home: Image.Image, stadium: Image.Image) -> Image.Image:
    bg = cover(stadium, (W, H), 1.0)
    d = ImageDraw.Draw(bg)
    d.rectangle((0, H - 6, W, H), fill=ORANGE)
    # phone
    pw, ph = 560, 1140
    px, py = (W - pw) // 2, 340
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((px + 10, py + 24, px + pw - 10, py + ph + 24), 70, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    bg = Image.alpha_composite(bg.convert("RGBA"), shadow)
    body = Image.new("RGB", (pw, ph), (28, 30, 34))
    body = rounded_screen(body, 72)
    # screen inset
    inset = 16
    screen_w, screen_h = pw - inset * 2, ph - inset * 2
    # show Game Week-heavy crop of home
    max_y = max(0, home.size[1] - screen_h)
    crop = home.crop((0, int(max_y * 0.72), W, int(max_y * 0.72) + screen_h))
    crop = crop.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    crop = rounded_screen(crop, 52)
    body.paste(crop, (inset, inset), crop)
    bg.paste(body, (px, py), body)
    return bg.convert("RGB")


def film_full(zoom: float = 1.0) -> Image.Image:
    src = Image.open(FILM_SRC).convert("RGB")
    im = cover(src, (W, H), zoom)
    bg = Image.new("RGB", (W, H), (3, 6, 14))
    scr = rounded_screen(im, 48)
    bg.paste(scr, (0, 0), scr)
    return bg


def end_card(home: Image.Image, stadium: Image.Image) -> Image.Image:
    bg = Image.new("RGB", (W, H), (4, 8, 16))
    glow = cover(stadium, (W, H), 1.05).convert("RGBA")
    glow.putalpha(90)
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(bg)
    d.text((W / 2, 220), "GATOR VAULT", font=font(52), fill=WHITE, anchor="mm")
    # orange rule under VAULT
    d.rectangle((690, 258, 860, 266), fill=ORANGE)
    d.text((W / 2, 310), "ONE VAULT.", font=font(22), fill=WHITE, anchor="mm")
    d.text((W / 2, 350), "GatorVault Insider", font=font(18, False), fill=MUTED, anchor="mm")

    # small phone
    mini = floating_phone(home, stadium)
    mini = mini.crop((180, 280, 900, 1640)).resize((520, 980), Image.Resampling.LANCZOS)
    mx, my = (W - 520) // 2, 430
    bg.paste(mini, (mx, my))

    # badge
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((270, 1680, 810, 1790), 40, fill=(12, 14, 18), outline=WHITE, width=2)
    d.text((W / 2, 1735), "Download on the App Store", font=font(22), fill=WHITE, anchor="mm")
    return bg


def blend(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    return Image.blend(a.convert("RGB"), b.convert("RGB"), ease(t))


def scene_at(sec: float) -> str:
    if sec < 4.4:
        return "home"
    if sec < 4.75:
        return "to_phone"
    if sec < 6.35:
        return "phone"
    if sec < 6.7:
        return "to_film"
    if sec < 10.0:
        return "film"
    if sec < 10.35:
        return "to_home2"
    if sec < 12.25:
        return "home2"
    if sec < 12.65:
        return "to_end"
    return "end"


def main() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    OUT.mkdir(parents=True, exist_ok=True)

    home = patch_home()
    stadium = Image.open(STADIUM).convert("RGB")
    phone = floating_phone(home, stadium)
    film0 = film_full(1.0)
    end = end_card(home, stadium)
    home_end = home_viewport(home, 1.0, caption=True)

    still = home_viewport(home, 0.85, caption=True)
    still.save(OUT / "fb-livecut-sc-week-still.jpg", quality=94, optimize=True)

    n = int(DUR * FPS)
    last = still
    for i in range(n):
        sec = i / FPS
        kind = scene_at(sec)
        if kind == "home":
            frame = home_viewport(home, sec / 4.4, caption=sec >= 1.2)
        elif kind == "to_phone":
            frame = blend(home_end, phone, (sec - 4.4) / 0.35)
        elif kind == "phone":
            frame = phone
        elif kind == "to_film":
            frame = blend(phone, film0, (sec - 6.35) / 0.35)
        elif kind == "film":
            frame = film_full(1.0 + 0.02 * ((sec - 6.7) / 3.3))
        elif kind == "to_home2":
            frame = blend(film_full(1.02), home_end, (sec - 10.0) / 0.35)
        elif kind == "home2":
            frame = home_end
        elif kind == "to_end":
            frame = blend(last if last else home_end, end, (sec - 12.25) / 0.40)
        else:
            frame = end
        last = frame
        frame.save(FRAMES / f"f{i:04d}.jpg", quality=91)

    mp4 = OUT / "fb-livecut-sc-week-15s.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", str(FRAMES / "f%04d.jpg"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
            "-movflags", "+faststart", str(mp4),
        ]
    )
    print("wrote", mp4, "still", OUT / "fb-livecut-sc-week-still.jpg")


if __name__ == "__main__":
    main()
