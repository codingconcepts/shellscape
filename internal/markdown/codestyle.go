package markdown

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"

	"github.com/alecthomas/chroma/v2"
	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/styles"
)

func CodeThemeCSS(darkStyle, lightStyle string) ([]byte, error) {
	dark, err := resolveStyle(darkStyle)
	if err != nil {
		return nil, fmt.Errorf("dark code style: %w", err)
	}

	light, err := resolveStyle(lightStyle)
	if err != nil {
		return nil, fmt.Errorf("light code style: %w", err)
	}

	formatter := chromahtml.New(chromahtml.WithClasses(true))

	var darkBuf bytes.Buffer
	if err := formatter.WriteCSS(&darkBuf, dark); err != nil {
		return nil, fmt.Errorf("writing dark CSS: %w", err)
	}

	var lightBuf bytes.Buffer
	if err := formatter.WriteCSS(&lightBuf, light); err != nil {
		return nil, fmt.Errorf("writing light CSS: %w", err)
	}

	var out bytes.Buffer
	out.WriteString("/* Code highlighting: dark */\n")
	out.WriteString(stripBgColors(darkBuf.String()))
	out.WriteString("\n/* Code highlighting: light */\n")
	out.WriteString(scopeCSS(stripBgColors(lightBuf.String()), "[data-code-theme=\"light\"]"))

	return out.Bytes(), nil
}

func scopeCSS(css, scope string) string {
	var out strings.Builder
	for line := range strings.SplitSeq(css, "\n") {
		trimmed := strings.TrimSpace(line)

		// Chroma emits each rule as "/* TokenName */ selector { ... }" on a
		// single line, so peel off a leading comment before deciding whether
		// the line contains a rule that needs scoping.
		prefix := ""
		if strings.HasPrefix(trimmed, "/*") {
			if end := strings.Index(trimmed, "*/"); end != -1 {
				prefix = trimmed[:end+2] + " "
				trimmed = strings.TrimSpace(trimmed[end+2:])
			}
		}
		if trimmed == "" || strings.HasPrefix(trimmed, "/*") || strings.HasPrefix(trimmed, "}") {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}
		if strings.Contains(trimmed, "{") {
			parts := strings.SplitN(trimmed, "{", 2)
			selector := strings.TrimSpace(parts[0])
			out.WriteString(prefix)
			out.WriteString(scope)
			out.WriteString(" ")
			out.WriteString(selector)
			out.WriteString(" {")
			out.WriteString(parts[1])
			out.WriteByte('\n')
			continue
		}
		out.WriteString(line)
		out.WriteByte('\n')
	}
	return out.String()
}

func stripBgColors(css string) string {
	re := regexp.MustCompile(`\s*background(?:-color)?\s*:\s*[^;]+;?`)
	return re.ReplaceAllString(css, "")
}

func resolveStyle(name string) (*chroma.Style, error) {
	s := styles.Get(name)
	if s == nil {
		s = styles.Fallback
	}
	return s, nil
}
