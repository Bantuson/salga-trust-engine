"""LLM factory for CrewAI agents.

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

Two factory functions:
  - get_deepseek_llm(): DeepSeek V3.2 via OpenAI-compatible API.
    Used for conversation-heavy specialist agents (Municipal Intake, GBV).
    Weaker at structured tool use — avoid for multi-tool-call agents.

  - get_routing_llm(): GPT-4o-mini.
    Used for tool-heavy agents (Auth, Ticket Status) and Flow intent
    classification. Reliable structured tool use.

Both use lazy instantiation (new LLM per call) per CrewAI 1.x guidance —
do NOT cache LLM objects across Crew instances.

Note: OPENAI_API_KEY is read automatically by LiteLLM from environment.
"""
from crewai import LLM

from src.core.config import settings


def get_deepseek_llm() -> LLM:
    """Factory for DeepSeek V3.2 LLM.

    Suitable for conversation-heavy specialist agents (Municipal Intake, GBV)
    where tool use is minimal (single tool call at conversation end).

    Returns:
        crewai.LLM configured for DeepSeek V3.2 chat via OpenAI-compatible API
    """
    return LLM(
        model="deepseek/deepseek-chat",
        base_url=settings.DEEPSEEK_BASE_URL,
        api_key=settings.DEEPSEEK_API_KEY,
        temperature=0.7,
        max_tokens=2048,
    )


def get_routing_llm() -> LLM:
    """Factory for GPT-4o-mini LLM.

    Used for:
    - Auth agent (multiple sequential tool calls: lookup_user, send_otp, verify_otp)
    - Ticket Status agent (lookup_ticket tool call)
    - Flow intent classification step (direct LLM.call() for routing)

    OPENAI_API_KEY is picked up from env by LiteLLM automatically.

    Returns:
        crewai.LLM configured for gpt-4o-mini
    """
    return LLM(
        model="gpt-4o-mini",
        api_key=settings.OPENAI_API_KEY,
        temperature=0.7,
        max_tokens=2048,
    )
