---
name: Fit Food Finder
description: A live meal board that ranks restaurant meals against a student's remaining macro gap.
colors:
  fieldhouse-cobalt: "#244fd8"
  acid-lime: "#ccff39"
  focus-orange: "#ff6a2b"
  ink-navy: "#101a32"
  cool-paper: "#f3f2ea"
  paper-deep: "#e7e6dc"
  warm-white: "#fffef8"
  muted-slate: "#556074"
  ruled-line: "#c7c9c4"
  detail-muted: "#bfc8da"
  detail-line: "#39445b"
  error-red: "#b42318"
  error-soft: "#ffe4df"
  selected-muted: "#dbe4ff"
typography:
  display:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.25rem, 6.5vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.04em"
  data-display:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "clamp(4rem, 7vw, 7.25rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  compact-display:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.85rem, 14vw, 3.65rem)"
    fontWeight: 400
    lineHeight: 0.88
    letterSpacing: "-0.04em"
  compact-data-display:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.7rem, 13vw, 3.35rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "clamp(1.8rem, 3vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo Black, ui-sans-serif, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.035em"
  metric:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  control: "8px"
  score: "9px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  2xl: "30px"
components:
  button-primary:
    backgroundColor: "{colors.fieldhouse-cobalt}"
    textColor: "{colors.warm-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.acid-lime}"
    typography: "{typography.label}"
    rounded: "0"
    padding: "0"
  target-number:
    backgroundColor: "transparent"
    textColor: "{colors.ink-navy}"
    typography: "{typography.data-display}"
    rounded: "0"
    padding: "0 0 8px"
  search-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "0"
    padding: "12px 0"
  sort-select:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.control}"
    padding: "9px 30px 9px 10px"
  confidence-official:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 7px"
  meal-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-navy}"
    rounded: "0"
    padding: "14px 10px"
  meal-row-selected:
    backgroundColor: "{colors.fieldhouse-cobalt}"
    textColor: "{colors.warm-white}"
    rounded: "0"
    padding: "14px 10px"
  fit-score:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.score}"
    padding: "8px 10px"
  detail-panel:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.warm-white}"
    rounded: "0"
    padding: "30px 24px"
---

# Design System: Fit Food Finder

## Overview

**Creative North Star: "The Campus Strength Log"**

The system turns a campus strength log into a live meal board: cool ruled paper, fixed data columns, decisive block type, and high-contrast marks that make nutrition tradeoffs legible at a glance. It feels athletic and utilitarian without borrowing the soft cards, pastel gradients, or lifestyle imagery of a generic wellness dashboard.

The experience is dense because comparison is the job, but it never becomes ornamental. Cobalt establishes the working zone, ink navy anchors navigation and detail, and acid lime marks the numbers that change a decision. On small screens the same board compresses rather than changing identity: macro columns remain aligned, labels shorten, and detail moves below the ranking.

**Key Characteristics:**

- Ruled-paper field with strong horizontal dividers
- Cobalt working surfaces and ink-navy structural surfaces
- Acid-lime marks reserved for status, fit, and proof
- Archivo Black for decisive headings and large numeric decisions
- Fixed, tabular data columns that survive narrow viewports

## Colors

The palette pairs cool athletic primaries with off-white paper neutrals; color always carries hierarchy or state.

### Primary

- **Fieldhouse Cobalt** (`#244fd8`): The main working color for the target brief and the selected meal row.

### Secondary

- **Acid Lime** (`#ccff39`): The signal color for fit scores, live status, official confidence, highlighted headline text, and selection.

### Tertiary

- **Focus Orange** (`#ff6a2b`): A focus-only accessibility accent used for the global visible outline.

### Neutral

- **Ink Navy** (`#101a32`): Default text, masthead, detail panel, footer, and the strongest rules.
- **Cool Paper** (`#f3f2ea`): The ruled page background beneath the application.
- **Paper Deep** (`#e7e6dc`): Secondary notes, inactive confidence chips, and loading bands.
- **Warm White** (`#fffef8`): Input and hover surfaces plus reversed text on dark and cobalt fields.
- **Muted Slate** (`#556074`): Supporting labels, metadata, placeholders, and secondary copy.
- **Ruled Line** (`#c7c9c4`): The quiet divider used throughout filters, rows, and panel boundaries.
- **Detail Muted** (`#bfc8da`): Low-contrast type reserved for ink-navy detail surfaces.
- **Detail Line** (`#39445b`): Macro-grid and option strokes reserved for ink-navy detail surfaces.
- **Error Red** (`#b42318`): Text for recoverable location and data failures.
- **Error Soft** (`#ffe4df`): Background for recoverable failure messages.
- **Selected Muted** (`#dbe4ff`): Secondary metadata on cobalt selected rows.

### Named Rules

**The Signal Lime Rule.** Acid lime marks a decision, status, or verified fact; it is not a decorative fill for ordinary surfaces.

## Typography

**Display Font:** Archivo Black (with ui-sans-serif fallback)  
**Body Font:** System UI sans serif  
**Label Font:** System UI sans serif

**Character:** Archivo Black supplies the compact force of a scoreboard, while the system face keeps dense macro data and controls familiar. Tight display tracking and heavy uppercase labels make the page feel logged, measured, and decisive.

### Hierarchy

