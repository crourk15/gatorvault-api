#!/usr/bin/env python3
"""Phone-screen swaps that match the last winning Meta ad (navy + white list)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
NAVY = (8, 18, 48)
WHITE = (255, 255, 255)
ROW = (255, 255, 255)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def draw_icon(draw, kind, cx, cy, color=WHITE):
    r = 22
    if kind == "clapper":
        draw.rectangle([cx - r, cy - 10, cx + r, cy + 16], outline=color, width=3)
        draw.line([cx - r, cy - 10, cx + r, cy - 22], fill=color, width=3)
    elif kind == "radio":
        draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], outline=color, width=3)
        draw.arc([cx - 18, cy - 18, cx + 18, cy + 18], 200, 340, fill=color, width=3)
        draw.arc([cx - 26, cy - 26, cx + 26, cy + 26], 200, 340, fill=color, width=3)
    elif kind == "cal":
        draw.rectangle([cx - r, cy - 14, cx + r, cy + 16], outline=color, width=3)
        draw.line([cx - r, cy - 2, cx + r, cy - 2], fill=color, width=3)
    elif kind == "chart":
        draw.line([cx - 16, cy + 16, cx - 16, cy - 4], fill=color, width=3)
        draw.line([cx - 4, cy + 16, cx - 4, cy - 16], fill=color, width=3)
        draw.line([cx + 8, cy + 16, cx + 8, cy], fill=color, width=3)
        draw.line([cx + 20, cy + 16, cx + 20, cy - 10], fill=color, width=3)
    elif kind == "people":
        draw.ellipse([cx - 10, cy - 18, cx + 10, cy + 2], outline=color, width=3)
        draw.arc([cx - 22, cy + 4, cx + 22, cy + 28], 200, 340, fill=color, width=3)
    elif kind == "star":
        draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], outline=color, width=3)


def render(path, title_lines, rows):
    w, h = 900, 1400
    im = Image.new("RGB", (w, h), NAVY)
    d = ImageDraw.Draw(im)
    title_font = font(BOLD, 72)
    row_font = font(BOLD, 36)
    y = 80
    for line in title_lines:
        d.text((70, y), line, font=title_font, fill=WHITE)
        y += 88
    y += 40
    for kind, label in rows:
        d.line([(70, y - 28), (w - 70, y - 28)], fill=(40, 50, 80), width=1)
        draw_icon(d, kind, 120, y + 18)
        d.text((190, y), label, font=row_font, fill=ROW)
        y += 150
    im.save(path, "PNG")
    print("wrote", path)


def main():
    render(
        OUT / "phone-2028-board.png",
        ["2028 BOARD", "IS LIVE"],
        [
            ("star", "BAILEY COMMIT"),
            ("star", "SMITH COMMIT"),
            ("chart", "CHASE BOARD"),
            ("clapper", "FILM ROOM"),
            ("cal", "GAME WEEK"),
        ],
    )
    render(
        OUT / "phone-two-commits.png",
        ["TWO COMMITS", "THIS WEEK"],
        [
            ("star", "BAILEY  OT"),
            ("star", "SMITH  DB"),
            ("chart", "THE BOARD"),
            ("clapper", "FILM ROOM"),
            ("chart", "FUTURECAST"),
        ],
    )


if __name__ == "__main__":
    main()
