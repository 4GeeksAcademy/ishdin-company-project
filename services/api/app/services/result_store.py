from copy import deepcopy
from threading import Lock

from app.models.incidents import IncidentAnalysisResult


_lock = Lock()
_latest_result: IncidentAnalysisResult | None = None


def save_latest_result(result: IncidentAnalysisResult) -> None:
    """Save the most recent analysis in process memory."""
    global _latest_result

    with _lock:
        _latest_result = result.model_copy(deep=True)


def get_latest_result() -> IncidentAnalysisResult | None:
    """Return a copy of the most recent analysis, if one exists."""
    with _lock:
        if _latest_result is None:
            return None
        return _latest_result.model_copy(deep=True)


def clear_latest_result() -> None:
    """Helper mainly used by tests."""
    global _latest_result

    with _lock:
        _latest_result = None
