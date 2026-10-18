#!/usr/bin/env bash
# Prints the end of a log as GitHub Actions error annotations. Run logs need a signed-in
# account to read; annotations come through the public API (check-runs/<id>/annotations), so a
# failed build can be read from outside GitHub too. GitHub keeps 10 error annotations a step.
#
# Usage: tools/ci/annotate-tail.sh <log file> <title> [lines]

LOG="$1"
TITLE="$2"
LINES="${3:-120}"
[ -f "$LOG" ] || exit 0

# Annotation messages escape %, CR and LF; one annotation holds a chunk of lines.
tail -n "$LINES" "$LOG" | cut -c1-240 | split -l 12 - "${RUNNER_TEMP:-/tmp}/annotate-"
i=0
for chunk in "${RUNNER_TEMP:-/tmp}"/annotate-*; do
  i=$((i + 1))
  body="$(sed -e 's/%/%25/g' -e 's/\r/%0D/g' "$chunk" | awk '{ printf "%s%%0A", $0 }')"
  echo "::error title=${TITLE} (${i})::${body}"
  rm -f "$chunk"
done
