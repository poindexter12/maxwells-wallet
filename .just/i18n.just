# Internationalization recipes
set working-directory := '..'

# Crowdin configuration
CROWDIN_CONFIG := "-c ../crowdin.yaml"
CROWDIN_PROJECT_ID := "854226"

# Upload source strings to Crowdin
upload:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Uploading source strings to Crowdin..."
    cd frontend
    spin "Uploading sources..." npx crowdin upload sources {{ CROWDIN_CONFIG }}
    style 2 "Source strings uploaded."

# Download translations from Crowdin
download:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Downloading translations from Crowdin..."
    cd frontend
    spin "Downloading translations..." npx crowdin download {{ CROWDIN_CONFIG }}
    style 2 "Translations downloaded."

# Show Crowdin project status
status:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    cd frontend && npx crowdin status {{ CROWDIN_CONFIG }}

# Generate pseudo-locale for i18n testing
pseudo:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Generating pseudo-locale..."
    cd frontend && node scripts/generate-pseudo-locale.mjs
    style 2 "Pseudo-locale generated."

# Run translation validation tests
test:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running translation tests..."
    cd frontend && npm run test:run -- src/test/i18n.test.ts
    style 2 "Translation tests passed."

# Extract context for ALL strings using AI (costs $$)
harvest:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Harvesting context for all strings..."
    style 11 "WARNING: This uses AI API calls - may incur costs"
    cd frontend && npx crowdin-context-harvester harvest \
        --token="$CROWDIN_PERSONAL_TOKEN" \
        --project={{ CROWDIN_PROJECT_ID }} \
        --ai=anthropic \
        --model=claude-sonnet-4-20250514 \
        --output=crowdin \
        --concurrency=2
    style 2 "Context harvested and uploaded to Crowdin."

# Extract context for strings added in last 7 days
harvest-new:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Harvesting context for new strings (last 7 days)..."
    cd frontend && npx crowdin-context-harvester harvest \
        --token="$CROWDIN_PERSONAL_TOKEN" \
        --project={{ CROWDIN_PROJECT_ID }} \
        --ai=anthropic \
        --model=claude-sonnet-4-20250514 \
        --output=crowdin \
        --since="7 days ago" \
        --concurrency=2
    style 2 "Context harvested for new strings."

# Preview context extraction (CSV output, no upload)
harvest-preview:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Previewing context harvest (dry run)..."
    cd frontend && npx crowdin-context-harvester harvest \
        --token="$CROWDIN_PERSONAL_TOKEN" \
        --project={{ CROWDIN_PROJECT_ID }} \
        --ai=anthropic \
        --model=claude-sonnet-4-20250514 \
        --output=csv \
        --concurrency=2
    style 2 "Context preview saved to CSV."

# Generate AI project description for Crowdin
describe:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Generating project description..."
    cd frontend && npx crowdin-context-harvester describe \
        --token="$CROWDIN_PERSONAL_TOKEN" \
        --project={{ CROWDIN_PROJECT_ID }} \
        --output=crowdin
    style 2 "Project description updated."
