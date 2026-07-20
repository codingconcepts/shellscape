build:
	go build ./cmd/shellscape
	mv ./shellscape ~/dev/bin

docs: build
	(cd docs && open "http://localhost:1313" && shellscape serve)