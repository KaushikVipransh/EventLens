# Design Language
## Event Photo Retrieval Platform

Based on the reference Dribbble motion study (Nunito / DSM-style landing pages). This is a bold, geometric, product-studio aesthetic — playful but confident, not corporate.

---

## 1. Colors

**Base:**
- Background: warm off-white / cream (`#F2F1EC`–`#F7F7F4` range) — never pure white, gives a soft paper-like base.
- Primary text/ink: near-black (`#17171A`) — used for all headline type, not pure `#000`.
- Content panels: pure white (`#FFFFFF`) floated on the cream/gradient background, giving a "card within a page" effect.

**Accent palette** (used sparingly, as shapes/icons/highlights — never as large fills):
- Coral/orange (`#E8623A`–`#F0997B` range)
- Green (`#4C9A5B`–`#63C48A` range)
- Blue (`#3A7BD5`–`#6FA8E8` range)
- Purple (`#8B6FD9`)
- Yellow/amber (`#F0B429`)

**Background atmosphere:** soft, low-saturation gradient blobs (pink → orange → purple) blurred behind the white content panel — decorative only, never behind text directly.

**Usage rule:** color lives in icons, shape accents, chips, and small UI elements. Large surfaces (backgrounds, cards, nav) stay neutral (cream/white/black). This is what keeps it feeling premium instead of loud.

---

## 2. Typography

- Typeface: bold geometric grotesk (reference uses "Mont" — a good substitute is **Sora, General Sans, or Space Grotesk**).
- Headlines are **oversized**, often lowercase, tight line-height, and mixed inline with icons/shapes replacing words (e.g., an arrow icon standing in for "→").
- Clear type scale (from the reference typescale panel):
  - Major headline: ~54–64px, semibold
  - Headline 1: ~36–48px, regular/medium
  - Headline 2: ~24px, regular
  - Body: ~16px, regular, generous line-height (1.5)
- Weight contrast is used instead of color contrast — bold headlines against regular-weight body text, all in near-black ink.

---

## 3. Layout Principles

- Generous whitespace; content breathes, never crowded.
- A **floating white panel** sits on a soft gradient/cream backdrop — this "canvas within a canvas" framing is the signature layout move.
- Compositions are asymmetric and scattered — icons, badges, and shapes are placed off-grid for energy, not confined to strict columns.
- Thin hairline dividers (1px, low-contrast) separate nav from content, never heavy borders.
- Center-weighted hero content, with decorative elements (sparkles, dashed connector lines, floating icon chips) placed loosely around it.

---

## 4. Navigation

- Logo/wordmark, left-aligned, paired with a small icon or mark.
- Nav links, center or left-of-center, plain text, medium weight, no underlines until hover.
- Small numeric badge/chip on nav items when relevant (e.g., notification count) — pill-shaped, solid accent color, white text.
- Right side: a text link ("Log in") + a solid pill CTA button ("Sign up") — this pairing (ghost + solid pill) is consistent across both reference sites.

---

## 5. Components

**Buttons:**
- Primary: solid black (or near-black) pill, white text, medium weight, generous horizontal padding — no gradients, no shadow.
- Secondary: outline pill, transparent fill, black border and text.
- Icon-only buttons: circular, either outlined or soft-filled, single icon centered.

**Cards / Photo tiles:**
- Rounded corners (12–16px), white background, minimal to no border, sit on the cream backdrop with subtle separation via whitespace rather than heavy shadows.
- Hover state: slight scale or a soft shadow lift — kept minimal, not dramatic.

**Chips/badges:**
- Pill-shaped, solid accent fill, white or dark text depending on contrast, small font size (~13px).

**Toggles:**
- Fully rounded track, solid fill when active (green/blue), circular white knob — soft and tactile, not flat/boxy.

**Decorative elements:**
- Dashed connector lines linking icons/shapes (playful, "flow" feeling).
- Small sparkle/star accents scattered in empty space.
- Soft gradient blobs strictly as background atmosphere, never under text.

---

## 6. Applying This to the Event Photo App

| Screen | Application |
|---|---|
| **Landing/nav** | Cream background, floating white hero panel, bold lowercase headline ("find yourself in every photo"), black pill CTA ("Get started" / "Create event"), soft gradient blob behind the panel. |
| **Gallery view** | White panel on cream backdrop; photo grid with generously rounded tiles, soft hover lift; a persistent pill-shaped "Find my photos" button (accent-colored, not black, to stand out as the key action) floating above the grid. |
| **Photo card** | Rounded 12–16px corners, minimal border, small download icon-button appears on hover in a corner, subtle overlay only on hover (no permanent dark scrim). |
| **Selfie capture flow** | Centered white card on cream backdrop, camera viewfinder as the focal element, dashed accent line or sparkle accents used sparingly to keep the "processing" state feeling light rather than clinical. |
| **Download action** | Solid black pill button with a download icon, consistent with the primary-button style across the reference. |
| **Photographer/organizer upload links** | Simple chip-based list (one chip per photographer link), pill "copy link" buttons, staying consistent with the pill-first component language. |

---

## 7. What to Avoid

- No dark/moody UI — this language is bright, warm, and light-forward.
- No sharp/square corners — everything rounded, from buttons to cards to chips.
- No large blocks of saturated color — accents stay small and purposeful.
- No dense, boxed dashboard-style layouts — keep whitespace generous even on data-heavy screens like the gallery.
