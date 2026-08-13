---
name: render-exam-markdown
description: >-
  Convert a markdown quiz file with question headings, an optional fenced code block, contiguous `(A)` onward options, and a `答案: (X)` answer line into a problem-set folder of PNG question images plus a JSON answer key. Supports four or more options through `(Z)` and matches the shape consumed by build-quiz-app and clean-exam-question-images. Use for requests such as converting a Markdown exam into a problem repo or rendering a quiz like module4/repo/114.
---

# Render Exam Markdown

Turns a **markdown quiz file** — questions authored directly as text (not
scanned from a PDF) — into the same **problem-set folder** shape that
`slice-exam-pdf` produces from a PDF pair: one PNG per question plus a
`{label}keys.json` answer key. This is the markdown-source counterpart to
`slice-exam-pdf`; downstream, `clean-exam-question-images` and
`build-quiz-app` both consume either one's output identically since they
only care about the folder shape, not how the PNGs were produced.

Use this when the source is already a `.md` file (hand-written or
LLM-generated question bank), not a PDF. If the source is a PDF, use
`slice-exam-pdf` instead — don't convert a PDF to markdown first just to
route it through this skill.

## Input contract

A markdown file shaped like `assessments/FinalExam50Q.md`:

- One `# Title` line at the top (informational only, not rendered into any
  question image).
- Question blocks separated by lines of 3+ dashes (`---`), including one
  right after the title and one after the last question.
- Each block:
  - `### N. <stem text>` — stem may continue past the first line, and may
    contain inline `` `code` `` spans.
  - Optional fenced code blocks (` ```javascript ... ``` `, language tag
    optional) in the stem or an option. Multiple fenced blocks are supported.
  - Contiguous options from `(A) ...` through the final letter (up to `(Z)`),
    one per line and blank-line separated. Four-option and six-option exams
    are both supported. Option text may itself contain inline `` `code` `` spans.
  - `答案: (X)` — X is one or more letters (multi-letter accepted for
    multi-answer questions, e.g. `(AD)`, though none appear in the current
    source file).

Run with `--dry-run` first — it parses and prints a JSON summary (question
count, warning count, a 2-question sample) without touching the filesystem
or launching a browser. Zero warnings and `questionCount` matching the
source's `### ` heading count (`grep -c '^### ' <file>`) means the parse is
clean; don't proceed to rendering until that's true.

## Usage

```bash
python3 .agents/skills/render-exam-markdown/scripts/render_markdown_exam.py \
  --input assessments/FinalExam50Q.md \
  --out-dir assessments/repo/FinalExam50Q \
  --label FinalExam50Q \
  --dry-run   # drop this flag once the dry-run output looks right
```

- `--out-dir` — follow the existing `<module>/repo/<label>/` convention
  (mirrors `module4/repo/114/`): a `repo/` folder sibling to wherever
  `build-quiz-app` will later create its `app/` folder, one subfolder per
  label. For a source file living directly under `assessments/`, that's
  `assessments/repo/<label>/`.
- `--label` — filename prefix; output files are `{label}Q<n>.png` and
  `{label}keys.json`. Default to the input file's stem (e.g.
  `FinalExam50Q.md` → label `FinalExam50Q`) unless the user asks for
  something else. Unlike the PDF pipeline's `{year}專業{1|2}Q<n>.png`
  (which encodes a subject-group split), a single markdown file with no
  subject grouping just needs one flat `{label}Q<n>.png` series.

## How it works (and why)

**Parsing** (`parse_exam()` in the script): blocks are split on
`\n-{3,}\s*\n`. Within a block, every code fence is swapped for a numbered
placeholder before searching for the first `(A)` marker — this
sidesteps the (unlikely but possible) case of an option-shaped string
appearing inside a code sample itself. Stem and option text are then split
back into text/code segments; whatever sits from `(A)` onward is split into
the contiguous options on their letter markers, and `答案:` is matched at the
very end of the block. Both the leading `---` after the title and the trailing `---`
after the last question are stripped before splitting, since `\n-{3,}\s*\n`
alone doesn't match a delimiter with nothing following it at end-of-string.

