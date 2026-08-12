---
name: slice-exam-pdf
description: Slice a downloaded TCTE (技專校院入學測驗中心) exam-question PDF (專業科目 試題) into one PNG per question, paired with answers pulled from the matching standard-answer PDF (標準答案), producing the {year}專業{1|2}Q{n}.png + {year}keys.json shape that clean-exam-question-images and build-quiz-app both expect as input. Trigger on requests like "切題目 PDF", "把試題切成一題一張圖", "slice this exam PDF into per-question images", or as the prerequisite step whenever raw exam PDFs (not yet per-question PNGs) need to feed either of those two skills.
---

# Slice Exam PDF

Turns a **downloaded exam PDF pair** (試題 + 標準答案, already fetched via
the download flow in `module2/ai-agent-prompt.md`'s Phase 1) into a
**problem-set folder**: one PNG per question plus a JSON answer key. This is
the prerequisite step before either `clean-exam-question-images` (pixel
cleanup on the crops) or `build-quiz-app` (turns the problem set into a quiz
app) — neither of those skills operates on whole-exam PDFs directly.

Run the script rather than re-deriving this by hand each time — earlier
manual runs of this pipeline hit two bugs (crop overlap across passage
groups, answer-table cell misalignment) before landing on the logic below.

## Usage

```bash
python3 .agents/skills/slice-exam-pdf/scripts/slice_exam_pdf.py \
  --year 114 \
  --subject "1:module4/raw/114專業一試題.pdf:module4/raw/114專業一答案.pdf" \
  --subject "2:module4/raw/114專業二試題.pdf:module4/raw/114專業二答案.pdf" \
  --out-dir module4/repo-114
```

Produces, in `--out-dir`:
- `{year}專業1Q<n>.png`, `{year}專業2Q<n>.png` — one per question (50 each for a standard TCTE 4y professional-subject paper)
- `{year}keys.json` — `{image filename → correct answer letter(s)}`, e.g. `"AD"` when the official answer key lists more than one accepted letter for a question

## How it works (and why)

PyMuPDF (`fitz`) line-level text extraction + coordinate-based cropping, no
OCR. This relies on every year sharing one rendering template (fixed left
margins, repeated per-page header/footer, watermark) — re-measure the
constants below with `--dump-page path/to.pdf:<page_index>` before trusting
them against a differently-formatted source (different agency, or a TCTE
template revision).

**Template constants** (measured against the 114 學年度 four-year-program
professional-subject PDFs; unchanged from what worked for 115 in
`module2/ai-agent-prompt.md`):
- `ZOOM = 3.0` — `get_pixmap` scale factor; must stay ≥2.5 or text blurs.
- `CONTENT_TOP = 63` — top-of-content bound used only when a question's own
  content continues onto a new page (trap below). Sits just below the
  page's watermark ("公告試題僅供參考", bottom edge ~59.7pt) and just above
  where real content starts (~71.6pt) — narrow enough to skip the header
  and watermark, wide enough not to shave real content.
- `CONTENT_BOTTOM = 806` — bottom-of-content bound, just above the `-N-`
  page-number footer (~810.7pt).
- `TOP_PAD = 8` — small breathing room added above a visible top boundary;
  the bottom boundary gets none (a next-question's own top edge is the
  exact, un-padded stop point — padding there would crop into it).

**Known traps** (each cost real debugging time on the first run; see also
the fuller trap list in `module2/ai-agent-prompt.md`):

1. **Read by line, not by block.** A PDF text block frequently spans
   multiple questions; scanning only each block's first line silently
   drops questions. `extract_lines()` flattens every block into its
   individual lines, sorted into page-major reading order, before any
   pattern matching happens.
2. **Question-number detection needs an expected-next-number cursor**, not
   a bare `^\d+\.` regex. Cover pages have their own numbered notice lists
   (e.g. "1.請核對考試科目…") that would otherwise be misread as Q1.
   `find_boundaries()` only accepts a match when its number equals the
   running `expected` cursor, and starts scanning from page index 1 (past
   the cover) to sidestep the issue entirely.
3. **Reading-passage groups** (`▲閱讀下文，回答第X-Y題`) share one
   description block across 2+ questions, printed only once, immediately
   before the *first* question in the group. The first question's crop
   extends its top boundary up to the passage header (nothing extra to
   stitch). Every later question in the group needs the shared block
   re-composited on top of its own block — `build_question_image()` does
   this by cropping the shared header→first-question-start region a second
   time and vertically stacking it with `vstack()`.
4. **Bottom boundary = the very next event's top, verbatim.** That "next
   event" is either the next plain question number *or* the next passage
   header, whichever the reading order hits first — a question immediately
   followed by a new group's intro line must stop at the intro line, not
   read into it. No padding on this edge, or it crops into what follows.
5. **Cross-page questions.** `crop_range()` always accepts a `(start_page,
   start_y)` → `(end_page, end_y)` span and transparently stitches when
   they differ: full-bleed on the start page down to `CONTENT_BOTTOM`, any
   whole pages in between at `CONTENT_TOP`→`CONTENT_BOTTOM`, then
   `CONTENT_TOP`→`end_y` on the final page. This one primitive covers
   ordinary same-page questions, passage-group reuse, and genuine
   page-spanning content without special-casing any of them.
6. **Crop full page width**, not just the text column — circuit/timing
   diagrams routinely extend past the right edge of the text block.
7. **Answer-table parsing needs a token cursor, not naive pairing.** After
   `get_text()`, the standard-answer table is a flat token stream (header
   labels, then repeating `number, answer` pairs). Trailing question-number
   columns with a blank answer cell can appear as an explicit blank token
   *or* be omitted outright, depending on the PDF — pairing every two
   tokens blindly desyncs the rest of the table the moment either format
   shows up. `parse_answers()` only consumes a following token as the
   answer if it actually matches `^[A-D]+$`; otherwise it advances past
   just the number and lets the next loop iteration resync on the next
   digit token, whatever came between.
8. **A published answer PDF may include a correction note** (e.g. "答案變
   更為 A 或 D 皆可"), which should end up as a multi-letter value (e.g.
   `"AD"`) rather than picking one. `parse_answers()`'s `[A-D]+` pattern
   already captures multi-letter cells like this as-is; there's just
   currently no automated check that a correction note in the PDF text
   actually landed in the table cell — skim the source PDF for "皆可" /
   "更正" / "變更" and cross-check the emitted JSON by hand if found.
9. **共同科目 (數學/國文/英文) papers carry a reference-formula preamble**
   ("參考公式") right on the first content page — itself a numbered list
   ("1. 點P...", "2. 若α、β...") that collides with the expected-cursor
   check exactly like a cover-page notice list (trap #2), except it isn't
   on a page that can be skipped wholesale — real questions follow
   immediately after it on the *same* page. A column-based fix (real
   questions flush left, list items indented) turned out fragile: in some
   papers a real single-digit question number sits closer to the indented
   list's x0 than to that same paper's own double-digit question numbers,
   because the number column is right-aligned and shifts with digit count.
   The reliable signature instead: the candidate stream visits number 1
   *twice* — once for the false list, once for the real Q1 — before ever
   reaching 2. `find_boundaries()` drops everything before the *last*
   candidate for "1" whenever more than one exists.
10. **A question's opening line can carry a vertically-tall inline element**
    (a brace-grouped system of equations, a stacked fraction) whose top
    extends above the plain-text baseline that `QNUM_RE` matched on — e.g.
    `"12. 若 abc≠0，且聯立方程式{ax+by=c ..."` where the `{...}` system's top
    row sits ~11pt above `"12."`'s own y0. Using only the matched line's y0
    as a boundary crops the *previous* question through the middle of that
    element (its top rows, physically above the recorded y0, get pulled
    into the previous crop) and then also truncates it mid-glyph in *this*
    question's own crop. `widen_to_block_top()` walks backward from the
    matched line through immediately preceding items on the same page,
    extending the boundary upward as long as consecutive items sit within
    10pt of each other — the signature of a tightly packed multi-fragment
    layout, as opposed to genuine inter-question whitespace (consistently
    far larger in every measured template).

## Verification

Before handing the output to `clean-exam-question-images` or
`build-quiz-app`, spot-check by opening the images:
- Question count: exactly `total` PNGs per subject, and `{year}keys.json`
  has exactly that many entries (the script already asserts this internally
  and raises if any question or answer is missing — but re-confirm by
  counting files).
- At least one **passage-group first question** and one **later member of
  the same group** — confirm the shared description appears in both, isn't
  duplicated or truncated, and the later member's own crop doesn't also
  carry the *next* group's intro line.
- At least one **circuit/diagram question** — confirm the diagram isn't
  clipped on the right edge.
- The **last question** — confirm it isn't cut short, and that any
  trailing "【以下空白】" blank-below notice is present (it gets stripped
  later by `clean-exam-question-images`, not here).
- Cross-check 2-3 `{year}keys.json` entries against the answer PDF by eye.
- On a **共同科目 (數學/國文/英文) paper with a 參考公式 preamble** (trap
  #9): open Q1 specifically and confirm it's the real first question, not
  a formula-list fragment — if the collision fix ever regresses, Q1 will
  visibly be the wrong content (a distance formula, Vieta's formulas, etc.)
  rather than a subtle crop error.
- On **any question whose stem opens with a brace-grouped system of
  equations or a stacked fraction right after the number** (trap #10):
  open both that question *and the one immediately before it* — confirm
  the previous question's crop ends cleanly (no partial line of unrelated
  content flush against its bottom edge) and this question's own crop
  includes the *entire* equation block, not just the tail of it. This class
  of bug hides well: the previous crop often looks fine at a glance because
  the truncated fragment is tiny and sits far below the real content with a
  large blank gap in between — don't skip this check just because nothing
  looks obviously wrong on a quick scroll.

## Notes

- Naming matches what `clean-exam-question-images` and `build-quiz-app`
  already expect: `{year}專業{1|2}Q{n}.png`, `{year}keys.json` — this is the
  same shape `module2/assets/` and `module2/assets/repo/` were built in by
  hand before this skill existed.
- **The output filename literally hardcodes the Chinese word "專業"**
  (`slice_subject()`'s `fname = f"{year}專業{subject_label}Q{q}.png"`),
  regardless of `--subject`'s label. This is correct for 專業科目 papers
  (`--subject 1:...` → `115專業1Q7.png`) but wrong for 共同科目 papers like
  數學(A)/(B)/(C) — running `--subject A:...` on a math paper still produces
  `115專業AQ7.png`, mislabeling a math question as a professional-subject
  one. There's no flag to override this; rename the output afterward (e.g.
  `115專業AQ*.png` → `115數學AQ*.png`, updating `{year}keys.json`'s keys to
  match) before handing off to `clean-exam-question-images` or
  `build-quiz-app`, and set `config.json`'s `filenamePattern` for that
  assessment to match the renamed convention.
- This skill only slices; it does not clean up leading question numbers or
  trailing whitespace baked into each crop. Run `clean-exam-question-images`
  on the output `.png` folder next for that.
- If pointed at a non-4y paper (二技, or a different subject count than 50),
  pass `--total` accordingly — everything else adapts automatically since
  the cursor-based detection doesn't hardcode 50. 共同科目 papers in this
  project (數學A/B/C) are 25-question papers, not 50.
