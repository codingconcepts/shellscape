package theme

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func TestResolve(t *testing.T) {
	cases := []struct {
		name      string
		themeName string
		setupUser func(t *testing.T) string
		embedFS   fstest.MapFS
		wantData  string
		wantErr   bool
	}{
		{
			name:      "from user themes dir",
			themeName: "custom",
			setupUser: func(t *testing.T) string {
				dir := t.TempDir()
				themeDir := filepath.Join(dir, "custom")
				if err := os.MkdirAll(themeDir, 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(themeDir, "theme.css"), []byte("user-dir-css"), 0o644); err != nil {
					t.Fatal(err)
				}
				return dir
			},
			embedFS:  fstest.MapFS{},
			wantData: "user-dir-css",
		},
		{
			name:      "from user flat file",
			themeName: "flat",
			setupUser: func(t *testing.T) string {
				dir := t.TempDir()
				if err := os.WriteFile(filepath.Join(dir, "flat.css"), []byte("flat-css"), 0o644); err != nil {
					t.Fatal(err)
				}
				return dir
			},
			embedFS:  fstest.MapFS{},
			wantData: "flat-css",
		},
		{
			name:      "from embedded FS",
			themeName: "embedded",
			setupUser: func(t *testing.T) string {
				return t.TempDir()
			},
			embedFS: fstest.MapFS{
				"themes/embedded/theme.css": &fstest.MapFile{Data: []byte("embed-css")},
			},
			wantData: "embed-css",
		},
		{
			name:      "not found anywhere",
			themeName: "missing",
			setupUser: func(t *testing.T) string {
				return t.TempDir()
			},
			embedFS: fstest.MapFS{},
			wantErr: true,
		},
		{
			name:      "user dir takes precedence over embedded",
			themeName: "both",
			setupUser: func(t *testing.T) string {
				dir := t.TempDir()
				themeDir := filepath.Join(dir, "both")
				if err := os.MkdirAll(themeDir, 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(themeDir, "theme.css"), []byte("user-wins"), 0o644); err != nil {
					t.Fatal(err)
				}
				return dir
			},
			embedFS: fstest.MapFS{
				"themes/both/theme.css": &fstest.MapFile{Data: []byte("embed-loses")},
			},
			wantData: "user-wins",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			userDir := tc.setupUser(t)
			data, err := Resolve(tc.themeName, userDir, tc.embedFS)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if string(data) != tc.wantData {
				t.Errorf("got %q, want %q", string(data), tc.wantData)
			}
		})
	}
}
