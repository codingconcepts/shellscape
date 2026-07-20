package markdown

import (
	"bytes"

	"github.com/yuin/goldmark"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer/html"

	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
)

type Renderer struct {
	md goldmark.Markdown
}

func NewRenderer() *Renderer {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.Typographer,
			highlighting.NewHighlighting(
				highlighting.WithFormatOptions(
					chromahtml.WithClasses(true),
				),
			),
		),
		goldmark.WithRendererOptions(
			html.WithUnsafe(),
		),
	)

	return &Renderer{md: md}
}

func (r *Renderer) Render(source []byte) ([]byte, error) {
	var buf bytes.Buffer
	if err := r.md.Convert(source, &buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
