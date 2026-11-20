#!/usr/bin/env python3
"""Crop Charles's phone chrome off the elite 10s App Install cut.

Removes the iOS status bar / Dynamic Island (time, battery, record dot,
fantasy Live Activity) by cutting the top 110px and scaling back to
1080x1920. Keeps the already-fixed App Store end card and original AAC.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "creatives" / "fb-elite-appstore-10s.mp4"
OUT = HERE / "creatives" / "fb-elite-appstore-10s.mp4"
TMP = HERE / "creatives" / "fb-elite-appstore-10s.tmp.mp4"
STILL = HERE / "creatives" / "fb-elite-appstore-still.jpg"
QA = Path("/tmp/elite-chrome-qa")

CROP_TOP = 110
W, H = 1080, 1920


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    QA.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg", "-y",
            "-i", str(SRC),
            "-vf", f"crop={W}:{H - CROP_TOP}:0:{CROP_TOP},scale={W}:{H}:flags=lanczos,setsar=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16",
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(TMP),
        ]
    )
    TMP.replace(OUT)
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-i", str(OUT),
            "-vf", "select='eq(n\\,15)+eq(n\\,40)+eq(n\\,70)+eq(n\\,130)+eq(n\\,220)+eq(n\\,290)'",
            "-vsync", "vfr", "-q:v", "2",
            str(QA / "q%d.jpg"),
        ]
    )
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(OUT), "-ss", "1.4", "-frames:v", "1", "-q:v", "2", str(STILL)]
    )
    print("wrote", OUT)


if __name__ == "__main__":
    main()
