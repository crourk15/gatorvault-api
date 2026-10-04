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
GNL_PLATE = HERE / "source" / "home-sc-gnl.png"
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
# 1.80-5.38 stadium Home — warp this-week plate onto the glass
#   (includes the orange dissolve so Missouri cannot flash).
# 5.38-7.48 FutureCast core — leave alone.
# 7.48-11.50 stadium Home (Home is back before the old 7.80 cut).
# 11.50-15.04 end card — warp glass only, keep GATOR VAULT / App Store.
FC_T0, FC_T1 = 5.36, 7.48
CLOSEUP_T1 = 1.80
END_T0 = 11.50


def font(size: int, weight: str = "bold") -> ImageFont.FreeTypeFont:
    files = {
        "bold": "/usr/share/fonts/truetype/macos/Inter-Bold.ttf",
        "semi": "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf",
        "med": "/usr/share/fonts/truetype/macos/Inter-Medium.ttf",
        "reg": "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
    }
    path = files.get(weight) or files["reg"]
    if not Path(path).exists():
        path = (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if weight in ("bold", "semi")
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        )
    return ImageFont.truetype(path, max(8, int(size)))


def _rounded(d: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 2) -> None:
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def patch_home_plate() -> Image.Image:
    """Phone-aspect Home: header + NOW + real Game Week + GNL peek.

    Matches the live cut's original glass (top of Home), not a scrolled crop.
    """
    rec = Image.open(GNL_PLATE).convert("RGB") if GNL_PLATE.exists() else None
    pw, ph = 1080, 2340
    bg = (13, 17, 29)
    im = Image.new("RGB", (pw, ph), bg)
    d = ImageDraw.Draw(im)

    pad = 48
    d.text((pad, 56), "GATORVAULT", font=font(54, "bold"), fill=WHITE)
    d.text(
        (pad, 128),
        "Only Gators get a live — recruiting, FutureCast,",
        font=font(20, "reg"),
        fill=(196, 202, 212),
    )
    d.text(
        (pad, 156),
        "team, and GNL in one vault.",
        font=font(20, "reg"),
        fill=(196, 202, 212),
    )

    pill_y, pill_h = 214, 56
    gap = 14
    pill_w = (pw - pad * 2 - gap * 2) // 3
    pills = [
        (pad, "RECRUITING", True),
        (pad + pill_w + gap, "FUTURECAST", True),
        (pad + 2 * (pill_w + gap), "GNL LIVE", False),
    ]
    for x, label, filled in pills:
        box = (x, pill_y, x + pill_w, pill_y + pill_h)
        if filled:
            _rounded(d, box, 28, ORANGE)
            d.text((x + pill_w / 2, pill_y + pill_h / 2), label, font=font(15, "semi"), fill=WHITE, anchor="mm")
        else:
            _rounded(d, box, 28, bg, outline=(210, 214, 222), width=3)
            d.text((x + pill_w / 2, pill_y + pill_h / 2), label, font=font(15, "semi"), fill=WHITE, anchor="mm")

    now_y = 310
    d.text((pad, now_y), "NOW", font=font(22, "bold"), fill=ORANGE)
    rows = [
        ("GAME", "South Carolina  ·  12:45 PM  ·  SECN"),
        ("VISITORS", "Easton Royal"),
        ("SEASON", "4-1  ·  SEC home Saturday"),
    ]
    y = now_y + 48
    for lab, val in rows:
        d.text((pad, y), lab, font=font(20, "semi"), fill=LABEL)
        d.text((pad + 200, y), val, font=font(22, "reg"), fill=WHITE)
        y += 46

    # Real Game Week + GNL from Charles's recording, fitted under the header.
    if rec is not None:
        rw, rh = rec.size
        # 0–1680 = Game Week through Open the vault; 1680–2000 = GNL card.
        gw = rec.crop((0, 0, rw, min(rh, 1680)))
        gnl = rec.crop((0, min(rh, 1680), rw, rh))
        scale = pw / rw
        gw = gw.resize((pw, max(1, int(gw.size[1] * scale))), Image.Resampling.LANCZOS)
        gnl = gnl.resize((pw, max(1, int(gnl.size[1] * scale))), Image.Resampling.LANCZOS)
        y_gw = 510
        im.paste(gw, (0, y_gw))
        y_gnl = min(ph - gnl.size[1], y_gw + gw.size[1])
        im.paste(gnl, (0, y_gnl))
        # If there's a gap, fill with navy (already the canvas).
    return im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=90, threshold=2))


def classify(sec: float, yel: int, white: int, orange: int) -> str:
    if FC_T0 <= sec <= FC_T1:
        return "futurecast"
    # Yellow ring + white card = FutureCast still on glass (swipe overlap).
    # Do not treat the orange dissolve as FutureCast — that is still Home.
    if 5.30 <= sec <= 7.55 and white > 120000 and yel > 1500:
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


def valid_quad(q: np.ndarray | None, closeup: bool = False) -> bool:
    if q is None:
        return False
    xs, ys = q[:, 0], q[:, 1]
    w = float(xs.max() - xs.min())
    h = float(ys.max() - ys.min())
    cx = float((xs.min() + xs.max()) / 2)
    max_w = 1040 if closeup else 860
    max_h = 1820 if closeup else 1760
    min_w = 240 if closeup else 260
    if w < min_w or w > max_w:
        return False
    if h < 500 or h > max_h:
        return False
    if abs(cx - W / 2) > (220 if closeup else 170):
        return False
    ar = h / max(w, 1)
    if ar < 1.45 or ar > (2.95 if closeup else 2.75):
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
    if bw >= 500:
        # Large phone: fill glass from under the island to the Open Game Week bar.
        width_div = 0.90
        sw = bw / width_div
        bottom = min(H - 4.0, y + bh + 8.0)
        top = max(150.0, bottom - min(sw * 2.35, bottom - 150.0))
        cx = x + bw / 2.0
        left = cx - sw / 2.0
        right = cx + sw / 2.0
        return np.array([[left, top], [right, top], [right, bottom], [left, bottom]], dtype=np.float32)
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


