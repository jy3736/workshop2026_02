---
name: build-quiz-app
description: Given a problem-set folder (one image per question, plus a JSON file mapping each image's filename to its correct answer letter(s) — e.g. module2/assets/, matching the shape produced by module2/ai-agent-prompt.md's PDF-slicing pipeline) analyze its structure and generate a static self-assessment web app from it — a student quiz page (random draw, submit-then-grade, CSV export) and a teacher CSV-aggregator page. config.json holds a list of assessments, so re-running this skill against a new problem-set folder can add another assessment to an existing app/ instead of replacing it — each stays independently rebuildable. The generated app must run with a plain double-click, no local server, no internet. Trigger on requests like "build a quiz app from this problem set", "generate a self-assessment web app from these questions", "turn this folder into a practice quiz", "make a no-server quiz from module2/assets".
---

# Build Quiz App

Turns a **problem-set folder** — one image per question plus a JSON answer
key — into a working instance of the static quiz app documented in
`docs/module2/quiz-app-tutorial.html` and first built by hand in
`module2/app/`. This skill automates that same build, generalized to run
against *any* folder with this shape, not just `module2/assets/`.

**Input contract** (what counts as a valid problem-set folder):
- A JSON file mapping `{image filename → answer letters}` (letters are
  usually one character like `"B"`, occasionally more than one for a
  multi-answer question, e.g. `"AD"`).
- Every key in that JSON resolves to an actual image file somewhere in the
  folder (commonly a `repo/` subfolder, but not required to be).
- The image itself contains the full question — stem and answer choices are
  already baked into the picture. This skill does not read or OCR the
  images; it only needs the JSON and the file paths.

If the input is still a raw exam PDF (not yet sliced into per-question
images), that's a separate prerequisite step — see `module2/ai-agent-prompt.md`
for the slicing pipeline. Don't attempt PDF slicing as part of this skill.

**Hard requirement**: the deliverable that gets handed to students is the
*bundled* single-file HTML (`dist/*.html`, produced in the last step) — it
has every image inlined as base64 and needs no server, no `fetch()`, no
internet. The editable multi-file source (`quiz.html` reading `config.json`
and images via `fetch`) is also scaffolded for future edits, but that mode
*does* need a local server to test (browsers block `fetch()` over `file://`)
— don't confuse the two when reporting completion to the user.

## Step 1 — Locate input and output

Ask the user (if not already clear from context) which folder is the
problem-set source. Default the output location to `app/` created as a
**sibling of the input folder** (i.e. `<input folder>/../app`) — e.g. input
`module2/assets/` → output `module2/app/` (this mirrors the existing
`module2/assets/` + `module2/app/` pair in this repo).

**Never nest `app/` inside the problem-set folder itself** (e.g. do *not*
put it at `module3/week01/app/` when the input is `module3/week01/`), even
when the folder name looks like a one-off container (`week01`, `assets`,
`2026-02`, ...). The app is a reusable engine keyed to the *parent*
directory, not a per-instance artifact of the problem set — keeping it
outside means it survives untouched if the problem-set folder is later
replaced, archived, or deleted, and it matches the weekly-refresh workflow
(Step 6) where the same `app/` accumulates one more assessment entry in
`config.json` over time rather than being rebuilt from scratch.

