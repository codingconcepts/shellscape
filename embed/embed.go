package embed

import "embed"

//go:embed all:templates all:themes all:static all:scaffold
var FS embed.FS