def closeup_quad(bgr: np.ndarray) -> np.ndarray | None:
    """Full glass on the opening crop — keep the island and side chrome."""
    bars = orange_bars(bgr)
    cta = best_cta(bars)
    if cta is None:
        return None
    q = quad_from_cta(cta)
    q[:, 0] = np.clip(q[:, 0], 42, W - 43)
    q[0, 1] = max(float(q[0, 1]), 208.0)
    q[1, 1] = max(float(q[1, 1]), 208.0)
    q[2, 1] = float(H - 6)
    q[3, 1] = float(H - 6)
    return q if valid_quad(q, closeup=True) else None


def find_screen_quad(bgr: np.ndarray, kind: str) -> np.ndarray | None:
    if kind == "closeup":
        return closeup_quad(bgr)
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
            glass = inset_quad(rim, 0.078, 0.062)
            bottom = float(cta[1] + cta[3] + 4)
            glass[2, 1] = bottom
            glass[3, 1] = bottom
            # Pull-back phones: keep the plate inside the black glass, not the silver rim.
            if float(glass[:, 0].max() - glass[:, 0].min()) > 600:
                glass = inset_quad(glass, 0.045, 0.012)
            if valid_quad(glass):
                return glass
    if rim is not None and valid_quad(inset_quad(rim)):
        return inset_quad(rim, 0.078, 0.062)
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


def closeup_now_patch(rgb: Image.Image, bgr: np.ndarray, plate: Image.Image) -> Image.Image:
    """Drop the clean NOW block from the plate onto the close-up glass. Soft edges."""
    bars = orange_bars(bgr)
    pills = pill_cluster(bars)
    y_pills_bot = pills[1] + pills[3] if pills else 1110
    x0 = max(20, pills[0] - 8) if pills else 36
    x1 = min(W - 20, pills[0] + int(pills[2] * 1.62)) if pills else 1040
    if x1 - x0 < 720:
        x1 = min(W - 20, x0 + 940)
    now_marks = [
        b
        for b in bars
        if 16 <= b[3] <= 55 and 40 <= b[2] <= 140 and y_pills_bot + 40 < b[1] < y_pills_bot + 320
    ]
    ny = min(now_marks, key=lambda b: b[1])[1] if now_marks else y_pills_bot + 170
    # Stop above Game Week — keep the 3D Game Week title.
    thin = [b for b in bars if b[3] <= 22 and ny + 200 < b[1] < ny + 560]
    y1 = (thin[0][1] - 18) if thin else min(H - 190, ny + 390)

    # Plate NOW lives under the pills (y≈300–500 on the 2340 plate).
    src = plate.crop((0, 292, plate.size[0], 508))
    dest_w, dest_h = max(8, x1 - x0), max(8, y1 - ny)
    src = src.resize((dest_w, dest_h), Image.Resampling.LANCZOS)

    overlay = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    overlay.paste(src.convert("RGBA"), (x0, ny))
    mask = Image.new("L", rgb.size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((x0, ny, x1, y1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=7))
    base = rgb.convert("RGBA")
    return Image.composite(overlay, base, mask).convert("RGB")


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
        close = kind == "closeup"
        if q is None or not valid_quad(q, closeup=close):
            out.append(None)
            prev = None
            prev_kind = kind
            continue
        if prev is None or prev_kind != kind:
            out.append(q)
            prev = q
        else:
            sm = (0.78 * q + 0.22 * prev).astype(np.float32)
            out.append(sm if valid_quad(sm, closeup=close) else q)
            prev = sm if valid_quad(sm, closeup=close) else q
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
        if kind in ("stadium", "endcard", "closeup"):
            quads.append(find_screen_quad(bgr, kind))
        else:
            quads.append(None)
    quads = smooth_quads(quads, kinds)

    last_q = None
    last_kind = None
    for i, p in enumerate(paths):
        sec = i / FPS
        bgr = cv2.imread(str(p))
        kind = kinds[i]
        if kind == "futurecast":
            out = bgr
            last_q = None
        elif kind == "closeup":
            q = quads[i]
            if q is not None:
                out = warp_home(bgr, plate_bgr, q)
                last_q, last_kind = q, kind
            else:
                rgb = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                out = cv2.cvtColor(np.array(closeup_now_patch(rgb, bgr, plate)), cv2.COLOR_RGB2BGR)
        else:
            q = quads[i] if quads[i] is not None else (last_q if last_kind == kind else None)
            if q is not None:
                out = warp_home(bgr, plate_bgr, q)
                last_q, last_kind = q, kind
            elif sec < 2.35:
                rgb = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                out = cv2.cvtColor(np.array(closeup_now_patch(rgb, bgr, plate)), cv2.COLOR_RGB2BGR)
            else:
                out = bgr
        cv2.imwrite(str(FRAMES_OUT / f"f{i:04d}.jpg"), out, [int(cv2.IMWRITE_JPEG_QUALITY), 93])

    for t in (0.0, 1.0, 1.5, 2.0, 2.5, 4.0, 5.2, 5.3, 5.5, 6.5, 7.5, 7.6, 7.7, 8.0, 10.0, 11.5, 12.0, 13.5, 14.0):
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
