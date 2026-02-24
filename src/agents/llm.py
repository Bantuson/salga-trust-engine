"""LLM factory for CrewAI agents.

Default: gpt-4o-mini — strong tool-calling, cost-effective, reliable instruction following.
OPENAI_API_KEY is read automatically by LiteLLM from environment.

DeepSeek kept as optional fallback via get_deepseek_llm().
"""
from crewai import LLM

from src.core.config import settings


def get_crew_llm() -> LLM:
    """Factory for gpt-4o-mini LLM.

    OPENAI_API_KEY is picked up from env by LiteLLM automatically.

    Returns:
        crewai.LLM configured for gpt-4o-mini
    """
    return LLM(
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=2048,
    )


def get_deepseek_llm() -> LLM:
    """Factory for DeepSeek V3.2 LLM (legacy/fallback).

    Returns:
        crewai.LLM configured for DeepSeek V3.2 chat model
    """
    return LLM(
        model="openai/deepseek-chat",
        base_url=settings.DEEPSEEK_BASE_URL,
        api_key=settings.DEEPSEEK_API_KEY,
        temperature=0.7,
        max_tokens=2048,
    )
