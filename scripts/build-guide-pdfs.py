#!/usr/bin/env python3
"""
Prayer Dome — guide PDF builder
===============================

Renders the ministry guides kept in ``scripts/documents-src/*.md`` into
branded PDF booklets in ``/documents/*.pdf``.

The constitution has been retired; everything members need is now delivered
as a polished PDF with the Prayer Dome logo, royal-blue and gold brand
system, and consistent typography.

Run (needs reportlab + pillow):

    pip install reportlab pillow
    python3 scripts/build-guide-pdfs.py
"""
import html
import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (BaseDocTemplate, Frame, Image, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'scripts' / 'documents-src'
OUT = ROOT / 'documents'
LOGO = ROOT / 'assets' / 'logo-badge-256.png'

BLUE = HexColor('#0A4D9B')
BLUE_DEEP = HexColor('#07244d')
GOLD = HexColor('#d4af37')
GOLD_DEEP = HexColor('#a67c00')
INK = HexColor('#1f2937')
MUTED = HexColor('#64748b')

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

# Title/subtitle metadata per guide
META = {
    'statement-of-faith': {
        'title': 'Prayer Dome Statement of Faith',
        'category': 'Doctrine',
        'tagline': 'What we believe and teach',
    },
    'new-believers-guide': {
        'title': 'New Believer’s Growth Guide',
        'category': 'Discipleship',
        'tagline': 'First steps of a life with Christ',
    },
    'prayer-watch-guide': {
        'title': 'Prayer Watch Guide',
        'category': 'Prayer',
        'tagline': 'Schedules, prayer points and safeguards',
    },
    'serving-teams-handbook': {
        'title': 'Serving Teams Handbook',
        'category': 'Ministry',
        'tagline': 'Values, expectations and growth',
    },
    'small-group-guide': {
        'title': 'Small Group Discussion Guide',
        'category': 'Fellowship',
        'tagline': 'Meetings, questions and covenant',
    },
}

BODY = ParagraphStyle('Body', fontName='Helvetica', fontSize=10.5,
                      leading=16, textColor=INK, spaceAfter=7)
BULLET = ParagraphStyle('Bullet', parent=BODY, leftIndent=7 * mm,
                        bulletIndent=2 * mm, spaceAfter=4)
H2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=13.5,
                    leading=17, textColor=BLUE, spaceBefore=14, spaceAfter=6)
TITLE = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22,
                       leading=26, textColor=white, alignment=TA_LEFT)
KICKER = ParagraphStyle('Kicker', fontName='Helvetica-Bold', fontSize=8.5,
                        leading=11, textColor=HexColor('#f6df8a'),
                        alignment=TA_LEFT)
BRAND = ParagraphStyle('Brand', fontName='Helvetica-Bold', fontSize=9,
                       leading=12, textColor=HexColor('#ffffff'),
                       alignment=TA_LEFT)


def esc(t: str) -> str:
    return html.escape(t, quote=False)


def inline(t: str) -> str:
    t = esc(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'\*(.+?)\*', r'<i>\1</i>', t)
    return t


def parse_md(md: str):
    """Very small markdown subset -> reportlab flowables."""
    flow = []
    for block in re.split(r'\n\n+', md.strip()):
        block = block.strip()
        if not block:
            continue
        # A block may begin with a heading line followed by body text.
        while block.startswith('## '):
            head, _, rest = block.partition('\n')
            flow.append(Spacer(0, 2 * mm))
            flow.append(_gold_heading(inline(head[3:].strip())))
            block = rest.strip()
            if not block:
                break
        if not block:
            continue
        if block.startswith('# '):
            # First heading is the document title — already drawn on the cover.
            continue
        lines = block.split('\n')
        if all(re.match(r'\s*[-•]\s+', ln) for ln in lines):
            for ln in lines:
                txt = re.sub(r'^\s*[-•]\s+', '', ln)
                flow.append(Paragraph(inline(txt), BULLET, bulletText='•'))
            continue
        if all(re.match(r'\s*\d+[.)]\s+', ln) for ln in lines):
            for ln in lines:
                m = re.match(r'\s*(\d+[.)])\s+(.*)', ln)
                flow.append(Paragraph(inline(m.group(2)), BULLET,
                                      bulletText=m.group(1)))
            continue
        flow.append(Paragraph(inline(' '.join(ln.strip() for ln in lines)), BODY))
    return flow


