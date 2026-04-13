"""Tests for the circuit breaker."""
import pytest
from services.circuit_breaker import CircuitBreaker, CircuitOpenError


def test_circuit_opens_after_threshold():
    cb = CircuitBreaker("test", failure_threshold=3, cooldown_seconds=60)
    for _ in range(3):
        cb.record_failure()
    assert cb.state == "open"


def test_circuit_resets_on_success():
    cb = CircuitBreaker("test", failure_threshold=3, cooldown_seconds=60)
    cb.record_failure()
    cb.record_failure()
    cb.record_success()
    assert cb.state == "closed"


def test_decorator_raises_when_open():
    cb = CircuitBreaker("test", failure_threshold=1, cooldown_seconds=60)

    @cb
    def will_fail():
        raise ValueError("boom")

    with pytest.raises(ValueError):
        will_fail()

    assert cb.state == "open"

    with pytest.raises(CircuitOpenError):
        will_fail()


def test_decorator_passes_through_on_success():
    cb = CircuitBreaker("test", failure_threshold=3, cooldown_seconds=60)

    @cb
    def ok():
        return 42

    assert ok() == 42
    assert cb.state == "closed"
