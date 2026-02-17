"""HTTP client for the SALGA crew server.

Provides a synchronous httpx-based client that wraps the crew server REST API.
Streamlit uses a synchronous execution model — async clients are not compatible.

Crew server API contract:
    GET  /api/v1/health          — Server status check
    POST /api/v1/chat            — Intake: phone detection + agent routing
    POST /api/v1/session/reset   — Clear conversation state for a phone number

All error cases return a synthetic dict matching the ChatResponse structure,
so callers never need to handle exceptions separately.
"""
from dataclasses import dataclass, field

import httpx


# ---------------------------------------------------------------------------
# Error reply constants (match ChatResponse keys so callers don't need guards)
# ---------------------------------------------------------------------------

_ERR_BASE: dict = {
    "agent_name": "error",
    "session_status": "error",
    "debug": {},
}


def _error_response(reply: str) -> dict:
    """Build a synthetic ChatResponse-shaped error dict."""
    return {**_ERR_BASE, "reply": reply}


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

@dataclass
class CrewServerClient:
    """Synchronous HTTP client for the SALGA crew server.

    Uses httpx in synchronous mode — Streamlit's execution model is synchronous
    and does not support async coroutines at the top level.

    Args:
        base_url: Base URL of the crew server (default: http://localhost:8001).
        api_key:  Optional X-API-Key value. Empty string = dev mode (no auth).
        timeout:  Request timeout in seconds. LLM calls can take 30-60s.
    """

    base_url: str = "http://localhost:8001"
    api_key: str = ""
    timeout: float = 120.0  # LLM calls via CrewAI can be slow

    def _headers(self) -> dict:
        """Build request headers including optional X-API-Key.

        Returns:
            Dict of HTTP headers for JSON requests.
        """
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def chat(
        self,
        phone: str,
        message: str,
        language: str = "en",
        municipality_id: str | None = None,
        session_override: str | None = None,
    ) -> dict:
        """Send a chat message to the crew server.

        Routes to the appropriate agent based on phone detection:
        - Active session  -> municipal or GBV intake agent
        - New/expired     -> auth agent (registration / OTP re-auth)

        Args:
            phone:             Citizen phone number (E.164 format recommended).
            message:           The message text to send.
            language:          Language hint (en / zu / af).
            municipality_id:   Optional municipality UUID for multi-tenant routing.
            session_override:  Test-mode override: "new" | "expired" | None.

        Returns:
            ChatResponse dict with keys: reply, agent_name, session_status, debug.
            On error, returns synthetic dict with reply describing the error.
        """
        payload: dict = {
            "phone": phone,
            "message": message,
            "language": language,
        }
        if municipality_id:
            payload["municipality_id"] = municipality_id
        if session_override:
            payload["session_override"] = session_override

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.base_url}/api/v1/chat",
                    json=payload,
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError:
            return _error_response(
                "Crew server not running. Start with: uvicorn src.api.v1.crew_server:crew_app --port 8001"
            )
        except httpx.TimeoutException:
            return _error_response(
                "Request timed out. The LLM may be slow — try again."
            )
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            return _error_response(f"Server error: {status_code}")
        except Exception as exc:
            return _error_response(f"Unexpected error: {exc}")

    def reset_session(self, phone: str) -> dict:
        """Reset the conversation session for a phone number.

        Clears conversation history from Redis for both municipal and GBV
        namespaces. Used by the Reset Conversation button in the sidebar.

        Args:
            phone: Phone number whose conversation state should be cleared.

        Returns:
            Dict with success/error status from the server.
        """
        payload = {"phone": phone}

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/api/v1/session/reset",
                    json=payload,
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError:
            return {"success": False, "error": "Crew server not running."}
        except httpx.TimeoutException:
            return {"success": False, "error": "Reset request timed out."}
        except httpx.HTTPStatusError as exc:
            return {"success": False, "error": f"Server error: {exc.response.status_code}"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def health(self) -> dict:
        """Check crew server health.

        Does NOT make an LLM API call — only confirms the server is running
        and whether DEEPSEEK_API_KEY is configured.

        Returns:
            HealthResponse dict: {status, deepseek_configured, version}.
            On error, returns {status: "error", deepseek_configured: False, version: "unknown"}.
        """
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(
                    f"{self.base_url}/api/v1/health",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()

        except httpx.ConnectError:
            return {
                "status": "error",
                "deepseek_configured": False,
                "version": "unknown",
                "error": "Crew server not running.",
            }
        except Exception as exc:
            return {
                "status": "error",
                "deepseek_configured": False,
                "version": "unknown",
                "error": str(exc),
            }
