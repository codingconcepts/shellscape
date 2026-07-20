package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Site     SiteConfig     `yaml:"site"`
	Theme    string         `yaml:"theme"`
	Nav      []NavItem      `yaml:"nav"`
	Terminal TerminalConfig `yaml:"terminal"`
	Blog     BlogConfig     `yaml:"blog"`
	Footer   FooterConfig   `yaml:"footer"`
	Build    BuildConfig    `yaml:"build"`
}

type SiteConfig struct {
	Title       string `yaml:"title"`
	Description string `yaml:"description"`
	Author      string `yaml:"author"`
	BaseURL     string `yaml:"base_url"`
	Language    string `yaml:"language"`
}

type NavItem struct {
	Label string `yaml:"label"`
	Path  string `yaml:"path"`
}

type TerminalConfig struct {
	Prompt   string       `yaml:"prompt"`
	WhoAmI   string       `yaml:"whoami"`
	ASCIIArt string       `yaml:"ascii_art"`
	Banner   BannerConfig `yaml:"banner"`
}

type BannerConfig struct {
	Text      string   `yaml:"text"`
	Font      string   `yaml:"font"`
	Colors    []string `yaml:"colors"`
	ColorType string   `yaml:"color_type"`
}

type BlogConfig struct {
	PostsDir       string `yaml:"posts_dir"`
	DateFormat     string `yaml:"date_format"`
	ShowReadingTime bool  `yaml:"show_reading_time"`
	ShowTags       bool   `yaml:"show_tags"`
	CodeStyleDark  string `yaml:"code_style_dark"`
	CodeStyleLight string `yaml:"code_style_light"`
}

type FooterConfig struct {
	Text  string       `yaml:"text"`
	Links []FooterLink `yaml:"links"`
}

type FooterLink struct {
	Label string `yaml:"label"`
	URL   string `yaml:"url"`
}

type BuildConfig struct {
	OutputDir string `yaml:"output_dir"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	cfg.applyDefaults()

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (c *Config) applyDefaults() {
	if c.Theme == "" {
		c.Theme = "terminal"
	}
	if c.Site.Language == "" {
		c.Site.Language = "en"
	}
	if c.Blog.PostsDir == "" {
		c.Blog.PostsDir = "blog"
	}
	if c.Blog.DateFormat == "" {
		c.Blog.DateFormat = "Jan 2, 2006"
	}
	if c.Blog.CodeStyleDark == "" {
		c.Blog.CodeStyleDark = "dracula"
	}
	if c.Blog.CodeStyleLight == "" {
		c.Blog.CodeStyleLight = "github"
	}
	if c.Build.OutputDir == "" {
		c.Build.OutputDir = "dist"
	}
}

func (c *Config) validate() error {
	if c.Site.Title == "" {
		return fmt.Errorf("site.title is required")
	}
	return nil
}
