---
name: clean-exam-question-images
description: Clean up per-question PNG images cropped from exam PDFs (e.g. module2/assets/repo/*.png, named like 115專業1Q7.png) — trims trailing blank space at the bottom of each image (including "【以下空白】" blank-below notices) and paints out the leading question-series number (e.g. "50.", "11.") on the question-stem line, without touching answer-choice labels like (A)(B)(C)(D). Trigger on requests like "crop the blank area below the questions", "remove the trailing whitespace", "remove the problem series numbers", "clean up the question images".
---

# Clean Exam Question Images

Two independent pixel-level cleanup passes over a folder of single-question
PNG crops (produced by extracting individual questions out of scanned exam
PDFs, e.g. `module2/assets/repo/*.png`). Both passes are pure image
processing (PIL/numpy) — no OCR, no vision-model calls per file — because
these images all share one rendering template (same fonts, same left
margins), which is what makes the pixel heuristics below reliable.

Ask the user which target directory to run against if it isn't obvious from
context (default in this project: `module2/assets/repo/`). Always spot-check
a handful of results with `Read` afterward — see "Verification" at the end.

## Pass 1 — trim trailing blank space at the bottom

Many crops have extra blank canvas below the real content — either plain
whitespace from imprecise cropping, or an explicit "【以下空白】" ("blank
below") notice printed on the last question of an exam section, followed by
more blank canvas.

Algorithm: convert to grayscale, group dark rows into blocks (paragraphs),
drop any trailing block that's tiny and far-separated (crop-boundary bleed
— see below), then crop to `(last_real_content_row + 1 + pad)` with
`pad = 15` px of breathing room. This naturally removes both plain trailing
whitespace and any "以下空白" banner (it's just more content near the
bottom, followed by nothing) in one pass — no special-casing needed for
that text.

```python
from PIL import Image
import numpy as np
import glob

def row_blocks(arr, min_gap=3):
    h, w = arr.shape
    row_has_content = (arr < 200).any(axis=1)
    blocks, in_block, start, gap = [], False, 0, 0
    for y in range(h):
        if row_has_content[y]:
            if not in_block:
                in_block, start = True, y
            gap = 0
        else:
            if in_block:
                gap += 1
                if gap > min_gap:
                    blocks.append((start, y - gap))
                    in_block = False
    if in_block:
        blocks.append((start, h - 1))
    return blocks

pad = 15
for fname in sorted(glob.glob("*.png")):   # run from inside the target dir
    img = Image.open(fname)
    gray = np.array(img.convert("L"))
    h, w = gray.shape
    blocks = row_blocks(gray)
    if not blocks:
        continue
    # drop trailing tiny isolated blocks (bleed from the next question's
    # crop boundary, see "Why trailing bleed happens" below) before
    # deciding where the real content ends
    last = blocks[-1][1]
    i = len(blocks) - 1
    while i > 0:
        blk_h = blocks[i][1] - blocks[i][0]
        gap_before = blocks[i][0] - blocks[i - 1][1]
        if blk_h <= 8 and gap_before >= 20:
            i -= 1
            last = blocks[i][1]
        else:
            break
    new_h = min(h, last + 1 + pad)
    if new_h < h:
        img.crop((0, 0, w, new_h)).save(fname)
```

Threshold `200` (out of 255) and `pad = 15` were tuned against this
project's scans and worked cleanly across all 100 sample images (88 of 100
had blank space to trim; 12 were already tight and were left alone). Re-tune
`pad` only if a spot-check shows content shaved too close or too much
leftover margin.

**Why trailing bleed happens, and why simple "last dark pixel" trimming
isn't enough.** `slice-exam-pdf` sets a question's bottom crop edge to the
*next* question's own top edge with zero padding on that side by design
(padding there would crop into what follows) — but that edge is a single
y-coordinate derived from text-line positions, not a guarantee that nothing
from the next question's own glyphs render a hair above it. Two shapes of
this showed up cleaning `module2/repo/math-115{a,b,c}`:
- A **tiny (1–3px) sliver**: overline notation (e.g. $\overline{AB}$ segment
  marks) or similar diacritics can sit just above the next line's text
  baseline, leaving a few stray dark pixels right at the very bottom edge.
  Naive "last dark row" trimming sees those pixels as "real content" and
  refuses to trim anything above them — on one file this hid ~490px of pure
  blank canvas between the actual last answer choice and the sliver.
- A **larger bleed** (a whole equation line, ~20–30px tall) is a boundary
  bug in the *slicer itself*, not something this skill's pixel heuristics
  can safely paper over — see `slice-exam-pdf`'s trap #10
  (`widen_to_block_top`). If a spot-check turns up a partial/truncated line
  of clearly *different* content sitting flush against a crop's bottom
  edge, don't just trim it here — re-slice with an up-to-date
  `slice-exam-pdf` first, then clean.

The `blk_h <= 8` / `gap_before >= 20` thresholds distinguish the small,
harmless sliver case (which this pass can safely drop) from genuine content
— normal text-line blocks in this template run ~25–40px tall with ~20–35px
inter-line gaps, well outside those bounds, which is what keeps this pass
from ever mistaking a real short answer choice (e.g. `(D) 2`) for bleed. It
doesn't fix the larger-bleed case; that always needs a source re-slice (see
the folder-wide scan under "Verification" below).

## Pass 2 — remove the leading question-series number

Run this **after** Pass 1 (order doesn't strictly matter — the two passes
touch different regions — but this is the tested order).

Every question stem starts with a line like `50. 如圖(三十三)所示電路...` or
`11. 某 MCU 的片段程式如下...`. The goal is to blank out just the `"50."` /
`"11."` token — not the answer-choice labels `(A)`/`(B)`/`(C)`/`(D)`, which
must survive untouched, and not passage headers like `▲閱讀下文，回答第
37-38 題` for multi-question reading-passage crops (the passage header has no
leading number of its own; the real numbered line, e.g. `38. ...`, appears
lower in the same image and must still be found and cleaned).

**Why pixel heuristics work here without OCR**: in this exam template, the
question number is right-aligned in a fixed-width column ending around
x≈209–212px, followed by a wide space (~20–23px) before the question text,
which always starts at x≈228–236px regardless of whether the number is one
or two digits. Answer-choice labels `(A)…(D)` are indented to align with
that same text-start column (x≈228+), not with the number column — so
requiring the leading segment to start at x ≤ 220 already excludes choice
lines. Passage-header lines (`▲閱讀...`) also start near x≈172 but their
internal character-to-character gaps stay small (~5px, no ≥14px gap early
on), which is what tells them apart from an actual `"NN."` token.

Detection logic, per image:

1. Split the image into horizontal "row blocks" — runs of rows that contain
   any dark pixel, merging across gaps of ≤3 blank rows (`min_gap=3`). Each
   block is roughly one paragraph/line group.
2. For each block, scan columns (grayscale < 200) within x ∈ [0, 350] and
   collapse into contiguous horizontal segments.
3. A block is a "number line" iff:
   - its leftmost segment starts at x ≤ 220, **and**
   - walking the segments left to right, there's a gap ≥ **14px** between
     two consecutive segments (this is the number→text space), **and**
   - everything before that gap (the "cluster") ends at x ≤ 225 and spans
     ≤ 55px total (fits a 1–2 digit number + period).
4. If found, paint that block's row range white from `x=0` to
   `(start of the segment right after the gap) - 2`, leaving the space
   before the text intact so nothing collides with what follows.

**The `gap_threshold=14` value matters — do not lower it to 10.** Two-digit
numbers like `"11."` can have an inter-digit gap (between the two `1`s) as
wide as 10px, which at a `gap_threshold=10` gets misread as the
number→text gap and truncates the blank-out after only the first digit,
leaving `"1."` visible. 14px cleanly separates real inter-glyph spacing from
the actual word-space gap (which runs ~20–23px in this template). This was
caught by dry-running detection across all 100 files and checking the
distribution of resulting text-start x-positions before touching any pixels
— one file (`115專業2Q11.png`) stuck out as an outlier at x=193 when every
other file landed at x≈231–236, which is what exposed the bug.

```python
from PIL import Image
import numpy as np
import glob

def row_blocks(arr, min_gap=3):
    h, w = arr.shape
    row_has_content = (arr < 200).any(axis=1)
    blocks, in_block, start, gap = [], False, 0, 0
    for y in range(h):
        if row_has_content[y]:
            if not in_block:
                in_block, start = True, y
            gap = 0
        else:
            if in_block:
                gap += 1
                if gap > min_gap:
                    blocks.append((start, y - gap))
                    in_block = False
    if in_block:
        blocks.append((start, h - 1))
    return blocks

def segs_in_range(arr, s, e, xmax=350):
    band = arr[s:e+1, :xmax]
    col_has = (band < 200).any(axis=0)
    xs = np.where(col_has)[0]
    if len(xs) == 0:
        return []
    segs, seg_start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > 1:
            segs.append((int(seg_start), int(prev)))
            seg_start = x
        prev = x
    segs.append((int(seg_start), int(prev)))
    return segs

def find_number_cluster(segs, gap_threshold=14):
    if not segs or segs[0][0] > 220:
        return None
    for i in range(len(segs) - 1):
        gap = segs[i+1][0] - segs[i][1]
        if gap >= gap_threshold:
            cluster = segs[:i+1]
            cend = cluster[-1][1]
            cwidth = cend - cluster[0][0]
            if cend <= 225 and cwidth <= 55:
                return (cluster, segs[i+1][0])
            return None
    return None

for fname in sorted(glob.glob("*.png")):
    img = Image.open(fname)
    gray = np.array(img.convert("L"))
    for (s, e) in row_blocks(gray):
        segs = segs_in_range(gray, s, e)
        res = find_number_cluster(segs)
        if res:
            _, next_x = res
            blank_end = next_x - 2
            arr = np.array(img)
            if arr.ndim == 2:
                arr[s:e+1, 0:blank_end] = 255
            else:
                arr[s:e+1, 0:blank_end, :3] = 255
            img = Image.fromarray(arr)
            break  # one number line per file — stop after the first match
    img.save(fname)
```

Before saving anything, it's cheap and worth it to **dry-run the detector
first** (print `(fname, flagged_blocks)` without writing) and sanity-check:

- every file should produce **exactly one** flagged block — if any file
  produces 0 or ≥2, stop and inspect it manually before running the paint
  step (0 likely means the number line's layout differs from this
  template; ≥2 likely means a false positive, e.g. threshold too loose);
- the collected `next_x` values across all files should cluster tightly
  (this project: ~231–236px) — an outlier is a sign the gap threshold needs
  adjusting, same as the `115專業2Q11.png` case above.

## Verification

After running either or both passes, `Read` a small sample back (don't just
trust the script ran without error):

- At least one single-digit and one double-digit question number (e.g. a
  `Q1`/`Q9`-style file and a `Q50`-style file) — confirm the number is gone
  and the question text starts flush left with no leftover digit fragments.
- At least one file with answer choices `(A)`–`(D)` — confirm those labels
  are untouched.
- If the folder contains a multi-question reading-passage crop (look for a
  file whose content includes `▲閱讀下文` or similar shared-passage header)
  — confirm the passage header survives and only the actual numbered
  question line lower in the image got cleaned.
- At least one file that had a `【以下空白】` notice or large trailing
  whitespace — confirm it's gone and the last real content (e.g. answer
  choice D) is now close to the bottom edge with just the small `pad`
  margin.
- **Scan the whole folder for residual bleed**, not just the spot-checked
  files: for every image, take the last two `row_blocks()` blocks and flag
  any file where the gap between them is unusually large (e.g. ≥40px) or
  where the last block still runs flush to the very bottom edge (zero
  trailing pad after Pass 1). A large gap that survives Pass 1 is
  expected/harmless on a genuine last-question-with-diagram-then-
  【以下空白】 layout — `Read` it to confirm — but a block flush against the
  bottom edge showing a partial line of unrelated content is the
  larger-bleed case above and means the source needs re-slicing, not more
  trimming.

## Notes

- Both scripts operate in place (`img.save(fname)` overwrites the source
  file) and are **not idempotent-safe against re-cropping already-cleaned
  images** in a harmful way, but re-running them on already-clean images is
  harmless (Pass 1 finds nothing to trim, Pass 2 finds no number-shaped
  cluster left to blank) — safe to re-run.
- Pass 1's bleed-blob rejection (`blk_h <= 8`, `gap_before >= 20`) only
  catches the small sliver case. It was added after cleaning
  `module2/repo/math-115{a,b,c}`, where one file (`115數學CQ17.png`) had
  ~490px of hidden blank space behind a 2-row bleed mark that naive "last
  dark pixel" trimming refused to remove; the same run also turned up a
  larger, ~30px-tall bleed in `115數學BQ11.png` that this pass's size
  threshold correctly does *not* touch, because that one was a genuine
  `slice-exam-pdf` boundary bug (see trap #10 there) that needed a source
  re-slice, not more aggressive trimming here.
- These thresholds (x-columns, gap sizes, `pad`) are specific to this
  project's exam-PDF rendering template (same font, same margins across all
  `module2/assets/repo/*.png` files). If this skill is pointed at images
  from a differently-formatted source, re-derive the thresholds by
  dry-running Pass 2's detector and inspecting the `next_x` distribution
  before painting anything, rather than assuming these exact numbers still
  apply.
- Don't extend Pass 2 to strip answer-choice labels or other markers unless
  the user explicitly asks — the x ≤ 220 / gap ≥ 14 heuristic was
  specifically tuned to leave `(A)`–`(D)` alone.
