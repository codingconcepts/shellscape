package config

import (
	"testing"
)

func TestApplyDefaults(t *testing.T) {
	cases := []struct {
		name  string
		cfg   Config
		check func(t *testing.T, c *Config)
	}{
		{
			name: "all empty gets defaults",
			cfg:  Config{},
			check: func(t *testing.T, c *Config) {
				if c.Theme != "terminal" {
					t.Errorf("Theme = %q, want %q", c.Theme, "terminal")
				}
				if c.Site.Language != "en" {
					t.Errorf("Language = %q, want %q", c.Site.Language, "en")
				}
				if c.Blog.PostsDir != "blog" {
					t.Errorf("PostsDir = %q, want %q", c.Blog.PostsDir, "blog")
				}
				if c.Blog.DateFormat != "Jan 2, 2006" {
					t.Errorf("DateFormat = %q, want %q", c.Blog.DateFormat, "Jan 2, 2006")
				}
				if c.Blog.CodeStyleDark != "dracula" {
					t.Errorf("CodeStyleDark = %q, want %q", c.Blog.CodeStyleDark, "dracula")
				}
				if c.Blog.CodeStyleLight != "github" {
					t.Errorf("CodeStyleLight = %q, want %q", c.Blog.CodeStyleLight, "github")
				}
				if c.Build.OutputDir != "dist" {
					t.Errorf("OutputDir = %q, want %q", c.Build.OutputDir, "dist")
				}
			},
		},
		{
			name: "existing values preserved",
			cfg: Config{
				Theme: "custom",
				Site:  SiteConfig{Language: "fr"},
				Blog: BlogConfig{
					PostsDir:       "articles",
					DateFormat:     "2006-01-02",
					CodeStyleDark:  "monokai",
					CodeStyleLight: "solarized-light",
				},
				Build: BuildConfig{OutputDir: "public"},
			},
			check: func(t *testing.T, c *Config) {
				if c.Theme != "custom" {
					t.Errorf("Theme = %q, want %q", c.Theme, "custom")
				}
				if c.Site.Language != "fr" {
					t.Errorf("Language = %q, want %q", c.Site.Language, "fr")
				}
				if c.Blog.PostsDir != "articles" {
					t.Errorf("PostsDir = %q, want %q", c.Blog.PostsDir, "articles")
				}
				if c.Blog.DateFormat != "2006-01-02" {
					t.Errorf("DateFormat = %q, want %q", c.Blog.DateFormat, "2006-01-02")
				}
				if c.Build.OutputDir != "public" {
					t.Errorf("OutputDir = %q, want %q", c.Build.OutputDir, "public")
				}
			},
		},
		{
			name: "partial values filled",
			cfg:  Config{Theme: "dark"},
			check: func(t *testing.T, c *Config) {
				if c.Theme != "dark" {
					t.Errorf("Theme = %q, want %q", c.Theme, "dark")
				}
				if c.Site.Language != "en" {
					t.Errorf("Language should default to en, got %q", c.Site.Language)
				}
				if c.Build.OutputDir != "dist" {
					t.Errorf("OutputDir should default to dist, got %q", c.Build.OutputDir)
				}
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.cfg.applyDefaults()
			tc.check(t, &tc.cfg)
		})
	}
}

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name:    "missing title",
			cfg:     Config{},
			wantErr: true,
		},
		{
			name:    "valid config",
			cfg:     Config{Site: SiteConfig{Title: "My Site"}},
			wantErr: false,
		},
		{
			name:    "title with only whitespace counts as present",
			cfg:     Config{Site: SiteConfig{Title: "  "}},
			wantErr: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.cfg.validate()
			if tc.wantErr && err == nil {
				t.Fatal("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
