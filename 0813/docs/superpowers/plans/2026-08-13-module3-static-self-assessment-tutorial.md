# Module 3 Static Self-Assessment Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the Module 3 tutorial on a learner-facing, self-contained static quiz bundle with immediate feedback and no instructor workflow.

**Architecture:** Keep the existing question-folder analysis, configuration, quiz-template, and packaging workflow. Remove the teacher aggregation section and revise every learner-facing prompt, validation item, navigation item, and closing note so results remain only in the learner's browser.

**Tech Stack:** Static HTML, embedded CSS and JavaScript examples, Python standard-library packaging script.

## Global Constraints

- Modify only `docs/module3/quiz-app-tutorial.html` for reader-facing tutorial content.
- The final deliverable is a directly opened static HTML self-assessment bundle.
- Do not mention dashboards, instructor/teacher workflows, CSV exports, class aggregation, or result collection.
- Retain immediate per-question feedback and the existing question-bundle build path.

---

### Task 1: Remove instructor-oriented flow

**Files:**
- Modify: `docs/module3/quiz-app-tutorial.html`

**Interfaces:**
- Consumes: Existing Module 2 question-image folder plus answer JSON.
- Produces: A student-only tutorial outline with no instructor result path.

- [ ] **Step 1: Write the failing content check**

Run:

```bash
rg -n -i 'dashboard|teacher|instructor|老師|教師|CSV|aggregate|report-aggregator|全班' docs/module3/quiz-app-tutorial.html
```

Expected: matches identify material that must be removed or rewritten.

- [ ] **Step 2: Remove Step 7 and its navigation item**

Delete the teacher aggregation heading, prompt, explanation, checks, and matching navigation button.

- [ ] **Step 3: Rewrite remaining student workflow copy**

Replace result-download and teacher-collection language with local immediate feedback only. Update the introductory, overview, shared-engine, template-prompt, validation, and closing copy.

- [ ] **Step 4: Run the content check**

Run the command from Step 1.

Expected: no matches.

### Task 2: Validate the focused static tutorial

**Files:**
- Modify: `docs/module3/quiz-app-tutorial.html`

**Interfaces:**
- Consumes: The revised student-only tutorial HTML.
- Produces: A valid local page with consistent navigation and no removed concepts.

- [ ] **Step 1: Verify navigation count**

Run a page-local check that the number of navigation buttons matches the number of `h2` headings.

- [ ] **Step 2: Verify the served page**

Serve the workspace root and request `docs/module3/quiz-app-tutorial.html`; expect HTTP 200.

- [ ] **Step 3: Check patch quality**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.
