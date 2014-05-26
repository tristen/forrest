# See the README for installation instructions.
UGLIFY = node_modules/.bin/uglifyjs
BROWSERIFY = node_modules/.bin/browserify

all: \
	js/app.js \
	js/app.min.js

install:
	npm install && make

clean:
	rm js/app.js js/app.min.js

js/app.js: index.js 
	$(BROWSERIFY) index.js -o js/app.js

js/app.min.js: js/app.js
	$(UGLIFY) js/app.js > js/app.min.js

.PHONY: clean install
