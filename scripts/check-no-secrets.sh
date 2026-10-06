#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='sk-or-|OPENROUTER_API_KEY|openrouter\.ai'

echo "Scanning src/ for secret patterns..."
if rg -q "$PATTERN" src/ 2>/dev/null; then
  echo "FAIL: forbidden pattern found in src/"
  rg "$PATTERN" src/
  exit 1
fi

echo "Running expo export for bundle scan (ios + android)..."
# Web export fails headless: expo-sqlite pulls wa-sqlite.wasm on web. Native bundles match shipped JS.
bunx expo export --platform ios --output-dir dist
bunx expo export --platform android --output-dir dist-android

echo "Scanning dist/ and dist-android/ for secret patterns..."
for dir in dist dist-android; do
  if rg -q "$PATTERN" "$dir/" 2>/dev/null; then
    echo "FAIL: forbidden pattern found in $dir/"
    rg "$PATTERN" "$dir/"
    exit 1
  fi
done

echo "OK: no forbidden secret patterns in src/ or exported bundles"
