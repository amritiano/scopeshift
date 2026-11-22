# GitHub publication preparation

Source repository: https://github.com/amritiano/scopeshift. Live browser demo: https://amritiano.github.io/scopeshift/demo/. The local main branch is synchronized with the GitHub repository; the earlier local build history remains on master.

The owner created the public repository and selected GitHub Actions as the Pages source. The source was uploaded using the connected GitHub account. The workflow build job has contents:read and pages:read, and the deployment job has pages:write and id-token:write. The successful deployment run is https://github.com/amritiano/scopeshift/actions/runs/45067017204. No password or personal access token was requested or placed in source.

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
