package banner

import (
	"fmt"
	"html"
	"math"
	"strconv"
	"strings"

	figure "github.com/common-nighthawk/go-figure"
)

var defaultColors = []string{
	"#e06c75",
	"#d19a66",
	"#e5c07b",
	"#98c379",
	"#56b6c2",
	"#61afef",
	"#c678dd",
}

type charGlyph struct {
	rows  []string
	width int
	ch    rune
}

func Render(text, fontName string, colors []string, colorType string) string {
	if text == "" {
		return ""
	}
	if fontName == "" {
		fontName = "slant"
	}
	if len(colors) == 0 {
		colors = defaultColors
	}
	if colorType == "" {
		colorType = "letter"
	}

	var glyphs []charGlyph

	maxHeight := 0
	for _, ch := range text {
		if ch == ' ' {
			glyphs = append(glyphs, charGlyph{ch: ' '})
			continue
		}
		fig := figure.NewFigure(string(ch), fontName, false)
		rows := fig.Slicify()
		w := 0
		for _, r := range rows {
			if len(r) > w {
				w = len(r)
			}
		}
		if len(rows) > maxHeight {
			maxHeight = len(rows)
		}
		glyphs = append(glyphs, charGlyph{rows: rows, width: w, ch: ch})
	}

	spaceWidth := 3
	for i := range glyphs {
		g := &glyphs[i]
		if g.ch == ' ' {
			g.width = spaceWidth
			g.rows = make([]string, maxHeight)
			for j := range g.rows {
				g.rows[j] = strings.Repeat(" ", spaceWidth)
			}
			continue
		}
		for len(g.rows) < maxHeight {
			g.rows = append(g.rows, "")
		}
		for j, r := range g.rows {
			if len(r) < g.width {
				g.rows[j] = r + strings.Repeat(" ", g.width-len(r))
			}
		}
	}

	switch colorType {
	case "gradient-lr":
		return renderGradientLR(glyphs, maxHeight, colors)
	case "gradient-tb":
		return renderGradientTB(glyphs, maxHeight, colors)
	default:
		return renderLetter(glyphs, maxHeight, colors)
	}
}

func renderLetter(glyphs []charGlyph, maxHeight int, colors []string) string {
	var lines []string
	for row := range maxHeight {
		var parts []string
		colorIdx := 0
		for _, g := range glyphs {
			if g.ch == ' ' {
				parts = append(parts, html.EscapeString(g.rows[row]))
				continue
			}
			color := colors[colorIdx%len(colors)]
			escaped := html.EscapeString(g.rows[row])
			parts = append(parts, fmt.Sprintf(`<span style="color:%s">%s</span>`, color, escaped))
			colorIdx++
		}
		lines = append(lines, strings.Join(parts, ""))
	}
	return strings.Join(lines, "\n")
}

func renderGradientLR(glyphs []charGlyph, maxHeight int, colors []string) string {
	totalCols := 0
	for _, g := range glyphs {
		totalCols += g.width
	}
	if totalCols == 0 {
		return ""
	}

	var lines []string
	for row := range maxHeight {
		var parts []string
		col := 0
		for _, g := range glyphs {
			rowRunes := []rune(g.rows[row])
			for i := 0; i < g.width; i++ {
				t := float64(col) / float64(totalCols)
				color := gradientColor(colors, t)
				var ch string
				if i < len(rowRunes) {
					ch = html.EscapeString(string(rowRunes[i]))
				} else {
					ch = " "
				}
				parts = append(parts, fmt.Sprintf(`<span style="color:%s">%s</span>`, color, ch))
				col++
			}
		}
		lines = append(lines, strings.Join(parts, ""))
	}
	return strings.Join(lines, "\n")
}

func renderGradientTB(glyphs []charGlyph, maxHeight int, colors []string) string {
	if maxHeight == 0 {
		return ""
	}

	var lines []string
	for row := range maxHeight {
		t := float64(row) / float64(maxHeight)
		color := gradientColor(colors, t)
		var parts []string
		for _, g := range glyphs {
			rowRunes := []rune(g.rows[row])
			for i := 0; i < g.width; i++ {
				var ch string
				if i < len(rowRunes) {
					ch = html.EscapeString(string(rowRunes[i]))
				} else {
					ch = " "
				}
				parts = append(parts, fmt.Sprintf(`<span style="color:%s">%s</span>`, color, ch))
			}
		}
		lines = append(lines, strings.Join(parts, ""))
	}
	return strings.Join(lines, "\n")
}

func gradientColor(colors []string, t float64) string {
	if len(colors) == 1 {
		return colors[0]
	}
	t = math.Max(0, math.Min(t, 0.9999))
	segments := float64(len(colors) - 1)
	scaled := t * segments
	idx := int(scaled)
	frac := scaled - float64(idx)

	c1 := parseHex(colors[idx])
	c2 := parseHex(colors[idx+1])
	return lerpColor(c1, c2, frac)
}

func parseHex(hex string) [3]uint8 {
	hex = strings.TrimPrefix(hex, "#")
	r, _ := strconv.ParseUint(hex[0:2], 16, 8)
	g, _ := strconv.ParseUint(hex[2:4], 16, 8)
	b, _ := strconv.ParseUint(hex[4:6], 16, 8)
	return [3]uint8{uint8(r), uint8(g), uint8(b)}
}

func lerpColor(c1, c2 [3]uint8, t float64) string {
	r := uint8(float64(c1[0])*(1-t) + float64(c2[0])*t)
	g := uint8(float64(c1[1])*(1-t) + float64(c2[1])*t)
	b := uint8(float64(c1[2])*(1-t) + float64(c2[2])*t)
	return fmt.Sprintf("#%02x%02x%02x", r, g, b)
}
