package builder

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/codingconcepts/shellscape/internal/banner"
	"github.com/codingconcepts/shellscape/internal/config"
	"github.com/codingconcepts/shellscape/internal/content"
	"github.com/codingconcepts/shellscape/internal/markdown"
	"github.com/codingconcepts/shellscape/internal/theme"
)

type BuildResult struct {
	Pages int
	Posts int
}

type Builder struct {
	cfg      *config.Config
	renderer *markdown.Renderer
	embedFS  fs.FS
	siteDir  string
	outDir   string
	drafts   bool
}

type templateData struct {
	Site         config.SiteConfig
	Nav          []navItem
	Terminal     config.TerminalConfig
	Footer       config.FooterConfig
	Theme        string
	Page         *content.Page
	Posts        []*content.Page
	Tags         map[string][]*content.Page
	CurrentPath  string
	SiteDataJSON template.JS
	BlogConfig   config.BlogConfig
}

type navItem struct {
	Label    string
	Path     string
	IsActive bool
}

func New(cfg *config.Config, siteDir string, embedFS fs.FS, drafts bool) (*Builder, error) {
	return &Builder{
		cfg:      cfg,
		renderer: markdown.NewRenderer(),
		embedFS:  embedFS,
		siteDir:  siteDir,
		outDir:   filepath.Join(siteDir, cfg.Build.OutputDir),
		drafts:   drafts,
	}, nil
}

func (b *Builder) Build() (*BuildResult, error) {
	buildStart := time.Now()

	start := time.Now()
	if err := os.RemoveAll(b.outDir); err != nil {
		return nil, fmt.Errorf("cleaning output: %w", err)
	}
	if err := os.MkdirAll(b.outDir, 0o755); err != nil {
		return nil, fmt.Errorf("creating output dir: %w", err)
	}
	slog.Info("clean", "duration", time.Since(start))

	start = time.Now()
	tmpls, err := b.loadTemplates()
	if err != nil {
		return nil, fmt.Errorf("loading templates: %w", err)
	}
	slog.Info("templates", "duration", time.Since(start))

	// Group A: static assets + theme in parallel
	start = time.Now()
	var ga errgroup.Group
	ga.Go(func() error {
		if err := b.copyStaticAssets(); err != nil {
			return fmt.Errorf("copying static assets: %w", err)
		}
		return nil
	})
	ga.Go(func() error {
		if err := b.writeTheme(); err != nil {
			return fmt.Errorf("writing theme: %w", err)
		}
		return nil
	})
	if err := ga.Wait(); err != nil {
		return nil, err
	}
	slog.Info("assets+theme", "duration", time.Since(start))

	// Group B: load pages + posts in parallel
	start = time.Now()
	contentDir := filepath.Join(b.siteDir, "content")
	blogDir := filepath.Join(contentDir, b.cfg.Blog.PostsDir)

	var pages, posts []*content.Page
	var gb errgroup.Group
	gb.Go(func() error {
		var err error
		pages, err = content.LoadPages(contentDir, b.renderer, b.cfg.Blog.PostsDir)
		if err != nil {
			return fmt.Errorf("loading pages: %w", err)
		}
		return nil
	})
	gb.Go(func() error {
		var err error
		posts, err = content.LoadBlogPosts(blogDir, b.renderer, b.drafts, b.cfg.Blog.PostsDir)
		if err != nil {
			return fmt.Errorf("loading posts: %w", err)
		}
		return nil
	})
	if err := gb.Wait(); err != nil {
		return nil, err
	}
	slog.Info("content", "pages", len(pages), "posts", len(posts), "duration", time.Since(start))

	for _, p := range append(pages, posts...) {
		if b := p.Frontmatter.Banner; b != nil && b.Text != "" {
			p.BannerHTML = template.HTML(banner.Render(b.Text, b.Font, b.Colors, b.ColorType))
		}
	}

	tags := content.CollectTags(posts)

	start = time.Now()
	siteDataJSON, err := b.buildSiteDataJSON(pages, posts, tags)
	if err != nil {
		return nil, fmt.Errorf("building site data: %w", err)
	}

	if err := b.writeFindIndex(pages, posts); err != nil {
		return nil, fmt.Errorf("writing find index: %w", err)
	}
	slog.Info("site data", "duration", time.Since(start))

	// Group C: render all pages, posts, tags in parallel
	start = time.Now()
	var gc errgroup.Group
	for _, page := range pages {
		gc.Go(func() error {
			if err := b.renderPage(tmpls, page, posts, tags, siteDataJSON); err != nil {
				return fmt.Errorf("rendering %s: %w", page.URL, err)
			}
			slog.Info("rendered", "page", page.URL)
			return nil
		})
	}
	gc.Go(func() error {
		if err := b.renderBlogList(tmpls, posts, tags, siteDataJSON); err != nil {
			return fmt.Errorf("rendering blog list: %w", err)
		}
		slog.Info("rendered", "page", "/"+b.cfg.Blog.PostsDir)
		return nil
	})
	for _, post := range posts {
		gc.Go(func() error {
			if err := b.renderPage(tmpls, post, posts, tags, siteDataJSON); err != nil {
				return fmt.Errorf("rendering post %s: %w", post.URL, err)
			}
			slog.Info("rendered", "post", post.URL)
			return nil
		})
	}
	for tag, tagPosts := range tags {
		gc.Go(func() error {
			if err := b.renderTagPage(tmpls, tag, tagPosts, posts, tags, siteDataJSON); err != nil {
				return fmt.Errorf("rendering tag %s: %w", tag, err)
			}
			slog.Info("rendered", "tag", tag)
			return nil
		})
	}
	if err := gc.Wait(); err != nil {
		return nil, err
	}
	slog.Info("render", "duration", time.Since(start))

	slog.Info("build complete", "duration", time.Since(buildStart))

	return &BuildResult{
		Pages: len(pages),
		Posts: len(posts),
	}, nil
}

