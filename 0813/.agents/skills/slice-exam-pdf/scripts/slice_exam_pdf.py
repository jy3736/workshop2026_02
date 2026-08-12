#!/usr/bin/env python3
"""Slice a TCTE (技專校院入學測驗中心) exam-question PDF into one PNG per
question, and pair each with its answer from the standard-answer PDF.

Usage:
    python3 slice_exam_pdf.py \\
        --year 114 \\
        --subject 1:/path/to/專業一題目.pdf:/path/to/專業一答案.pdf \\
        --subject 2:/path/to/專業二題目.pdf:/path/to/專業二答案.pdf \\
        --out-dir /path/to/module4/repo-114

Writes <out-dir>/<year>專業<N>Q<q>.png for every question, plus a single
<out-dir>/<year>keys.json mapping every image filename to its answer
letter(s).

Template constants (CONTENT_TOP/BOTTOM, TOP_PAD, ZOOM) were measured against
the 114 學年度 4y exam PDFs. Re-measure with --dump-page before trusting them
on a differently-formatted source (different year/agency template).
"""
import argparse
import io
import json
import os
import re
import sys

import fitz  # PyMuPDF
from PIL import Image

ZOOM = 3.0
TOP_PAD = 8
CONTENT_TOP = 63     # just below header + watermark bottom (~59.7pt), above first content line (~71.6pt)
CONTENT_BOTTOM = 806  # just above the "-N-" footer marker (~810.7pt)

QNUM_RE = re.compile(r"^(\d{1,2})\.\s")
PASSAGE_RE = re.compile(r"回答第\s*(\d+)\s*[-–—]\s*(\d+)\s*題")
ANSWER_RE = re.compile(r"^[A-D]+$")


def render_clip(page, rect, zoom=ZOOM):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def crop_range(doc, start_page, top, end_page, end_y):
    """Render the region from (start_page, top) to (end_page, end_y),
    stitching across pages if it spans more than one (trap #5). `top` is
    already the final, padding-adjusted y — see `safe_top()`."""
    if start_page == end_page:
        page = doc[start_page]
        rect = fitz.Rect(0, top, page.rect.width, end_y)
        return render_clip(page, rect)

    imgs = []
    page0 = doc[start_page]
    imgs.append(render_clip(page0, fitz.Rect(0, top, page0.rect.width, CONTENT_BOTTOM)))
    for pno in range(start_page + 1, end_page):
        pm = doc[pno]
        imgs.append(render_clip(pm, fitz.Rect(0, CONTENT_TOP, pm.rect.width, CONTENT_BOTTOM)))
    pageN = doc[end_page]
    imgs.append(render_clip(pageN, fitz.Rect(0, CONTENT_TOP, pageN.rect.width, end_y)))
    return vstack(imgs)


def vstack(imgs):
    w = max(im.width for im in imgs)
    h = sum(im.height for im in imgs)
    out = Image.new("RGB", (w, h), "white")
    y = 0
    for im in imgs:
        out.paste(im, (0, y))
        y += im.height
    return out


def extract_lines(doc, start_page=1):
    """Line-level (page, y0, y1, x0, text) tuples in page-major reading
    order. Reads by line (not block) — a PDF block often spans multiple
    questions, so scanning only each block's first line would silently skip
    questions (trap #1)."""
    items = []
    for pno in range(start_page, len(doc)):
        d = doc[pno].get_text("dict")
        page_lines = []
        for block in d["blocks"]:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                text = "".join(s["text"] for s in line["spans"])
                if text.strip():
                    bbox = line["bbox"]
                    page_lines.append((bbox[1], bbox[3], bbox[0], text))
        page_lines.sort()
        for y0, y1, x0, t in page_lines:
            items.append((pno, y0, y1, x0, t))
    return items


def collect_line_bottoms(items):
    """page -> sorted [(y0, y1), ...] for every line, used by safe_top() to
    find how much clearance actually exists above a boundary before adding
    padding there."""
    by_page = {}
    for pno, y0, y1, x0, text in items:
        by_page.setdefault(pno, []).append((y0, y1))
    for pno in by_page:
        by_page[pno].sort()
    return by_page


def safe_top(page, y0, desired_pad, line_bottoms_by_page, epsilon=1.5):
    """Padding above a boundary must never eat into the preceding line —
    e.g. a passage-group header can sit as little as ~7pt below the prior
    question's last answer choice, well under a flat 8pt pad. Clamp the pad
    to the real gap (with a small epsilon of slack) instead of assuming
    there's always room for the full desired padding."""
    prev_y1 = None
    for by0, by1 in line_bottoms_by_page.get(page, []):
        if by0 < y0 - 0.01 and (prev_y1 is None or by1 > prev_y1):
            prev_y1 = by1
    if prev_y1 is None:
        return max(0, y0 - desired_pad)
    gap = y0 - prev_y1
    pad = min(desired_pad, max(0, gap - epsilon))
    return max(0, y0 - pad)


