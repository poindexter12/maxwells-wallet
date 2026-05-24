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

### Step 4: CI Uploads Sources to Crowdin

The **Crowdin Sync** GitHub Action (`.github/workflows/crowdin.yaml`) runs on every push to `main` that changes `en-US.json` and uploads the new source strings to Crowdin. Watch it in the **Actions** tab — unlike the old GitHub App, every sync is visible and debuggable.

### Step 5: Translations Arrive via PR

The same workflow runs weekly (Mondays 06:00 UTC) and on-demand via **Actions → Crowdin Sync → Run workflow**. It downloads completed translations and opens a PR from `l10n/crowdin` → `main`. Review and merge it.

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

## Just Recipes

| Command | Description |
|---------|-------------|
| `just i18n::upload` | Push `en-US.json` to Crowdin |
| `just i18n::download` | Pull all translations from Crowdin |
| `just i18n::status` | Show translation progress |
| `just i18n::pseudo` | Generate pseudo-locale for testing |
| `just i18n::harvest-new` | Generate AI context for new strings |

## Manual Sync (When Needed)

If you need translations immediately without waiting for auto-sync:

```bash
# Push new source strings
just i18n::upload

# After translation in Crowdin...
just i18n::download

# Commit all updated files
git add frontend/src/messages/*.json
git commit -m "chore(i18n): sync translations"
git push
```

## Handling Crowdin PRs

### Normal Flow

1. The Crowdin Sync workflow opens a PR from `l10n/crowdin` → `main`
2. CI runs (skips E2E for translation-only changes)
3. Review the changes (spot check a few strings)
4. Merge the PR

### If There Are Conflicts

Conflicts occur when `main` has changes Crowdin doesn't know about (usually from incorrect direct edits). Because the Action recreates `l10n/crowdin` from `main` on each run, the simplest fix is almost always to discard the branch and re-run the workflow:

```bash
# Close the conflicted PR and delete the branch
gh pr close <PR-number>
git push origin --delete l10n/crowdin

# Re-run: Actions → Crowdin Sync → Run workflow (download = true)
```

If you must keep the branch, rebase it on `main` — keep `main`'s version of `en-US.json`, keep Crowdin's (incoming) version of every other locale — then `git push --force-with-lease`.

## Providing Context for Translators

Good context helps translators understand:
- Where the string appears in the UI
- What tone to use
- Any character limits
- Placeholders and their meaning

### AI Context Harvesting

Run after adding new strings:

```bash
just i18n::harvest-new
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
just i18n::pseudo
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

Sync runs through the **Crowdin GitHub Action** (`.github/workflows/crowdin.yaml`). It replaces Crowdin's older **webhook/OAuth integration** — the one that authenticated as a repo user (so its commits/PRs showed up under a human account, not a `crowdin[bot]`) and silently orphaned the `i18n/crowdin-sync` branch after a history rewrite. That integration has been disconnected. The Action:
- **Push to `main`** touching `en-US.json` → uploads source strings to Crowdin.
- **Weekly schedule + manual dispatch** → downloads translations and opens a PR from `l10n/crowdin` → `main`.
- Recreates `l10n/crowdin` fresh from `main` each run, so it can't silently drift from history rewrites.

Requirements:
- Repo secret `CROWDIN_PERSONAL_TOKEN` (already set).
- Project ID `854226` lives in `crowdin.yaml`.

> **Do not reconnect Crowdin's native GitHub integration** (Project → Settings → Integrations → GitHub). Running it alongside the Action against the same project causes duplicate/competing PRs and re-introduces the branch-drift failure. The Action is the only sync path.

## Troubleshooting

### "My new strings aren't in Crowdin"

1. Verify strings are in `en-US.json` and pushed to `main`
2. Check the **Crowdin Sync** run in the Actions tab (it triggers on push to `main`), or run `just i18n::upload` locally
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
- Just recipes: `.just/i18n.just`
- Config: `crowdin.yaml`
- Messages: `frontend/src/messages/CLAUDE.md`
