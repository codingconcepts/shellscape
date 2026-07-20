build:
	go build ./cmd/shellscape
	mv ./shellscape ~/dev/bin

init: build
	shellscape init mysite

serve: build
	(cd mysite && shellscape serve)