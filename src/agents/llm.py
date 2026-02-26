"""LLM factory for CrewAI agents.

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

Two factory functions:
  - get_deepseek_llm(): DeepSeek V3.2 via OpenAI-compatible API.
    Used for ALL specialist agents: Auth, Municipal Intake, Ticket Status, GBV.
    Phase 10.3 Plan 08 trajectory evals proved DeepSeek correctly follows long
    backstory prompts (150-300 lines) and Gugu persona identity. gpt-4o-mini
    failed evals: 0/3 tool calls correct with long prompts — it ignores backstory
    and tool instructions when the system prompt exceeds ~50 tokens.

  - get_routing_llm(): GPT-4o-mini.
    Used ONLY for IntakeFlow intent classification (short prompt < 50 tokens,
    no tools, simple 5-way classification). NOT used for specialist agents.

Both use lazy instantiation (new LLM per call) per CrewAI 1.x guidance —
do NOT cache LLM objects across Crew instances.

Note: OPENAI_API_KEY is read automatically by LiteLLM from environment.
"""
from crewai import LLM

from src.core.config import settings


def get_deepseek_llm() -> LLM:
    """Factory for DeepSeek V3.2 LLM.

    Used for ALL specialist agents (Auth, Municipal Intake, Ticket Status, GBV).
    DeepSeek correctly follows long backstory prompts (150-300 lines) and
    maintains the Gugu persona identity. Phase 10.3 evals confirmed: DeepSeek
    passes all 4 agent evals; gpt-4o-mini fails 3/4 (ignores backstory/tools).

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

    Used ONLY for:
    - IntakeFlow intent classification (short prompt < 50 tokens, no tools,
      simple 5-way classification: auth/municipal/ticket_status/gbv/unknown)

    NOT used for specialist agents — Phase 10.3 evals showed gpt-4o-mini
    fails with long backstory prompts (150-300 lines), ignoring Gugu persona
    and tool call instructions. Use get_deepseek_llm() for specialist agents.

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
