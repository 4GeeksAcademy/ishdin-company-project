from copy import deepcopy
from threading import Lock
from time import monotonic
from typing import Any


class TTLCache:
    """Small thread-safe in-process TTL cache."""

    def __init__(self) -> None:
        self._values: dict[str, tuple[float, Any]] = {}
        self._lock = Lock()

    def get(self, key: str) -> Any | None:
        now = monotonic()

        with self._lock:
            cached = self._values.get(key)

            if cached is None:
                return None

            expires_at, value = cached

            if now >= expires_at:
                self._values.pop(key, None)
                return None

            return deepcopy(value)

    def set(
        self,
        key: str,
        value: Any,
        *,
        ttl_seconds: float,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be greater than zero.")

        expires_at = monotonic() + ttl_seconds

        with self._lock:
            self._values[key] = (
                expires_at,
                deepcopy(value),
            )

    def delete(self, key: str) -> None:
        with self._lock:
            self._values.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._values.clear()


app_cache = TTLCache()