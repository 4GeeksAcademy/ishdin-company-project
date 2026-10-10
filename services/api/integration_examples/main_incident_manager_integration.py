"""
Merge these lines into the EXISTING services/api/main.py.

Do not create a second FastAPI application.
"""

from services.api.incidents.routes import router as incident_manager_router

# IMPORTANT:
# If the older CSV analyzer router still exposes static routes such as
# /api/incidents/results/export, include that legacy router BEFORE this new
# Incident Manager router because this manager also has /api/incidents/{id}.
#
# Example:
# app.include_router(existing_incident_analyzer_router)
app.include_router(incident_manager_router)
