# TA Skills Training Workshop — 0813 Draft Edition

This folder is a standalone static site draft for **AI Agent 助教技能培訓工作坊：從工具安裝、檔案管理到問題排除** ("AI Agent TA Skills Training Workshop: From Tool Installation and File Management to Troubleshooting"), a half-day session that trains teaching assistants (and interested administrative staff) to provide first-line technical support for faculty using AI Agents — not to design teaching materials, write questions, or act as software engineers. The single course document, `docs/ta-workshop-guide.html`, is compiled directly from the planning documents in `refs/` (`AI-Agent-助教技能培訓工作坊-執行摘要.md` and `-執行方案.md`) and maps that same content onto the concrete Module 1–3 material this training's "vibe coding build" unit draws on. Content is not final; the official per-cohort announcement governs the actual date, time, and registration link.

## Layout

- `index.html` — the only HTML file at the site root; the landing page and entry point. It presents the three hands-on modules below as one ordered pipeline (Module 1 → 2 → 3), plus the combined course outline/TA guide and prerequisite reference material.
- `docs/` — every other HTML document, published to GitHub Pages:
  - `docs/ta-workshop-guide.html` — the complete course document: workshop positioning, training goals, audience/scale, afternoon schedule and checkpoints, hands-on scope and principles, and data safety, built directly from `refs/`; followed by a module-by-module (1–3) technical-support breakdown (where faculty commonly get stuck, what TAs should know, quick troubleshooting tables) mapping that same `refs/` content onto the concrete Module 1–3 material below. Trains TAs to provide first-line support during the live faculty session, not to operate specific pre-built tools. (Originally two separate pages — a `refs/`-based course outline and a module-specific guide — merged into one document.)
  - `docs/codex-app-settings-guide.html` — carried-over Workshop (1) reference guide for ChatGPT Work / Codex setup.
  - `docs/module1/` — carried-over Workshop (1) reference material for the Windows 11 / AI Agent environment setup (`windows11-vibe-coding-setup.html`, `module1-setup-windows.bat`). Presented on the top page as Module 1 of the three-module pipeline.
  - `docs/module2/exam-paper-pipeline-tutorial.html` — Module 2: hands-on tutorial for turning a downloaded exam PDF into clean per-question images and an answer-key JSON, using the chained `download-exam-pdf` / `slice-exam-pdf` / `clean-exam-question-images` skills.
  - `docs/module3/quiz-app-tutorial.html` — Module 3: hands-on tutorial for designing and building, from scratch (no pre-built skill), a tool that turns a finished problem-set folder into a double-click student quiz page and teacher CSV-aggregator page.
  - `docs/assets/` — images used by the pages above.
- `module2/`, `module3/` (top level) — working pipeline directories (`raw/`, `repo/`, `docs/`, `app/`) used to produce the material and screenshots referenced by the Module 2/3 tutorials. Not part of the published site itself.
- `.claude/skills/`, `.agents/skills/` — the Claude Code skills (`download-exam-pdf`, `slice-exam-pdf`, `clean-exam-question-images`, `build-quiz-app`) that the Module 2 tutorial walks through (`build-quiz-app` itself is only referenced for comparison in Module 3, not invoked).
- `refs/` — source planning documents for this session (workshop intro, DM copy, series executive summary, module design/development plans, TA training plans). Not part of the published site.
- `tests/` — content regression checks for the reference guide under `docs/`.
- `_archive/` — retired material kept for reference, not part of the published site: `module4/` (working pipeline dir) and `docs-module4/` (the former Module 4 quickstart tutorial + its skill bundle), removed because this workshop trains TAs, not faculty, and Module 4 was a faculty-only shortcut; `ta-workshop-course-outline.html`, the original standalone `refs/`-based course outline page, since merged into `docs/ta-workshop-guide.html`.

## Verification

Run the content regression checks from this directory:

```bash
python3 -m unittest discover -s tests -v
```

Before sharing the draft, also click through the internal links (especially the `docs/` cross-links and the `../index.html` / `../../index.html` "back to parent" links) and render the key pages at desktop and mobile widths.
