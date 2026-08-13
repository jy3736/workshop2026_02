---
name: embed-concept-infographic
description: "Generate and embed dark 16:9 explanatory infographic slides in local HTML or Markdown documentation. Use when a user provides {folder-store-generated-slides} and {target-docs} and wants each section's concepts, knowledge, relationships, comparisons, or mental models made easier to scan and understand with concise Taiwan Traditional Chinese visuals."
---

# Embed Concept Infographic Slides

Create source-grounded explanatory slides for important document sections, store the selected PNGs in the requested asset folder, and embed them into the requested HTML or Markdown documents.

## Parameters

Require exactly these two parameters:

- `{folder-store-generated-slides}`: Writable output folder for final PNG slides.
- `{target-docs}`: One existing local HTML or Markdown document, or a comma-separated list of existing local documents to inspect and update.

Resolve relative paths from the workspace root. Stop and request the missing path if either parameter is absent, unreadable, or outside the permitted project scope.

## Workflow

1. Inspect every target document before editing.
   - Extract its title, headings, section purpose, key concepts, terms, comparisons, relationships, and existing figures.
   - Prioritize sections that introduce a difficult concept, explain why a process works, distinguish related ideas, summarize choices, or connect cause and effect.
   - Do not create a slide for boilerplate, short transition text, code-only sections, repetitions, or material already explained by an equivalent visual.
   - Read the document's CSS variables or existing visual styles and reuse its dark-theme canvas, card, text, border, and accent colors when available.

2. Plan a compact teaching visual for each chosen section.
   - Keep one slide focused on one learning goal. Prefer one visual for every 2–4 substantial sections; do not force a slide into every heading.
   - Select the clearest source-grounded structure: concept map, layered model, before-and-after comparison, cause-and-effect chain, decision guide, hierarchy, input-transform-output model, or annotated example.
   - Preserve the source's meaning and uncertainty. Do not invent facts, steps, examples, or claims.
   - Write every visible label in Taiwan-standard Traditional Chinese. Keep labels short, concrete, and readable at normal document width.
   - Remove code, paths, extensions, English abbreviations, implementation detail, and decorative copy unless the source requires a technical term.

3. Generate slides with `$imagegen`.
   - Read and follow the image-generation skill before invoking it.
   - Use the built-in image generator, not a CLI fallback, unless the user explicitly requests the CLI path.
   - Request a 16:9 dark professional educational infographic with generous whitespace, a clear visual hierarchy, and the extracted document palette.
   - Explicitly describe the selected teaching structure and the exact Chinese labels, their relationship, and their reading order.
   - Require no watermark, logo, fake text, English, Roman letters, code, filenames, URLs, or file extensions.
   - Use simple unlabeled icons or diagrams only when they clarify the concept. Do not use decorative icons, UI mockups, or stock-photo imagery.

4. Inspect each generated image with `view_image`.
   - Check concept fidelity, label accuracy, reading order, Chinese text quality, contrast, clipping, whitespace, and the no-watermark constraint.
   - Regenerate once with a focused correction if a required label is wrong, a relationship is misleading, non-Chinese text appears, or text is missing.

5. Save selected PNGs in `{folder-store-generated-slides}`.
   - Create the folder if it is missing.
   - Name each file `<document-stem>-<section-slug>-concept-dark.png`.
   - Use a concise ASCII section slug such as `retrieval-model`, `answer-quality`, or `decision-guide`.
   - Do not overwrite an existing file; choose the next available `-v2`, `-v3`, and so on sibling name.
   - Copy the selected built-in image output into the requested folder before editing the document.

6. Embed each slide immediately after the section's introductory explanation and before dense detail, examples, code, or a long list.
   - Compute every image source relative to the target document's parent folder. Never use an absolute local path.
   - For HTML, add this responsive style only if an equivalent style does not already exist:

```css
.concept-infographic{max-width:var(--measure,100%);margin:1.35em 0 1.8em;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--card);box-shadow:var(--shadow)}
.concept-infographic img{display:block;width:100%;height:auto}
.concept-infographic figcaption{padding:.55em .9em;color:var(--muted);font-size:.88rem}
```

   - Embed HTML figures in this shape, using source-grounded Traditional Chinese alternative text and caption:

```html
<figure class="concept-infographic" data-concept-infographic="section-slug">
  <img src="relative/path/to/slide.png" alt="說明本節核心概念與關係的圖解">
  <figcaption>本節概念圖解</figcaption>
</figure>
```

   - For Markdown, embed a source-grounded image followed by an italic caption:

```md
![說明本節核心概念與關係的圖解](relative/path/to/slide.png)

*本節概念圖解*
```

   - If an equivalent `data-concept-infographic` block or same-section image already exists, update it rather than adding a duplicate.

7. Validate before reporting completion.
   - Confirm every final PNG exists and is a PNG image.
   - Confirm every embedded relative source resolves to a local file.
   - Run `git diff --check`.
   - For HTML, serve the relevant document root locally and confirm each updated page and generated PNG returns HTTP 200.

## Report

Report the final PNG paths, updated document paths, the sections and teaching structures represented, the built-in generation mode, and the validation results.
