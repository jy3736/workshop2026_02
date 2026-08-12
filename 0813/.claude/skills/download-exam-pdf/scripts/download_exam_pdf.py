#!/usr/bin/env python3
"""Download a TCTE (技專校院入學測驗中心) exam-question PDF pair (試題 +
標準答案) for a given 學年度 and 群/類, from the exam's static results page.

Usage:
    python3 download_exam_pdf.py \\
        --year 115 \\
        --group 電機與電子群資電類 \\
        --subjects 1,2 \\
        --out-dir module2/raw/115

--group is optional and defaults to 電機與電子群資電類 (this project's
original target group) — pass a different 群/類 name substring to fetch
another group for the same or a different 學年度.

Writes <out-dir>/<year>專業<一|二>試題.pdf and <out-dir>/<year>專業<一|二>答案.pdf
for each subject in --subjects, matching the input shape slice-exam-pdf expects.

The results page (https://web1.tcte.edu.tw/EXAM/<year>_4y/) is a plain
server-rendered PHP table, no JavaScript rendering needed — a normal HTTP GET
returns the same HTML a browser would see. The download buttons are
`<input type="image" onclick="location.href='downloader.php?obj=<base64>'">`,
not `<a href>`, so a naive link scrape misses them; this script regex-parses
the raw HTML instead. Fetching the actual PDF requires a Referer header set
to the results page, or the server rejects the request.
"""
import argparse
import base64
import os
import re
import sys
import urllib.request

UA = "Mozilla/5.0 (compatible; download-exam-pdf-skill/1.0)"
SUBJECT_LABELS = {"1": "專業科目(一)", "2": "專業科目(二)"}
SUBJECT_CN = {"1": "一", "2": "二"}


def fetch_url(url, referer=None):
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def find_group_tbody(html_text, group_name):
    """Isolate the <tbody>...</tbody> block for one 群/類 row-group.

    Anchors on the group's own heading cell (`<td ...>04電機與電子群資電類`,
    optionally with a 2-digit code before the name) rather than a bare
    substring search — several groups' 成績組距 cells cross-reference *other*
    group names in plain note text (e.g. "組距請參考以下群(類)別：電機與電
    子群電機類、電機與電子群資電類"), which would otherwise false-match.
    """
    heading_re = re.compile(r"<td\b[^>]*>\s*\d{0,3}" + re.escape(group_name))
    blocks = re.split(r"<tbody>", html_text)
    hits = []
    for b in blocks:
        block = b[: b.find("</tbody>")] if "</tbody>" in b else b
        if heading_re.search(block):
            hits.append(block)
    if not hits:
        raise ValueError(f"群/類 not found on page: {group_name!r}")
    if len(hits) > 1:
        raise ValueError(
            f"群/類 matched {len(hits)} row-groups: {group_name!r} — "
            "pass a more specific (longer) name"
        )
    return hits[0]


def cells_of_row(row_segment):
    """Split one <tr> segment into its <td> cells. The source HTML never
    closes <td>/<tr> tags, so a <td>-boundary split is the only reliable cut."""
    return re.split(r"<td\b", row_segment)[1:]


def extract_pdf_obj(cell_text):
    """Pull the base64 `obj` param off the PDF-icon <input> in one cell
    (cells with a 試題 also carry a Word-icon <input> — skip that one)."""
    for m in re.finditer(r"<input\b[^>]*>", cell_text):
        tag = m.group(0)
        if "PDF File" not in tag:
            continue
        om = re.search(r"downloader\.php\?obj=([^'\"]+)", tag)
        if om:
            return om.group(1)
    return None


