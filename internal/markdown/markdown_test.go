package markdown

import (
	"strings"
	"testing"
)

func TestScopeCSS(t *testing.T) {
	cases := []struct {
		name  string
		css   string
		scope string
		check func(t *testing.T, result string)
	}{
		{
			name:  "scopes selector",
			css:   ".chroma { color: red; }",
			scope: "[data-theme]",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "[data-theme] .chroma") {
					t.Errorf("expected scoped selector, got %q", result)
				}
			},
		},
		{
			name:  "preserves comment-only lines",
			css:   "/* comment */",
			scope: "[data-theme]",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "/* comment */") {
					t.Errorf("comment should be preserved, got %q", result)
				}
			},
		},
		{
			name:  "preserves closing brace",
			css:   "}",
			scope: "[data-theme]",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "}") {
					t.Errorf("closing brace should be preserved")
				}
			},
		},
		{
			name:  "empty input",
			css:   "",
			scope: "[data-theme]",
			check: func(t *testing.T, result string) {
				trimmed := strings.TrimSpace(result)
				if trimmed != "" {
					t.Errorf("expected empty output, got %q", result)
				}
			},
		},
		{
			name:  "chroma comment+selector line",
			css:   "/* Keyword */ .chroma .k { color: blue; }",
			scope: "[data-theme]",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "/* Keyword */ [data-theme] .chroma .k") {
					t.Errorf("expected comment preserved and selector scoped, got %q", result)
				}
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := scopeCSS(tc.css, tc.scope)
			tc.check(t, result)
		})
	}
}

func TestStripBgColors(t *testing.T) {
	cases := []struct {
		name  string
		input string
		check func(t *testing.T, result string)
	}{
		{
			name:  "removes background",
			input: ".chroma { background: #fff; color: red; }",
			check: func(t *testing.T, result string) {
				if strings.Contains(result, "background") {
					t.Errorf("background should be stripped, got %q", result)
				}
				if !strings.Contains(result, "color: red") {
					t.Errorf("non-background rules should be preserved, got %q", result)
				}
			},
		},
		{
			name:  "removes background-color",
			input: ".chroma { background-color: #272822; }",
			check: func(t *testing.T, result string) {
				if strings.Contains(result, "background-color") {
					t.Errorf("background-color should be stripped, got %q", result)
				}
			},
		},
		{
			name:  "no background unchanged",
			input: ".chroma { color: red; }",
			check: func(t *testing.T, result string) {
				if result != ".chroma { color: red; }" {
					t.Errorf("should be unchanged, got %q", result)
				}
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := stripBgColors(tc.input)
			tc.check(t, result)
		})
	}
}

func TestResolveStyle(t *testing.T) {
	cases := []struct {
		name    string
		style   string
		wantErr bool
	}{
		{name: "valid dracula", style: "dracula", wantErr: false},
		{name: "valid monokai", style: "monokai", wantErr: false},
		{name: "fallback style returns non-nil", style: "nonexistent-style-xyz", wantErr: false},
		{name: "empty name returns fallback", style: "", wantErr: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s, err := resolveStyle(tc.style)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if s == nil {
				t.Fatal("expected non-nil style")
			}
		})
	}
}

func TestCodeThemeCSS(t *testing.T) {
	cases := []struct {
		name       string
		darkStyle  string
		lightStyle string
		wantErr    bool
		check      func(t *testing.T, css []byte)
	}{
		{
			name:       "valid styles",
			darkStyle:  "dracula",
			lightStyle: "github",
			wantErr:    false,
			check: func(t *testing.T, css []byte) {
				s := string(css)
				if !strings.Contains(s, "/* Code highlighting: dark */") {
					t.Error("missing dark section header")
				}
				if !strings.Contains(s, "/* Code highlighting: light */") {
					t.Error("missing light section header")
				}
				if !strings.Contains(s, `[data-code-theme="light"]`) {
					t.Error("light theme should be scoped")
				}
			},
		},
		{
			name:       "same style for both",
			darkStyle:  "monokai",
			lightStyle: "monokai",
			wantErr:    false,
			check: func(t *testing.T, css []byte) {
				s := string(css)
				if !strings.Contains(s, "/* Code highlighting: dark */") {
					t.Error("missing dark section header")
				}
			},
		},
		{
			name:       "unknown dark style falls back",
			darkStyle:  "github-dark",
			lightStyle: "github",
			wantErr:    false,
			check: func(t *testing.T, css []byte) {
				if len(css) == 0 {
					t.Error("expected non-empty CSS from fallback")
				}
			},
		},
		{
			name:       "unknown light style falls back",
			darkStyle:  "dracula",
			lightStyle: "not-a-style",
			wantErr:    false,
			check: func(t *testing.T, css []byte) {
				if len(css) == 0 {
					t.Error("expected non-empty CSS from fallback")
				}
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			css, err := CodeThemeCSS(tc.darkStyle, tc.lightStyle)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			tc.check(t, css)
		})
	}
}

func TestRender(t *testing.T) {
	r := NewRenderer()
	cases := []struct {
		name    string
		input   string
		wantSub string
	}{
		{name: "heading", input: "# Hello", wantSub: "<h1 id=\"hello\">Hello</h1>"},
		{name: "paragraph", input: "some text", wantSub: "<p>some text</p>"},
		{name: "bold", input: "**bold**", wantSub: "<strong>bold</strong>"},
		{name: "code block", input: "```go\nfmt.Println()\n```", wantSub: "chroma"},
		{name: "link", input: "[click](http://example.com)", wantSub: `href="http://example.com"`},
		{name: "gfm table", input: "| a | b |\n|---|---|\n| 1 | 2 |", wantSub: "<table>"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := r.Render([]byte(tc.input))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !strings.Contains(string(out), tc.wantSub) {
				t.Errorf("output %q does not contain %q", string(out), tc.wantSub)
			}
		})
	}
}
