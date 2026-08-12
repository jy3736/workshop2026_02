---
name: embed-workflow-infographic
description: Generate and embed dark 16:9 PNG workflow infographic slides in a local HTML tutorial. Use when a user provides `{folder-store-generated-slides}` and `{target-html-docs}` and wants the tutorial's stages or numbered steps turned into concise Taiwan Traditional Chinese slides with numbered icons and connecting arrows.
---

# Embed Workflow Infographic

Create a source-grounded workflow slide, store it in the requested asset folder, and embed it in the requested HTML tutorial.

## Parameters

Require exactly these two parameters:

- `{folder-store-generated-slides}`: Writable output folder for the final PNG slide or slides.
- `{target-html-docs}`: Existing local HTML tutorial to inspect and update.

Resolve relative paths from the workspace root. Stop and request the missing path if either parameter is absent, unreadable, or outside the permitted project scope.

## Workflow

1. Inspect the target HTML before editing.
   - Extract the tutorial title, its actual ordered stages, and the intended overview location.
   - Prefer `h2` headings with IDs or text matching `step`, `stage`, `步驟`, or `階段`.
   - Ignore practice, troubleshooting, prerequisites, and next-step sections unless the tutorial explicitly defines them as workflow stages.
   - Read CSS variables or dark-theme rules and reuse their canvas, card, text, border, and accent colors.

2. Derive concise slide labels from the source.
   - Preserve the source order and meaning.
   - Use Taiwan-standard Traditional Chinese for every visible word in the generated image.
   - Remove code, file paths, extensions, English abbreviations, and implementation details from labels; replace them with short Chinese descriptions when needed.
   - Use numbered circle icons such as `①`, `②`, and `③` as requested. Do not add any other visible text that is not source-grounded.

3. Choose the slide count and layout.
   - For 2–4 stages, make one left-to-right slide.
   - For 5–7 stages, make one two-row directional flow with clear turning arrows.
   - For 8 or more stages, split the ordered flow into multiple 16:9 slides rather than shrinking labels; connect the final stage of each slide to the first stage of the next.

4. Generate the slide with `$imagegen`.
   - Read and follow the image-generation skill before invoking it.
   - Use the built-in image generator, not a CLI fallback, unless the user explicitly requests the CLI path.
   - Request a 16:9 dark professional infographic with generous whitespace, the extracted deck palette, numbered icons, and directional arrows.
   - Require no watermark, logo, fake text, English, Roman letters, code, filenames, URLs, or file extensions.
   - Request blank, unlabeled document/UI symbols so no accidental English appears inside icons.

5. Inspect the output with `view_image`.
   - Check stage order, arrows, dark palette, text fidelity, clipping, contrast, whitespace, and the no-watermark constraint.
   - If a required label is wrong, non-Chinese text appears, or a step is missing, regenerate once with a targeted correction.

6. Save final PNGs in `{folder-store-generated-slides}`.
   - Create the folder if it is missing.
   - Use `<html-stem>-workflow-dark.png` for one slide, or `<html-stem>-workflow-dark-01.png`, `-02.png`, and so on for multiple slides.
   - Do not overwrite an existing file; choose the next available `-v2`, `-v3`, and so on sibling name.
   - Copy the selected built-in image output into the requested folder before editing the HTML.

7. Embed the slide or slides in `{target-html-docs}`.
   - Compute each `img src` relative to the target HTML's parent folder; never use an absolute local path.
   - Add a responsive figure style only if an equivalent style is not already present:

```css
.workflow-infographic{max-width:var(--measure,100%);margin:1.35em 0 1.8em;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--card);box-shadow:var(--shadow)}
.workflow-infographic img{display:block;width:100%;height:auto}
.workflow-infographic figcaption{padding:.55em .9em;color:var(--muted);font-size:.88rem}
```

   - Place the figure after the overview introduction and before its detailed ordered list or the first stage heading. If no overview exists, place it before the first workflow stage.
   - Use this shape, with source-grounded Traditional Chinese alternative text and caption:

```html
<figure class="workflow-infographic" data-workflow-infographic="true">
  <img src="relative/path/to/slide.png" alt="流程各步驟的簡短說明">
  <figcaption>流程總覽</figcaption>
</figure>
```

   - If the page already has a `data-workflow-infographic="true"` block for this workflow, update that block instead of adding a duplicate.

8. Validate before reporting completion.
   - Confirm every final PNG exists and is a PNG image.
   - Confirm every embedded relative source resolves to a local file.
   - Run `git diff --check`.
   - Serve the relevant document root locally and confirm the HTML page and every generated PNG return HTTP 200.

## Report

Report the final PNG path or paths, the updated HTML path, the number of stages represented, the built-in generation mode, and the validation results.
