# Apply AUTH-088 to `error-handling-audit`

Copy this overlay into the repository root. It only adds/replaces test/configuration files; it does not replace authentication production modules.

Files to add:

- `TESTING.md`
- `services/api/tests/conftest.py` (nested test fixtures; the existing `services/api/conftest.py` remains unchanged)
- `services/api/tests/test_auth_*.py`
- `uis/backoffice/jest.config.js`
- `uis/backoffice/__tests__/auth.test.ts`

Files to update:

- `services/api/pyproject.toml`
- `services/api/requirements-dev.txt`
- `uis/backoffice/package.json`

After copying, run `npm install` in `uis/backoffice` and commit the generated `package-lock.json` change.

Then validate:

```bash
cd services/api
uv sync
uv run pytest
uv run pytest --cov=auth --cov-report=term-missing

cd ../../uis/backoffice
npm install
npx jest --coverage
```
