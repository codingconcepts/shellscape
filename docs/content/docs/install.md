---
title: "Install"
description: "How to install shellscape"
date: 2026-07-20
tags: ["install"]
draft: false
---

## Install

Shellscape is a single Go binary. Install it with:

```sh
go install github.com/codingconcepts/shellscape/cmd/shellscape@latest
```

This requires [Go 1.22+](https://go.dev/dl/). The binary will be placed in your `$GOPATH/bin` directory.

### Verify

```sh
shellscape --help
```

### Available commands

| Command | What it does |
|---------|-------------|
| `shellscape init [name]` | Scaffold a new site |
| `shellscape build` | Build static site to `dist/` |
| `shellscape serve` | Dev server with live reload |