func (b *Builder) loadTemplates() (map[string]*template.Template, error) {
	funcMap := template.FuncMap{
		"join": strings.Join,
	}

	baseContent, err := fs.ReadFile(b.embedFS, "templates/base.html")
	if err != nil {
		return nil, fmt.Errorf("reading base template: %w", err)
	}

	pageTemplates := map[string]string{
		"home":      "templates/home.html",
		"page":      "templates/page.html",
		"post":      "templates/post.html",
		"blog-list": "templates/blog/blog-list.html",
		"blog-tag":  "templates/blog/blog-tag.html",
	}

	result := make(map[string]*template.Template)

	for name, path := range pageTemplates {
		pageContent, err := fs.ReadFile(b.embedFS, path)
		if err != nil {
			return nil, fmt.Errorf("reading template %s: %w", path, err)
		}

		tmpl, err := template.New("base.html").Funcs(funcMap).Parse(string(baseContent))
		if err != nil {
			return nil, fmt.Errorf("parsing base for %s: %w", name, err)
		}

		_, err = tmpl.Parse(string(pageContent))
		if err != nil {
			return nil, fmt.Errorf("parsing page template %s: %w", name, err)
		}

		result[name] = tmpl
	}

	return result, nil
}

func (b *Builder) copyStaticAssets() error {
	staticFS, err := fs.Sub(b.embedFS, "static")
	if err != nil {
		return err
	}

	err = fs.WalkDir(staticFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			if d != nil && d.IsDir() {
				return os.MkdirAll(filepath.Join(b.outDir, path), 0o755)
			}
			return err
		}

		data, err := fs.ReadFile(staticFS, path)
		if err != nil {
			return err
		}

		outPath := filepath.Join(b.outDir, path)
		if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
			return err
		}
		return os.WriteFile(outPath, data, 0o644)
	})
	if err != nil {
		return err
	}

	userStatic := filepath.Join(b.siteDir, "static")
	if _, err := os.Stat(userStatic); err == nil {
		return filepath.WalkDir(userStatic, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			rel, _ := filepath.Rel(userStatic, path)
			outPath := filepath.Join(b.outDir, "static", rel)
			if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
				return err
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			return os.WriteFile(outPath, data, 0o644)
		})
	}
	return nil
}