def _gold_heading(text: str) -> Table:
    """Section heading with a small gold bar in front."""
    bar = Table([['']], colWidths=[3 * mm], rowHeights=[8 * mm])
    bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    t = Table([[bar, Paragraph(text, H2)]],
              colWidths=[5 * mm, PAGE_W - 2 * MARGIN - 5 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (0, 0), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    return t


def cover_banner(meta) -> Table:
    """Royal-blue banner with logo, brand name, title and tagline."""
    logo_col = []
    if LOGO.exists():
        logo_col.append(Image(str(LOGO), width=22 * mm, height=22 * mm))
    left = Table([[logo_col[0] if logo_col else '',
                   Paragraph('PRAYER DOME', BRAND)]],
                 colWidths=[25 * mm, 40 * mm])
    left.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (1, 0), (1, 0), 2 * mm),
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),
    ]))

    texts = [
        Paragraph('PRAYER DOME MINISTRY · 2026 EDITION · ' + esc(meta['category']).upper(), KICKER),
        Spacer(0, 2 * mm),
        Paragraph(esc(meta['title']), TITLE),
        Spacer(0, 1.5 * mm),
        Paragraph('<font color="#dbeafe">' + esc(meta['tagline']) + '</font>',
                  ParagraphStyle('Tag', fontName='Helvetica-Oblique',
                                 fontSize=10, leading=13, textColor=white)),
    ]
    wrap = Table([[left], [Spacer(0, 5 * mm)]] + [[x] for x in texts],
                 colWidths=[PAGE_W - 2 * MARGIN - 12 * mm])
    wrap.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BLUE),
        ('LEFTPADDING', (0, 0), (-1, -1), 8 * mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8 * mm),
        ('TOPPADDING', (0, 0), (0, 0), 8 * mm),
        ('TOPPADDING', (0, 1), (0, 1), 0),
        ('BOTTOMPADDING', (0, 0), (0, -2), 0),
        ('BOTTOMPADDING', (0, -1), (0, -1), 8 * mm),
        ('LINEBELOW', (0, -1), (-1, -1), 1.6, GOLD),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    return wrap


def footer(canvas: pdfcanvas.Canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.8)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 10 * mm,
                      'Prayer Dome · A House of Prayer for All Nations · prayerdome.net')
    canvas.drawRightString(PAGE_W - MARGIN, 10 * mm,
                           'Page %d' % doc.page)
    canvas.restoreState()


def build(slug: str):
    md_path = SRC / (slug + '.md')
    if not md_path.exists():
        print('skip', slug, '(no source)')
        return
    meta = META.get(slug, {'title': slug.replace('-', ' ').title(),
                           'category': 'Guide', 'tagline': ''})
    doc = BaseDocTemplate(
        str(OUT / (slug + '.pdf')), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=20 * mm,
        title=meta['title'], author='Prayer Dome',
        subject='Prayer Dome ' + meta['category'],
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id='main')
    doc.addPageTemplates([PageTemplate(id='page', frames=[frame],
                                       onPage=footer)])

    story = [cover_banner(meta), Spacer(0, 8 * mm)]
    story += parse_md(md_path.read_text(encoding='utf-8'))
    story += [Spacer(0, 10 * mm),
              Paragraph('<font color="#a67c00"><b>“He hath done all things well.” — Mark 7:37</b></font>',
                        ParagraphStyle('Close', parent=BODY, alignment=TA_CENTER))]
    doc.build(story)
    size = (OUT / (slug + '.pdf')).stat().st_size
    print('built', slug + '.pdf', f'({size} bytes)')


def main():
    OUT.mkdir(exist_ok=True)
    for src in sorted(SRC.glob('*.md')):
        build(src.stem)


if __name__ == '__main__':
    main()
