# shellscape

Websites that look like terminals that look like websites!

A static site generator that produces interactive terminal-themed websites. Visitors can type real commands (`ls`, `cd`, `cat`) to navigate, or just click around. Write your content in YAML + Markdown - no frontend skills required.

## Install

```sh
go install github.com/codingconcepts/shellscape/cmd/shellscape@latest
```

## Quick start

```sh
shellscape init mysite
cd mysite
shellscape serve
```

Open [http://localhost:1313](http://localhost:1313) and start typing.

## Commands

| Command | What it does |
|---------|-------------|
| `shellscape init [name]` | Scaffold a new site |
| `shellscape build` | Build static site to `dist/` |
| `shellscape serve` | Dev server with live reload |

### Build flags

- `--config`, `-c` - path to config file (default: `config.yaml`)
- `--drafts` - include draft posts

### Serve flags

- `--config`, `-c` - path to config file (default: `config.yaml`)
- `--drafts` - include draft posts
- `--port`, `-p` - port number (default: `1313`)

## Site structure

```
mysite/
  config.yaml          # site configuration
  content/
    index.md           # home page
    about.md           # additional pages
    blog/
      my-post.md       # blog posts
  static/              # your images, downloads, etc.
  themes/              # custom theme overrides
  dist/                # build output (gitignored)
```

## Configuration

```yaml
site:
  title: "My Site"
  description: "A terminal-themed personal site"
  author: "Your Name"
  base_url: "https://yoursite.com"
  language: "en"             # default

theme: "terminal"    # "terminal" (dark), "light", or "system" (follows OS preference)

nav:
  - label: "Home"
    path: "/"
  - label: "About"
    path: "/about"
  - label: "Blog"
    path: "/blog"

terminal:
  banner:
    text: "Shellscape"
    font: "banner3"
    # color_type: "letter" # options: letter (default), gradient-lr, gradient-tb
    # colors:             # optional - defaults to rainbow
    #   - "#e06c75"
    #   - "#d19a66"
    #   - "#e5c07b"
    #   - "#98c379"
    #   - "#56b6c2"
    #   - "#61afef"
    #   - "#c678dd"

blog:
  posts_dir: "blog"
  date_format: "2006-02-01"
  show_reading_time: true
  show_tags: true
  code_style_dark: "paraiso-dark"
  code_style_light: "paraiso-light"

build:
  output_dir: "dist"   # default

footer:
  text: "Built with shellscape"
  links:
    - label: "GitHub"
      url: "https://github.com/codingconcepts/shellscape"
```

## Writing content

Pages use Markdown with YAML frontmatter:

```markdown
---
title: "My Post"
date: 2026-07-16
tags: ["go", "tools"]
draft: false
description: "A short summary"
slug: "custom-url-slug"    # optional - defaults to filename
banner:                    # optional per-post ASCII banner
  text: "My Post"
  font: "slant"
  color_type: "gradient-lr"
---

Your content here. Code blocks get syntax highlighting automatically.
```

## Terminal commands

Visitors to your site can use these commands:

| Command | Action |
|---------|--------|
| `help` | List available commands |
| `ls [dir]` | List pages at current or given location |
| `cd <page>` | Navigate to a page |
| `cd ..` | Go up one level |
| `cat <page>` | Display page content inline |
| `open <page>` | Navigate to and display a page |
| `clear` | Clear terminal output |
| `history` | Show command history |
| `theme <name>` | Switch theme (`system`, `light`, `dark`) |

Tab completion, command history (up/down arrows), and Ctrl+L (clear) are supported.

## Custom themes

Create a CSS file in `themes/` to override the default theme. Themes are pure CSS custom properties:

```css
:root {
  --ss-bg: #1a1b26;
  --ss-text: #a9b1d6;
  --ss-accent: #7aa2f7;
  --ss-green: #9ece6a;
  --ss-prompt-user: #9ece6a;
  /* ... see embed/themes/terminal/theme.css for all variables */
}
```

## Code syntax highlighting

Code blocks in Markdown get syntax highlighting automatically. Separate styles for dark and light mode switch with the theme:

```yaml
blog:
  code_style_dark: "dracula"     # used in dark/terminal mode (default)
  code_style_light: "github"     # used in light mode (default)
```

Any [Chroma style](https://github.com/alecthomas/chroma/tree/master/styles) works. Some popular options:

| Style | Description | Best for |
|-------|-------------|----------|
| `dracula` | Dark purple theme | dark |
| `monokai` | Classic dark theme | dark |
| `nord` | Arctic blue palette | dark |
| `solarized-dark` | Solarized dark | dark |
| `vim` | Vim default colors | dark |
| `xcode-dark` | Xcode dark theme | dark |
| `github` | Light GitHub style | light |
| `github-dark` | Dark GitHub style | dark |
| `solarized-light` | Solarized light | light |
| `xcode` | Xcode light theme | light |

## Deploy

The `dist/` directory is fully static - deploy it anywhere:

- GitHub Pages
- Netlify
- Cloudflare Pages
- S3 + CloudFront
- Any static file server

### Cloudflare Pages (GitHub Actions)

The included workflow at `.github/workflows/deploy.yml` automatically builds and deploys to Cloudflare Pages on every push to `main`.

**Setup:**

1. Create a Cloudflare Pages project (in the dashboard under **Workers & Pages > Create > Pages > Direct Upload**)

2. Create a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with **Cloudflare Pages: Edit** permission

3. Add secrets and variables to your GitHub repo under **Settings > Secrets and variables > Actions**:

   | Type | Name | Value |
   |------|------|-------|
   | Secret | `CLOUDFLARE_API_TOKEN` | Your API token |
   | Secret | `CLOUDFLARE_ACCOUNT_ID` | Your account ID (found in the dashboard sidebar) |
   | Variable | `CLOUDFLARE_PROJECT_NAME` | Your Pages project name |

4. Push to `main` — the workflow builds shellscape from source, generates your site, and deploys it

## Available Fonts

168 fonts are available via the [go-figure](https://github.com/common-nighthawk/go-figure) library. Set the font in your config:

```yaml
terminal:
  banner:
    text: "my site"
    font: "slant"
```

For an example of each (using the text "Shellscape"), see [example fonts](./example-fonts.md).

## Todos

* Display directories in tree format:
```
blog/
├── first-post
├── second-post
└── third-post
```