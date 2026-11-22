# GitHub publication preparation

The repository has a local commit history. No GitHub remote or connected GitHub account was present when this deployment preparation began. Do not interpret a local commit or workflow file as a successful push or deployment.

The owner subsequently selected a new public ScopeShift repository. GitHub appeared installed, but repository access tools were not available in the current session. Account access must be usable before creating that repository, pushing source and running the prepared workflow. No password or personal access token should be pasted into chat.

## Browser demo on GitHub Pages

The `.github/workflows/pages.yml` runs on pushes to main and on manual dispatch. It runs tests and source checks, builds a whitelisted static artifact and deploys it using GitHub's Pages actions. After pushing the source, enable GitHub Actions as the Pages publishing source. If the initial run occurred before Pages was enabled, re-run “Deploy ScopeShift demo.” The run's deployment output supplies the real URL.

The build supports project subpaths such as `/scopeshift`; demo, login and workspace routes have actual index files, so refresh does not rely on a 404 redirect. Static mode skips private configuration requests. The authenticated workspace displays its setup-unavailable state. Only the browser demo is deployed; no Node server, migration, environment file or privileged database key goes into the Pages artifact.

Local artifact command, with no external packages:

```powershell
$env:PAGES_BASE_PATH='/scopeshift'
npm run build:pages
```

GitHub Pages is static hosting. Free accounts support Pages from public repositories; private repository support depends on the account's plan. The owner authorized the new public amritiano/scopeshift repository. Repository creation and Pages configuration are not exposed by the current connector; these one-time settings require the owner when browser control is unavailable.

Official references: [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Full authenticated deployment

The supplied render.yaml prepares a free Node web service. Before provisioning, confirm current provider availability and avoid paid upgrades. Set APP_ORIGIN to the resulting exact HTTPS origin, configure the Supabase URL/publishable key, apply all database migrations and complete the checks in deployment.md and release-checklist.md. No Render account or service was created by preparing this file.

The GitHub source repository and a full authenticated deployment are separate deliverables. GitHub Pages does not execute the Node backend.
