"""Membuat ikon launcher Android dari www/icons/icon-512.png"""
import os, sys
from PIL import Image, ImageDraw
SRC = "www/icons/icon-512.png"
RES = "android/app/src/main/res"
img = Image.open(SRC).convert("RGB")
legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fore = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for d, px in legacy.items():
    out = os.path.join(RES, f"mipmap-{d}"); os.makedirs(out, exist_ok=True)
    sq = img.resize((px, px), Image.LANCZOS); sq.save(os.path.join(out, "ic_launcher.png"))
    mask = Image.new("L", (px * 4, px * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    mask = mask.resize((px, px), Image.LANCZOS); rd = Image.new("RGBA", (px, px), (0, 0, 0, 0)); rd.paste(sq, (0, 0), mask)
    rd.save(os.path.join(out, "ic_launcher_round.png"))
for d, px in fore.items():
    out = os.path.join(RES, f"mipmap-{d}"); os.makedirs(out, exist_ok=True)
    canvas = Image.new("RGBA", (px, px), (255, 255, 255, 255)); s = int(px * 0.62)
    canvas.paste(img.resize((s, s), Image.LANCZOS), ((px - s) // 2, (px - s) // 2)); canvas.save(os.path.join(out, "ic_launcher_foreground.png"))
# Hapus ikon vektor bawaan agar tidak bentrok dengan PNG kita
for root, _, files in os.walk(RES):
    for f in files:
        if f in ("ic_launcher_foreground.xml",): os.remove(os.path.join(root, f))
print("Ikon dibuat")
