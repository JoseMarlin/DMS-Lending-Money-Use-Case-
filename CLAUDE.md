Read `PROJECT_OVERVIEW.md` in full before doing anything. It is the single source of truth for scope, data model, rules, workflow, demo data and build order.

Working rules, in short:

- Build only the step I name. Do not build ahead.
- Everything is mocked and front-end only. No backend, no real APIs.
- Dummy data only. Aadhaar is always masked.
- Match the DMS+ look from `/design`. Ask if a reference is missing.
- Use the exact field names, statuses and DocType names from the overview.
- After each step, stop and wait for my review.