func (b *Builder) writeTheme() error {
	userThemesDir := filepath.Join(b.siteDir, "themes")
	themeCSS, err := theme.Resolve(b.cfg.Theme, userThemesDir, b.embedFS)
	if err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(b.outDir, "theme.css"), themeCSS, 0o644); err != nil {
		return err
	}

	// Write all embedded themes so the JS `theme` command can switch at runtime
	for _, name := range []string{"terminal", "light"} {
		data, err := fs.ReadFile(b.embedFS, "themes/"+name+"/theme.css")
		if err != nil {
			continue
		}
		_ = os.WriteFile(filepath.Join(b.outDir, name+"-theme.css"), data, 0o644)
	}

	codeCSS, err := markdown.CodeThemeCSS(b.cfg.Blog.CodeStyleDark, b.cfg.Blog.CodeStyleLight)
	if err != nil {
		return fmt.Errorf("generating code theme CSS: %w", err)
	}
	if err := os.WriteFile(filepath.Join(b.outDir, "code-theme.css"), codeCSS, 0o644); err != nil {
		return err
	}

	return nil
}

func (b *Builder) writeFindIndex(pages, posts []*content.Page) error {
	type findEntry struct {
		Title   string `json:"title"`
		URL     string `json:"url"`
		Content string `json:"content"`
	}

	index := make(map[string]findEntry)
	for _, p := range append(pages, posts...) {
		if p.URL == "/" {
			continue
		}

		var buf strings.Builder
		for line := range strings.SplitSeq(p.RawContent, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			line = strings.TrimLeft(line, "#")
			line = strings.TrimSpace(line)
			if line != "" {
				buf.WriteString(line)
				buf.WriteString(" ")
			}
		}

		index[p.URL] = findEntry{
			Title:   p.Frontmatter.Title,
			URL:     p.URL,
			Content: strings.ToLower(strings.TrimSpace(buf.String())),
		}
	}

	data, err := json.Marshal(index)
	if err != nil {
		return fmt.Errorf("marshalling find index: %w", err)
	}

	return os.WriteFile(filepath.Join(b.outDir, "find.json"), data, 0o644)
}

func (b *Builder) buildSiteDataJSON(pages []*content.Page, posts []*content.Page, tags map[string][]*content.Page) (template.JS, error) {
	siteData := map[string]any{
		"site": map[string]any{
			"title":       b.cfg.Site.Title,
			"author":      b.cfg.Site.Author,
			"description": b.cfg.Site.Description,
		},
		"terminal": map[string]any{
			"prompt":     b.cfg.Terminal.Prompt,
			"whoami":     b.cfg.Terminal.WhoAmI,
			"hint":       b.cfg.Terminal.Hint,
			"asciiArt":   b.cfg.Terminal.ASCIIArt,
			"bannerHTML": banner.Render(b.cfg.Terminal.Banner.Text, b.cfg.Terminal.Banner.Font, b.cfg.Terminal.Banner.Colors, b.cfg.Terminal.Banner.ColorType),
		},
		"nav":      b.cfg.Nav,
		"postsDir": b.cfg.Blog.PostsDir,
		"pages":    map[string]any{},
		"blog": map[string]any{
			"posts": []any{},
			"tags":  map[string]any{},
		},
	}

	pageMap := siteData["pages"].(map[string]any)
	for _, p := range pages {
		pageMap[p.URL] = content.PageToMap(p, b.cfg.Blog.DateFormat)
	}

	blogData := siteData["blog"].(map[string]any)
	var postList []any
	for _, p := range posts {
		pm := content.PageToMap(p, b.cfg.Blog.DateFormat)
		postList = append(postList, pm)
		pageMap[p.URL] = pm
	}
	blogData["posts"] = postList

	tagMap := make(map[string][]string)
	for tag, tagPosts := range tags {
		var urls []string
		for _, p := range tagPosts {
			urls = append(urls, p.URL)
		}
		tagMap[tag] = urls
	}
	blogData["tags"] = tagMap

	data, err := json.Marshal(siteData)
	if err != nil {
		return "", fmt.Errorf("marshaling site data: %w", err)
	}

	return template.JS(data), nil
}

