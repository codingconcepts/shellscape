package cli

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
)

type colorHandler struct {
	w  io.Writer
	mu sync.Mutex
}

func newColorHandler(w io.Writer) *colorHandler {
	return &colorHandler{w: w}
}

func (h *colorHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *colorHandler) Handle(_ context.Context, r slog.Record) error {
	var level string
	switch r.Level {
	case slog.LevelInfo:
		level = "\033[32mINFO\033[0m"
	case slog.LevelWarn:
		level = "\033[33mWARN\033[0m"
	case slog.LevelError:
		level = "\033[31mERROR\033[0m"
	default:
		level = "\033[90mDEBUG\033[0m"
	}

	msg := fmt.Sprintf("%s \033[1m%s\033[0m", level, r.Message)

	r.Attrs(func(a slog.Attr) bool {
		msg += fmt.Sprintf(" \033[90m%s=\033[0m%s", a.Key, a.Value.String())
		return true
	})

	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := fmt.Fprintln(h.w, msg)
	return err
}

func (h *colorHandler) WithAttrs(_ []slog.Attr) slog.Handler  { return h }
func (h *colorHandler) WithGroup(_ string) slog.Handler        { return h }
