---
name: tdd-refactor
description: Refactor code while keeping all tests green (Refactor phase of TDD)
---

## Refactor Phase — Clean Up While Green

Improve the code without changing its behavior. All tests must stay green.

### Rules
1. Run the full test suite before starting to confirm green state.
2. Make incremental refactors (rename, extract, simplify, remove duplication).
3. After each refactor step, run the relevant tests to confirm they still pass.
4. Do NOT add new features during this phase.

### Refactoring targets
- Remove duplication
- Improve naming
- Split large functions
- Add type hints / interfaces where missing
- Improve error messages
- Simplify conditional logic

### Verify
```bash
# Backend
pytest api/tests/ -v

# Frontend
cd frontend && npx vitest run
```

### Commit
After refactoring, commit with a message like `refactor: <what was improved>`.
