"""Guardrails system for AI safety: input validation and output sanitization.

This module provides defense-in-depth for citizen-facing AI interactions:
- Input validation: prompt injection detection, HTML sanitization, length checks
- Output sanitization: PII masking (SA ID, phone, email), system info removal
- GuardrailsEngine: wraps agent calls with both input and output filtering

NOTE: This is a lightweight rule-based implementation. For production, consider
adding NeMo Guardrails or similar LLM-based guardrails as an enhancement layer.
"""
from src.guardrails.engine import GuardrailsEngine, guardrails_engine
from src.guardrails.input_filters import InputValidationResult, validate_input
from src.guardrails.output_filters import OutputSanitizationResult, sanitize_output

__all__ = [
    "GuardrailsEngine",
    "guardrails_engine",
    "InputValidationResult",
    "validate_input",
    "OutputSanitizationResult",
    "sanitize_output",
]
