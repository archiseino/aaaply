---
name: test-setup
description: Bootstrap test infrastructure — configs, fixtures, mocks, and smoke tests
---

## Test Setup — Bootstrap Test Infrastructure

Use this skill to set up or extend test infrastructure for a new module.

### Backend setup (pytest)
1. Add test dependencies to `requirements.txt`:
   ```
   pytest>=8.0
   pytest-asyncio>=0.24
   pytest-cov>=5.0
   httpx>=0.27
   ```
2. Create `api/tests/conftest.py` with shared fixtures:
   - `async_client` — FastAPI test client via `httpx.AsyncClient` + `ASGITransport`
   - `mock_gemini` — monkeypatch `google.generativeai` calls
   - `mock_supabase` — monkeypatch supabase service calls
3. Create `api/tests/test_*.py` for each module.

### Frontend setup (vitest)
1. Add dev dependencies:
   ```
   vitest @testing-library/react @testing-library/jest-dom jsdom
   ```
2. Create `frontend/vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/setupTests.ts'],
       globals: true,
     },
   });
   ```
3. Create `frontend/src/setupTests.ts`:
   ```typescript
   import '@testing-library/jest-dom';
   ```
4. Add `"test": "vitest"` to `frontend/package.json` scripts.

### Verify setup works
```bash
# Backend
pytest api/tests/ -v

# Frontend
cd frontend && npx vitest run
```
