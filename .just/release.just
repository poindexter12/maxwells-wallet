# Release recipes
set working-directory := '..'

# Version detection
CURRENT_VERSION := `grep -E '^version = ' backend/pyproject.toml | sed 's/version = "\(.*\)"/\1/'`
FRONTEND_VERSION := `grep -E '"version":' frontend/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/'`
LAST_TAG := `git describe --tags --abbrev=0 2>/dev/null || echo ""`
RELEASE_DOCS := "CHANGELOG.md README.md docs-site/index.md"

# Pre-flight validation (dry-run)
check:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    header "Release Pre-flight Check"
    echo ""
    style 11 "1. Version Numbers:"
    echo "   Backend (pyproject.toml):  {{ CURRENT_VERSION }}"
    echo "   Frontend (package.json):   {{ FRONTEND_VERSION }}"
    if [ "{{ CURRENT_VERSION }}" = "{{ FRONTEND_VERSION }}" ]; then
        style 2 "   Versions match"
    else
        style 1 "   Version mismatch!"
    fi
    echo ""
    style 11 "2. Last Release Tag: {{ LAST_TAG }}"
    echo ""
    style 11 "3. Docs Changed Since {{ LAST_TAG }}:"
    for doc in {{ RELEASE_DOCS }}; do
        if [ -n "{{ LAST_TAG }}" ]; then
            if git diff --quiet "{{ LAST_TAG }}" HEAD -- "$doc" 2>/dev/null; then
                style 1 "   $doc - NO CHANGES"
            else
                style 2 "   $doc - updated"
            fi
        else
            echo "   ? $doc (no previous tag)"
        fi
    done
    echo ""
    style 11 "4. CHANGELOG has section for {{ CURRENT_VERSION }}:"
    if grep -q "\[{{ CURRENT_VERSION }}\]" CHANGELOG.md; then
        style 2 "   Found [{{ CURRENT_VERSION }}] in CHANGELOG.md"
    else
        style 1 "   Missing [{{ CURRENT_VERSION }}] section in CHANGELOG.md"
    fi

# Validate release checks (fail on issues)
validate:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    ERRORS=0
    if [ "{{ CURRENT_VERSION }}" != "{{ FRONTEND_VERSION }}" ]; then
        style 1 "Error: Version mismatch - backend={{ CURRENT_VERSION }} frontend={{ FRONTEND_VERSION }}"
        ERRORS=1
    fi
    if [ -n "{{ LAST_TAG }}" ]; then
        if git diff --quiet "{{ LAST_TAG }}" HEAD -- CHANGELOG.md 2>/dev/null; then
            style 1 "Error: CHANGELOG.md has no changes since {{ LAST_TAG }}"
            ERRORS=1
        fi
    fi
    if ! grep -q "\[{{ CURRENT_VERSION }}\]" CHANGELOG.md; then
        style 1 "Error: CHANGELOG.md missing section for [{{ CURRENT_VERSION }}]"
        ERRORS=1
    fi
    if [ $ERRORS -ne 0 ]; then
        echo ""
        style 11 "Run 'just release::check' for details"
        exit 1
    fi
    style 2 "All release checks passed."

# Create a release (usage: just release::release x.y.z)
release VERSION="":
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    VERSION="{{ VERSION }}"
    if [ -z "$VERSION" ]; then
        header "Release Commands"
        echo ""
        style 11 "  just release::release x.y.z           - Release specific version"
        style 11 "  just release::release-patch           - {{ CURRENT_VERSION }} -> next patch"
        style 11 "  just release::release-minor           - {{ CURRENT_VERSION }} -> next minor"
        style 11 "  just release::release-major           - {{ CURRENT_VERSION }} -> next major"
        style 11 "  just release::check                   - Pre-flight validation (dry-run)"
        echo ""
        echo "Current version: $(style 2 "{{ CURRENT_VERSION }}")"
        echo "Last tag: {{ LAST_TAG }}"
    else
        style 12 "Pre-flight validation for v$VERSION..."
        echo ""
        ERRORS=0
        if [ "{{ CURRENT_VERSION }}" != "{{ FRONTEND_VERSION }}" ]; then
            style 1 "Version mismatch: backend={{ CURRENT_VERSION }} frontend={{ FRONTEND_VERSION }}"
            ERRORS=1
        else
            style 2 "Backend/frontend versions match ({{ CURRENT_VERSION }})"
        fi
        if [ -n "{{ LAST_TAG }}" ]; then
            if git diff --quiet "{{ LAST_TAG }}" HEAD -- CHANGELOG.md 2>/dev/null; then
                style 1 "CHANGELOG.md has no changes since {{ LAST_TAG }}"
                ERRORS=1
            else
                style 2 "CHANGELOG.md updated since {{ LAST_TAG }}"
            fi
        fi
        if ! grep -q "\[$VERSION\]" CHANGELOG.md; then
            style 1 "CHANGELOG.md missing section for [$VERSION]"
            ERRORS=1
        else
            style 2 "CHANGELOG.md has [$VERSION] section"
        fi
        if [ $ERRORS -ne 0 ]; then
            echo ""
            style 1 "Release blocked. Fix the above issues first."
            style 11 "Run 'just release::check' for full details."
            exit 1
        fi
        echo ""
        if confirm "Create and push release v$VERSION?" false; then
            style 12 "Creating release v$VERSION..."
            sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" backend/pyproject.toml
            sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
            git add -A
            git commit -m "chore: release v$VERSION"
            git tag "v$VERSION"
            style 12 "Pushing to GitHub..."
            git push origin main --tags
            echo ""
            style 2 "Release v$VERSION created!"
            echo ""
            echo "GitHub Actions will now:"
            echo "  1. Create GitHub Release with changelog"
            echo "  2. Build Docker image"
            echo "  3. Push to ghcr.io/poindexter12/maxwells-wallet:$VERSION"
            echo ""
            style 11 "Monitor progress: gh run watch"
        else
            style 12 "Release cancelled."
        fi
    fi

# Create a patch release (x.y.Z+1)
release-patch:
    #!/usr/bin/env bash
    set -euo pipefail
    NEW_VERSION=$(echo "{{ CURRENT_VERSION }}" | awk -F. '{print $1"."$2"."$3+1}')
    just release::release "$NEW_VERSION"

# Create a minor release (x.Y+1.0)
release-minor:
    #!/usr/bin/env bash
    set -euo pipefail
    NEW_VERSION=$(echo "{{ CURRENT_VERSION }}" | awk -F. '{print $1"."$2+1".0"}')
    just release::release "$NEW_VERSION"

# Create a major release (X+1.0.0)
release-major:
    #!/usr/bin/env bash
    set -euo pipefail
    NEW_VERSION=$(echo "{{ CURRENT_VERSION }}" | awk -F. '{print $1+1".0.0"}')
    just release::release "$NEW_VERSION"
