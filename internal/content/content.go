package content

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"gopkg.in/yaml.v3"

	"github.com/codingconcepts/shellscape/internal/markdown"
)

type BannerFrontmatter struct {
	Text      string   `yaml:"text"`
	Font      string   `yaml:"font"`
	Colors    []string `yaml:"colors"`
	ColorType string   `yaml:"color_type"`
}

type Frontmatter struct {
	Title       string             `yaml:"title"`
	Date        time.Time          `yaml:"date"`
	Tags        []string           `yaml:"tags"`
	Draft       bool               `yaml:"draft"`
	Description string             `yaml:"description"`
	Slug        string             `yaml:"slug"`
	Template    string             `yaml:"template"`
	Banner      *BannerFrontmatter `yaml:"banner"`
}

type Page struct {
	Frontmatter Frontmatter
	RawContent  string
	HTMLContent template.HTML
	BannerHTML  template.HTML
	FilePath    string
	URL         string
	ReadingTime int
}

func LoadPage(filePath string, renderer *markdown.Renderer) (*Page, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", filePath, err)
	}

	fm, body, err := parseFrontmatter(data)
	if err != nil {
		return nil, fmt.Errorf("parsing frontmatter in %s: %w", filePath, err)
	}

	html, err := renderer.Render(body)
	if err != nil {
		return nil, fmt.Errorf("rendering markdown in %s: %w", filePath, err)
	}

	if fm.Slug == "" {
		fm.Slug = slugFromFilename(filePath)
	}

	return &Page{
		Frontmatter: fm,
		RawContent:  string(body),
		HTMLContent: template.HTML(html),
		FilePath:    filePath,
		ReadingTime: estimateReadingTime(string(body)),
	}, nil
}

func LoadPages(contentDir string, renderer *markdown.Renderer, blogDir string) ([]*Page, error) {
	var pages []*Page

	entries, err := os.ReadDir(contentDir)
	if err != nil {
		return nil, fmt.Errorf("reading content dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		page, err := LoadPage(filepath.Join(contentDir, entry.Name()), renderer)
		if err != nil {
			return nil, err
		}

		name := strings.TrimSuffix(entry.Name(), ".md")
		if name == "index" {
			page.URL = "/"
			if page.Frontmatter.Template == "" {
				page.Frontmatter.Template = "home"
			}
		} else {
			page.URL = "/" + name
			if page.Frontmatter.Template == "" {
				page.Frontmatter.Template = "page"
			}
		}

		pages = append(pages, page)
	}

	return pages, nil
}

func LoadBlogPosts(blogDir string, renderer *markdown.Renderer, includeDrafts bool) ([]*Page, error) {
	if _, err := os.Stat(blogDir); os.IsNotExist(err) {
		return nil, nil
	}

	entries, err := os.ReadDir(blogDir)
	if err != nil {
		return nil, fmt.Errorf("reading blog dir: %w", err)
	}

	var posts []*Page

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		page, err := LoadPage(filepath.Join(blogDir, entry.Name()), renderer)
		if err != nil {
			return nil, err
		}

		if page.Frontmatter.Draft && !includeDrafts {
			continue
		}

		page.URL = "/blog/" + page.Frontmatter.Slug
		page.Frontmatter.Template = "post"

		posts = append(posts, page)
	}

	sort.Slice(posts, func(i, j int) bool {
		return posts[i].Frontmatter.Date.After(posts[j].Frontmatter.Date)
	})

	return posts, nil
}

func parseFrontmatter(data []byte) (Frontmatter, []byte, error) {
	const delimiter = "---"

	content := string(data)
	content = strings.TrimSpace(content)

	if !strings.HasPrefix(content, delimiter) {
		return Frontmatter{}, data, nil
	}

	rest := content[len(delimiter):]
	before, after, ok := strings.Cut(rest, "\n"+delimiter)
	if !ok {
		return Frontmatter{}, data, fmt.Errorf("unterminated frontmatter")
	}

	fmData := before
	body := after
	body = strings.TrimLeft(body, "\n")

	var fm Frontmatter
	if err := yaml.Unmarshal([]byte(fmData), &fm); err != nil {
		return Frontmatter{}, nil, fmt.Errorf("parsing yaml frontmatter: %w", err)
	}

	return fm, []byte(body), nil
}

func estimateReadingTime(content string) int {
	words := utf8.RuneCountInString(content) / 5
	minutes := words / 200
	if minutes < 1 {
		return 1
	}
	return minutes
}

func slugFromFilename(path string) string {
	name := filepath.Base(path)
	name = strings.TrimSuffix(name, filepath.Ext(name))
	return name
}

func CollectTags(posts []*Page) map[string][]*Page {
	tags := make(map[string][]*Page)
	for _, post := range posts {
		for _, tag := range post.Frontmatter.Tags {
			tags[tag] = append(tags[tag], post)
		}
	}
	return tags
}

func PageToMap(p *Page, dateFormat string) map[string]any {
	m := map[string]any{
		"title":       p.Frontmatter.Title,
		"url":         p.URL,
		"description": p.Frontmatter.Description,
		"content":     string(p.HTMLContent),
		"template":    p.Frontmatter.Template,
	}
	if !p.Frontmatter.Date.IsZero() {
		m["date"] = p.Frontmatter.Date.Format(dateFormat)
		m["dateRaw"] = p.Frontmatter.Date.Format(time.RFC3339)
	}
	if len(p.Frontmatter.Tags) > 0 {
		m["tags"] = p.Frontmatter.Tags
	}
	if p.ReadingTime > 0 {
		m["readingTime"] = p.ReadingTime
	}
	if p.BannerHTML != "" {
		m["bannerHTML"] = string(p.BannerHTML)
	}

	var buf bytes.Buffer
	mdLines := strings.SplitSeq(p.RawContent, "\n")
	for line := range mdLines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		line = strings.TrimLeft(line, "#")
		line = strings.TrimSpace(line)
		if line != "" {
			buf.WriteString(line)
			buf.WriteString("\n")
		}
	}
	m["plainText"] = buf.String()

	return m
}
