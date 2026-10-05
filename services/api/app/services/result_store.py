from threading import Lock

from app.models.incidents import IncidentAnalysisResult


_lock = Lock()
_latest_result: tuple[int, IncidentAnalysisResult] | None = None


def save_latest_result(result: IncidentAnalysisResult, owner_id: int) -> None:
    """Save the most recent analysis in process memory."""
    global _latest_result

    with _lock:
        _latest_result = (owner_id, result.model_copy(deep=True))


def get_latest_result() -> tuple[int, IncidentAnalysisResult] | None:
    """Return an atomic owner/result snapshot, if one exists."""
    with _lock:
        if _latest_result is None:
            return None
        owner_id, result = _latest_result
        return owner_id, result.model_copy(deep=True)


def clear_latest_result() -> None:
    """Helper mainly used by tests."""
    global _latest_result

    with _lock:
        _latest_result = None
