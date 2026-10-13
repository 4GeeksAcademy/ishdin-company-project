# Apply the final TrackFlow error-handling overlay

This package contains the final versions of the 32 source files changed by the error-handling work.

From the root of your `error-handling-fixes` checkout, copy the package contents over the repository while preserving paths. Do **not** copy `FINAL_ERROR_HANDLING_REPORT.md` or `APPLY_INSTRUCTIONS.md` into the repository unless you want to keep the documentation there.

After copying, run:

```bash
cd services/api
python -m pip install -r requirements-dev.txt
pytest -q

cd ../../uis/backoffice
npm install
npm run build
```

Review `FINAL_ERROR_HANDLING_REPORT.md` for the final re-audit and validation results.
