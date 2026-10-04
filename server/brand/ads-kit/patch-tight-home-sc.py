#!/usr/bin/env python3
"""Homepage-only patch on the live tight 15s App Install.

Keeps the uploaded Runway cut (phone, stadium, FutureCast, end card, audio).
Replaces last-week Home (Missouri / Bailey) with South Carolina week.
Does not remake the ad. Does not touch FutureCast.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "creatives"
SOURCE = HERE / "source" / "gatorvault-ad-tight-15s.mp4"
UPLOAD = Path("/home/ubuntu/.cursor/projects/workspace/uploads/gatorvault_ad_tight_15s_b733.mp4")
ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
HOME_SRC = ASSETS / "e6189363-5c7c-45cc-8e52-323065e8c458.png"
FRAMES_IN = Path("/tmp/tight-frames")
FRAMES_OUT = Path("/tmp/tight-home-sc")
QA = Path("/tmp/tight-home-qa")

W, H = 1080, 1920
FPS = 24

NAVY = (18, 22, 36)
ORANGE = (250, 70, 22)
WHITE = (245, 246, 248)
LABEL = (138, 146, 160)

# Uploaded cut at 24 fps / 361 frames.
# 0.00-1.80 close-up Home — paint NOW rows in place (no 295px warp).
# 1.80-5.30 stadium Home — warp this-week plate onto the glass.
# 5.30-7.80 FutureCast + orange dissolve — leave alone.
# 7.80-11.50 stadium Home
# 11.50-15.04 end card — warp glass only, keep GATOR VAULT / App Store.
FC_T0, FC_T1 = 5.30, 7.80
CLOSEUP_T1 = 1.80
END_T0 = 11.50


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )
    return ImageFont.truetype(path, max(8, int(size)))


def patch_home_plate() -> Image.Image:
    """Real Home at width 1080. NOW rows this week. No iOS chrome."""
    im = Image.open(HOME_SRC).convert("RGB")
    src_w, src_h = im.size
    s = 1080 / src_w
    im = im.resize((1080, int(src_h * s)), Image.Resampling.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
    d = ImageDraw.Draw(im)
    y0, y1 = int(174 * s), int(278 * s)
    x0, x1 = int(6 * s), int(289 * s)
    d.rectangle((x0, y0, x1, y1), fill=NAVY)
    lx = x0 + int(14 * s)
    vx = x0 + int(92 * s)
    d.text((lx, y0 + int(6 * s)), "NOW", font=font(11 * s), fill=ORANGE)
    rows = [
        ("GAME", "South Carolina  ·  12:45 PM  ·  SECN", WHITE),
        ("VISITORS", "Easton Royal", WHITE),
        ("SEASON", "4-1  ·  SEC home Saturday", WHITE),
    ]
    y = y0 + int(28 * s)
    for lab, val, col in rows:
        d.text((lx, y), lab, font=font(10 * s), fill=LABEL)
        d.text((vx, y), val, font=font(11.5 * s, False), fill=col)
        y += int(22 * s)
    top = int(26 * s)
    bot = int(562 * s)
    return im.crop((0, top, 1080, min(bot, im.size[1])))


def classify(sec: float, yel: int, white: int, orange: int) -> str:
    if FC_T0 <= sec <= FC_T1:
        return "futurecast"
    if white > 150000 and yel > 1500:
        return "futurecast"
    if orange > 200000:
        return "futurecast"
    if sec < CLOSEUP_T1:
        return "closeup"
    if sec >= END_T0:
        return "endcard"
    return "stadium"


def frame_stats(bgr: np.ndarray) -> tuple[int, int, int]:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    yel = int(cv2.inRange(hsv, (18, 80, 160), (40, 255, 255)).sum() // 255)
    white = int(cv2.inRange(bgr, (210, 210, 210), (255, 255, 255)).sum() // 255)
    orange = int(cv2.inRange(hsv, (0, 100, 80), (18, 255, 255)).sum() // 255)
    return yel, white, orange


def order_quad(pts: np.ndarray) -> np.ndarray:
    pts = np.array(pts, dtype=np.float32).reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).reshape(-1)
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        dtype=np.float32,
    )


def orange_bars(bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (0, 80, 60), (18, 255, 255))
    mask = cv2.bitwise_or(mask, cv2.inRange(hsv, (170, 80, 60), (180, 255, 255)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 21), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bars = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w < 70 or h < 4 or h > 110:
            continue
        if w / max(h, 1) < 2.2:
            continue
        bars.append((x, y, w, h))
    bars.sort(key=lambda b: b[1])
    return bars


def best_cta(bars: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int] | None:
    """Widest centered Open Game Week bar — not a leftover sliver or the stadium rail."""
    if not bars:
        return None
    cands = [b for b in bars if b[1] > int(H * 0.40) and 8 <= b[3] <= 80 and b[2] >= 140]
    if not cands:
        cands = [b for b in bars if b[3] < 80]
    if not cands:
        return None

    def score(b: tuple[int, int, int, int]) -> float:
        cx = b[0] + b[2] / 2.0
        center = 1.0 - abs(cx - W / 2) / (W / 2)
        thick = 1.0 if b[3] >= 16 else 0.45
        return b[2] * max(0.15, center) * thick

    return max(cands, key=score)


def pill_cluster(bars: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int] | None:
    if not bars:
        return None
    pills = [b for b in bars if b[1] < int(H * 0.62) and 16 <= b[3] <= 95]
    if not pills:
        return None
    x0 = min(b[0] for b in pills)
    y0 = min(b[1] for b in pills)
    x1 = max(b[0] + b[2] for b in pills)
    y1 = max(b[1] + b[3] for b in pills)
    return (x0, y0, x1 - x0, y1 - y0)


def valid_quad(q: np.ndarray | None) -> bool:
    if q is None:
        return False
    xs, ys = q[:, 0], q[:, 1]
    w = float(xs.max() - xs.min())
    h = float(ys.max() - ys.min())
    cx = float((xs.min() + xs.max()) / 2)
    if w < 260 or w > 860:
        return False
    if h < 500 or h > 1760:
        return False
    if abs(cx - W / 2) > 170:
        return False
    ar = h / max(w, 1)
    if ar < 1.50 or ar > 2.75:
        return False
    return True


def inset_quad(quad: np.ndarray, fx: float = 0.06, fy: float = 0.05) -> np.ndarray:
    tl, tr, br, bl = quad

    def lerp(a, b, t):
        return a + (b - a) * t

    ntl = lerp(lerp(tl, tr, fx), lerp(bl, br, fx), fy)
    ntr = lerp(lerp(tr, tl, fx), lerp(br, bl, fx), fy)
    nbr = lerp(lerp(br, bl, fx), lerp(tr, tl, fx), fy)
    nbl = lerp(lerp(bl, br, fx), lerp(tl, tr, fx), fy)
    return np.array([ntl, ntr, nbr, nbl], dtype=np.float32)


def quad_from_cta(cta: tuple[int, int, int, int], width_div: float = 0.86) -> np.ndarray:
    x, y, bw, bh = cta
    aspect = 19.5 / 9.0
    if bw >= 520:
        # Pull-back: CTA is wide. Do not let the plate cover the silver bezel.
        width_div = 0.97
        aspect = 2.22
    sw = bw / width_div
    sh = sw * aspect
    cx = x + bw / 2.0
    bottom = y + bh + max(5.0, bh * 0.25)
    top = bottom - sh
    left = cx - sw / 2.0
    right = cx + sw / 2.0
    return np.array([[left, top], [right, top], [right, bottom], [left, bottom]], dtype=np.float32)


def rim_phone(bgr: np.ndarray) -> np.ndarray | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 1)
    cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_score = -1.0
    for c in cnts:
        area = cv2.contourArea(c)
        if area < (H * W) * 0.05:
            continue
        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), _ang = rect
        if rw < 1 or rh < 1:
            continue
        ar = min(rw, rh) / max(rw, rh)
        if ar < 0.38 or ar > 0.60:
            continue
        if min(rw, rh) < 240:
            continue
        if max(rw, rh) > H * 0.94:
            continue
        if abs(cx - W / 2) > 140:
            continue
        score = area * (1.15 - abs(ar - 0.47))
        if score > best_score:
            best_score = score
            best = order_quad(cv2.boxPoints(rect))
    return best if valid_quad(best) else None


def find_screen_quad(bgr: np.ndarray, kind: str) -> np.ndarray | None:
    bars = orange_bars(bgr)
    cta = best_cta(bars)
    if kind == "endcard":
        if cta is None:
            return None
        q = quad_from_cta(cta, width_div=0.92)
        if q is not None:
            q[:, 0] = np.clip(q[:, 0], 0, W - 1)
            q[:, 1] = np.clip(q[:, 1], 0, H - 1)
        return q if valid_quad(q) else None
    rim = rim_phone(bgr)
    if rim is not None and cta is not None:
        # Rim must roughly match the CTA width. Otherwise it is the bezel+fog blob.
        rim_w = float(rim[:, 0].max() - rim[:, 0].min())
        if 0.85 * cta[2] < rim_w < 1.55 * cta[2]:
            glass = inset_quad(rim, 0.058, 0.052)
            bottom = float(cta[1] + cta[3] + 7)
            glass[2, 1] = bottom
            glass[3, 1] = bottom
            if valid_quad(glass):
                return glass
    if rim is not None and valid_quad(inset_quad(rim)):
        return inset_quad(rim, 0.058, 0.052)
    if cta is not None:
        q = quad_from_cta(cta)
        q[:, 0] = np.clip(q[:, 0], 0, W - 1)
        q[:, 1] = np.clip(q[:, 1], 0, H - 1)
        if valid_quad(q):
            return q
    return None


def sample_bg_rgb(bgr: np.ndarray, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return NAVY
    roi = bgr[y0:y1, x0:x1]
    lum = roi.mean(axis=2)
    dark = roi[lum < 55]
    if dark.size < 80:
        return NAVY
    med = np.median(dark.reshape(-1, 3), axis=0)
    return (int(med[2]), int(med[1]), int(med[0]))


def paint_now_rows(rgb: Image.Image, bgr: np.ndarray) -> Image.Image:
    """In-place NOW rewrite. No stuck-on card. Covers leftover 4-0."""
    bars = orange_bars(bgr)
    pills = pill_cluster(bars)
    if pills is None:
        x0, y_pills_bot, x1 = 56, 1110, 1024
        pw = x1 - x0
    else:
        px, py, pw, ph = pills
        x0 = max(28, px - 8)
        x1 = min(W - 28, px + int(pw * 1.55))
        if x1 - x0 < 720:
            x1 = min(W - 28, x0 + max(pw + 80, 860))
        y_pills_bot = py + ph
    # Only use a nearby Game Week rule — the close-up bottom rail is too far down.
    thin = [
        b
        for b in bars
        if b[3] <= 24 and y_pills_bot + 80 < b[1] < y_pills_bot + 520
    ]
    if thin:
        y1 = thin[0][1] - 18
    else:
        y1 = min(H - 180, y_pills_bot + max(470, int((x1 - x0) * 0.50)))
    y0 = y_pills_bot + 20
    if y1 - y0 < 200:
        y1 = y0 + 420
    bg = sample_bg_rgb(bgr, (x0, max(0, y_pills_bot - 12), x1, y_pills_bot + 18))
    im = rgb.copy()
    d = ImageDraw.Draw(im)
    # Opaque — leftover Missouri / Bailey cannot show through.
    d.rectangle((x0, y0, x1, y1), fill=bg)
    scale = (x1 - x0) / 960.0
    fs_lab = max(15, int(26 * scale))
    fs_val = max(16, int(29 * scale))
    lx = x0 + int(22 * scale)
    vx = x0 + int(200 * scale)
    d.text((lx, y0 + int(8 * scale)), "NOW", font=font(max(14, int(24 * scale))), fill=ORANGE)
    rows = [
        ("GAME", "South Carolina  ·  12:45 PM  ·  SECN", WHITE),
        ("VISITORS", "Easton Royal", WHITE),
        ("SEASON", "4-1  ·  SEC home Saturday", WHITE),
    ]
    y = y0 + int(48 * scale)
    for lab, val, col in rows:
        d.text((lx, y), lab, font=font(fs_lab), fill=LABEL)
        d.text((vx, y), val, font=font(fs_val, False), fill=col)
        y += int(50 * scale)
    return im


def rounded_quad_mask(quad: np.ndarray) -> np.ndarray:
    xs, ys = quad[:, 0], quad[:, 1]
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    radius = max(20, int((x1 - x0) * 0.075))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius, fill=255)
    arr = np.array(mask)
    arr = cv2.erode(arr, np.ones((7, 7), np.uint8), iterations=1)
    arr = cv2.GaussianBlur(arr, (11, 11), 0)
    return arr


def warp_home(bgr: np.ndarray, plate_bgr: np.ndarray, quad: np.ndarray) -> np.ndarray:
    ph, pw = plate_bgr.shape[:2]
    src = np.array([[0, 0], [pw - 1, 0], [pw - 1, ph - 1], [0, ph - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(src, quad)
    warped = cv2.warpPerspective(plate_bgr, M, (W, H), flags=cv2.INTER_LINEAR)
    warped = cv2.GaussianBlur(warped, (3, 3), 0)
    mask = rounded_quad_mask(quad)
    alpha = (mask.astype(np.float32) / 255.0)[..., None]
    return (warped.astype(np.float32) * alpha + bgr.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)


def smooth_quads(quads: list[np.ndarray | None], kinds: list[str]) -> list[np.ndarray | None]:
    out: list[np.ndarray | None] = []
    prev = None
    prev_kind = None
    for q, kind in zip(quads, kinds):
        if q is None or not valid_quad(q):
            out.append(None)
            prev = None
            prev_kind = kind
            continue
        if prev is None or prev_kind != kind:
            out.append(q)
            prev = q
        else:
            sm = (0.78 * q + 0.22 * prev).astype(np.float32)
            out.append(sm if valid_quad(sm) else q)
            prev = sm if valid_quad(sm) else q
        prev_kind = kind
    return out


def ensure_frames() -> None:
    if FRAMES_IN.exists() and len(list(FRAMES_IN.glob("f*.jpg"))) >= 360:
        return
    FRAMES_IN.mkdir(parents=True, exist_ok=True)
    src = SOURCE if SOURCE.exists() else UPLOAD
    subprocess.check_call(["ffmpeg", "-y", "-i", str(src), "-q:v", "2", str(FRAMES_IN / "f%04d.jpg")])


def main() -> None:
    ensure_frames()
    if FRAMES_OUT.exists():
        shutil.rmtree(FRAMES_OUT)
    FRAMES_OUT.mkdir(parents=True)
    QA.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    plate = patch_home_plate()
    plate.save(QA / "home-plate.jpg", quality=94)
    plate_bgr = cv2.cvtColor(np.array(plate), cv2.COLOR_RGB2BGR)

    paths = sorted(FRAMES_IN.glob("f*.jpg"))
    kinds: list[str] = []
    quads: list[np.ndarray | None] = []
    for i, p in enumerate(paths):
        sec = i / FPS
        bgr = cv2.imread(str(p))
        yel, white, orange = frame_stats(bgr)
        kind = classify(sec, yel, white, orange)
        kinds.append(kind)
        if kind in ("stadium", "endcard"):
            quads.append(find_screen_quad(bgr, kind))
        else:
            quads.append(None)
    quads = smooth_quads(quads, kinds)

    for i, p in enumerate(paths):
        sec = i / FPS
        bgr = cv2.imread(str(p))
        kind = kinds[i]
        if kind == "futurecast":
            out = bgr
        elif kind == "closeup":
            rgb = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            rgb = paint_now_rows(rgb, bgr)
            out = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        else:
            q = quads[i]
            if q is not None:
                out = warp_home(bgr, plate_bgr, q)
            elif sec < 2.35:
                rgb = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                out = cv2.cvtColor(np.array(paint_now_rows(rgb, bgr)), cv2.COLOR_RGB2BGR)
            else:
                out = bgr
        cv2.imwrite(str(FRAMES_OUT / f"f{i:04d}.jpg"), out, [int(cv2.IMWRITE_JPEG_QUALITY), 93])

    for t in (0.0, 1.0, 1.5, 2.0, 2.5, 4.0, 5.5, 6.5, 8.0, 10.0, 11.5, 12.0, 13.5, 14.0):
        idx = min(int(round(t * FPS)), len(paths) - 1)
        shutil.copy(FRAMES_OUT / f"f{idx:04d}.jpg", QA / f"q{t:04.1f}.jpg")

    src = SOURCE if SOURCE.exists() else UPLOAD
    mp4 = OUT / "fb-tight-home-sc-15s.mp4"
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
    Image.open(QA / "q04.0.jpg").save(OUT / "fb-tight-home-sc-still.jpg", quality=94, optimize=True)
    print("wrote", mp4)
    # debug a few quads
    for t in (2.0, 4.0, 8.0, 12.0, 14.0):
        idx = min(int(round(t * FPS)), len(paths) - 1)
        q = quads[idx]
        print(f"t={t} kind={kinds[idx]} quad={'none' if q is None else np.round(q,1).tolist()}")


if __name__ == "__main__":
    main()
