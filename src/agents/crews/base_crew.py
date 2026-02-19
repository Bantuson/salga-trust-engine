"""BaseCrew — shared foundation for all CrewAI specialist crews."""
import asyncio
import json
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import yaml
from crewai import Agent, Crew, Process, Task
from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Shared Pydantic output model
# ---------------------------------------------------------------------------

class AgentResponse(BaseModel):
    """Base structured output model shared by all specialist crews."""
    message: str                     # Clean citizen-facing text
    language: str = "en"            # "en" | "zu" | "af"
    action_taken: str = "unknown"   # Crew-specific action identifier
    requires_followup: bool = False
    tracking_number: str | None = None
    raw_output: str | None = None   # Debug only, never citizen-facing

    @field_validator("message")
    @classmethod
    def strip_artifacts(cls, v: str) -> str:
        """Strip LLM artifacts from message field if present."""
        final_match = re.search(r"Final Answer:?\s*(.+)", v, re.DOTALL | re.IGNORECASE)
        if final_match:
            return final_match.group(1).strip()
        return v.strip()

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        return v if v in ("en", "zu", "af") else "en"


# ---------------------------------------------------------------------------
# Shared repair strategy
# ---------------------------------------------------------------------------

def _repair_from_raw(raw: str, model_class, fallback_message: str, language: str = "en") -> dict:
    """Attempt to extract model fields from raw LLM output when Pydantic conversion fails.

    Two-step repair:
    1. Try JSON regex extraction -> validate with model_class
    2. Try Final Answer extraction -> build minimal valid model
    3. If both fail: return hardcoded safe fallback (never crashes)
    """
    # Step 1: Extract JSON object if present
    json_match = re.search(r'\{[^{}]*"message"[^{}]*\}', raw, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            return model_class(**data).model_dump()
        except Exception:
            pass

    # Step 2: Extract text after "Final Answer:" marker
    final_match = re.search(r"Final Answer:?\s*(.+)", raw, re.DOTALL | re.IGNORECASE)
    extracted_msg = final_match.group(1).strip() if final_match else raw.strip()

    # Step 3: Build minimal valid model from extracted text
    try:
        return model_class(
            message=extracted_msg or fallback_message,
            language=language,
        ).model_dump()
    except Exception:
        # Final fallback: dict that always works (never fails)
        return {
            "message": fallback_message,
            "language": language,
            "action_taken": "error",
            "requires_followup": False,
            "raw_output": raw[:500] if raw else None,
        }


# ---------------------------------------------------------------------------
# BaseCrew
# ---------------------------------------------------------------------------

class BaseCrew(ABC):
    """Abstract base for specialist crews.

    Consolidates: YAML config loading, language validation, lazy LLM init,
    agent/task construction from YAML, async kickoff pattern, result parsing.

    Subclasses MUST define:
        agent_key: str          — key in agents.yaml (e.g. "auth_agent")
        task_key: str           — key in tasks.yaml (e.g. "auth_task")
        tools: list             — CrewAI tool instances for the agent
        memory_enabled: bool    — False for PII-sensitive crews (auth, gbv)

    Subclasses MAY override:
        get_language_prompt(language) — return language-specific backstory extension
        build_task_description(context) — custom task description building
        build_task_kwargs(context) — extra Task() kwargs (e.g. output_pydantic)
        build_kickoff_inputs(context) — dict of inputs passed to crew.kickoff()
        parse_result(result) — custom result extraction from CrewAI output
        get_error_response(error) — custom error dict
    """

    # --- Subclass MUST define these ---
    agent_key: str
    task_key: str
    tools: list
    memory_enabled: bool = False  # Safe default: disabled

    def __init__(self, language: str = "en", llm=None):
        self.language = language if language in ("en", "zu", "af") else "en"
        self._llm = llm  # Lazy: resolved in create_crew() if None

        # Load YAML configs ONCE
        config_dir = Path(__file__).parent.parent / "config"
        with open(config_dir / "agents.yaml", "r", encoding="utf-8") as f:
            self.agents_config = yaml.safe_load(f)
        with open(config_dir / "tasks.yaml", "r", encoding="utf-8") as f:
            self.tasks_config = yaml.safe_load(f)

    @property
    def llm(self):
        """Lazy LLM resolution — avoids circular imports, supports test fakes."""
        if self._llm is None:
            from src.agents.llm import get_deepseek_llm
            self._llm = get_deepseek_llm()
        return self._llm

    def get_language_prompt(self, language: str) -> str:
        """Return language-specific backstory extension. Override in subclass."""
        return ""

    def build_task_description(self, context: dict) -> str:
        """Build task description from YAML template + context.

        Default: format task_key template with context dict.
        Override for custom building (e.g. AuthCrew uses build_auth_task_description).
        """
        task_config = self.tasks_config[self.task_key]
        return task_config["description"].format(**context)

    def build_task_kwargs(self, context: dict) -> dict:
        """Extra kwargs for Task() constructor. Override to add output_pydantic etc."""
        return {}

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Dict of inputs passed to crew.kickoff(). Override for custom mapping."""
        return context

    def parse_result(self, result) -> dict[str, Any]:
        """Parse CrewAI result. Tries Pydantic model first, then regex fallback."""
        # Pydantic path: if result has .pydantic and it's not None
        if hasattr(result, "pydantic") and result.pydantic is not None:
            model_dict = result.pydantic.model_dump()
            model_dict["raw_output"] = str(result)
            return model_dict

        # Existing regex fallback
        raw = str(result)
        final = re.search(r"Final Answer:?\s*(.+)", raw, re.DOTALL | re.IGNORECASE)
        clean_message = final.group(1).strip() if final else raw
        tracking_match = re.search(r"TKT-\d{8}-[A-F0-9]{6}", raw)
        json_match = re.search(r"\{[^{}]*\"tracking_number\"[^{}]*\}", raw)

        if json_match:
            try:
                ticket_dict = json.loads(json_match.group())
                ticket_dict["message"] = clean_message
                ticket_dict["raw_output"] = raw
                return ticket_dict
            except json.JSONDecodeError:
                pass

        if tracking_match:
            return {
                "tracking_number": tracking_match.group(),
                "message": clean_message,
                "raw_output": raw,
            }
        return {"message": clean_message, "raw_output": raw}

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Error response dict. Override for crew-specific error messages."""
        return {"error": str(error), "message": "Something went wrong. Please try again."}

    def create_crew(self, context: dict) -> Crew:
        """Build Agent + Task + Crew from YAML config + context."""
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        agent_config = self.agents_config[self.agent_key]
        role = agent_config["role"]
        goal = agent_config["goal"].format(language=language)
        yaml_backstory = agent_config["backstory"]

        # Combine YAML identity + language-specific operational prompt
        language_prompt = self.get_language_prompt(language)
        backstory = yaml_backstory + "\n\n" + language_prompt if language_prompt else yaml_backstory

        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=self.tools,
            llm=self.llm,
            allow_delegation=agent_config.get("allow_delegation", False),
            max_iter=agent_config.get("max_iter", 3),
            verbose=agent_config.get("verbose", False),
        )

        task_description = self.build_task_description(context)
        expected_output = self.tasks_config[self.task_key]["expected_output"]

        task_kwargs = {
            "description": task_description,
            "expected_output": expected_output,
            "agent": agent,
            **self.build_task_kwargs(context),
        }
        task = Task(**task_kwargs)

        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            memory=self.memory_enabled,
            verbose=False,
        )
        return crew

    async def kickoff(self, context: dict) -> dict[str, Any]:
        """Run crew asynchronously via thread pool executor."""
        try:
            crew = self.create_crew(context)
            inputs = self.build_kickoff_inputs(context)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: crew.kickoff(inputs=inputs)
            )
            return self.parse_result(result)
        except Exception as e:
            return self.get_error_response(e)
