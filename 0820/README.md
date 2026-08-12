# Workshop 2 — 0820 Draft Edition

This folder is a standalone static site draft for **AI Agent 教學應用工作坊 (二)：從教材到自主練習小工具** ("AI Agent Teaching Applications Workshop (2): From Teaching Materials to a Self-Practice Tool"), the second session in the three-part AI Agent Teaching Applications Workshop series. Content is compiled from the planning documents in `refs/` and is not final; the official per-cohort announcement governs the actual date, time, and registration link.

## Layout

- `index.html` — the only HTML file at the site root; the landing page and entry point. It presents the three hands-on modules below as one ordered pipeline (Module 1 → 2 → 3), plus the course outline and prerequisite reference material.
- `docs/` — every other HTML document, published to GitHub Pages:
  - `docs/ai-agent-workshop2-course-outline.html` — the main Workshop (2) course outline/handout, built from `refs/`.
  - `docs/codex-app-settings-guide.html` — carried-over Workshop (1) reference guide for ChatGPT Work / Codex setup.
  - `docs/module1/` — carried-over Workshop (1) reference material for the Windows 11 / AI Agent environment setup (`windows11-vibe-coding-setup.html`, `setup-windows.bat`). Presented on the top page as Module 1 of the three-module pipeline.
  - `docs/module2/exam-paper-pipeline-tutorial.html` — Module 2: hands-on tutorial for turning a downloaded exam PDF into clean per-question images and an answer-key JSON, using the chained `download-exam-pdf` / `slice-exam-pdf` / `clean-exam-question-images` skills.
  - `docs/module3/quiz-app-tutorial.html` — Module 3: hands-on tutorial for turning a finished problem-set folder into a double-click student quiz page and teacher CSV-aggregator page, using the `build-quiz-app` skill.
  - `docs/assets/` — images used by the pages above.
- `module2/`, `module3/` (top level) — working pipeline directories (`raw/`, `repo/`, `docs/`, `app/`) used to produce the material and screenshots referenced by the Module 2/3 tutorials. Not part of the published site itself.
- `.claude/skills/`, `.agents/skills/` — the Claude Code skills (`download-exam-pdf`, `slice-exam-pdf`, `clean-exam-question-images`, `build-quiz-app`) that the Module 2/3 tutorials walk through.
- `refs/` — source planning documents for this session (workshop intro, DM copy, series executive summary, module design/development plans). Not part of the published site.
- `tests/` — content regression checks for the reference guide under `docs/`.

## Verification

Run the content regression checks from this directory:

```bash
python3 -m unittest discover -s tests -v
```

Before sharing the draft, also click through the internal links (especially the `docs/` cross-links and the `../index.html` / `../../index.html` "back to parent" links) and render the key pages at desktop and mobile widths.
