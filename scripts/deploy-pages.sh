#!/usr/bin/env bash
# Builds the site and publishes it to the public repo codeviants-lab/codeviants-lab.github.io (GitHub Pages),
# served at https://codeviants-lab.github.io. Only the built files are public; the source stays here.
# Supabase keys, if any, are read from .env.local by the build (the anon key is public by design).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
git clone -q --depth 1 git@github.com:codeviants-lab/codeviants-lab.github.io.git "$out" 2>/dev/null || {
  git init -q "$out"
  git -C "$out" remote add origin git@github.com:codeviants-lab/codeviants-lab.github.io.git
}
find "$out" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$out"/
touch "$out/.nojekyll"
printf '# codeviants-lab.github.io\n\nBuilt site of codeviants-chess: https://codeviants-lab.github.io\nSource: codeviants-lab/chess (private). Do not edit here: published by `scripts/deploy-pages.sh`.\n' > "$out/README.md"
src=$(git rev-parse --short HEAD)
git -C "$out" add -A
git -C "$out" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Deploy chess@$src" || { echo "Nothing to deploy"; exit 0; }
git -C "$out" branch -M main
git -C "$out" push -q origin main
echo "Deployed chess@$src -> https://codeviants-lab.github.io"
