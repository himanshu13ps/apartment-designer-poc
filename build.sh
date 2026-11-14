#!/bin/sh
# Concatenates the source parts in src/ into the single self-contained index.html.
cd "$(dirname "$0")" && cat src/01-head.html src/[0-9][0-9]-*.js src/99-tail.html > index.html && echo "built index.html ($(wc -c < index.html) bytes)"
