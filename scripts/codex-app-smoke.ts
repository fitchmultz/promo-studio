#!/usr/bin/env tsx
function help() {
	console.log(`Promo Studio app smoke

Usage: npm run codex:app-smoke

Manual smoke checklist for a running app:
  1. npm run setup
  2. npm run dev
  3. In a second terminal, run npm run runs:worker
  4. Sign in with demo@promostudio.test / promo-studio
  5. Create a variant from /studio
  6. Confirm /runs/<id> shows stream, preview, diff, receipt, and transcript

Exit codes:
  0  Checklist printed`);
}

help();
