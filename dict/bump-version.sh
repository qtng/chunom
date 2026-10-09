#!/bin/sh
# Sets a new cache-busting version in the dictionary pages. Run it after changing a file in dict/ or js/ime.js,
# then commit. GitHub Pages lets browsers keep files for hours; a new "?v=" makes them fetch the new ones.
# Usage: dict/bump-version.sh [version]     (default: current date and time)
cd "$(dirname "$0")" || exit 1
v="${1:-$(date -u +%Y%m%d-%H%M)}"
sed -i "s/?v=[0-9A-Za-z._-]*/?v=$v/g" genibrel.html bonet.html tdcntd.html
grep -c "?v=$v" genibrel.html bonet.html tdcntd.html
