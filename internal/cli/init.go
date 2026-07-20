package cli

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	content "github.com/codingconcepts/shellscape/embed"
)

var initCmd = &cobra.Command{
	Use:   "init [name]",
	Short: "Create a new shellscape site",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runInit,
}

func runInit(cmd *cobra.Command, args []string) error {
	dir := "."
	if len(args) > 0 {
		dir = args[0]
	}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}

	scaffold, err := fs.Sub(content.FS, "scaffold")
	if err != nil {
		return fmt.Errorf("reading scaffold: %w", err)
	}

	err = fs.WalkDir(scaffold, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		target := filepath.Join(dir, path)

		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}

		data, err := fs.ReadFile(scaffold, path)
		if err != nil {
			return fmt.Errorf("reading %s: %w", path, err)
		}

		return os.WriteFile(target, data, 0o644)
	})
	if err != nil {
		return fmt.Errorf("scaffolding site: %w", err)
	}

	// Create empty directories for user assets
	for _, d := range []string{"static", "themes"} {
		if err := os.MkdirAll(filepath.Join(dir, d), 0o755); err != nil {
			return err
		}
	}

	fmt.Printf("✔ Site created at %s\n\n", dir)
	fmt.Println("Next steps:")
	if dir != "." {
		fmt.Printf("  cd %s\n", dir)
	}
	fmt.Println("  shellscape serve")
	fmt.Println()

	return nil
}
