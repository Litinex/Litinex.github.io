"""Build WebP alternatives and update local HTML images. Requires Pillow.

Charts use lossless WebP at their original resolution. Smaller alternatives
serve narrow screens; original PNG/JPG/SVG files remain available as fallbacks.
Run from any directory: python scripts/optimize-images.py
"""

import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ATTRIBUTES = re.compile(r'([\w:-]+)="([^"]*)"')
generated = set()


def set_attribute(tag, name, value):
    pattern = rf'\s{re.escape(name)}="[^"]*"'
    if re.search(pattern, tag):
        return re.sub(pattern, lambda _: f' {name}="{value}"', tag)
    return tag[:-1] + f' {name}="{value}">'


def convert_image(source, width=None):
    suffix = f"-{width}" if width else ""
    destination = source.with_name(f"{source.stem}{suffix}.webp")
    if destination in generated:
        return destination
    with Image.open(source) as original:
        image = original.convert("RGB") if original.mode != "RGBA" else original.copy()
        if width and width < image.width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", lossless=source.suffix.lower() == ".png", quality=84, method=6)
    generated.add(destination)
    return destination


def webp_sources(source, prefix):
    with Image.open(source) as image:
        width = image.width
    candidates = []
    if width > 800:
        candidates.append((convert_image(source, 800), 800))
    candidates.append((convert_image(source), width))
    return ", ".join(f"{prefix}{path.name} {size}w" for path, size in candidates)


def optimize_element(element, page):
    image_match = re.search(r'<img\b[^>]*>', element, re.S)
    if not image_match:
        return element
    image_tag = image_match.group()
    attributes = dict(ATTRIBUTES.findall(image_tag))
    src = attributes.get("src", "").split("?")[0]
    source = (page.parent / src).resolve()
    if source.parent != ASSETS or not source.is_file():
        return element

    hero = source.name.startswith("hero-sky")
    article = page.parent.name == "posts"
    if article:
        image_tag = set_attribute(image_tag, "loading", "lazy")
    image_tag = set_attribute(image_tag, "decoding", "async")
    if source.suffix.lower() in (".jpg", ".jpeg", ".png"):
        with Image.open(source) as image:
            # Avatar dimensions intentionally describe its display box.
            if hero or article or "width" not in attributes:
                image_tag = set_attribute(image_tag, "width", str(image.width))
                image_tag = set_attribute(image_tag, "height", str(image.height))
    element = element[:image_match.start()] + image_tag + element[image_match.end():]
    if source.suffix.lower() == ".svg":
        return element

    prefix = "../assets/" if article else "assets/"
    if hero:
        sizes = "100vw"
        candidates = [(convert_image(ASSETS / "hero-sky-1280.jpg", 640), 640)]
        candidates.extend((convert_image(ASSETS / f"hero-sky-{width}.jpg"), width)
                          for width in (1280, 1920, 2560))
        srcset = ", ".join(f"{prefix}{path.name} {width}w" for path, width in candidates)
        fallback = ", ".join(f"{prefix}hero-sky-{width}.jpg {width}w" for width in (1280, 1920, 2560))
        image_tag = set_attribute(image_tag, "srcset", fallback)
        image_tag = set_attribute(image_tag, "sizes", sizes)
        image_tag = set_attribute(image_tag, "fetchpriority", "high")
    else:
        srcset = webp_sources(source, prefix)
        sizes = "(min-width: 1200px) 960px, (min-width: 720px) 840px, calc(100vw - 62px)" if article else "104px"

    webp = f'<source type="image/webp" srcset="{srcset}" sizes="{sizes}">'
    if element.startswith("<picture"):
        opening = element[:element.index(">") + 1]
    else:
        opening = "<picture>"
    return f"{opening}\n          {webp}\n          {image_tag}\n        </picture>"


def main():
    updated = 0
    pages = sorted(ROOT.glob("*.html")) + sorted((ROOT / "posts").glob("*.html"))
    element_pattern = re.compile(r'<picture\b[^>]*>.*?</picture>|<img\b[^>]*>', re.S)
    for page in pages:
        text = page.read_text(encoding="utf-8")
        optimized = element_pattern.sub(lambda match: optimize_element(match.group(), page), text)
        if page.name == "index.html":
            # Preload the same format/srcset as <picture> to avoid downloading both formats.
            hero = re.search(r'<source type="image/webp" srcset="([^"]*hero-sky[^"]*)" sizes="100vw">', optimized)
            if hero:
                preload = (f'<link rel="preload" as="image" type="image/webp" href="assets/hero-sky-1920.webp" '
                           f'imagesrcset="{hero.group(1)}" imagesizes="100vw">')
                optimized = re.sub(r'<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>', lambda _: preload, optimized)
        if optimized != text:
            page.write_text(optimized, encoding="utf-8", newline="\n")
            updated += 1
    total = sum(path.stat().st_size for path in generated)
    print(f"Generated {len(generated)} WebP assets ({total:,} bytes); updated {updated} pages.")


if __name__ == "__main__":
    main()
