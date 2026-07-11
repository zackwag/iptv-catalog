#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- Check for uncommitted changes ---
UNSTAGED=$(git diff --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard)
STAGED=$(git diff --cached --name-only)

if [[ -n "$UNSTAGED" || -n "$UNTRACKED" ]]; then
  echo "Uncommitted changes detected:"
  git status --short
  echo ""
  read -rp "Stage and commit these files before releasing? [Y/n] " stage_confirm
  stage_confirm="${stage_confirm:-Y}"
  if [[ "$stage_confirm" =~ ^[Yy]$ ]]; then
    git add -A
    read -rp "Commit message: " pre_message
    git commit -m "$pre_message"
    echo ""
  else
    echo "Proceeding without committing unstaged changes."
    echo ""
  fi
elif [[ -n "$STAGED" ]]; then
  echo "Staged but uncommitted changes detected:"
  git status --short
  echo ""
  read -rp "Commit staged changes before releasing? [Y/n] " stage_confirm
  stage_confirm="${stage_confirm:-Y}"
  if [[ "$stage_confirm" =~ ^[Yy]$ ]]; then
    read -rp "Commit message: " pre_message
    git commit -m "$pre_message"
    echo ""
  fi
fi

# --- Read current version from package.json ---
CURRENT=$(node -p "require('./package.json').version")
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

echo "Current version: $CURRENT"
echo ""
echo "Bump type:"
echo "  1) patch  → $MAJOR.$MINOR.$((PATCH + 1))"
echo "  2) minor  → $MAJOR.$((MINOR + 1)).0"
echo "  3) major  → $((MAJOR + 1)).0.0"
echo ""
read -rp "Choose [1]: " bump_choice
bump_choice="${bump_choice:-1}"

case "$bump_choice" in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  *)
    echo "Invalid choice."
    exit 1
    ;;
esac

# Preview the new version without changing anything yet
NEW_VERSION=$(node -p "
  const v = '${CURRENT}'.split('.').map(Number);
  if ('${BUMP}' === 'patch') { v[2]++; }
  else if ('${BUMP}' === 'minor') { v[1]++; v[2] = 0; }
  else { v[0]++; v[1] = 0; v[2] = 0; }
  v.join('.');
")
TAG="v${NEW_VERSION}"

echo ""
echo "Preparing release:"
echo "  Version : $CURRENT → $NEW_VERSION ($TAG)"
echo ""
read -rp "Proceed? [Y/n] " confirm
confirm="${confirm:-Y}"
[[ "$confirm" =~ ^[Yy]$ ]] || exit 0

# --- Generate changelog entry ---
CHANGELOG="CHANGELOG.md"
DATE=$(date +%Y-%m-%d)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

{
  echo "## [$NEW_VERSION] - $DATE"
  echo ""
  if [[ -n "$LAST_TAG" ]]; then
    git log "${LAST_TAG}..HEAD" --pretty=format:"- %s" --no-merges
    echo ""
  fi
  echo ""
} > /tmp/changelog_entry.txt

if [[ -f "$CHANGELOG" ]]; then
  if grep -q "^# Changelog" "$CHANGELOG"; then
    head -n 1 "$CHANGELOG" > /tmp/changelog_new.txt
    echo "" >> /tmp/changelog_new.txt
    cat /tmp/changelog_entry.txt >> /tmp/changelog_new.txt
    tail -n +2 "$CHANGELOG" >> /tmp/changelog_new.txt
  else
    cat /tmp/changelog_entry.txt "$CHANGELOG" > /tmp/changelog_new.txt
  fi
else
  {
    echo "# Changelog"
    echo ""
    cat /tmp/changelog_entry.txt
  } > /tmp/changelog_new.txt
fi

mv /tmp/changelog_new.txt "$CHANGELOG"
echo "Updated $CHANGELOG"

# --- Bump version in package.json (no git commit yet — npm version --no-git-tag-version) ---
npm version "$BUMP" --no-git-tag-version --no-commit-hooks > /dev/null
echo "Bumped package.json to $NEW_VERSION"

# --- Commit everything (package.json + CHANGELOG) then tag ---
git add package.json "$CHANGELOG"
git commit -m "chore: release $NEW_VERSION"
git tag "$TAG"

echo ""
read -rp "Push to origin/main now? [Y/n] " push_confirm
push_confirm="${push_confirm:-Y}"
if [[ "$push_confirm" =~ ^[Yy]$ ]]; then
  git push origin main
  git push origin "$TAG"
  echo ""
  echo "Done. Release $TAG is live."
else
  echo ""
  echo "Commit and tag created locally. Push when ready:"
  echo "  git push origin main && git push origin $TAG"
fi
