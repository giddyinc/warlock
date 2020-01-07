RUNNER ?= ./node_modules/mocha/bin/mocha
REPORTER ?= list

run = $(RUNNER) -R $(REPORTER) $(2) $(1)

clean:
	npm run clean
compile: clean
	npm run build
test: compile
	$(call run,./test/warlock.js)

bench:
	$(call run,./test/bench.js)

.PHONY: test
