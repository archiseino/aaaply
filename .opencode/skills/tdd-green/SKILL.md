---
name: tdd-green
description: Write minimal production code to pass the failing test (Green phase of TDD)
---

## Green Phase — Make the Test Pass

Write the bare minimum production code needed to turn the failing test green.

### Rules
1. Do NOT over-engineer. Write the simplest thing that works.
2. Do NOT refactor or clean up in this phase.
3. Run the test to confirm it PASSES.
4. If it still fails, iterate until green.

### After passing
Run the full test suite to ensure no regressions:
```bash
# Backend
pytest api/tests/ -v

# Frontend
cd frontend && npx vitest run
```

### Commit
After the test passes, commit with a message like `feat: implement <feature> to pass test`.