**Rendering**: one Playwright (Chromium, headless) page, `set_content()`
per question, screenshot of a fixed-width (`1786px`, matching
`module4/repo/114/*.png`'s width) `#card` element whose height is whatever
the content needs — no manual text-wrapping or layout math, the browser's
own layout engine handles CJK/Latin/code mixed content correctly. Inline
`` `code` `` spans become plain `<code>` (no coloring, matching how inline
code reads in ordinary markdown renderers); the fenced block becomes a
`<pre>` with a light-gray background and colored syntax. This is a **fresh
rendering styled for on-screen readability** (system sans-serif for prose,
monospace for code), not a pixel-clone of the 114 dataset's PDF-crop
typography — there's no PDF to match here, and code-bearing content
benefits more from a modern code-block look than from replicating a
scanned-exam serif font.

**Syntax highlighting** (`highlight_js()`): a small self-contained regex
tokenizer, not an embedded copy of Prism/highlight.js and not a CDN
`<script>` tag — this project's quiz-app deliverable has to run offline
with no server and no internet (`build-quiz-app`'s hard requirement), and a
render-time skill script has the same constraint by extension. The
tokenizer only needs to be good enough to *color* JS, not parse it
correctly: one alternation (`JS_TOKEN_RE`) matches comments, strings
(`"..."`/`'...'`), template literals (`` `...` ``, colored as a single
string span — `${...}` interpolation inside one isn't split out
separately, which is a readability trade worth making for a ~40-line
tokenizer), numbers, and bare identifiers (checked against `JS_KEYWORDS`/
`JS_BUILTINS` for keyword/builtin coloring); everything else (punctuation,
operators, whitespace) passes through unstyled in the gaps between matches.
Tokenizing happens on the **raw** code string, with each matched piece
HTML-escaped individually as it's wrapped — escaping the whole code block
first and tokenizing after would shift character offsets (`<` becoming
`&lt;`) and desync the regex against what it thinks it's matching.

**No question-number prefix is rendered** — matching the convention
`clean-exam-question-images` establishes by stripping the `"50."` /
`"11."` token from PDF-sourced crops (see that skill's Pass 2). This script
produces that same "already clean" shape directly, since it controls its
own rendering rather than cropping pre-existing text.

## Verification

Don't trust a clean `--dry-run` alone — after rendering:

- `ls <out-dir> | wc -l` should be `questionCount + 1` (N images + 1
  `keys.json`).
- Cross-check every parsed answer against the source mechanically rather
  than by eye — e.g.:
  ```bash
  python3 -c "
  import re, json
  md = open('<input.md>', encoding='utf-8').read()
  nums = re.findall(r'^### (\d+)\.', md, re.M)
  answers = re.findall(r'答案: \((.+?)\)', md)
  src = dict(zip(map(int, nums), answers))
  keys = json.load(open('<out-dir>/<label>keys.json', encoding='utf-8'))
  bad = [(f, src.get(int(re.search(r'Q(\d+)\.png', f).group(1))), a)
         for f, a in keys.items()
         if src.get(int(re.search(r'Q(\d+)\.png', f).group(1))) != a]
  print('mismatches:', bad or 'none')
  "
  ```
- Run `build-quiz-app`'s analyzer against the output folder as a compatibility
  smoke test — `missingImageCount` must be 0 and `filenamePattern` should be
  non-null:
  ```bash
  python3 .agents/skills/build-quiz-app/scripts/analyze_folder.py <out-dir>
  ```
- Open at least: one question with no code block, one with a code block, one
  where an option itself contains inline `` `code` ``, and the **last**
  question in the file (to catch the trailing-`---` edge case the parser
  has to strip) — confirm each renders with no leading number, no truncated
  text, and code formatted in the monospace block.
- Open one question whose code contains a **template literal with `${}`
  interpolation** (e.g. a tagged-template question) and one with a **`//`
  comment** — confirm the backticks/`${}` didn't confuse the tokenizer
  (whole template should render as one unbroken blue string span, not cut
  off at the first `` ` ``) and the comment renders gray/italic across its
  full line, not just part of it.

## Notes

- The script hard-fails into a `WARNING:` on stderr (not a silent skip) for
  any block missing an `答案:` line or missing an `(A)` marker, and lists
  question numbers that don't form a clean `1..N` sequence — always check
  stderr, not just the "Wrote N images" success line.
- Code fences are extracted before option splitting, so code blocks in an
  option render as `<pre>` blocks rather than literal Markdown.
- 1786px card width is hardcoded to match `module4/repo/114/`'s crop width
  purely for cross-dataset visual consistency if bundled together in the
  same quiz app later; it has no other significance and is safe to change
  via the CSS `#card { width: ... }` rule if a source file's content needs
  more room (e.g. wider code samples with long lines).
- Like `slice-exam-pdf`'s output, hand off the resulting folder to
  `clean-exam-question-images` only if it actually needs pixel cleanup
  (it won't — this skill already renders "clean," no cropping artifacts to
  fix) — go straight to `build-quiz-app` instead.
