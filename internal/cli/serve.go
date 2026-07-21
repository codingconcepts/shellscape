package cli

import (
	"fmt"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/codingconcepts/shellscape/internal/builder"
	"github.com/codingconcepts/shellscape/internal/config"
	"github.com/codingconcepts/shellscape/internal/server"

	content "github.com/codingconcepts/shellscape/embed"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Build and serve the site with live reload",
	RunE:  runServe,
}

var (
	servePort int
	watch     bool
)

func init() {
	serveCmd.Flags().IntVarP(&servePort, "port", "p", 1313, "port to serve on")
	serveCmd.Flags().StringVarP(&configPath, "config", "c", "config.yaml", "path to config file")
	serveCmd.Flags().BoolVar(&drafts, "drafts", false, "include draft posts")
	serveCmd.Flags().BoolVar(&watch, "watch", false, "watch for file changes and live reload")
}

func runServe(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	siteDir := filepath.Dir(configPath)

	// Reload config on every build so edits to config.yaml are picked up
	// by the watcher-triggered rebuilds, not just the initial one.
	buildFn := func() error {
		cfg, err := config.Load(configPath)
		if err != nil {
			return err
		}
		b, err := builder.New(cfg, siteDir, content.FS, drafts)
		if err != nil {
			return err
		}
		_, err = b.Build()
		return err
	}

	if err := buildFn(); err != nil {
		return fmt.Errorf("initial build: %w", err)
	}

	addr := fmt.Sprintf(":%d", servePort)
	srv := server.New(addr, siteDir, cfg.Build.OutputDir, buildFn, watch)

	fmt.Printf("✔ Serving at http://localhost:%d (press Ctrl+C to stop)\n", servePort)
	return srv.ListenAndServe()
}
