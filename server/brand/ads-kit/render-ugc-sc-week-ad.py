#!/usr/bin/env python3
"""15s 9:16 UGC App Install — Game Week → FutureCast → Film Room."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
OUT = Path(__file__).resolve().parent / "creatives"
PLATE_SRC = OUT / "ugc-hand-phone-plate.jpg"
if not PLATE_SRC.exists():
    PLATE_SRC = Path("/opt/cursor/artifacts/assets/gv-ugc-hand-phone-magenta.jpg")
FRAMES = Path("/tmp/gv-ugc-ad-frames")
W, H = 1080, 1920
FPS = 24
DUR = 15.0

NAVY = (7, 17, 31)
ORANGE = (250, 70, 22)
WHITE = (255, 255, 255)

SCREENS = {
    "home": ASSETS / "e6189363-5c7c-45cc-8e52-323065e8c458.png",
    "futurecast": ASSETS / "df8a4058-f9ad-4eb3-a705-c49ed384b73c.png",
    "film": ASSETS / "87fd3132-0935-4141-9f22-97116a1fbaeb.png",
}

# Game Week only — leftover NOW / Bailey stays off the ad.
HOME_CROP_Y = (0.40, 0.935)


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


def load_screen(key: str) -> Image.Image:
    im = Image.open(SCREENS[key]).convert("RGB")
    if key == "home":
        w, h = im.size
        im = im.crop((0, int(h * HOME_CROP_Y[0]), w, int(h * HOME_CROP_Y[1])))
    return im


def screen_quad(plate_bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    hsv = cv2.cvtColor(plate_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    mask = ((h > 130) & (h < 175) & (s > 80) & (v > 80)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cnts, key=cv2.contourArea)
    box = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    ssum = box.sum(axis=1)
    diff = np.diff(box, axis=1).reshape(-1)
    tl, br = box[np.argmin(ssum)], box[np.argmax(ssum)]
    tr, bl = box[np.argmin(diff)], box[np.argmax(diff)]
    quad = np.array([tl, tr, br, bl], dtype=np.float32)
    return quad, mask


def warp_to_phone(src: Image.Image, quad: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    arr = np.array(src.convert("RGB"))[:, :, ::-1]  # BGR
    sh, sw = arr.shape[:2]
    src_quad = np.array([[0, 0], [sw - 1, 0], [sw - 1, sh - 1], [0, sh - 1]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(src_quad, quad)
    return cv2.warpPerspective(arr, m, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_TRANSPARENT)


def swipe_source(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    """t=0 shows A; t=1 shows B. Horizontal swipe left."""
    t = ease(t)
    w = 720
    ah = int(w * a.size[1] / a.size[0])
    bh = int(w * b.size[1] / b.size[0])
    h = max(ah, bh)
    canvas = Image.new("RGB", (w * 2, h), NAVY)
    canvas.paste(a.resize((w, ah), Image.Resampling.LANCZOS), (0, (h - ah) // 2))
    canvas.paste(b.resize((w, bh), Image.Resampling.LANCZOS), (w, (h - bh) // 2))
    x = int(t * w)
    return canvas.crop((x, 0, x + w, h))


def caption_layer(text: str) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(36)
    pad_x, pad_y = 28, 18
    tw = d.textlength(text, font=f)
    box_w, box_h = tw + pad_x * 2, 36 + pad_y * 2
    x = (W - box_w) / 2
    y = 320
    d.rounded_rectangle((x, y, x + box_w, y + box_h), 28, fill=(0, 0, 0, 168))
    d.text((W / 2, y + box_h / 2), text, font=f, fill=WHITE, anchor="mm")
    return layer


def end_card() -> Image.Image:
    im = Image.new("RGB", (W, H), NAVY)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-200, -200, 1280, 700), fill=(0, 33, 165, 70))
    gd.ellipse((100, 1200, 1400, 2200), fill=(250, 70, 22, 36))
    im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(im)
    d.rectangle((0, H - 14, W, H), fill=ORANGE)
    d.text((W / 2, 720), "GATORVAULT", font=font(54), fill=WHITE, anchor="mm")
    d.text((W / 2, 790), "INSIDER", font=font(20), fill=ORANGE, anchor="mm")
    d.rounded_rectangle((250, 980, 830, 1090), 54, fill=ORANGE)
    d.text((W / 2, 1035), "GET THE APP", font=font(34), fill=WHITE, anchor="mm")
    d.text((W / 2, 1180), "iOS  ·  South Carolina week", font=font(22, False), fill=(200, 208, 218), anchor="mm")
    return im


def tap_ripple(base: Image.Image, cx: float, cy: float, t: float) -> Image.Image:
    if t <= 0 or t >= 1:
        return base
    layer = base.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    r = 18 + 70 * ease(t)
    a = int(180 * (1 - t))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, a), width=5)
    return Image.alpha_composite(layer, overlay)


def scene_at(sec: float) -> str:
    if sec < 5.0:
        return "home"
    if sec < 5.45:
        return "swipe_home_fc"
    if sec < 9.2:
        return "futurecast"
    if sec < 9.65:
        return "swipe_fc_film"
    if sec < 12.15:
        return "film"
    return "end"


def main() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    OUT.mkdir(parents=True, exist_ok=True)

    plate = Image.open(PLATE_SRC).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    plate_bgr = np.array(plate)[:, :, ::-1].copy()
    quad, mask = screen_quad(plate_bgr)
    mask_f = (mask > 0).astype(np.uint8)
    # fill leftover magenta on the plate so the bezel does not glow pink
    plate_bgr[mask_f == 1] = (18, 16, 12)
    mask_f = cv2.erode(mask_f, np.ones((7, 7), np.uint8), iterations=1)

    home, future, film = load_screen("home"), load_screen("futurecast"), load_screen("film")
    cap = caption_layer("South Carolina week is already in the app.")
    end = end_card()

    # play-button approx: center of phone quad, shifted onto the Film Room player
    cx = float((quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4)
    cy = float((quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4) + 120

    n = int(DUR * FPS)
    still_saved = False
    last_live = Image.fromarray(plate_bgr[:, :, ::-1])
    for i in range(n):
        sec = i / FPS
        kind = scene_at(sec)
        if kind == "end":
            t = ease((sec - 12.15) / 0.35)
            frame = Image.blend(last_live, end, t)
            if t >= 1.0:
                frame = end
        else:
            if kind == "home":
                src = home
            elif kind == "futurecast":
                src = future
            elif kind == "film":
                src = film
            elif kind == "swipe_home_fc":
                src = swipe_source(home, future, (sec - 5.0) / 0.45)
            else:
                src = swipe_source(future, film, (sec - 9.2) / 0.45)

            warped = warp_to_phone(src, quad, (W, H))
            composed = plate_bgr.copy()
            m = mask_f[:, :, None]
            composed = np.where(m == 1, warped, composed)
            frame = Image.fromarray(composed[:, :, ::-1])
            if kind != "end" and sec >= 0.35:
                frame = Image.alpha_composite(frame.convert("RGBA"), cap).convert("RGB")
            if kind == "film":
                tap_t = (sec - 10.05) / 0.55
                frame = tap_ripple(frame, cx, cy, tap_t).convert("RGB")
            if kind == "home" and not still_saved:
                frame.save(OUT / "fb-ugc-gameweek-still.jpg", quality=94, optimize=True)
                still_saved = True
            last_live = frame

        frame.save(FRAMES / f"f{i:04d}.jpg", quality=90)

    mp4 = OUT / "fb-ugc-sc-week-15s.mp4"
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
    print("wrote", mp4, "still", OUT / "fb-ugc-gameweek-still.jpg")


if __name__ == "__main__":
    main()