def find_boundaries(items, total=50):
    """Walk the reading-order stream with an expected-next-question cursor
    (trap #2: guards against false-positive matches like a cover-page
    "1.請核對…" note list) and record every question's own start position,
    plus passage-group headers (trap #3: "▲閱讀下文，回答第X-Y題").

    Trap #9: some papers (e.g. 數學 common-subject exams) carry a reference-
    formula block ("參考公式") right on the first content page, itself a
    numbered list ("1. 點P...", "2. 若α、β...") that collides with the
    expected-cursor check just like a cover-page notice list would. Unlike
    the cover page, this block isn't on a page we can skip wholesale — real
    questions follow immediately after it on the same page. A column-based
    fix (real questions flush left, list items indented a few points in)
    turned out fragile: in some papers real single-digit question numbers
    ("1.") sit closer to the indented list's x0 than to real double-digit
    question numbers ("10.") in the same document, because the number
    column is right-aligned and shifts with digit count. Geometry aside,
    the signature of this collision is unambiguous either way: the
    candidate stream visits number 1 twice — once for the false list, once
    for the real Q1 — before ever reaching 2. Whenever a candidate for "1"
    appears more than once, only the *last* one can be real (an expected-
    cursor walk that accepted an earlier one would have to reach the same
    number again to recover), so everything before it is dropped outright."""
    ones = [i for i, (pno, y0, y1, x0, text) in enumerate(items)
            if QNUM_RE.match(text.strip()) and int(QNUM_RE.match(text.strip()).group(1)) == 1]
    if len(ones) > 1:
        items = items[ones[-1]:]

    q_pos = {}
    group_start_pos = {}   # X -> (page, y0) of the passage header
    group_of = {}          # every q in [X..Y] -> X
    pending_passage = None
    expected = 1

    for idx, (pno, y0, y1, x0, text) in enumerate(items):
        t = text.strip()
        m = PASSAGE_RE.search(t)
        if m:
            X, Y = int(m.group(1)), int(m.group(2))
            if X == expected:
                pending_passage = (pno, y0, X, Y)
            continue
        m2 = QNUM_RE.match(t)
        if m2:
            n = int(m2.group(1))
            if n == expected and n <= total:
                q_pos[n] = widen_to_block_top(items, idx, pno, y0)
                if pending_passage and pending_passage[2] == n:
                    php, phy0, X, Y = pending_passage
                    group_start_pos[X] = (php, phy0)
                    for gq in range(X, Y + 1):
                        group_of[gq] = X
                pending_passage = None
                expected += 1

    missing = [q for q in range(1, total + 1) if q not in q_pos]
    if missing:
        raise RuntimeError(f"question boundary detection incomplete, missing: {missing}")
    return q_pos, group_start_pos, group_of


def widen_to_block_top(items, idx, pno, y0, gap_threshold=10.0):
    """Trap #10: a question's opening line can carry a vertically-tall
    inline element (a brace-grouped system of equations, a stacked
    fraction) whose top extends above the plain-text baseline that
    QNUM_RE matched on — e.g. "12. 若 abc≠0，且聯立方程式{ax+by=c ..." where
    the "{...}" system's top row sits ~11pt above "12."'s own y0. Using
    only the matched line's y0 as this question's top boundary then crops
    the previous question's image right through the middle of that
    element (its top rows, physically above the recorded y0, get pulled
    into the previous crop, which is `crop_top_of` looking at this exact
    value; then the recorded y0 itself cuts the element off mid-glyph in
    *this* question's own crop).

    Fix: walk backward from the matched line through immediately
    preceding items on the same page, and keep extending the top upward
    as long as consecutive items sit within `gap_threshold` points of each
    other — the signature of a tightly packed multi-fragment layout (a
    stacked equation), as opposed to genuine inter-question whitespace
    (consistently far larger than this in every measured template)."""
    top_y = y0
    j = idx - 1
    while j >= 0:
        ppno, py0, py1, px0, ptext = items[j]
        if ppno != pno or (top_y - py0) >= gap_threshold:
            break
        top_y = py0
        j -= 1
    return (pno, top_y)


def crop_top_of(q, q_pos, group_start_pos):
    if q in group_start_pos:
        return group_start_pos[q]
    return q_pos[q]


