package cli

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	"github.com/codingconcepts/shellscape/internal/builder"
	"github.com/codingconcepts/shellscape/internal/config"

	content "github.com/codingconcepts/shellscape/embed"
)

var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "Build the static site",
	RunE:  runBuild,
}

var (
	configPath string
	drafts     bool
)

func init() {
	buildCmd.Flags().StringVarP(&configPath, "config", "c", "config.yaml", "path to config file")
	buildCmd.Flags().BoolVar(&drafts, "drafts", false, "include draft posts")
}

func runBuild(cmd *cobra.Command, args []string) error {
	start := time.Now()

	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	siteDir := filepath.Dir(configPath)
	b, err := builder.New(cfg, siteDir, content.FS, drafts)
	if err != nil {
		return fmt.Errorf("initializing builder: %w", err)
	}

	result, err := b.Build()
	if err != nil {
		return fmt.Errorf("building site: %w", err)
	}

	fmt.Printf("✔ Built %d pages and %d posts in %s → %s\n",
		result.Pages, result.Posts, time.Since(start).Round(time.Millisecond), cfg.Build.OutputDir)

	return nil
}
