# Internationalization (i18n) Workflow

This document describes how translations are managed in Maxwell's Wallet using Crowdin.

## Overview

Maxwell's Wallet uses [Crowdin](https://crowdin.com/) for translation management. Crowdin integrates with GitHub to automatically sync source strings and create pull requests with translations.

**Key principle:** Developers only edit English (`en-US.json`). All other languages are managed through Crowdin.

## Supported Locales

| Locale | Language | Status |
|--------|----------|--------|
| `en-US` | English (US) | Source |
| `en-GB` | English (UK) | Translated |
| `de-DE` | German | Translated |
| `es-ES` | Spanish | Translated |
| `fr-FR` | French | Translated |
| `it-IT` | Italian | Translated |
| `nl-NL` | Dutch | Translated |
| `pt-PT` | Portuguese | Translated |
| `aa-ER` | Afar | Translated |
| `pseudo` | Pseudo-locale | Generated (QA) |

## File Structure

```
frontend/src/messages/
├── en-US.json      # Source file - edit this
├── de-DE.json      # Crowdin managed - do not edit
├── es-ES.json      # Crowdin managed - do not edit
├── fr-FR.json      # Crowdin managed - do not edit
├── it-IT.json      # Crowdin managed - do not edit
├── nl-NL.json      # Crowdin managed - do not edit
├── pt-PT.json      # Crowdin managed - do not edit
├── en-GB.json      # Crowdin managed - do not edit
├── aa-ER.json      # Crowdin managed - do not edit
└── pseudo.json     # Auto-generated for testing
```

## Adding New Translatable Strings

### Step 1: Add to Source File

Edit `frontend/src/messages/en-US.json`:

```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a new feature",
    "button": {
      "save": "Save Changes",
      "cancel": "Cancel"
    }
  }
}
```

### Step 2: Use in Code

```tsx
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('myFeature');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('button.save')}</button>
    </div>
  );
}
```

### Step 3: Commit and Push

```bash
git add frontend/src/messages/en-US.json
git commit -m "feat: add myFeature translations"
git push origin main
```

### Step 4: Crowdin Syncs Automatically

Crowdin watches the `main` branch via GitHub integration. Within an hour (or on next sync), new strings appear in Crowdin for translators.

### Step 5: Translations Arrive via PR

When translations are complete, Crowdin creates a PR from `i18n/crowdin-sync` → `main`. Review and merge it.

## String Key Conventions

Use dot notation to organize strings hierarchically:

```
section.subsection.element

Examples:
- nav.dashboard
- transactions.filter.dateRange
- admin.backups.createButton
- common.save
- errors.notFound
```

Guidelines:
- Group by feature or page
- Use camelCase for keys
- Be descriptive but concise
- Reuse `common.*` for shared strings

## Make Commands

| Command | Description |
|---------|-------------|
| `make translate-upload` | Push `en-US.json` to Crowdin |
| `make translate-download` | Pull all translations from Crowdin |
| `make translate-status` | Show translation progress |
| `make translate-pseudo` | Generate pseudo-locale for testing |
| `make translate-harvest-new` | Generate AI context for new strings |

## Manual Sync (When Needed)

If you need translations immediately without waiting for auto-sync:

```bash
# Push new source strings
make translate-upload

# After translation in Crowdin...
make translate-download

# Commit all updated files
git add frontend/src/messages/*.json
git commit -m "chore(i18n): sync translations"
git push
```

## Handling Crowdin PRs

### Normal Flow

1. Crowdin creates PR from `i18n/crowdin-sync` → `main`
2. CI runs (skips E2E for translation-only changes)
3. Review the changes (spot check a few strings)
4. Merge the PR

### If There Are Conflicts

Conflicts occur when `main` has changes Crowdin doesn't know about (usually from incorrect direct edits).

**Option A: Rebase**
```bash
git fetch origin
git checkout i18n/crowdin-sync
git rebase origin/main
# Resolve conflicts:
# - For en-US.json: keep main's version
# - For other locales: keep Crowdin's version (incoming)
git push --force-with-lease
```

**Option B: Reset**
```bash
# Close the conflicted PR
gh pr close <PR-number>

# Delete the branch
git push origin --delete i18n/crowdin-sync

# Crowdin will recreate it on next sync
```

## Providing Context for Translators

Good context helps translators understand:
- Where the string appears in the UI
- What tone to use
- Any character limits
- Placeholders and their meaning

### AI Context Harvesting

Run after adding new strings:

```bash
make translate-harvest-new
```

This uses AI to analyze your codebase and automatically generate context descriptions for new strings in Crowdin.

> **Note:** This uses API credits. Use `--since="7 days ago"` (default) to limit scope.

### Manual Context

Add context directly in Crowdin for ambiguous strings. Examples:
- "Button text on the settings page, max 20 characters"
- "Error message when file upload fails"
- "{count} is a number, e.g., '5 items'"

## Pseudo-Locale Testing

The pseudo-locale (`pseudo.json`) transforms English text to catch i18n issues:

```
"Save" → "[Šåvé ÎñţļÐōמ]"
```

This helps identify:
- Hardcoded strings (not translated)
- Text overflow issues (pseudo is ~30% longer)
- RTL/character encoding problems

Generate it:
```bash
make translate-pseudo
```

Enable in the app by selecting "Pseudo" in language settings.

## Configuration

### Crowdin Config (`crowdin.yaml`)

```yaml
project_id: 854226
api_token_env: CROWDIN_PERSONAL_TOKEN

preserve_hierarchy: true
files:
  - source: /frontend/src/messages/en-US.json
    ignore:
      - /frontend/src/messages/pseudo.json
    translation: /frontend/src/messages/%locale%.json
```

### GitHub Integration

Crowdin uses the GitHub App integration (not a workflow file):
- Watches: `main` branch
- Creates: `i18n/crowdin-sync` branch
- Auto-syncs: ~hourly

## Troubleshooting

### "My new strings aren't in Crowdin"

1. Verify strings are in `en-US.json` and pushed to `main`
2. Wait for auto-sync (~1 hour) or run `make translate-upload`
3. Check Crowdin project for the strings

### "Translations aren't appearing in the app"

1. Check if the Crowdin PR exists and is merged
2. If not merged, review and merge it
3. Verify the locale file has the translation

### "Merge conflicts in Crowdin PR"

Someone edited a non-English locale directly. See "Handling Crowdin PRs" above.

### "Translation is wrong"

1. Do NOT fix it in the code
2. Go to Crowdin → find the string → report issue or fix it
3. Crowdin will update the PR automatically

## Related Files

- Agent: `.claude/agents/i18n-lead.mdc`
- Make targets: `make/i18n.mk`
- Config: `crowdin.yaml`
- Messages: `frontend/src/messages/CLAUDE.md`
