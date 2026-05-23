---
name: tdd-red
description: Write a failing test first (Red phase of TDD)
---

## Red Phase — Write a Failing Test

Write a test that fails because the target code doesn't exist or doesn't behave correctly yet.

### Rules
1. Do NOT implement the production code — only write the test.
2. Choose the right framework:
   - Backend (Python): `pytest`, `pytest-asyncio`, `httpx` for API tests
   - Frontend (TypeScript): `vitest`, `@testing-library/react` for component tests
3. Run the test to confirm it FAILS before proceeding.
4. Print the failure output so the user can see it's legitimately red.

### Backend test pattern
```python
# api/tests/test_something.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.index import app

@pytest.mark.asyncio
async def test_something():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
```

### Frontend test pattern
```typescript
// frontend/src/components/__tests__/Something.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Something from '../Something';

describe('Something', () => {
  it('renders correctly', () => {
    render(<Something />);
    expect(screen.getByText('expected text')).toBeDefined();
  });
});
```

### Commit
After confirming the test fails, commit with a message like `test: add failing test for <feature>`.
