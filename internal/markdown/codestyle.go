package markdown

import (
	"bytes"
	"fmt"
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
	out.Write(darkBuf.Bytes())
	out.WriteString("\n/* Code highlighting: light */\n")
	out.WriteString(scopeCSS(lightBuf.String(), "[data-code-theme=\"light\"]"))

	return out.Bytes(), nil
}

func scopeCSS(css, scope string) string {
	var out strings.Builder
	for line := range strings.SplitSeq(css, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "/*") {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}
		if strings.HasPrefix(trimmed, "}") {
			out.WriteString(line)
			out.WriteByte('\n')
			continue
		}
		if strings.Contains(trimmed, "{") {
			selector := strings.TrimSpace(strings.SplitN(trimmed, "{", 2)[0])
			rest := "{" + strings.SplitN(trimmed, "{", 2)[1]
			out.WriteString(scope)
			out.WriteString(" ")
			out.WriteString(selector)
			out.WriteString(" ")
			out.WriteString(rest)
			out.WriteByte('\n')
			continue
		}
		out.WriteString(line)
		out.WriteByte('\n')
	}
	return out.String()
}

func resolveStyle(name string) (*chroma.Style, error) {
	s := styles.Get(name)
	if s == nil {
		return nil, fmt.Errorf("unknown chroma style %q", name)
	}
	return s, nil
}
