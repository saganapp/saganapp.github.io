# Sagan — Claude Code Instructions

## Allowed Commands

All commands go through `run.sh`, which sources nvm automatically:

```bash
./run.sh typecheck   # Type checking (npx tsc -b)
./run.sh build       # Vite production build
./run.sh lint        # ESLint
./run.sh test        # Run tests once (vitest)
./run.sh verify      # typecheck + lint + build

# Dev server
npm run dev
```

## Deployment

- **Remote:** `git@github.com:saganapp/saganapp.github.io.git` (origin)
- **Live URL:** https://saganapp.github.io
- GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on push to `main`
- OG image URLs in `index.html` use absolute `https://saganapp.github.io/og-image.png`

## README

`README.md` documents the app's architecture, design decisions, tech stack, and project structure. **Keep it updated** whenever significant changes are made (new features, new platforms, architectural changes, new analysis modules, etc.).

## GDPR example reports to test
/home/ole/gdpr_exports