- **Display** (400, fluid `3.25rem–6rem`, 0.86): The two-line target promise; compresses to `2.85rem–3.65rem` below 600px.
- **Data Display** (400, fluid `4rem–7.25rem`, 0.9): Calorie and protein target inputs with tabular numerals.
- **Compact Display** (400, fluid `2.85rem–3.65rem`, 0.88): Mobile target promise.
- **Compact Data Display** (400, fluid `2.7rem–3.35rem`, 0.9): Mobile calorie and protein inputs.
- **Headline** (400, fluid `1.8rem–2.6rem`, 1): Results-panel heading.
- **Title** (400, `1.75rem`, 1): Selected meal title in the detail panel.
- **Metric** (850, `1.25rem`, 1.2): Fit totals, macro values, and estimated price.
- **Body** (400, `1rem`, 1.5): Explanatory copy and control content.
- **Label** (typically 800–900, `0.7rem–0.8rem`, up to `0.09em`, uppercase): Restaurants, macro names, filters, statuses, and compact metadata.

### Named Rules

**The Block Type Is a Decision Rule.** Use Archivo Black only for the promise, major section titles, target numbers, and fit totals; dense supporting data stays in the system face.

## Layout

The page is one continuous worksheet. A 72px masthead precedes a two-column target board, followed by a three-column finder shell capped at 1720px: a 220–280px filter rail, a fluid ranking board with a 520px minimum, and a 280–340px detail rail. Meal rows use five persistent columns—identity, calories, protein, protein value, and fit—so the eye can compare vertically without reopening anything.

At 1180px, detail becomes a full-width band beneath filters and results. At 820px, the hero, filters, results, and detail stack into one column; the two quick filters remain side by side. At 600px, side padding contracts to 18px, the meal board becomes a fixed `minmax(0, 1fr) 42px 40px 48px 64px` grid, and secondary units are minimized while all decision columns remain visible.

The recurring spacing rhythm is compact and practical: 8–12px inside data marks, 18–24px between related control groups, and about 30px at major panel edges. The ruled body background repeats every 32px and reinforces the worksheet cadence.

## Elevation & Depth

The system is flat by default. Section ownership comes from color fields, 1–6px rules, and adjoining panels rather than floating cards. Shadows are limited to the live-status dot and the movable switch thumb; they clarify small physical states instead of elevating content.

### Shadow Vocabulary

- **Live Signal Glow** (`0 2px 9px rgba(204, 255, 57, 0.55)`): A compact glow behind the masthead status dot.
- **Switch Thumb Lift** (`0 2px 6px rgba(16, 26, 50, 0.3)`): Physical separation for the toggle thumb only.

### Named Rules

**The Flat Worksheet Rule.** Do not float primary content in generic shadowed cards; use ruled edges and solid field changes to establish depth.

## Shapes

Most structural surfaces and rows are square so their columns read as one continuous board. Gentle rounding belongs to discrete controls and annotations: 8px for selects and action buttons, 9px for fit-score blocks, 14px for explanatory notes, and full pills for confidence badges and switches. The circular F/F mark and live dot are identity and status exceptions, not a general card language.

## Components

### Buttons

- **Primary:** A compact cobalt action with warm-white heavy text, 8px corners, and `11px 16px` padding; used by the empty-state recovery action.
- **Text:** Underlined, background-free, and heavy. On dark surfaces it uses acid lime; elsewhere it inherits the local ink color.
- **Focus:** Every button uses the same 3px orange outline with a 3px offset.

### Target Fields

- **Style:** Oversized Archivo Black numerals sit on a 6px ink baseline with the unit aligned to the baseline.
- **Focus:** The baseline changes from ink navy to cobalt; the input itself keeps no inner outline.
- **Behavior:** Numerals are tabular and scale fluidly; units hide below 600px while labels remain.

### Search, Sort, and Toggles

- **Search:** Transparent field with a 19px outlined search icon and a 2px ink underline.
- **Sort:** Warm-white select with a quiet ruled-line border, 8px corners, and compact heavy type.
- **Toggle:** A 38px by 22px gray pill with a 16px warm-white thumb; the track turns cobalt when checked.

### Source Confidence Chips

- **Published Macros:** Acid-lime pill with ink-navy uppercase text.
- **Published Core:** Paper-deep pill with muted-slate uppercase text; calories and protein are sourced while carbs and fat are estimated.
- **Placement:** Metadata stays below the meal name rather than becoming a heading above it.

### Meal Rows

- **Default:** Transparent five-column row with a 1px ruled-line divider and a 98px minimum height.
- **Hover:** Warm-white field and a 5px horizontal nudge over 200ms.
- **Selected:** Full cobalt field with warm-white data; the fit-score cell remains acid lime for continuity.
- **Responsive:** The same columns persist on mobile with fixed numeric widths and truncated meal names.

### Fit Scores

- **Style:** Acid-lime block, 9px corners, centered ink-navy percentage, and a compact uppercase fit label.
- **Numerals:** Archivo Black with tabular figures so the score behaves like a live board readout.

### Detail Panel

- **Style:** Ink-navy field with warm-white content, acid-lime restaurant and fit signals, and detail-line macro cells.
- **Structure:** Meal title and provider badge lead into the recalculated fit, a two-column macro grid, source links, and available local price.
- **Behavior:** Content is sticky on wide screens, becomes a two-column full-width band below 1180px, and stacks below the meal list on mobile.

## Do's and Don'ts

### Do:

- **Do** keep calorie, protein, protein value, and fit in stable vertical columns, including on narrow screens.
- **Do** use acid lime for proof-bearing marks such as fit, provider verification, and live state.
- **Do** use ruled dividers and adjoining color fields to organize dense information.
- **Do** preserve visible orange focus treatment and the reduced-motion override.

### Don't:

- **Don't** replace the worksheet with a grid of floating wellness cards.
- **Don't** use Archivo Black for paragraphs, long labels, or dense table metadata.
- **Don't** apply acid lime as an ambient background or general decoration.
- **Don't** hide the core macro columns on mobile; compress labels and spacing first.
