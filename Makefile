.PHONY: all
all: build

.PHONY: build
build: node_modules
	npm run build

.PHONY: watch
watch: node_modules
	npm run watch

node_modules:
	npm ci