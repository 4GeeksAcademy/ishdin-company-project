"""
MERGE these lines into your EXISTING services/api/main.py.
Do not create a second FastAPI app.
"""

from auth.routes.auth import router as auth_router
from auth.routes.profiles import router as profiles_router
from auth.routes.users import router as users_router

# Add after: app = FastAPI(...)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(profiles_router)