def build_question_image(doc, q, total, q_pos, group_start_pos, group_of, line_bottoms_by_page):
    own_page, own_y = q_pos[q]
    if q < total:
        end_page, end_y = crop_top_of(q + 1, q_pos, group_start_pos)
    else:
        end_page, end_y = len(doc) - 1, CONTENT_BOTTOM

    if q in group_start_pos:
        top_page, top_y = group_start_pos[q]
        top = safe_top(top_page, top_y, TOP_PAD, line_bottoms_by_page)
        return crop_range(doc, top_page, top, end_page, end_y)

    if q in group_of and group_of[q] != q:
        # Non-first member of a reading-passage group (trap #3): the shared
        # description isn't reprinted, so stitch it back on top of this
        # question's own block.
        X = group_of[q]
        shared_top_page, shared_top_y = group_start_pos[X]
        shared_end_page, shared_end_y = q_pos[X]
        shared_top = safe_top(shared_top_page, shared_top_y, TOP_PAD, line_bottoms_by_page)
        shared_img = crop_range(doc, shared_top_page, shared_top, shared_end_page, shared_end_y)
        own_top = safe_top(own_page, own_y, TOP_PAD, line_bottoms_by_page)
        own_img = crop_range(doc, own_page, own_top, end_page, end_y)
        return vstack([shared_img, own_img])

    top = safe_top(own_page, own_y, TOP_PAD, line_bottoms_by_page)
    return crop_range(doc, own_page, top, end_page, end_y)


def parse_answers(answer_pdf, total=50):
    """Cursor-scan the answer table's token stream (trap #8). A number
    token is paired with the following token only if that token is a valid
    answer pattern (A/B/C/D or a combo like "AD"); otherwise only the
    number is consumed, so a blank cell — whether it's an explicit blank
    token or omitted outright — never desyncs the rest of the scan."""
    doc = fitz.open(answer_pdf)
    text = "\n".join(doc[p].get_text() for p in range(len(doc)))
    lines = [l.strip() for l in text.split("\n")]
    result = {}
    i, n = 0, len(lines)
    while i < n:
        tok = lines[i]
        if tok.isdigit():
            num = int(tok)
            if 1 <= num <= total:
                if i + 1 < n and ANSWER_RE.match(lines[i + 1]):
                    result[num] = lines[i + 1]
                    i += 2
                    continue
        i += 1
    missing = [q for q in range(1, total + 1) if q not in result]
    if missing:
        raise RuntimeError(f"answer parsing incomplete, missing: {missing}")
    return result


def slice_subject(question_pdf, answer_pdf, subject_label, year, out_dir, total=50):
    doc = fitz.open(question_pdf)
    items = extract_lines(doc, start_page=1)
    q_pos, group_start_pos, group_of = find_boundaries(items, total=total)
    line_bottoms_by_page = collect_line_bottoms(items)
    answers = parse_answers(answer_pdf, total=total)

    keys = {}
    for q in range(1, total + 1):
        img = build_question_image(doc, q, total, q_pos, group_start_pos, group_of, line_bottoms_by_page)
        fname = f"{year}專業{subject_label}Q{q}.png"
        img.save(os.path.join(out_dir, fname))
        keys[fname] = answers[q]
    n_groups = len(group_start_pos)
    print(f"  subject {subject_label}: {total} images, {n_groups} passage group(s) "
          f"({sorted(group_start_pos.keys())})", file=sys.stderr)
    return keys


def dump_page(pdf_path, page_index):
    doc = fitz.open(pdf_path)
    d = doc[page_index].get_text("dict")
    lines = []
    for block in d["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            text = "".join(s["text"] for s in line["spans"])
            if text.strip():
                lines.append((line["bbox"][1], line["bbox"][0], text))
    lines.sort()
    for y0, x0, t in lines:
        print(f"y0={y0:.1f} x0={x0:.1f} {t!r}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--year", required=True, help="school year prefix, e.g. 114")
    ap.add_argument("--subject", action="append", required=True,
                     help='label:question_pdf:answer_pdf, e.g. "1:專業一題目.pdf:專業一答案.pdf" '
                          '(repeatable)')
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--total", type=int, default=50)
    ap.add_argument("--dump-page", metavar="PDF:PAGE_INDEX",
                     help="debug: print line coordinates for one page and exit")
    args = ap.parse_args()

    if args.dump_page:
        pdf_path, page_index = args.dump_page.rsplit(":", 1)
        dump_page(pdf_path, int(page_index))
        return

    os.makedirs(args.out_dir, exist_ok=True)
    all_keys = {}
    for spec in args.subject:
        label, question_pdf, answer_pdf = spec.split(":", 2)
        keys = slice_subject(question_pdf, answer_pdf, label, args.year, args.out_dir, total=args.total)
        all_keys.update(keys)

    keys_path = os.path.join(args.out_dir, f"{args.year}keys.json")
    with open(keys_path, "w", encoding="utf-8") as f:
        json.dump(all_keys, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(f"wrote {len(all_keys)} images + {keys_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
