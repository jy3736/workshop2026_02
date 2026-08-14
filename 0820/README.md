# Workshop 2 — 0820 Draft Edition

This folder is a standalone static site draft for **AI Agent 教學應用工作坊 (二)：從教材到自主練習小工具** ("AI Agent Teaching Applications Workshop (2): From Teaching Materials to a Self-Practice Tool"), the second session in the three-part AI Agent Teaching Applications Workshop series. Content is compiled from the planning documents in `refs/` and is not final; the official per-cohort announcement governs the actual date, time, and registration link.

## Layout

- `index.html` — the only HTML file at the site root; the landing page and entry point. It presents the four hands-on modules below as one ordered pipeline (Module 1 → 2 → 3 → 4), plus the course outline and prerequisite reference material.
- `docs/` — every other HTML document, published to GitHub Pages:
  - `docs/ai-agent-workshop2-course-outline.html` — the main Workshop (2) course outline/handout, built from `refs/`.
  - `docs/codex-app-settings-guide.html` — carried-over Workshop (1) reference guide for ChatGPT Work / Codex setup.
  - `docs/module1/` — Windows 11 / AI Agent environment setup (`windows11-vibe-coding-setup.html`, `module1-setup-windows.bat`), covering three independent parts: installing/configuring the ChatGPT desktop app (Chat/Work/Codex), installing VS Code with the Codex + GitHub Copilot extensions plus Python/Markdown/HTML/MS-Office viewers, and applying for a GitHub account + GitHub Education. Presented on the top page as Module 1 of the four-module pipeline.
  - `docs/module2/exam-paper-pipeline-tutorial.html` — Module 2: hands-on tutorial for turning a downloaded exam PDF into clean per-question images and an answer-key JSON, using the chained `download-exam-pdf` / `slice-exam-pdf` / `clean-exam-question-images` skills.
  - `docs/module3/quiz-app-tutorial.html` — Module 3: hands-on tutorial for turning a finished problem-set folder into a double-click student quiz page and teacher CSV-aggregator page **from scratch**, by prompting an AI agent directly rather than using a pre-built skill. Deliberately ships with no `app/` starting point (see `module3/` below) — the exercise is designing the approach, not applying one.
  - `docs/module4/quiz-app-quickstart-tutorial.html` — Module 4: quickstart for anyone who didn't finish Module 3. Same input/output as Module 3, but generated in one prompt via the pre-built `build-quiz-app` skill instead of designing it from scratch.
  - `docs/assets/` — images used by the pages above.
- `module2/`, `module3/`, `module4/` (top level) — working pipeline directories used to produce the material and screenshots referenced by the Module 2/3/4 tutorials. Not part of the published site itself.
  - `module2/` has `raw/`, `repo/`, `docs/` — the exam-PDF pipeline from download through cleaned images.
  - `module3/` has only `repo/` (problem-set folders as input) — no `app/`, kept as a clean starting point for the from-scratch exercise. Module 4 shares this same `repo/`, so it's the one input location for both modules.
  - `module4/` has only `app/` (including `app/dist/`, the generated quiz page) — the skill-built output. It reads its problem-set input from `module3/repo/`, not its own copy.
- `.claude/skills/`, `.agents/skills/` — the same four workshop skills (`download-exam-pdf`, `slice-exam-pdf`, `clean-exam-question-images`, `build-quiz-app`) in two path flavors, one per agent tool: `.claude/skills/` for Claude Code, `.agents/skills/` for Codex. Module 2 walks through the first three chained; Module 4 applies `build-quiz-app` directly (bundled for attendees as `docs/module4/module4-agents-skills.tar`).
- `forms/` — a Google Apps Script (`questionnaire.gs`, `appsscript.json`, `.clasp.json`) that generates the pre-/post-workshop Google Forms and response spreadsheet for the two cohort sessions (8/20, 8/21). Not part of the published site.
- `refs/` — source planning documents for this session (workshop intro, DM copy, series executive summary, module design/development plans). Not part of the published site.
- `tests/` — content regression checks for the reference guide under `docs/`.

## Verification

Run the content regression checks from this directory:

```bash
python3 -m unittest discover -s tests -v
```

Before sharing the draft, also click through the internal links (especially the `docs/` cross-links and the `../index.html` / `../../index.html` "back to parent" links) and render the key pages at desktop and mobile widths.
