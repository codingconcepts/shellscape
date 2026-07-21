package banner

import (
	"strings"
	"testing"
)

func TestParseHex(t *testing.T) {
	cases := []struct {
		name string
		hex  string
		want [3]uint8
	}{
		{name: "with hash", hex: "#ff0000", want: [3]uint8{255, 0, 0}},
		{name: "without hash", hex: "00ff00", want: [3]uint8{0, 255, 0}},
		{name: "blue", hex: "#0000ff", want: [3]uint8{0, 0, 255}},
		{name: "white", hex: "#ffffff", want: [3]uint8{255, 255, 255}},
		{name: "black", hex: "#000000", want: [3]uint8{0, 0, 0}},
		{name: "mixed", hex: "#1a2b3c", want: [3]uint8{0x1a, 0x2b, 0x3c}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseHex(tc.hex)
			if got != tc.want {
				t.Errorf("parseHex(%q) = %v, want %v", tc.hex, got, tc.want)
			}
		})
	}
}

func TestLerpColor(t *testing.T) {
	cases := []struct {
		name string
		c1   [3]uint8
		c2   [3]uint8
		t    float64
		want string
	}{
		{name: "t=0 returns c1", c1: [3]uint8{255, 0, 0}, c2: [3]uint8{0, 0, 255}, t: 0, want: "#ff0000"},
		{name: "t=1 returns c2", c1: [3]uint8{255, 0, 0}, c2: [3]uint8{0, 0, 255}, t: 1, want: "#0000ff"},
		{name: "midpoint", c1: [3]uint8{0, 0, 0}, c2: [3]uint8{254, 254, 254}, t: 0.5, want: "#7f7f7f"},
		{name: "same color", c1: [3]uint8{100, 100, 100}, c2: [3]uint8{100, 100, 100}, t: 0.5, want: "#646464"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := lerpColor(tc.c1, tc.c2, tc.t)
			if got != tc.want {
				t.Errorf("lerpColor(%v, %v, %v) = %q, want %q", tc.c1, tc.c2, tc.t, got, tc.want)
			}
		})
	}
}

func TestGradientColor(t *testing.T) {
	cases := []struct {
		name   string
		colors []string
		t      float64
		want   string
	}{
		{name: "single color", colors: []string{"#ff0000"}, t: 0.5, want: "#ff0000"},
		{name: "two colors t=0", colors: []string{"#ff0000", "#0000ff"}, t: 0, want: "#ff0000"},
		{name: "two colors t=0.9999", colors: []string{"#ff0000", "#0000ff"}, t: 0.9999, want: "#0000fe"},
		{name: "three colors t=0.5", colors: []string{"#ff0000", "#00ff00", "#0000ff"}, t: 0.5, want: "#00ff00"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := gradientColor(tc.colors, tc.t)
			if got != tc.want {
				t.Errorf("gradientColor(%v, %v) = %q, want %q", tc.colors, tc.t, got, tc.want)
			}
		})
	}
}

func TestRender(t *testing.T) {
	cases := []struct {
		name      string
		text      string
		fontName  string
		colors    []string
		colorType string
		check     func(t *testing.T, result string)
	}{
		{
			name: "empty text",
			text: "", fontName: "", colors: nil, colorType: "",
			check: func(t *testing.T, result string) {
				if result != "" {
					t.Errorf("expected empty string, got %q", result)
				}
			},
		},
		{
			name: "letter coloring contains spans",
			text: "Hi", fontName: "slant", colors: []string{"#ff0000", "#00ff00"}, colorType: "letter",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, `<span style="color:#ff0000">`) {
					t.Error("expected first color span")
				}
				if !strings.Contains(result, `<span style="color:#00ff00">`) {
					t.Error("expected second color span")
				}
			},
		},
		{
			name: "gradient-lr contains spans",
			text: "A", fontName: "slant", colors: []string{"#ff0000", "#0000ff"}, colorType: "gradient-lr",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "<span") {
					t.Error("expected span elements")
				}
			},
		},
		{
			name: "gradient-tb contains spans",
			text: "A", fontName: "slant", colors: []string{"#ff0000", "#0000ff"}, colorType: "gradient-tb",
			check: func(t *testing.T, result string) {
				if !strings.Contains(result, "<span") {
					t.Error("expected span elements")
				}
			},
		},
		{
			name: "defaults applied",
			text: "X", fontName: "", colors: nil, colorType: "",
			check: func(t *testing.T, result string) {
				if result == "" {
					t.Error("expected non-empty result with defaults")
				}
				if !strings.Contains(result, "<span") {
					t.Error("expected span elements")
				}
			},
		},
		{
			name: "text with space",
			text: "A B", fontName: "slant", colors: []string{"#ff0000"}, colorType: "letter",
			check: func(t *testing.T, result string) {
				if result == "" {
					t.Error("expected non-empty result")
				}
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := Render(tc.text, tc.fontName, tc.colors, tc.colorType)
			tc.check(t, result)
		})
	}
}