If the sibling `app/` already exists from a prior run of this skill
against a *different* problem-set folder under the same parent (e.g. last
week's refresh), that's expected, not a conflict. `config.json` holds a
list of assessments (Step 3), so the default move is to **append** a new
assessment entry to the existing array rather than overwrite it — confirm
with the user first, and prefer appending unless they explicitly want an
old assessment replaced or removed. `quiz.html`/`build_bundle.py`/
`report-aggregator.html` are the shared engine and can be safely
overwritten with the current template versions (they're not supposed to
diverge per problem set — see the closing note on not hand-editing them).
`dist/` accumulates one bundle per assessment (Step 4); nothing needs to
be cleared just because a new assessment was added. More generally,
confirm with the user before writing into a location that already
contains files unrelated to a previous run of this skill.

## Step 2 — Analyze the folder

Run the bundled analyzer (never guess this by hand — filename patterns are
easy to get subtly wrong):

```bash
python3 .agents/skills/build-quiz-app/scripts/analyze_folder.py <problem-set-folder>
```

It prints a JSON report — no files are written. Optional `--keys-file NAME`
/ `--repo-dir NAME` flags force a choice when auto-detection is ambiguous.
Read every field before moving on:

| Field | What to do with it |
| --- | --- |
| `error: ambiguous_or_missing_keys_file` | Multiple/zero `*.json` candidates in `candidates`. Ask the user which one is the answer key, then re-run with `--keys-file`. |
| `repoDir: null` / `error: could_not_locate_image_folder` | Ask the user where the images live, re-run with `--repo-dir`. |
| `repoDir: "."` | Images sit directly in the problem-set folder itself, alongside the keys file (no subfolder) — write `"repoDir": "."` into `config.json` explicitly, don't omit it (omitting means the default `"repo"`, which would be wrong here). |
| `missingImageCount` / `missingImages` | Keys with no matching image file. Surface this to the user explicitly — don't silently drop them. Ask whether to proceed (those questions will just be skipped by the bundler) or fix the source data first. |
| `extraImageFileCount` / `extraImageFiles` | Image files not referenced by any key — informational, harmless, mention in passing. |
| `multiAnswerCount` / `multiAnswerSample` | Questions whose correct answer is more than one letter. No action needed — the template already grades these by exact-set match — but mention the count so the user isn't surprised later. |
| `answerLetters` | The full set of letters used across all answers. If this is anything other than a subset of `A`–`D`, set `choiceLetters` in `config.json` (next step) to the sorted joined string of these letters instead of the default `"ABCD"`. |
| `filenamePattern` | A regex (JS named-capture syntax, e.g. `^(?<group>[12])_(?<number>\d+)\.png$`) inferred from the filenames, or `null` if no clean pattern was found. |
| `filenamePatternNote` | Explains *why* — read it. If it names specific group-token candidates, sanity-check they actually mean something (e.g. `['1','2']` for two exam subjects makes sense; a stray candidate that looks like noise means the inference guessed wrong). |

**If `filenamePattern` is `null`, that's fine, not a failure** — omit it
from `config.json` and the app falls back to showing each question by its
raw filename with no group-based balancing. Still fully functional.

**If a `filenamePattern` was found but the group-token candidates look
wrong** (e.g. they don't correspond to any real distinction in the source
material), don't force it — omit `filenamePattern` and let the app fall
back to the ungrouped default rather than shipping a misleading grouping.

## Step 3 — Scaffold the app

```bash
mkdir -p <output>/app
cp .agents/skills/build-quiz-app/templates/quiz.html <output>/app/quiz.html
cp .agents/skills/build-quiz-app/templates/report-aggregator.html <output>/app/report-aggregator.html
cp .agents/skills/build-quiz-app/templates/build_bundle.py <output>/app/build_bundle.py
```

`config.json` holds a list of assessments — `{"assessments": [ {...}, {...} ]}`.
If `<output>/app/config.json` doesn't exist yet, create it with a
single-entry array. If it already exists (re-running against a new
problem-set folder under the same `app/`, per Step 1), **append** a new
entry to the existing array rather than replacing the file — read the
current `config.json` first so you don't clobber earlier assessments.

Each entry:

```json
{
  "examLabel": "<ask the user, or derive a readable title from the input folder name>",
  "assetsDir": "<path to the problem-set folder, relative to <output>/app/ — e.g. '../assets' or '../repo-115'>",
  "keysFile": "<keysFile from the analysis report>",
  "repoDir": "<repoDir from the analysis report, omit this field entirely if it equals \"repo\" — that's the default — but keep it explicit if it's \".\", see table above>",
  "questionCount": "<min(20, questionCount from the report)>",
  "choiceLetters": "<'ABCD' unless answerLetters needs something else, see table above>",
  "filenamePattern": "<from the report, or omit the field entirely if null>"
}
```

`assetsDir` is the one field with no analyzer equivalent — compute it
yourself as the relative path from `<output>/app/` to the problem-set
folder you analyzed in Step 2. `examLabel` values must be distinct across
entries in the array (they drive both the output filename and, in the
non-bundled dev preview, the `?exam=` selector) — check the existing
array before picking one if you're appending.

`report-aggregator.html` needs zero configuration — it's copied as-is and
works for any problem set, since it only ever reads whatever columns are in
the CSVs it's given.

## Step 4 — Build the no-server bundle

```bash
cd <output>/app
python3 build_bundle.py
```

With no flags this rebuilds **every** assessment in `config.json`, writing
one `<output>/app/dist/<examLabel>_quiz.html` per entry with every image
base64-inlined — `assetsDir` (Step 3) points straight at each original
input folder, there is no need to copy or duplicate question images
anywhere. If you only just appended one new assessment and don't want to
re-encode the others (each bundle can be tens of MB), use
`python3 build_bundle.py --only <examLabel>` to build just that one.

For each assessment built, check the printed question count against that
folder's analysis report `questionCount` (minus any `missingImageCount`,
which are silently excluded from the bundle with a warning on stderr —
surface that warning to the user if it's non-zero). The final summary line
(`Built N/M assessments`) should read `N == M`; if not, an entry was
skipped — its warning on stderr says why (e.g. a bad `keysFile`/`repoDir`/
`assetsDir` path).

## Step 5 — Verify

Don't just trust that the script ran without error:

- Confirm each expected `dist/*.html` file exists (one per assessment you
  built) and its size is in the right ballpark (roughly `sum of source
  image bytes × 1.37` for the base64 overhead — a file that's suspiciously
  small likely means most images went missing).
- If a browser-automation tool is available in this session, open at least
  one bundle **directly via its file path or a `file://`-equivalent local
  preview — do not start an HTTP server for this check**, since the whole
  point is confirming it works without one. Fill in a name, start a short
  session, answer a question, submit, and confirm the score/answer reveal
  renders. (If the tool only supports `http://` URLs, a temporary server
  for *this verification step only* is an acceptable fallback — just don't
  let that leak into how you describe the deliverable to the user.)
- If no browser tool is available, at minimum grep each bundle for
  `window.QUIZ_DATA` and spot-check by opening the file that a couple of the
  embedded `data:image/png;base64,` entries are present and non-empty.

## Step 6 — Report back

Tell the user, clearly distinguishing the two outputs:

- **`<output>/app/dist/*.html`** — the actual deliverable. Double-click
  ready, no server, no internet, safe to hand to students as-is (subject to
  the copyright note below).
- **`<output>/app/{quiz.html,report-aggregator.html,config.json}`** — the
  editable source, kept around for future tweaks. Testing *this* version
  needs a local server (`python3 -m http.server` from `<output>/app/`) —
  same reasoning as the "本機測試你的網頁" section of
  `docs/module2/quiz-app-tutorial.html`.
- **`<output>/app/report-aggregator.html`** — hand this to the instructor
  separately; it merges CSV exports from multiple students into a class
  report, fully offline.
- Point to `docs/module2/quiz-app-tutorial.html` for the weekly-refresh
  workflow (add the new week as another assessment entry in `config.json`
  — Step 1/3 — then re-run this skill or just `build_bundle.py`, optionally
  with `--only` for the new one).

## Notes

- The filename-pattern inference in `analyze_folder.py` is a heuristic over
  a handful of filenames, not a guarantee — always read
  `filenamePatternNote` and sanity-check the result before writing it into
  `config.json`, per Step 2.
- If the problem set contains material the user doesn't have clear rights
  to redistribute (e.g. copyrighted exam content, as with
  `module2/assets/`), remind them before handing out the bundled HTML —
  same caution already documented in `module2/AI_Agent_教學應用工作坊02_模組一_從教材產生題組.md`
  step 0 and in the quiz-app tutorial.
- Don't hand-edit the copied `quiz.html` / `report-aggregator.html` /
  `build_bundle.py` to special-case a particular problem set's naming
  quirks — that defeats the point of the shared template. If a problem set
  genuinely needs behavior the generic engine can't express (not just a
  filename pattern or choice-letter set), that's a signal that the template
  itself needs a new config field, not a one-off fork.
