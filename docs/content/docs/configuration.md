---
title: "Configuration"
description: "Shellscape configuration reference"
date: 2026-07-20
tags: ["configuration"]
draft: false
---

## Configuration

All configuration lives in `config.yaml` at the root of your site.

**Jump to:** [Full example](#full-example) | [Themes](#themes) | [Banner](#banner) | [Code syntax highlighting](#code-syntax-highlighting) | [Custom themes](#custom-themes) | [Deploy](#deploy)

### Full example

```yaml
site:
  title: "My Site"
  description: "A terminal-themed personal site"
  author: "Your Name"
  base_url: "https://yoursite.com"
  language: "en"

theme: "terminal"

nav:
  - label: "Home"
    path: "/"
  - label: "About"
    path: "/about"
  - label: "Blog"
    path: "/blog"

terminal:
  hint: "Type help for available commands, or click around to navigate."
  banner:
    text: "Shellscape"
    font: "banner3"

blog:
  posts_dir: "blog"
  date_format: "2006-02-01"
  show_reading_time: true
  show_tags: true
  code_style_dark: "paraiso-dark"
  code_style_light: "paraiso-light"

build:
  output_dir: "dist"

footer:
  text: "Built with shellscape"
  links:
    - label: "GitHub"
      url: "https://github.com/you/yoursite"
```

### Themes

Set `theme` to one of:

| Theme | Description |
|-------|-------------|
| `terminal` | Dark terminal look (default) |
| `light` | Light theme |
| `system` | Follows OS preference |

### Banner

The ASCII art banner at the top of every page:

```yaml
terminal:
  banner:
    text: "My Site"
    font: "banner3"
    color_type: "gradient-lr"
    colors:
      - "#e06c75"
      - "#d19a66"
      - "#e5c07b"
      - "#98c379"
      - "#56b6c2"
      - "#61afef"
      - "#c678dd"
```

| Option | Values | Default |
|--------|--------|---------|
| `font` | Any [go-figure](https://github.com/common-nighthawk/go-figure) font | `banner3` |
| `color_type` | `letter`, `gradient-lr`, `gradient-tb` | `letter` |
| `colors` | Array of hex colors | Rainbow |

### Code syntax highlighting

Code blocks in Markdown get syntax highlighting automatically. Separate styles for dark and light mode:

```yaml
blog:
  code_style_dark: "dracula"
  code_style_light: "github"
```

Any [Chroma style](https://github.com/alecthomas/chroma/tree/master/styles) works. Some popular options:

| Style | Best for |
|-------|----------|
| `dracula` | dark |
| `monokai` | dark |
| `nord` | dark |
| `github` | light |
| `solarized-dark` | dark |
| `solarized-light` | light |

### Custom themes

Create a CSS file in `themes/` to override the default theme. Themes are pure CSS custom properties:

```css
:root {
  --ss-bg: #1a1b26;
  --ss-text: #a9b1d6;
  --ss-accent: #7aa2f7;
  --ss-green: #9ece6a;
  --ss-prompt-user: #9ece6a;
}
```

See `embed/themes/terminal/theme.css` for all available variables.

### Deploy

The `dist/` directory is fully static. Deploy it anywhere:

- GitHub Pages
- Cloudflare Pages
- Netlify
- S3 + CloudFront
- Any static file server

A GitHub Actions workflow for Cloudflare Pages is included at `.github/workflows/deploy.yml`.
