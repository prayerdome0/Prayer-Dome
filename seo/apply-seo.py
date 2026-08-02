#!/usr/bin/env python3
"""
Prayer Dome SEO injector.

Reads seo/pages.json and injects a managed SEO block into the <head> of every
listed HTML page, then regenerates sitemap.xml and robots.txt.

The injected block is delimited by:
    <!-- PD-SEO:START --> ... <!-- PD-SEO:END -->

Running this script repeatedly is safe: an existing block is replaced, never
duplicated. Nothing outside the markers is touched, so hand-written page
markup, styles and scripts are left exactly as they are.

Usage:
    python3 seo/apply-seo.py            # apply to all pages
    python3 seo/apply-seo.py --check    # report drift, change nothing (exit 1 if stale)
"""

import json
import os
import re
import sys
from datetime import date, timezone, datetime
from html import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "seo", "pages.json")

START = "<!-- PD-SEO:START -->"
END = "<!-- PD-SEO:END -->"
BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
TITLE_RE = re.compile(r"[ \t]*<title>.*?</title>[ \t]*\n?", re.DOTALL | re.IGNORECASE)
MANIFEST_RE = re.compile(
    r"[ \t]*<link[^>]*rel=[\"']manifest[\"'][^>]*>[ \t]*\n?", re.IGNORECASE
)
CHARSET_RE = re.compile(r"<meta[^>]*charset=[^>]*>", re.IGNORECASE)
VIEWPORT_RE = re.compile(r"<meta[^>]*name=[\"']viewport[\"'][^>]*>", re.IGNORECASE)
HEAD_OPEN_RE = re.compile(r"<head[^>]*>", re.IGNORECASE)


def load():
    with open(CONFIG, encoding="utf-8") as fh:
        return json.load(fh)


def org_schema(site):
    """Church / Organization schema — emitted on every page so any entry point
    into the site tells Google who this organisation is."""
    return {
        "@context": "https://schema.org",
        "@type": "Church",
        "@id": site["baseUrl"] + "/#church",
        "name": site["siteName"],
        "alternateName": "Prayer Dome Ministries",
        "description": (
            "Prayer Dome is a house of prayer for all nations — an online and "
            "in-person Christian community for daily prayer, Bible study, "
            "devotionals, live services and church events."
        ),
        "url": site["baseUrl"] + "/",
        "logo": site["logo"],
        "image": site["defaultImage"],
        "slogan": "A House of Prayer for All Nations",
        "sameAs": site.get("sameAs", []),
        "address": {
            "@type": "PostalAddress",
            "addressLocality": site.get("addressLocality", "Lusaka"),
            "addressCountry": site.get("addressCountry", "ZM"),
        },
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": site["baseUrl"] + "/bible?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
        },
    }


def website_schema(site):
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": site["baseUrl"] + "/#website",
        "name": site["siteName"],
        "url": site["baseUrl"] + "/",
        "publisher": {"@id": site["baseUrl"] + "/#church"},
        "inLanguage": "en",
    }


def page_schema(site, page, url):
    """Per-page schema, typed from the page's `schema` key."""
    kind = page.get("schema", "webpage")
    base = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "url": url,
        "name": page["title"],
        "description": page["description"],
        "isPartOf": {"@id": site["baseUrl"] + "/#website"},
        "about": {"@id": site["baseUrl"] + "/#church"},
        "inLanguage": "en",
    }
    if kind == "church":
        # Home page already carries the full Church node; keep the WebPage light.
        base["@type"] = "WebPage"
        base["primaryImageOfPage"] = site["defaultImage"]
    elif kind == "aboutpage":
        base["@type"] = "AboutPage"
    elif kind == "contactpage":
        base["@type"] = "ContactPage"
    elif kind == "webapp":
        base["@type"] = ["WebPage", "WebApplication"]
        base["applicationCategory"] = "LifestyleApplication"
        base["operatingSystem"] = "Any"
        base["offers"] = {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
        }
    elif kind == "broadcast":
        base["@type"] = ["WebPage", "BroadcastService"]
        base["broadcastDisplayName"] = "Prayer Dome Live"
        base["provider"] = {"@id": site["baseUrl"] + "/#church"}
    elif kind == "donate":
        base["potentialAction"] = {
            "@type": "DonateAction",
            "target": url,
            "recipient": {"@id": site["baseUrl"] + "/#church"},
        }
    return base


