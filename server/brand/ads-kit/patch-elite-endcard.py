#!/usr/bin/env python3
"""Fix only the garbled App Store pill on Charles's elite export.

Keeps the rest of the 10s cut. Replaces 'Capplnonh Pipp / DOWNLOAD NOWW'
with 'Download on the / App Store'. Muxes original AAC.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "creatives"
SRC_COPY = HERE / "source" / "gatorvault-ad-elite-export.mp4"
UPLOAD = Path("/home/ubuntu/.cursor/projects/workspace/uploads/export__2__5b06.MP4")
FRAMES = Path("/tmp/elite-export-frames")
FRAMES_OUT = Path("/tmp/elite-export-fixed")
QA = Path("/tmp/elite-end-qa")

W, H = 1080, 1920
FPS = 30
WHITE = (245, 246, 248)
NAVY = (8, 10, 28)
# Film Room holds through ~8.80s. End-card fade starts ~8.83s.
END_T0 = 8.82
LOCKED_PILL = (200, 802, 680, 195)


def font(size: int, weight: str = "semi") -> ImageFont.FreeTypeFont:
    files = {
        "bold": "/usr/share/fonts/truetype/macos/Inter-Bold.ttf",
        "semi": "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf",
        "med": "/usr/share/fonts/truetype/macos/Inter-Medium.ttf",
        "reg": "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
    }
    path = files.get(weight, files["semi"])
    if not Path(path).exists():
        path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    return ImageFont.truetype(path, max(10, int(size)))


def draw_tracked(d: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, font: ImageFont.FreeTypeFont, fill, tracking: float) -> None:
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def find_pill(bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    white = cv2.inRange(bgr, (160, 160, 160), (255, 255, 255))
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((7, 17), np.uint8))
    cnts, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_score = -1.0
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w < 280 or w > 860:
            continue
        if h < 70 or h > 240:
            continue
        if abs((x + w / 2) - W / 2) > 160:
            continue
        if y < H * 0.28 or y > H * 0.62:
            continue
        ar = w / max(h, 1)
        if ar < 2.2 or ar > 5.6:
            continue
        score = w * h * (1.2 - abs(ar - 3.4) / 4)
        if score > best_score:
            best_score = score
            best = (x, y, w, h)
    return best


def is_endcard(t: float) -> bool:
    return t >= END_T0


def apple_cut_x(bgr: np.ndarray, pill: tuple[int, int, int, int]) -> int:
    """Right edge of the Apple mark so we keep the logo and cover the gibberish."""
    x, y, w, h = pill
    x0 = x + 8
    x1 = x + int(w * 0.40)
    y0, y1 = y + 10, y + h - 10
    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return x + int(w * 0.30)
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    med = float(np.median(gray))
    if med < 90:
        mask = (gray > 165).astype(np.uint8)
    else:
        return x + int(w * 0.30)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_area = 0
    for c in cnts:
        bx, by, bw, bh = cv2.boundingRect(c)
        area = bw * bh
        if area < 400 or bw > h * 1.1:
            continue
        if bw / max(bh, 1) > 1.6:
            continue
        if area > best_area:
            best_area = area
            best = (bx, bw)
    if best is None:
        return x + int(w * 0.30)
    return x0 + best[0] + best[1] + 10


def patch_pill(bgr: np.ndarray, pill: tuple[int, int, int, int]) -> np.ndarray:
    x, y, w, h = pill
    apple_cut = apple_cut_x(bgr, pill)
    inset = max(8, int(h * 0.08))
    cover_l = min(max(apple_cut, x + int(w * 0.26)), x + int(w * 0.34))
    cover_r = x + w - inset
    cover_t = y + inset
    cover_b = y + h - inset
    sample = bgr[y + 18 : y + h - 18, x + 14 : min(cover_l - 6, x + 64)]
    if sample.size < 30:
        fill = NAVY
        ink = WHITE
    else:
        med = np.median(sample.reshape(-1, 3), axis=0)
        fill = (int(med[2]), int(med[1]), int(med[0]))
        ink = WHITE if (fill[0] + fill[1] + fill[2]) / 3 < 90 else NAVY

    im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((cover_l, cover_t, cover_r, cover_b), 16, fill=fill)

    tx = cover_l + 4
    mid = (cover_t + cover_b) / 2
    line1 = font(22, "med")
    line2 = font(40, "bold")
    draw_tracked(d, (tx, mid - 36), "Download on the", line1, ink, 0.9)
    d.text((tx, mid - 6), "App Store", font=line2, fill=ink)
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)


def ensure_source() -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    HERE.joinpath("source").mkdir(parents=True, exist_ok=True)
    src = SRC_COPY if SRC_COPY.exists() else UPLOAD
    if not SRC_COPY.exists() and UPLOAD.exists():
        shutil.copy(UPLOAD, SRC_COPY)
        src = SRC_COPY
    return src


def ensure_frames(src: Path) -> None:
    if FRAMES.exists() and len(list(FRAMES.glob("f*.jpg"))) >= 290:
        return
    FRAMES.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-q:v", "2", str(FRAMES / "f%04d.jpg")]
    )


def lock_pill(paths: list[Path]) -> tuple[int, int, int, int]:
    found: list[tuple[int, int, int, int]] = []
    for i, p in enumerate(paths):
        t = i / FPS
        if t < 9.0:
            continue
        bgr = cv2.imread(str(p))
        pill = find_pill(bgr)
        if pill:
            found.append(pill)
    if not found:
        return LOCKED_PILL
    arr = np.median(np.array(found, dtype=float), axis=0)
    return tuple(int(round(v)) for v in arr)


def main() -> None:
    src = ensure_source()
    ensure_frames(src)
    if FRAMES_OUT.exists():
        shutil.rmtree(FRAMES_OUT)
    FRAMES_OUT.mkdir(parents=True)
    QA.mkdir(parents=True, exist_ok=True)

    paths = sorted(FRAMES.glob("f*.jpg"))
    locked = lock_pill(paths)
    patched = 0
    for i, p in enumerate(paths):
        bgr = cv2.imread(str(p))
        t = i / FPS
        if is_endcard(t):
            pill = find_pill(bgr) or locked
            bgr = patch_pill(bgr, pill)
            patched += 1
        cv2.imwrite(str(FRAMES_OUT / f"f{i+1:04d}.jpg"), bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 94])

    for t in (0.0, 4.0, 7.0, 8.5, 8.8, 8.9, 9.2, 9.6, 9.9):
        idx = min(max(1, int(round(t * FPS)) + 1), len(paths))
        shutil.copy(FRAMES_OUT / f"f{idx:04d}.jpg", QA / f"q{t:04.1f}.jpg")

    mp4 = OUT / "fb-elite-appstore-10s.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y",
            "-framerate", str(FPS),
            "-i", str(FRAMES_OUT / "f%04d.jpg"),
            "-i", str(src),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16",
            "-c:a", "copy",
            "-shortest",
            "-movflags", "+faststart",
            str(mp4),
        ]
    )
    Image.open(QA / "q09.6.jpg").save(OUT / "fb-elite-appstore-still.jpg", quality=94, optimize=True)
    print("patched", patched, "of", len(paths), "pill", locked, "->", mp4)


if __name__ == "__main__":
    main()
