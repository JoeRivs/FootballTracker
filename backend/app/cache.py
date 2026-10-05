"""Tiny async-friendly TTL cache so we don't hammer ESPN on every request."""
import time
from typing import Any, Callable, Awaitable

_store: dict[str, tuple[float, Any]] = {}


async def cached(key: str, ttl: int, producer: Callable[[], Awaitable[Any]]) -> Any:
    now = time.time()
    hit = _store.get(key)
    if hit and hit[0] > now:
        return hit[1]
    value = await producer()
    _store[key] = (now + ttl, value)
    return value


def invalidate(prefix: str = "") -> int:
    keys = [k for k in _store if k.startswith(prefix)]
    for k in keys:
        _store.pop(k, None)
    return len(keys)