def breadcrumb_schema(site, page, url):
    if page["path"] == "/":
        return None
    label = page["title"].split("|")[0].strip()
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": site["baseUrl"] + "/",
            },
            {"@type": "ListItem", "position": 2, "name": label, "item": url},
        ],
    }


def ld(obj):
    return (
        '    <script type="application/ld+json">\n'
        + json.dumps(obj, indent=2, ensure_ascii=False)
        + "\n    </script>"
    )


def build_block(site, filename, page, has_manifest):
    canonical = site["baseUrl"] + ("" if page["path"] == "/" else page["path"])
    if page["path"] == "/":
        canonical = site["baseUrl"] + "/"
    title = escape(page["title"], quote=True)
    desc = escape(page["description"], quote=True)
    image = page.get("image", site["defaultImage"])
    noindex = page.get("noindex", False)

    robots = (
        "noindex, nofollow"
        if noindex
        else "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    )

    lines = [
        START,
        "    <!-- Managed by seo/apply-seo.py from seo/pages.json. Do not hand-edit this block. -->",
        f"    <title>{title}</title>",
        f'    <meta name="description" content="{desc}">',
    ]
    if page.get("keywords"):
        lines.append(
            f'    <meta name="keywords" content="{escape(page["keywords"], quote=True)}">'
        )
    lines += [
        f'    <meta name="robots" content="{robots}">',
        f'    <meta name="googlebot" content="{robots}">',
        f'    <link rel="canonical" href="{canonical}">',
        f'    <meta name="author" content="{site["siteName"]}">',
        '    <meta name="theme-color" content="#0A4D9B">',
        '    <meta name="apple-mobile-web-app-capable" content="yes">',
        '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
        f'    <meta name="apple-mobile-web-app-title" content="{site["siteName"]}">',
        f'    <link rel="apple-touch-icon" href="{site["logo"]}">',
        f'    <link rel="icon" type="image/png" href="{site["logo"]}">',
        "",
        "    <!-- Open Graph / Facebook / WhatsApp -->",
        f'    <meta property="og:type" content="website">',
        f'    <meta property="og:site_name" content="{site["siteName"]}">',
        f'    <meta property="og:title" content="{title}">',
        f'    <meta property="og:description" content="{desc}">',
        f'    <meta property="og:url" content="{canonical}">',
        f'    <meta property="og:image" content="{image}">',
        '    <meta property="og:image:width" content="1200">',
        '    <meta property="og:image:height" content="630">',
        f'    <meta property="og:image:alt" content="{title}">',
        '    <meta property="og:locale" content="en_US">',
        "",
        "    <!-- Twitter / X -->",
        '    <meta name="twitter:card" content="summary_large_image">',
        f'    <meta name="twitter:site" content="{site["twitter"]}">',
        f'    <meta name="twitter:title" content="{title}">',
        f'    <meta name="twitter:description" content="{desc}">',
        f'    <meta name="twitter:image" content="{image}">',
        "",
        "    <!-- Performance hints -->",
        '    <link rel="preconnect" href="https://fonts.googleapis.com">',
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '    <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">',
        '    <link rel="dns-prefetch" href="https://www.gstatic.com">',
    ]
    if has_manifest:
        lines.append('    <link rel="manifest" href="/manifest.json">')

    lines.append("")
    lines.append("    <!-- Structured data -->")
    lines.append(ld(org_schema(site)))
    lines.append(ld(website_schema(site)))
    lines.append(ld(page_schema(site, page, canonical)))
    crumb = breadcrumb_schema(site, page, canonical)
    if crumb:
        lines.append(ld(crumb))
    lines.append(f"    {END}")
    return "\n".join(lines)


def inject(path, block):
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    original = html

    if BLOCK_RE.search(html):
        html = BLOCK_RE.sub(lambda _m: block, html, count=1)
        return html, original

    # First run for this file: strip the legacy <title> and manifest link
    # (they are reissued inside the managed block) and insert after the
    # viewport tag, falling back to charset, then to <head>.
    html = TITLE_RE.sub("", html, count=1)
    html = MANIFEST_RE.sub("", html, count=1)

    for pattern in (VIEWPORT_RE, CHARSET_RE, HEAD_OPEN_RE):
        m = pattern.search(html)
        if m:
            insert_at = m.end()
            html = html[:insert_at] + "\n    " + block + html[insert_at:]
            break
    else:
        raise SystemExit(f"{path}: no <head> found")

    return html, original


def write_sitemap(site, cfg, present):
    today = date.today().isoformat()
    entries = []
    for filename, page in cfg["pages"].items():
        if page.get("noindex") or filename not in present:
            continue
        loc = site["baseUrl"] + ("/" if page["path"] == "/" else page["path"])
        entries.append(
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f'    <changefreq>{page.get("changefreq", "weekly")}</changefreq>\n'
            f'    <priority>{page.get("priority", "0.5")}</priority>\n'
            "  </url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    return xml


def write_robots(site, cfg, present):
    disallowed = sorted(
        page["path"]
        for filename, page in cfg["pages"].items()
        if page.get("noindex") and filename in present
    )
    lines = [
        "# Prayer Dome — https://prayerdome.net",
        "# Generated by seo/apply-seo.py",
        "",
        "User-agent: *",
        "Allow: /",
    ]
    for path in disallowed:
        lines.append(f"Disallow: {path}")
    lines += [
        "Disallow: /admin.html",
        "Disallow: /finance.html",
        "Disallow: /account.html",
        "",
        "# Block noisy SEO crawlers that add no value to a church site",
        "User-agent: AhrefsBot",
        "Disallow: /",
        "",
        "User-agent: SemrushBot",
        "Disallow: /",
        "",
        "User-agent: MJ12bot",
        "Disallow: /",
        "",
        f"Sitemap: {site['baseUrl']}/sitemap.xml",
        "",
    ]
    return "\n".join(lines)


def main():
    check = "--check" in sys.argv
    cfg = load()
    site = cfg["_site"]

    present = {
        f for f in cfg["pages"] if os.path.exists(os.path.join(ROOT, f))
    }
    missing = sorted(set(cfg["pages"]) - present)

    changed, skipped = [], []
    for filename, page in cfg["pages"].items():
        path = os.path.join(ROOT, filename)
        if filename not in present:
            continue
        with open(path, encoding="utf-8") as fh:
            has_manifest = 'rel="manifest"' in fh.read()
        # Every page should be installable, so always emit the manifest link.
        block = build_block(site, filename, page, has_manifest=True)
        new, old = inject(path, block)
        if new != old:
            changed.append(filename)
            if not check:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(new)
        else:
            skipped.append(filename)

    artifacts = {
        "sitemap.xml": write_sitemap(site, cfg, present),
        "robots.txt": write_robots(site, cfg, present),
    }
    for name, content in artifacts.items():
        path = os.path.join(ROOT, name)
        old = ""
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
        # Ignore the volatile lastmod dates when deciding if the sitemap drifted.
        norm = lambda s: re.sub(r"<lastmod>[^<]*</lastmod>", "", s)
        if norm(old) != norm(content):
            changed.append(name)
            if not check:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(content)

    print(f"SEO: {len(skipped)} up to date, {len(changed)} {'stale' if check else 'updated'}")
    for name in changed:
        print(f"  {'~' if check else '+'} {name}")
    if missing:
        print(f"  note: {len(missing)} configured page(s) not on disk: {', '.join(missing)}")

    if check and changed:
        sys.exit(1)


if __name__ == "__main__":
    main()
