#!/usr/bin/env python3
"""
Prayer Dome — official logo renderer (real-logo mode)
=====================================================

Uses the authoritative Prayer Dome mark committed as ``assets/logo-master.png`` at the
repository root (3264 px, transparent) and derives the canonical asset set:

    assets/logo.png        512 px  (site, certificate, PWA 512, OG)
    assets/logo-192.png    192 px  (PWA)
    assets/logo-256.png    256 px  (guide PDF cover banner)
    assets/logo-badge-256.png 256 px (PDF banner badge)
    assets/logo-source.png 1024 px (square trimmed source)
    mobile/app-icon.png   1024 px  (Capacitor)
    android/app/src/main/res/mipmap-*/ic_launcher*.png  (all densities)

The source artwork is *never* procedurally redrawn; it is cropped to its
non-transparent bounds, padded to a square, and scaled with high-quality
Lanczos.  This guarantees the mark is identical everywhere — on pages,
certificates, PDFs, the Play Store listing and the share card.

Run:

    pip install pillow
    python3 scripts/build-logo.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "logo-master.png"

# Target sizes
WANTED = [
    (ROOT / "assets" / "logo.png", 512),
    (ROOT / "assets" / "logo-192.png", 192),
    (ROOT / "assets" / "logo-256.png", 256),
    (ROOT / "assets" / "logo-badge-256.png", 256),
    (ROOT / "assets" / "logo-source.png", 1024),
    (ROOT / "mobile" / "app-icon.png", 1024),
]

ANDROID = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def load_square():
    im = Image.open(SRC).convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if bbox is None:
        raise SystemExit("source logo appears fully transparent")
    cropped = im.crop(bbox)
    w, h = cropped.size
    pad = int(max(w, h) * 0.08)
    new_w, new_h = w + 2 * pad, h + 2 * pad
    side = max(new_w, new_h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)
    return square


def main():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC} — commit the real logo as assets/logo-master.png first")
    square = load_square()
    print(f"source square {square.size} from {SRC}")

    for out, px in WANTED:
        out.parent.mkdir(parents=True, exist_ok=True)
        resized = square.resize((px, px), Image.LANCZOS)
        resized.save(out, optimize=True)
        print(f"wrote {out.relative_to(ROOT)} {resized.size} ({out.stat().st_size} bytes)")

    for folder, dim in ANDROID.items():
        base = ROOT / "android" / "app" / "src" / "main" / "res" / folder
        base.mkdir(parents=True, exist_ok=True)
        icon = square.resize((dim, dim), Image.LANCZOS)
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
            out = base / name
            icon.save(out, optimize=True)
            print(f"wrote {out.relative_to(ROOT)} {dim}")

    # The share card (og-image) is built separately — it composes the same
    # square onto a branded 1200×630 canvas — so we leave it untouched here.

    print("done — the real Prayer Dome mark is now everywhere.")


if __name__ == "__main__":
    main()
