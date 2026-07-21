bundle:
	npx esbuild embed/static/src/terminal.js --bundle --outfile=embed/static/terminal.js --format=iife --sourcemap

bundle-prod:
	npx esbuild embed/static/src/terminal.js --bundle --outfile=embed/static/terminal.js --format=iife --minify --sourcemap

build: bundle-prod
	go build ./cmd/shellscape
	mv ./shellscape ~/dev/bin

docs: bundle
	go build ./cmd/shellscape
	mv ./shellscape ~/dev/bin
	(cd docs && open "http://localhost:1313" && shellscape serve --watch)

test-js:
	npx vitest run

test: test-js
	go test ./... -coverprofile=coverage.out
	go tool cover -func=coverage.out | tail -1
	@rm -f coverage.out

fix:
	- golangci-lint run
	- govulncheck -show verbose ./...
	- staticcheck ./...
	- go fix ./...
	- go vet ./...
	- command rg -nU '[Ee]rr\s*:=.*\n.*[Ee]rr\s*:=' --glob '*.go' --glob '!*_test.go' .