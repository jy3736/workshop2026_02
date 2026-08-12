# TA Workshop Infographic Slide Prompt

Copy this prompt into Codex and replace the bracketed values. It is designed for the built-in `imagegen` skill.

```text
Use the `imagegen` skill in its default built-in tool mode to create one project-bound PNG infographic slide for this target document:

- Source document: [TARGET_HTML_OR_MD_PATH]
- Slide topic / module number: [MODULE_NUMBER_AND_TITLE]
- Intended output path after generation: [PROJECT_RELATIVE_OUTPUT_PATH].png
- Language for all slide text: [LANGUAGE]

First, read the target document and identify one self-contained workflow or concept that can be taught in three stages. Extract only the exact wording needed for the title, one short subtitle, three stage labels, three short captions, and one bottom-line learning outcome. Do not invent claims, procedures, filenames, commands, or requirements that are absent from the source. If the source does not support exactly three stages, choose the clearest three-part grouping and state the grouping before generation.

Then generate one 16:9 landscape PNG infographic (matching the visual language of `0813/docs/assets/ta-workshop-guide/module1-environment-brief.png`, `module2-question-bank-brief.png`, and `module3-quiz-site-brief.png`). This is a standalone teaching slide intended to appear inside an HTML or Markdown document.

Use case: infographic-diagram
Asset type: embedded teaching infographic slide for an HTML or Markdown document
Input images: the three named PNG files are style-and-layout references only; do not copy their text, module names, or illustrated objects
Primary request: communicate the extracted three-stage workflow accurately and at a glance
Scene/backdrop: near-black navy background with a subtle technical grid, faint circuit traces, and restrained glowing nodes; no photographic environment
Style/medium: premium dark technology-training infographic, clean editorial slide layout, semi-realistic isometric 3D illustrations, crisp high-contrast typography
Composition/framing: 16:9 landscape; generous safe margins; large title at top left; short mint subtitle below it; three equal rounded rectangular cards across the middle; use small glowing arrows between cards only when they clarify flow; a full-width rounded outcome banner along the bottom
Color palette: deep navy and blue-black background; warm amber/gold for title, step numbers, primary labels, connectors, and outcome emphasis; mint/aqua for subtitle, captions, validation states, and selected highlights; off-white for only essential secondary text
Typography: use a bold modern sans-serif with excellent Traditional Chinese and Latin support; exact text must be sharp, large, high-contrast, and fully legible. Keep every text block short; do not use placeholder text, lorem ipsum, tiny labels, or decorative pseudo-text.
Card system: each of the three cards has a thin mint, teal, or blue edge glow; a circled amber step number; a large amber stage label; a fine divider line; one central isometric 3D object that is a literal visual metaphor for that stage; and one short mint caption at the bottom. Keep visual weight and spacing balanced across all cards.
Text (verbatim):
- Title: "[EXACT_TITLE]"
- Subtitle: "[EXACT_SUBTITLE]"
- Card 1: "[STEP_1_LABEL]" / "[STEP_1_CAPTION]"
- Card 2: "[STEP_2_LABEL]" / "[STEP_2_CAPTION]"
- Card 3: "[STEP_3_LABEL]" / "[STEP_3_CAPTION]"
- Outcome banner: "[EXACT_OUTCOME]"
Illustration mapping:
- Card 1: [LITERAL_3D_OBJECT_FOR_STEP_1]
- Card 2: [LITERAL_3D_OBJECT_FOR_STEP_2]
- Card 3: [LITERAL_3D_OBJECT_FOR_STEP_3]
Constraints: Preserve the supplied text verbatim; make the workflow order unmistakable; retain strong readability when embedded at the document content width; no logos or trademarks unless explicitly provided in the source; no people unless essential to the source; no student data or sensitive information; no watermark.
Avoid: light backgrounds; excessive glow; crowded cards; charts; paragraphs; more than three workflow cards; illegible Chinese characters; misspelled English; unrelated devices or decorations; copied artwork or copied text from the reference images.

After generation, inspect the result at full size. Verify the 16:9 composition, the exact text, the three-step order, unclipped margins, visible outcome banner, and that each illustration matches its card. If text is inaccurate or unreadable, regenerate once with a targeted correction. Copy the selected final PNG from the built-in ImageGen output location into `[PROJECT_RELATIVE_OUTPUT_PATH].png`; do not overwrite an existing asset unless explicitly requested. Finally, report the saved path, the source sections used, and any text that had to be shortened for legibility.
```

## Fill-in example

For a source section that teaches “collect, validate, publish,” use literal objects such as a folder with source documents, a checklist with a magnifier, and a boxed web page with a checkmark. Keep the wording in the target document authoritative; the generated illustration should explain it rather than add content.
