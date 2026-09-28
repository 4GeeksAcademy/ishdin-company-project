# Protect the existing Incident Analysis routes

Because incident CSV files contain sensitive customer data, protect both:

```text
POST /api/incidents/analyze
GET  /api/incidents/results/export
```

Add:

```python
from fastapi import Depends
from auth.dependencies import get_current_user
from auth.models import UserStored
```

Then add this parameter to each protected endpoint:

```python
current_user: UserStored = Depends(get_current_user)
```

No frontend changes are needed for AUTH-01. Existing frontend calls returning
401 after this change are expected until the frontend later sends the JWT.