func (b *Builder) makeTemplateData(page *content.Page, posts []*content.Page, tags map[string][]*content.Page, siteDataJSON template.JS) templateData {
	var navItems []navItem
	for _, n := range b.cfg.Nav {
		navItems = append(navItems, navItem{
			Label:    n.Label,
			Path:     n.Path,
			IsActive: page != nil && page.URL == n.Path,
		})
	}

	return templateData{
		Site:         b.cfg.Site,
		Nav:          navItems,
		Terminal:     b.cfg.Terminal,
		Footer:       b.cfg.Footer,
		Theme:        b.cfg.Theme,
		Page:         page,
		Posts:        posts,
		Tags:         tags,
		CurrentPath:  page.URL,
		SiteDataJSON: siteDataJSON,
		BlogConfig:   b.cfg.Blog,
	}
}

func (b *Builder) renderPage(tmpls map[string]*template.Template, page *content.Page, posts []*content.Page, tags map[string][]*content.Page, siteDataJSON template.JS) error {
	data := b.makeTemplateData(page, posts, tags, siteDataJSON)

	var outPath string
	if page.URL == "/" {
		outPath = filepath.Join(b.outDir, "index.html")
	} else {
		outPath = filepath.Join(b.outDir, page.URL, "index.html")
	}

	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return err
	}

	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	tmpl, ok := tmpls[page.Frontmatter.Template]
	if !ok {
		return fmt.Errorf("unknown template %q", page.Frontmatter.Template)
	}
	return tmpl.ExecuteTemplate(f, "base.html", data)
}

func (b *Builder) renderBlogList(tmpls map[string]*template.Template, posts []*content.Page, tags map[string][]*content.Page, siteDataJSON template.JS) error {
	listPage := &content.Page{
		URL: "/" + b.cfg.Blog.PostsDir,
		Frontmatter: content.Frontmatter{
			Title:       strings.ToTitle(b.cfg.Blog.PostsDir[:1]) + b.cfg.Blog.PostsDir[1:],
			Description: "All posts",
			Template:    "blog-list",
		},
	}

	data := b.makeTemplateData(listPage, posts, tags, siteDataJSON)

	outPath := filepath.Join(b.outDir, b.cfg.Blog.PostsDir, "index.html")
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return err
	}

	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	return tmpls["blog-list"].ExecuteTemplate(f, "base.html", data)
}

func (b *Builder) renderTagPage(tmpls map[string]*template.Template, tag string, tagPosts []*content.Page, allPosts []*content.Page, tags map[string][]*content.Page, siteDataJSON template.JS) error {
	tagPage := &content.Page{
		URL: "/" + b.cfg.Blog.PostsDir + "/tags/" + tag,
		Frontmatter: content.Frontmatter{
			Title:       "Tag: " + tag,
			Description: fmt.Sprintf("Posts tagged %q", tag),
			Template:    "blog-tag",
		},
	}

	data := b.makeTemplateData(tagPage, tagPosts, tags, siteDataJSON)

	outPath := filepath.Join(b.outDir, b.cfg.Blog.PostsDir, "tags", tag, "index.html")
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return err
	}

	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	return tmpls["blog-tag"].ExecuteTemplate(f, "base.html", data)
}
