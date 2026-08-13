#!/usr/bin/env python3
"""
Render a markdown quiz file (see parse_exam() docstring for the expected
shape) into a problem-set folder: one PNG per question plus a JSON answer
key, matching the {label}Q<n>.png / {label}keys.json shape produced by
slice-exam-pdf and consumed by build-quiz-app.

Usage:
    python3 render_markdown_exam.py \
        --input assessments/FinalExam50Q.md \
        --out-dir assessments/repo/FinalExam50Q \
        --label FinalExam50Q

Run with --dry-run first to validate parsing (prints a JSON summary, writes
nothing) before spending time on browser rendering.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

QUESTION_RE = re.compile(r"^#{2,3}\s*(\d+)\.\s*(.*)", re.S)
ANSWER_RE = re.compile(r"\n答案:\s*\(([A-Z]+)\)\s*\Z")
CODE_FENCE_RE = re.compile(r"```(\w*)\n(.*?)\n```", re.S)
OPTION_START_RE = re.compile(r"(?:^|\n)\(A\)\s")
OPTION_SPLIT_RE = re.compile(r"\n?\(([A-Z])\)\s*")
PLACEHOLDER_RE = re.compile(r"\x00CODE(\d+)\x00")
OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def parse_exam(md_text):
    """Parse a markdown quiz file into a list of question dicts.

    Expected shape (see assessments/FinalExam50Q.md):
      - one `# Title` line, then blocks separated by lines of 3+ dashes.
      - each block: `### N. <stem, may span lines>`, optional fenced code
        blocks in the stem or options, then `(A) ...` through a final option letter,
        each on its own line (blank-line separated), then `答案: (X)`
        (X = one or more option letters).
    """
    md_text = re.sub(r"\n-{3,}\s*\Z", "", md_text.strip())
    blocks = re.split(r"\n-{3,}\s*\n", md_text)
    questions = []
    warnings = []
    for block in blocks:
        block = block.strip("\n")
        if not block.strip():
            continue
        qm = QUESTION_RE.match(block)
        if not qm or block.lstrip().startswith("# "):
            continue  # title block or stray separator, skip

        num = int(qm.group(1))
        rest = qm.group(2)

        am = ANSWER_RE.search("\n" + rest)
        if not am:
            warnings.append(f"Q{num}: no 答案 line found, skipping")
            continue
        answer = am.group(1)
        body = ("\n" + rest)[: am.start()]

        code_fences = []

        def hide_code_fence(match):
            code_fences.append((match.group(1) or "javascript", match.group(2)))
            return f"\x00CODE{len(code_fences) - 1}\x00"

        # Hide every fence before finding option markers, including fences
        # inside options where code could otherwise resemble an option label.
        body_flat = CODE_FENCE_RE.sub(hide_code_fence, body)

        opt_m = OPTION_START_RE.search(body_flat)
        if not opt_m:
            warnings.append(f"Q{num}: no (A) option marker found, skipping")
            continue
        stem_flat = body_flat[: opt_m.start()].strip("\n")
        options_block = body_flat[opt_m.start() :]

        def split_segments(flat_text):
            segments = []
            pos = 0
            for placeholder in PLACEHOLDER_RE.finditer(flat_text):
                text = flat_text[pos : placeholder.start()].strip("\n")
                if text.strip():
                    segments.append(("text", text.strip()))
                language, code = code_fences[int(placeholder.group(1))]
                segments.append(("code", language, code))
                pos = placeholder.end()
            text = flat_text[pos:].strip("\n")
            if text.strip():
                segments.append(("text", text.strip()))
            return segments

        stem_segments = split_segments(stem_flat)

        parts = OPTION_SPLIT_RE.split(options_block)
        options = {}
        it = iter(parts[1:])
        for letter, text in zip(it, it):
            options[letter] = split_segments(text)
        last_option_index = max(
            (OPTION_LETTERS.index(letter) for letter in options), default=-1
        )
        expected_options = OPTION_LETTERS[: last_option_index + 1]
        missing = [letter for letter in expected_options if letter not in options]
        if missing:
            warnings.append(f"Q{num}: missing option(s) {missing}")
        if any(letter not in options for letter in answer):
            warnings.append(f"Q{num}: answer {answer} is not among the parsed options")

        questions.append(
            {
                "number": num,
                "stem_segments": stem_segments,
                "options": options,
                "answer": answer,
            }
        )

    questions.sort(key=lambda q: q["number"])
    return questions, warnings


def inline_md_to_html(text):
    """Escape HTML, then turn `code` spans into <code>."""
    text = html.escape(text, quote=False)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", text)


JS_KEYWORDS = {
    "const", "let", "var", "function", "return", "if", "else", "for",
    "while", "do", "switch", "case", "break", "continue", "class",
    "extends", "super", "new", "this", "typeof", "instanceof", "in", "of",
    "void", "delete", "throw", "try", "catch", "finally", "async", "await",
    "yield", "import", "export", "from", "as", "default", "static", "get",
    "set", "null", "undefined", "true", "false",
}
JS_BUILTINS = {
    "console", "Promise", "Math", "JSON", "Array", "Object", "Number",
    "String", "Boolean", "Symbol", "Map", "Set", "Error", "Infinity",
    "NaN", "Date", "RegExp", "Function", "Reflect", "Proxy",
}
# Tokenizes just enough JS to color it, not to parse it: comments, strings
# (including template literals — colored as one string span, ${...}
# interpolation isn't split out separately), numbers, and bare identifiers
# (checked against JS_KEYWORDS/JS_BUILTINS). Everything else (punctuation,
# operators, whitespace) is left as plain text in the gaps between matches.
JS_TOKEN_RE = re.compile(
    r"(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)"
    r"|(?P<template>`(?:\\.|[^`\\])*`)"
    r"|(?P<string>\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*')"
    r"|(?P<number>\b\d+\.\d+\b|\b\d+\b)"
    r"|(?P<ident>[A-Za-z_$][A-Za-z0-9_$]*)"
)


def highlight_js(code):
    """Wrap JS tokens in <span class="tok-...">, HTML-escaping as it goes.

    Tokenizes the raw code first, then escapes each piece individually —
    escaping the whole string up front would shift offsets (`<` becomes
    `&lt;`) and desync the regex matches against the original source.
    """
    out = []
    pos = 0
    for m in JS_TOKEN_RE.finditer(code):
        if m.start() > pos:
            out.append(html.escape(code[pos : m.start()]))
        text = m.group(0)
        esc = html.escape(text)
        kind = m.lastgroup
        if kind == "comment":
            out.append(f'<span class="tok-comment">{esc}</span>')
        elif kind in ("template", "string"):
            out.append(f'<span class="tok-string">{esc}</span>')
        elif kind == "number":
            out.append(f'<span class="tok-number">{esc}</span>')
        elif kind == "ident" and text in JS_KEYWORDS:
            out.append(f'<span class="tok-keyword">{esc}</span>')
        elif kind == "ident" and text in JS_BUILTINS:
            out.append(f'<span class="tok-builtin">{esc}</span>')
        else:
            out.append(esc)
        pos = m.end()
    out.append(html.escape(code[pos:]))
    return "".join(out)


CSS = """
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; }
  #card {
    width: 1786px;
    padding: 40px 48px;
    background: #ffffff;
    font-family: -apple-system, "PingFang TC", "Heiti TC", "Noto Sans TC", sans-serif;
    font-size: 30px;
    line-height: 1.65;
    color: #111111;
  }
  .stem { white-space: pre-wrap; margin-bottom: 6px; }
  pre.code {
    margin: 14px 0;
    padding: 18px 22px;
    background: #f4f4f5;
    border: 1px solid #dcdce0;
    border-radius: 8px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 24px;
    line-height: 1.5;
    white-space: pre;
    overflow-x: auto;
    color: #1a1a1a;
  }
  .tok-keyword { color: #d73a49; }
  .tok-string { color: #032f62; }
  .tok-comment { color: #6a737d; font-style: italic; }
  .tok-number { color: #005cc5; }
  .tok-builtin { color: #6f42c1; }
  .options { margin-top: 10px; }
  .option { margin: 10px 0; display: flex; align-items: flex-start; }
  .option .label { flex: 0 0 56px; }
  .option-content { flex: 1; min-width: 0; }
  .option-content .stem { margin-bottom: 0; }
  .option-content pre.code { margin: 0 0 12px; }
  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    background: #f0f0f2;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.92em;
  }
"""


def render_question_html(q):
    stem_html = []
    for seg in q["stem_segments"]:
        if seg[0] == "text":
            stem_html.append(f'<div class="stem">{inline_md_to_html(seg[1])}</div>')
        else:
            _, lang, code = seg
            stem_html.append(f'<pre class="code">{highlight_js(code)}</pre>')
    options_html = []
    for letter, segments in q["options"].items():
        content = []
        for seg in segments:
            if seg[0] == "text":
                content.append(inline_md_to_html(seg[1]))
            else:
                _, lang, code = seg
                content.append(f'<pre class="code">{highlight_js(code)}</pre>')
        options_html.append(
            f'<div class="option"><span class="label">({letter})</span>'
            f'<div class="option-content">{"".join(content)}</div></div>'
        )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>{CSS}</style></head><body>
<div id="card">
{''.join(stem_html)}
<div class="options">{''.join(options_html)}</div>
</div>
</body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="source markdown file")
    ap.add_argument("--out-dir", required=True, help="output problem-set folder")
    ap.add_argument("--label", required=True, help="filename prefix, e.g. FinalExam50Q")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="parse only, print a JSON summary, write nothing",
    )
    args = ap.parse_args()

    md_text = Path(args.input).read_text(encoding="utf-8")
    questions, warnings = parse_exam(md_text)

    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)

    numbers = [q["number"] for q in questions]
    expected = list(range(1, len(numbers) + 1)) if numbers else []
    if numbers != expected:
        print(
            f"WARNING: question numbers are not a clean 1..N sequence: {numbers}",
            file=sys.stderr,
        )

    if args.dry_run:
        print(
            json.dumps(
                {
                    "questionCount": len(questions),
                    "warningCount": len(warnings),
                    "sample": questions[:2],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    from playwright.sync_api import sync_playwright

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    keys = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1786, "height": 100})
        for q in questions:
            page.set_content(render_question_html(q), wait_until="load")
            el = page.locator("#card")
            fname = f"{args.label}Q{q['number']}.png"
            el.screenshot(path=str(out_dir / fname))
            keys[fname] = q["answer"]
        browser.close()

    keys_path = out_dir / f"{args.label}keys.json"
    keys_path.write_text(
        json.dumps(keys, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(questions)} images and {keys_path} to {out_dir}")
    if warnings:
        print(f"{len(warnings)} warning(s) — see stderr above", file=sys.stderr)


if __name__ == "__main__":
    main()
