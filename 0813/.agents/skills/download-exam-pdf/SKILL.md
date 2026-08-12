---
name: download-exam-pdf
description: Download a TCTE (技專校院入學測驗中心) exam-question PDF pair (試題 + 標準答案) for a given 學年度 and 群/類, by resolving the base64-encoded downloader.php links off the exam's static results page and fetching them with the required Referer header — producing the {year}專業{一|二}{試題|答案}.pdf files that slice-exam-pdf expects as input. Trigger on requests like "幫我下載...統測...試題和答案", "download the exam PDFs for {year} {group}", "去技專校院入學測驗中心抓...的考古題", or as the prerequisite step whenever slice-exam-pdf is needed but the raw PDFs haven't been fetched yet.
---

# Download Exam PDF

Fetches a **downloaded exam PDF pair** (試題 + 標準答案, one pair per
subject) from the TCTE results page — this is Phase 1 of the pipeline in
`module2/docs/ai-agent-prompt.md`, and the prerequisite step before
`slice-exam-pdf` (which turns the PDF pair into per-question PNGs).

Run the script rather than driving a browser by hand: the results page
(`https://web1.tcte.edu.tw/EXAM/<year>_4y/`) is plain server-rendered HTML,
no JavaScript needed to see the download links — a normal HTTP GET returns
the same markup a browser would. Reaching for Playwright here is unnecessary
weight; a `curl`/`urllib` fetch plus regex parsing is enough, and is what the
script does.

## Usage

```bash
python3 .agents/skills/download-exam-pdf/scripts/download_exam_pdf.py \
  --year 115 \
  --group 電機與電子群資電類 \
  --subjects 1,2 \
  --out-dir module2/raw/115
```

`--group` is optional and defaults to `電機與電子群資電類` (this project's
original target) — omit it to fetch that group again for a different
`--year`, or pass a different 群/類 name substring to target another group
entirely.

Add `--dry-run` first to resolve and print the two subjects' file names
(base64-decoded) without downloading anything — cheap way to confirm the
group name matched before spending a real fetch.

Produces, in `--out-dir`:
- `{year}專業一試題.pdf`, `{year}專業一答案.pdf` (if `1` is in `--subjects`)
- `{year}專業二試題.pdf`, `{year}專業二答案.pdf` (if `2` is in `--subjects`)

This is exactly the naming `slice-exam-pdf --subject "1:...試題.pdf:...答案.pdf"`
expects as input.

## How it works (and why)

1. **Fetch the results page as plain HTML** (`urllib`, `User-Agent` set —
   the server 403s a default Python UA on some routes). No browser, no
   Playwright.
2. **Anchor the group match on the heading cell, not a bare substring.**
   Several groups' 成績組距 cell contains plain-text cross-references to
   *other* group names (e.g. group 51's row says "組距請參考以下群(類)
   別：電機與電子群電機類、電機與電子群資電類") — a naive `group_name in
   html` search matches those too. `find_group_tbody()` only accepts a hit
   where the name appears immediately after a `<td ...>` open tag (optionally
   preceded by the row's 2-digit group code), which only the real heading
   cell satisfies.
3. **Download buttons are `<input type="image" onclick="location.href=
   'downloader.php?obj=<base64>'">`, not `<a href>`.** A normal link-scrape
   misses them entirely; `extract_pdf_obj()` regexes the `onclick` attribute
   out of each PDF-icon `<input>` (there's a Word-icon `<input>` in the same
   cell for 試題 — matched and skipped by requiring `"PDF File"` in the tag).
4. **Locate 試題/標準答案 cells relative to the subject label, not by a
   fixed column offset.** A row's cell count varies: row 1 (專業科目一) has
   an extra 群類-name cell and a trailing rowspan 成績組距 cell that row 2
   (專業科目二) doesn't. `extract_subject_links()` finds the `專業科目(一)`
   or `專業科目(二)` label cell itself, then always reads the next two cells
   — that offset is constant regardless of what comes before the label.
5. **`obj` is base64 of the real filename** (e.g. `MTE1LTR5LTA0LTEucGRm` →
   `115-4y-04-1.pdf`) — decoded and printed before every download so a wrong
   group/subject match is visible before, not after, writing files.
6. **The PDF fetch itself needs the results page URL as `Referer`**, or the
   server rejects it — `fetch_url(url, referer=page_url)` on the two actual
   PDF requests (not on the initial page fetch, which needs none).
7. **Post-download verification isn't optional.** A 200 response and a
   plausible byte count don't prove the `obj` code decoded to the *intended*
   group/subject — `verify_pdf()` opens each downloaded file with PyMuPDF and
   checks the group name and subject label actually appear on the PDF's own
   title page, printing `OK`/`MISMATCH` per file rather than trusting the
   HTTP status alone.

## Known limitation

**Combined-code groups (51–56)** split `專業科目(二)` across more than one
sub-群類 in the same row-group (e.g. group 51's 專業科目(二) has separate
rows for "電機與電子群電機類" and "電機與電子群資電類"). This script's
`extract_subject_links()` returns the *first* `專業科目(二)` row it finds in
that row-group, which is very likely the wrong one if the caller actually
wanted a specific sub-群類 under a combined code. For any group numbered
01–20 (the common case — one 群/類 name, one clean row-group) this doesn't
come up. If a combined code is ever the target, resolve it by hand: fetch
the page, find the row-group, and read off the right `obj` value for the
specific sub-群類's row.

## Verification

Before handing the output to `slice-exam-pdf`, don't just check the script
exited 0:
- Each of the 4 (or 2, if only one subject requested) files' `verify_pdf()`
  line printed `OK` — if any printed `MISMATCH`, open that PDF and confirm
  by eye before using it.
- Page counts are plausible: 試題 PDFs are normally ~12 pages for a 50-item
  4y professional-subject paper; 標準答案 PDFs are normally 1 page.
- If a "答案變更為..." (answer correction) notice matters downstream, skim
  the 答案 PDF's text for "皆可"/"更正"/"變更" now — `slice-exam-pdf`'s
  answer-table parser picks up multi-letter cells automatically, but only if
  they're actually in the table, not just mentioned in a footnote.

## Notes

- Targets the 四技二專 (`_4y`) results page by default; pass
  `--exam-type 2y` for 二技 if that page follows the same static-HTML,
  same-onclick-pattern structure (not verified — check `--dry-run` output
  before trusting it).
- `--subjects` accepts `1`, `2`, or `1,2` — pass just one if the exam year
  or group genuinely only needs one professional subject.
- This skill only downloads. It does not slice the PDF into per-question
  images — hand its output directly to `slice-exam-pdf` next.
