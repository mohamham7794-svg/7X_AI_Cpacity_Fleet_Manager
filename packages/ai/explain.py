"""LLM explanation generator (§4, §6 Phase 6).

The LLM's job is prose selection/ordering — never arithmetic. All numeric
fields in ExplanationPayload come directly from structured
optimization/simulation/forecasting output. The LLM is only ever allowed to
choose which pre-computed reason strings to include and in what order (per
§4's suggested guardrail approach), never to author new sentences containing
numbers of its own. A validation guardrail rejects any output that doesn't
respect this.

Uses an OpenAI-compatible client, base URL/key from env vars
(OPENAI_BASE_URL / OPENAI_API_KEY) so it can point at any compatible
endpoint. If no endpoint is configured (or the call fails), falls back to a
deterministic "include everything in original order" selection — the
numbers are never at risk either way since they never come from the LLM.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from packages.analytics.schemas import ExplanationPayload


class ExplanationGuardrailError(Exception):
    """Raised when an explanation's content doesn't trace back to the
    structured input it was supposed to narrate (§4 requirement)."""


@dataclass
class ExplanationInputs:
    """The structured, already-computed facts the LLM is allowed to narrate.
    Every field here originates from optimization/simulation/forecasting —
    never from the LLM."""

    recommendation: str
    candidate_reasons: list[str]
    expected_savings_monthly: float
    currency: str
    confidence: float


def _select_reasons_via_llm(inputs: ExplanationInputs) -> list[str] | None:
    """Attempts to use an OpenAI-compatible chat-completions endpoint to
    choose/order candidate_reasons. Returns None (caller falls back) if no
    endpoint is configured or the call fails for any reason — LLM
    availability must never block producing a (safe, guardrailed)
    explanation."""
    base_url = os.environ.get("OPENAI_BASE_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not base_url or not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    system_prompt = (
        "You choose and order items from a fixed list of pre-written reason "
        "strings. You must return ONLY a JSON array of strings, each one "
        "copied EXACTLY (character-for-character) from the provided list, in "
        "the order you think best explains the recommendation. Do not add, "
        "remove, or alter any words or numbers. Do not include any string "
        "not present in the provided list."
    )
    user_prompt = json.dumps(
        {"recommendation": inputs.recommendation, "candidate_reasons": inputs.candidate_reasons}
    )

    try:
        client = OpenAI(base_url=base_url, api_key=api_key)
        response = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"} if False else None,
            temperature=0,
        )
        content = response.choices[0].message.content
        selected = json.loads(content)
        if not isinstance(selected, list):
            return None
        return [str(s) for s in selected]
    except Exception:
        return None


def generate_explanation(inputs: ExplanationInputs) -> ExplanationPayload:
    """Public API. Produces an ExplanationPayload, always guardrail-checked
    before returning."""
    selected = _select_reasons_via_llm(inputs)
    if selected is None:
        selected = list(inputs.candidate_reasons)

    payload = ExplanationPayload(
        recommendation=inputs.recommendation,
        reasons=selected,
        expected_savings_monthly=inputs.expected_savings_monthly,
        currency=inputs.currency,
        confidence=inputs.confidence,
    )

    try:
        validate_explanation(payload, inputs)
    except ExplanationGuardrailError:
        # Regenerate deterministically rather than surface a corrupted
        # explanation — this branch is what the guardrail test exercises.
        payload = ExplanationPayload(
            recommendation=inputs.recommendation,
            reasons=list(inputs.candidate_reasons),
            expected_savings_monthly=inputs.expected_savings_monthly,
            currency=inputs.currency,
            confidence=inputs.confidence,
        )
        validate_explanation(payload, inputs)  # must pass; raises if the fallback itself is broken

    return payload


def validate_explanation(payload: ExplanationPayload, inputs: ExplanationInputs) -> None:
    """The guardrail (§4, §6 Phase 6 — mandatory, not optional). Confirms:
      1. every reason string is verbatim one of the pre-computed candidates
         (so the LLM cannot introduce a new numeric claim by writing its
         own sentence);
      2. the numeric fields match the structured input exactly (the LLM
         never touches these fields at all in this design, but a guardrail
         should not simply trust that — it re-checks).
    Raises ExplanationGuardrailError on any violation.
    """
    candidate_set = set(inputs.candidate_reasons)
    for reason in payload.reasons:
        if reason not in candidate_set:
            raise ExplanationGuardrailError(
                f"reason not found verbatim in candidate_reasons (possible fabricated claim): {reason!r}"
            )

    if payload.expected_savings_monthly != inputs.expected_savings_monthly:
        raise ExplanationGuardrailError(
            f"expected_savings_monthly mismatch: payload={payload.expected_savings_monthly} "
            f"structured_input={inputs.expected_savings_monthly}"
        )
    if payload.confidence != inputs.confidence:
        raise ExplanationGuardrailError(
            f"confidence mismatch: payload={payload.confidence} structured_input={inputs.confidence}"
        )
    if payload.currency != inputs.currency:
        raise ExplanationGuardrailError(
            f"currency mismatch: payload={payload.currency} structured_input={inputs.currency}"
        )
