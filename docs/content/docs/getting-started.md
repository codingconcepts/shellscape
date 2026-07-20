---
title: "Getting Started"
description: "Create your first shellscape site"
date: 2026-07-20
tags: ["getting-started"]
draft: false
---

## Getting started

### Create a site

```sh
shellscape init mysite
cd mysite
```

This scaffolds a new site with the following structure:

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

### Run the dev server

```sh
shellscape serve
```

Open [http://localhost:1313](http://localhost:1313) and start typing.

### Serve flags

| Flag | Default | Description |
|------|---------|-------------|
| `--config`, `-c` | `config.yaml` | Path to config file |
| `--drafts` | `false` | Include draft posts |
| `--port`, `-p` | `1313` | Port number |

### Writing content

Pages use Markdown with YAML frontmatter:

```markdown
---
title: "My Post"
date: 2026-07-16
tags: ["go", "tools"]
draft: false
description: "A short summary"
slug: "custom-url-slug"
banner:
  text: "My Post"
  font: "slant"
  color_type: "gradient-lr"
---

Your content here. Code blocks get syntax highlighting.
```

### Build for production

```sh
shellscape build
```

| Flag | Default | Description |
|------|---------|-------------|
| `--config`, `-c` | `config.yaml` | Path to config file |
| `--drafts` | `false` | Include draft posts |

Output goes to `dist/`. Deploy that directory anywhere — GitHub Pages, Cloudflare Pages, Netlify, S3, or any static file server.

### Terminal commands

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
