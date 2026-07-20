package theme

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

func Resolve(themeName string, userThemesDir string, embedFS fs.FS) ([]byte, error) {
	userDirPath := filepath.Join(userThemesDir, themeName, "theme.css")
	if data, err := os.ReadFile(userDirPath); err == nil {
		return data, nil
	}

	userFlatPath := filepath.Join(userThemesDir, themeName+".css")
	if data, err := os.ReadFile(userFlatPath); err == nil {
		return data, nil
	}

	embeddedPath := "themes/" + themeName + "/theme.css"
	if data, err := fs.ReadFile(embedFS, embeddedPath); err == nil {
		return data, nil
	}

	return nil, fmt.Errorf("theme %q not found (checked %s, %s, and embedded themes)", themeName, userDirPath, userFlatPath)
}