def extract_subject_links(tbody_block, subject_label):
    """Find the row for one subject (專業科目(一)/(二)) and return the
    (試題 obj, 標準答案 obj) pair. Located by finding the label cell, then
    reading the two cells immediately after it — this is robust to whichever
    optional 群類-name / 成績組距 rowspan cells precede it, since those only
    ever appear *before* the subject label, never between it and 試題/答案."""
    for row in re.split(r"<tr\b", tbody_block):
        cells = cells_of_row(row)
        for i, c in enumerate(cells):
            if subject_label in c and "<input" not in c:
                if i + 2 >= len(cells):
                    raise ValueError(f"row for {subject_label!r} is missing 試題/答案 cells")
                exam_obj = extract_pdf_obj(cells[i + 1])
                answer_obj = extract_pdf_obj(cells[i + 2])
                if not exam_obj or not answer_obj:
                    raise ValueError(f"could not find PDF links next to {subject_label!r}")
                return exam_obj, answer_obj
    raise ValueError(
        f"subject not found in this 群/類's row-group: {subject_label!r} — "
        "combined-code groups (51-56) split 專業科目(二) by sub-群類; "
        "this script only picks the first match, disambiguate by hand if that's wrong"
    )


def decoded_name(obj):
    return base64.b64decode(obj + "=" * (-len(obj) % 4)).decode("utf-8", errors="replace")


def verify_pdf(path, group_name, subject_label):
    """Sanity-check a downloaded PDF's own title page before trusting it —
    a successful HTTP fetch doesn't guarantee the obj code decoded to the
    file the caller actually asked for."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print(f"    [skip verify: PyMuPDF not installed] {path}")
        return
    doc = fitz.open(path)
    text = doc[0].get_text()
    ok_group = group_name in text
    ok_subject = subject_label in text
    status = "OK" if (ok_group and ok_subject) else "MISMATCH"
    print(f"    verify [{status}]: {len(doc)} page(s), 群類{'✓' if ok_group else '✗'} 科目{'✓' if ok_subject else '✗'} — {path}")
    if status == "MISMATCH":
        print(f"      -> open {path} by hand, this may be the wrong group/subject")


def download_subject(page_url, tbody_block, year, subject_key, out_dir, group_name, dry_run=False):
    label = SUBJECT_LABELS[subject_key]
    cn = SUBJECT_CN[subject_key]
    exam_obj, answer_obj = extract_subject_links(tbody_block, label)

    print(f"  {label}: 試題 -> {decoded_name(exam_obj)}, 標準答案 -> {decoded_name(answer_obj)}")
    if dry_run:
        return

    os.makedirs(out_dir, exist_ok=True)
    for obj, tag in ((exam_obj, "試題"), (answer_obj, "答案")):
        url = f"{page_url}downloader.php?obj={obj}"
        data = fetch_url(url, referer=page_url)
        out_path = os.path.join(out_dir, f"{year}專業{cn}{tag}.pdf")
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"    wrote {out_path} ({len(data)} bytes)")
        verify_pdf(out_path, group_name, label)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", required=True, help="學年度, e.g. 115")
    ap.add_argument(
        "--group",
        default="電機與電子群資電類",
        help="群/類 name substring (default: %(default)s)",
    )
    ap.add_argument("--subjects", default="1,2", help="comma-separated subject numbers, default 1,2")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--exam-type", default="4y", help="URL path segment: 4y (四技二專, default) or 2y (二技)")
    ap.add_argument("--dry-run", action="store_true", help="resolve and print links without downloading")
    args = ap.parse_args()

    page_url = f"https://web1.tcte.edu.tw/EXAM/{args.year}_{args.exam_type}/"
    print(f"fetching {page_url}")
    html_text = fetch_url(page_url).decode("utf-8", errors="ignore")

    tbody_block = find_group_tbody(html_text, args.group)
    print(f"found 群/類: {args.group}")

    for subject_key in args.subjects.split(","):
        subject_key = subject_key.strip()
        if subject_key not in SUBJECT_LABELS:
            print(f"skip unknown subject key: {subject_key}", file=sys.stderr)
            continue
        download_subject(page_url, tbody_block, args.year, subject_key, args.out_dir, args.group, dry_run=args.dry_run)

    if not args.dry_run:
        print("done.")


if __name__ == "__main__":
    main()
