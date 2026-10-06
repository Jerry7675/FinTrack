#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='sk-or-|OPENROUTER_API_KEY|openrouter\.ai'

run_grep_scan() {
  local target=$1
  local label=$2
  local hits
  local ec

  echo "Scanning ${label} (grep -rEn)..."
  set +e
  hits="$(grep -rEn "$PATTERN" "$target" 2>&1)"
  ec=$?
  set -e

  if [ "$ec" -eq 0 ]; then
    echo "FAIL: forbidden pattern found in ${label}"
    echo "$hits"
    return 1
  fi
  if [ "$ec" -eq 1 ]; then
    echo "  OK: no matches in ${label}"
    return 0
  fi
  echo "FAIL: grep exited ${ec} while scanning ${label} (tool missing or I/O error)"
  echo "$hits"
  return 2
}

assert_bundle_dir() {
  local dir=$1
  if [ ! -d "$dir" ]; then
    echo "FAIL: ${dir}/ is missing after export"
    exit 2
  fi
  local count
  count="$(find "$dir" -type f 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$count" -eq 0 ]; then
    echo "FAIL: ${dir}/ is empty after export"
    exit 2
  fi
  echo "  Bundle ${dir}/: ${count} file(s) to scan"
}

run_self_test() {
  echo "Running secret-scan self-test (planted sk-or-test)..."
  local tmp
  tmp="$(mktemp -d)"
  printf '%s\n' 'sk-or-test-planted-for-ci' >"${tmp}/leak.txt"
  if run_grep_scan "$tmp" "self-test temp dir"; then
    rm -rf "$tmp"
    echo "FAIL: self-test did not detect planted secret string"
    exit 1
  fi
  rm -rf "$tmp"
  echo "OK: self-test detected planted secret (grep exit 0 -> scan failed as expected)"
}

if [ "${1:-}" = "--self-test" ]; then
  run_self_test
  exit 0
fi

run_self_test

run_grep_scan src/ "src/"

echo "Running expo export for bundle scan (ios + android)..."
# Web export fails headless: expo-sqlite pulls wa-sqlite.wasm on web. Native bundles match shipped JS.
bunx expo export --platform ios --output-dir dist
bunx expo export --platform android --output-dir dist-android

assert_bundle_dir dist
assert_bundle_dir dist-android

run_grep_scan dist/ "dist/"
run_grep_scan dist-android/ "dist-android/"

echo "OK: no forbidden secret patterns in src/ or exported bundles"
