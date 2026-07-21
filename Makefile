build:
	go build ./cmd/shellscape
	mv ./shellscape ~/dev/bin

docs: build
	(cd docs && open "http://localhost:1313" && shellscape serve)

test:
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