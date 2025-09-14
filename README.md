
# HundredX GO Scores — Chrome Extension Prototype

A polished MV3 extension that augments Claude/Perplexity results with inline **GO score badges** and a **right-side comparison panel**. Data is fake for demo purposes.

## What it does
- Detects brand names in AI responses (e.g., Nike, Adidas, Canon, Nikon, Delta, United, Apple, Samsung).
- Adds an inline `GO 87`-style badge next to each brand mention with a hover tooltip: “Based on N reviews by verified users.”
- Clicking a badge opens a **sleek side panel** with:
  - Brand card (GO score, reviews, top pros/cons)
  - Automatic **head‑to‑head comparison** when 2+ brands are in the same response.

## How to install (dev)
1. Download and unzip the archive.
2. Go to `chrome://extensions` → toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select the unzipped folder.
4. Open Claude (https://claude.ai) or Perplexity (https://perplexity.ai) and run a query like:
   - “Nike vs Adidas running shoes”
   - “Best DSLR — Canon or Nikon?”
5. You should see GO badges injected into the response. Click a badge to open the panel.

## Notes
- This injects into known response containers via a `MutationObserver` and wraps **text nodes**; it avoids code blocks/inputs.
- Side panel is isolated via **Shadow DOM** to prevent style clashes.
- Accessibility: badges are keyboard‑focusable with ARIA labels; `Esc` closes the panel.
- You can tweak brands and scores in `brands.json`.

## Files
- `manifest.json`: MV3 config
- `content.js`: parses DOM, injects badges, manages the panel
- `styles.css`: badge/tooltip/panel styles (panel styles live inside shadow root)
- `panel.html`: template for the side panel
- `brands.json`: fake demo data (editable)
- `icons/`: placeholder icons

— Enjoy the demo!
