---
title: "About"
description: "Why Shellscape exists and what it does"
template: "page"
banner:
  text: "A b o u t"
  font: "univers"
  color_type: "gradient-lr"
---

## About Shellscape

Shellscape is a static site generator for people who'd rather live in a terminal than write CSS. It turns YAML and Markdown into an interactive terminal-themed website: visitors can type real commands (`ls`, `cd`, `cat`) to explore your content, or click around like a normal site - both work.

### Why

Most site generators assume you want to design a website. Shellscape assumes you don't. You bring content; it brings a terminal that already looks good, works in dark and light mode, and needs zero frontend skills to run.

### What you get

- **Interactive terminal** - real command navigation with tab completion and history
- **ASCII art banners** - any [go-figure](https://github.com/common-nighthawk/go-figure) font, with per-letter or gradient colouring
- **Blog support** - posts, tags, reading time, RSS-friendly static output
- **Syntax highlighting** - separate [Chroma](https://github.com/alecthomas/chroma) styles for dark and light mode
- **Themeable** - pure CSS custom properties; override as much or as little as you like
- **Single Go binary** - no Node, no build chain, no dependencies

The output is a plain static `dist/` directory. Deploy it to GitHub Pages, Cloudflare Pages, Netlify, or any file server.

### Source

Shellscape is open source, written in Go, and built by [Rob Reid](https://github.com/codingconcepts). Contributions and issues welcome on [GitHub](https://github.com/codingconcepts/shellscape).

### Try it

- Type `cd docs/install` to get started
- Type `ls docs` to see all documentation
- Look for missing commands 