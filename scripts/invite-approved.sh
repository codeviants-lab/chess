#!/usr/bin/env bash
# Sends repository invitations for every approved join request.
#
# Join requests are issues opened with the form at
#   https://github.com/codeviants-lab/.github/issues/new?template=katilim.yml
# The owner approves one by adding the label "onay: admin" or "onay: write". This script invites each approved
# issue's author to codeviants-lab/chess with that role, comments on the issue and closes it.
# Usage: ./scripts/invite-approved.sh [--dry-run]
set -euo pipefail
REQUESTS=codeviants-lab/.github
REPO=codeviants-lab/chess
dry=${1:-}

invite() { # label permission
  gh issue list -R "$REQUESTS" --state open --label "$1" --json number,author --jq '.[] | "\(.number) \(.author.login)"' |
    while read -r number login; do
      if [ "$dry" = "--dry-run" ]; then
        echo "[deneme] #$number @$login → $2"
        continue
      fi
      gh api -X PUT "repos/$REPO/collaborators/$login" -f permission="$2" --silent
      gh issue comment "$number" -R "$REQUESTS" --body "Davet gönderildi (@$login, rol: $2). GitHub'dan gelen e-postadaki ya da https://github.com/$REPO/invitations sayfasındaki daveti kabul et. Hoş geldin!" >/dev/null
      gh issue close "$number" -R "$REQUESTS" --reason completed >/dev/null
      echo "#$number @$login → $2: davet gönderildi"
    done
}

invite "onay: admin" admin
invite "onay: write" push
pending=$(gh issue list -R "$REQUESTS" --state open --label "katılım-isteği" --json number --jq length)
echo "Onay bekleyen istek: $pending"
