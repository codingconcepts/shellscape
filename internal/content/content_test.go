package content

import (
	"html/template"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestParseFrontmatter(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		wantFM  Frontmatter
		wantErr bool
	}{
		{
			name:   "no frontmatter",
			input:  "just some content",
			wantFM: Frontmatter{},
		},
		{
			name:   "valid frontmatter",
			input:  "---\ntitle: Hello\ndraft: true\n---\nbody here",
			wantFM: Frontmatter{Title: "Hello", Draft: true},
		},
		{
			name:   "frontmatter with tags",
			input:  "---\ntitle: Post\ntags:\n  - go\n  - testing\n---\ncontent",
			wantFM: Frontmatter{Title: "Post", Tags: []string{"go", "testing"}},
		},
		{
			name:    "unterminated frontmatter",
			input:   "---\ntitle: Broken",
			wantErr: true,
		},
		{
			name:   "empty body",
			input:  "---\ntitle: Empty\n---\n",
			wantFM: Frontmatter{Title: "Empty"},
		},
		{
			name:    "invalid yaml",
			input:   "---\n: : :\n---\nbody",
			wantErr: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fm, body, err := parseFrontmatter([]byte(tc.input))
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if fm.Title != tc.wantFM.Title {
				t.Errorf("title = %q, want %q", fm.Title, tc.wantFM.Title)
			}
			if fm.Draft != tc.wantFM.Draft {
				t.Errorf("draft = %v, want %v", fm.Draft, tc.wantFM.Draft)
			}
			if !reflect.DeepEqual(fm.Tags, tc.wantFM.Tags) {
				t.Errorf("tags = %v, want %v", fm.Tags, tc.wantFM.Tags)
			}
			_ = body
		})
	}
}

func TestParseFrontmatterBody(t *testing.T) {
	input := "---\ntitle: Test\n---\nthe body"
	_, body, err := parseFrontmatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(body) != "the body" {
		t.Errorf("body = %q, want %q", string(body), "the body")
	}
}

func TestEstimateReadingTime(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    int
	}{
		{name: "empty", content: "", want: 1},
		{name: "short", content: "hello world", want: 1},
		{name: "one minute threshold", content: strings.Repeat("word ", 200), want: 1},
		{name: "long content", content: strings.Repeat("abcde ", 1000), want: 6},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := estimateReadingTime(tc.content)
			if got != tc.want {
				t.Errorf("estimateReadingTime() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestSlugFromFilename(t *testing.T) {
	cases := []struct {
		name string
		path string
		want string
	}{
		{name: "simple md", path: "hello.md", want: "hello"},
		{name: "with directory", path: "/blog/my-post.md", want: "my-post"},
		{name: "html extension", path: "page.html", want: "page"},
		{name: "nested path", path: "/a/b/c/deep.md", want: "deep"},
		{name: "no extension", path: "readme", want: "readme"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := slugFromFilename(tc.path)
			if got != tc.want {
				t.Errorf("slugFromFilename(%q) = %q, want %q", tc.path, got, tc.want)
			}
		})
	}
}

func TestCollectTags(t *testing.T) {
	cases := []struct {
		name     string
		posts    []*Page
		wantTags map[string]int
	}{
		{name: "nil posts", posts: nil, wantTags: map[string]int{}},
		{
			name: "single post single tag",
			posts: []*Page{
				{Frontmatter: Frontmatter{Tags: []string{"go"}}},
			},
			wantTags: map[string]int{"go": 1},
		},
		{
			name: "multiple posts shared tags",
			posts: []*Page{
				{Frontmatter: Frontmatter{Tags: []string{"go", "testing"}}},
				{Frontmatter: Frontmatter{Tags: []string{"go"}}},
			},
			wantTags: map[string]int{"go": 2, "testing": 1},
		},
		{
			name: "post with no tags",
			posts: []*Page{
				{Frontmatter: Frontmatter{}},
			},
			wantTags: map[string]int{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CollectTags(tc.posts)
			for tag, wantCount := range tc.wantTags {
				if len(got[tag]) != wantCount {
					t.Errorf("tag %q: got %d posts, want %d", tag, len(got[tag]), wantCount)
				}
			}
			if len(got) != len(tc.wantTags) {
				t.Errorf("got %d tags, want %d", len(got), len(tc.wantTags))
			}
		})
	}
}

func TestPageToMap(t *testing.T) {
	fixedDate := time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name       string
		page       *Page
		dateFormat string
		wantKeys   []string
		checkDate  string
	}{
		{
			name: "basic page",
			page: &Page{
				Frontmatter: Frontmatter{Title: "Test", Description: "desc"},
				URL:         "/test",
				HTMLContent: template.HTML("<p>hi</p>"),
			},
			dateFormat: "Jan 2, 2006",
			wantKeys:   []string{"title", "url", "description", "content", "template", "plainText"},
		},
		{
			name: "page with date",
			page: &Page{
				Frontmatter: Frontmatter{Title: "Dated", Date: fixedDate},
				URL:         "/dated",
			},
			dateFormat: "Jan 2, 2006",
			wantKeys:   []string{"title", "url", "date", "dateRaw"},
			checkDate:  "Jan 15, 2025",
		},
		{
			name: "page with tags",
			page: &Page{
				Frontmatter: Frontmatter{Title: "Tagged", Tags: []string{"go"}},
				URL:         "/tagged",
			},
			dateFormat: "Jan 2, 2006",
			wantKeys:   []string{"title", "url", "tags"},
		},
		{
			name: "page with reading time",
			page: &Page{
				Frontmatter: Frontmatter{Title: "Long"},
				URL:         "/long",
				ReadingTime: 5,
			},
			dateFormat: "Jan 2, 2006",
			wantKeys:   []string{"title", "url", "readingTime"},
		},
		{
			name: "page with banner",
			page: &Page{
				Frontmatter: Frontmatter{Title: "Banner"},
				URL:         "/banner",
				BannerHTML:  template.HTML("<pre>art</pre>"),
			},
			dateFormat: "Jan 2, 2006",
			wantKeys:   []string{"title", "url", "bannerHTML"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := PageToMap(tc.page, tc.dateFormat)
			for _, key := range tc.wantKeys {
				if _, ok := got[key]; !ok {
					t.Errorf("missing key %q", key)
				}
			}
			if tc.checkDate != "" {
				if got["date"] != tc.checkDate {
					t.Errorf("date = %q, want %q", got["date"], tc.checkDate)
				}
			}
		})
	}
}
