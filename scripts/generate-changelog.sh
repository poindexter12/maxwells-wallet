#!/bin/bash
# Generate changelog entry from git commits since last tag
# Usage: ./scripts/generate-changelog.sh <version>

set -e

VERSION="$1"
DATE=$(date +%Y-%m-%d)
CHANGELOG_FILE="CHANGELOG.md"

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Get commits since last tag (or all commits if no tags)
if [ -z "$LAST_TAG" ]; then
    COMMITS=$(git log --pretty=format:"%s" --no-merges)
else
    COMMITS=$(git log "${LAST_TAG}..HEAD" --pretty=format:"%s" --no-merges)
fi

# Parse conventional commits into categories
FEATURES=""
FIXES=""
OTHER=""

while IFS= read -r commit; do
    [ -z "$commit" ] && continue

    if [[ "$commit" =~ ^feat(\(.+\))?: ]]; then
        # Extract message after "feat:" or "feat(scope):"
        msg=$(echo "$commit" | sed -E 's/^feat(\([^)]+\))?: //')
        FEATURES="${FEATURES}\n- ${msg}"
    elif [[ "$commit" =~ ^fix(\(.+\))?: ]]; then
        msg=$(echo "$commit" | sed -E 's/^fix(\([^)]+\))?: //')
        FIXES="${FIXES}\n- ${msg}"
    elif [[ "$commit" =~ ^refactor(\(.+\))?: ]]; then
        msg=$(echo "$commit" | sed -E 's/^refactor(\([^)]+\))?: //')
        OTHER="${OTHER}\n- ${msg}"
    elif [[ "$commit" =~ ^chore: ]]; then
        # Skip chore commits (release, deps, etc.)
        continue
    elif [[ "$commit" =~ ^docs: ]]; then
        # Skip docs commits
        continue
    elif [[ "$commit" =~ ^ci: ]]; then
        # Skip CI commits
        continue
    else
        # Include other commits in "Changed"
        OTHER="${OTHER}\n- ${commit}"
    fi
done <<< "$COMMITS"

# Build the changelog entry
ENTRY="## [${VERSION}] - ${DATE}"

if [ -n "$FEATURES" ]; then
    ENTRY="${ENTRY}\n\n### Added${FEATURES}"
fi

if [ -n "$FIXES" ]; then
    ENTRY="${ENTRY}\n\n### Fixed${FIXES}"
fi

if [ -n "$OTHER" ]; then
    ENTRY="${ENTRY}\n\n### Changed${OTHER}"
fi

# If no categorized commits, add a placeholder
if [ -z "$FEATURES" ] && [ -z "$FIXES" ] && [ -z "$OTHER" ]; then
    ENTRY="${ENTRY}\n\n### Changed\n- Release ${VERSION}"
fi

# Create new changelog with entry inserted after header
HEADER=$(head -7 "$CHANGELOG_FILE")
BODY=$(tail -n +8 "$CHANGELOG_FILE")

{
    echo "$HEADER"
    echo ""
    echo -e "$ENTRY"
    echo "$BODY"
} > "${CHANGELOG_FILE}.new"

mv "${CHANGELOG_FILE}.new" "$CHANGELOG_FILE"

echo "Updated $CHANGELOG_FILE with v${VERSION} entry"
