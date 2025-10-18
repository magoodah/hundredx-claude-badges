# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome MV3 extension that injects HundredX GO score badges into AI assistant responses (Claude and Perplexity). It detects brand mentions in chat responses and adds interactive badges with review data and comparison functionality.

## Architecture

### Core Components
- **content.js**: Main content script that handles DOM mutation observation, brand detection, badge injection, and side panel management
- **manifest.json**: Chrome extension manifest defining permissions and content script configuration
- **brands.json**: Brand data store containing GO scores, review counts, pros/cons for each supported brand
- **panel.html**: HTML template for the Shadow DOM-isolated side panel
- **styles.css**: CSS for badges, tooltips, and panel styling

### Key Technical Patterns
- **Shadow DOM Isolation**: Side panel uses Shadow DOM to prevent style conflicts with host pages
- **MutationObserver**: Watches for DOM changes to detect new AI responses and inject badges
- **Text Node Walking**: Uses TreeWalker to traverse text nodes and avoid code blocks/inputs
- **Regex Brand Detection**: Dynamic regex built from brand keys, sorted by length to handle overlapping matches

### Brand Detection Flow
1. `loadBrandData()` fetches brands.json and builds detection regex
2. `MutationObserver` triggers on DOM changes
3. `getResultRoots()` identifies AI response containers using multiple selectors
4. `walkAndAnnotate()` processes text nodes, wrapping brand mentions with badges
5. Badge clicks open panel with brand details and automatic comparisons

### Panel System
- Panel template loaded from panel.html into Shadow DOM
- `renderPanelContent()` generates brand cards and comparison tables
- Comparison mode activates automatically when 2+ brands detected in same response
- Keyboard accessible with Escape to close and tab navigation

## Development Commands

### Installation & Testing
```bash
# Load extension in Chrome
# 1. Go to chrome://extensions
# 2. Toggle Developer mode
# 3. Click "Load unpacked" and select project folder

# Test on supported sites
# Visit claude.ai or perplexity.ai
# Query: "Nike vs Adidas running shoes" or "Canon vs Nikon cameras"
```

### Data Modification
Edit `brands.json` to add new brands or modify existing scores/reviews. Structure:
```json
{
  "brands": {
    "brandkey": {
      "display": "Brand Name",
      "score": 85,
      "reviews": 12000,
      "pros": ["benefit 1", "benefit 2"],
      "cons": ["drawback 1"]
    }
  }
}
```

## Code Conventions

### Selector Patterns
The extension targets multiple AI platforms using resilient selectors:
- Claude: `[data-cy="message-text"]`, `article`
- Perplexity: `.prose`, `.markdown`
- Generic: `[data-testid*="message"]`, `[class*="message"]`

### CSS Classes
- `hx-go-*` prefix for all extension classes to avoid conflicts
- `hx-go-processed` marker prevents double-processing
- Shadow DOM styles use `:host` selector for isolation

### Brand Processing Rules
- Text nodes in `CODE`, `PRE`, `SCRIPT`, `STYLE`, `TEXTAREA`, `INPUT` are ignored
- Already processed nodes (`.hx-go-brand-wrap`) are skipped
- Brand regex is case-insensitive and word-boundary aware

## Git Commit & PR Guidelines

### CRITICAL: NO AI ATTRIBUTION
**NEVER include any mention of Claude Code, Claude, AI, or automated generation in:**
- Commit messages
- Pull request titles
- Pull request descriptions
- Code comments (unless specifically requested)

### Commit Message Format
- Use conventional commit format: `type: description`
- Keep it concise and professional
- Focus on WHAT changed and WHY, not WHO made the change
- Example: `feat: add demo mode for live presentations`
- Example: `fix: resolve panel alignment issue on Meta.ai`

### Pull Request Format
- **Title**: Clear, concise description of the feature/fix
- **Body**: Include:
  - Summary section with bullet points
  - Key features/changes
  - Technical details if relevant
  - Test plan checklist
- **NO attribution footers** - do not add "Generated with Claude Code" or similar
- Keep it professional and focused on the technical changes

## File Structure
```
├── manifest.json       # Extension configuration
├── content.js          # Main content script
├── styles.css          # Badge and panel styles
├── panel.html          # Side panel template
├── brands.json         # Brand data and scores
└── icons/              # Extension icons
```