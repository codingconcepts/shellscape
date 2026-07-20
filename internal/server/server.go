package server

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type Server struct {
	addr     string
	siteDir  string
	outDir   string
	buildFn  func() error
	clients  map[chan struct{}]struct{}
	mu       sync.Mutex
}

func New(addr string, siteDir string, outDir string, buildFn func() error) *Server {
	return &Server{
		addr:    addr,
		siteDir: siteDir,
		outDir:  outDir,
		buildFn: buildFn,
		clients: make(map[chan struct{}]struct{}),
	}
}

func (s *Server) ListenAndServe() error {
	go s.watch()

	mux := http.NewServeMux()
	mux.HandleFunc("/_reload", s.handleSSE)
	mux.Handle("/", s.fileServer())

	return http.ListenAndServe(s.addr, mux)
}

func (s *Server) fileServer() http.Handler {
	root := filepath.Join(s.siteDir, s.outDir)
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, ".") && r.URL.Path != "/" {
			indexPath := filepath.Join(root, r.URL.Path, "index.html")
			if info, err := os.Stat(indexPath); err == nil && !info.IsDir() {
				http.ServeFile(w, r, indexPath)
				return
			}
		}
		fs.ServeHTTP(w, r)
	})
}

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := make(chan struct{}, 1)
	s.mu.Lock()
	s.clients[ch] = struct{}{}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, ch)
		s.mu.Unlock()
	}()

	for {
		select {
		case <-ch:
			_, _ = fmt.Fprintf(w, "data: reload\n\n")
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (s *Server) notifyClients() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.clients {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

func (s *Server) watch() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("fsnotify error: %v", err)
		return
	}
	defer func() { _ = watcher.Close() }()

	dirs := []string{
		filepath.Join(s.siteDir, "content"),
		filepath.Join(s.siteDir, "themes"),
		filepath.Join(s.siteDir, "static"),
	}

	for _, dir := range dirs {
		_ = addRecursive(watcher, dir)
	}
	_ = watcher.Add(filepath.Join(s.siteDir, "config.yaml"))

	var debounce *time.Timer
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove) == 0 {
				continue
			}
			if debounce != nil {
				debounce.Stop()
			}
			debounce = time.AfterFunc(200*time.Millisecond, func() {
				log.Printf("Rebuilding...")
				if err := s.buildFn(); err != nil {
					log.Printf("Build error: %v", err)
					return
				}
				log.Printf("Rebuilt successfully")
				s.notifyClients()
			})
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("watcher error: %v", err)
		}
	}
}

func addRecursive(watcher *fsnotify.Watcher, dir string) error {
	return filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return watcher.Add(path)
		}
		return nil
	})
}
