"""Lightweight circuit breaker — no external dependencies.

States:
  CLOSED  → calls pass through normally; failures counted.
  OPEN    → calls fail immediately with CircuitOpenError.
  HALF_OPEN → one trial call is allowed; success resets, failure reopens.
"""
import logging
import threading
import time
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitOpenError(RuntimeError):
    """Raised when a circuit breaker is open and rejecting calls."""


class CircuitBreaker:
    """Per-service circuit breaker with configurable thresholds."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        cooldown_seconds: float = 30.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

        self._lock = threading.Lock()
        self._failure_count = 0
        self._state = "closed"
        self._opened_at: float = 0.0

    @property
    def state(self) -> str:
        with self._lock:
            if self._state == "open" and (time.monotonic() - self._opened_at) >= self.cooldown_seconds:
                self._state = "half_open"
            return self._state

    def record_success(self):
        with self._lock:
            self._failure_count = 0
            if self._state != "closed":
                logger.info("Circuit '%s' reset to CLOSED", self.name)
            self._state = "closed"

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            if self._failure_count >= self.failure_threshold:
                self._state = "open"
                self._opened_at = time.monotonic()
                logger.warning(
                    "Circuit '%s' OPEN after %d consecutive failures (cooldown %.0fs)",
                    self.name, self._failure_count, self.cooldown_seconds,
                )

    def __call__(self, fn):
        """Use as a decorator: ``@breaker``."""
        @wraps(fn)
        def wrapper(*args, **kwargs):
            st = self.state
            if st == "open":
                raise CircuitOpenError(f"Circuit '{self.name}' is open — call rejected")
            try:
                result = fn(*args, **kwargs)
                self.record_success()
                return result
            except CircuitOpenError:
                raise
            except Exception:
                self.record_failure()
                raise
        return wrapper


bedrock_breaker = CircuitBreaker("bedrock", failure_threshold=5, cooldown_seconds=30)
voyage_breaker = CircuitBreaker("voyage_ai", failure_threshold=5, cooldown_seconds=30)
