"""Agent debug panel for the SALGA testing dashboard.

Displays agent internals from the last crew server response:
- Current agent name (auth_agent / municipal_intake / gbv_intake / error)
- Session status with colour indicator
- Conversation turn count
- Raw debug JSON (collapsed expander)

GBV SAFETY: When the current agent is gbv_intake or debug["is_gbv"] is True,
the raw debug data is REDACTED. Only metadata (agent_name, session_status,
turn_count, is_gbv) is shown. Conversation content is NEVER displayed in the
debug panel for GBV scenarios (per Pitfall 6 and the locked GBV firewall).

This panel is right-side column in the main layout (1 of 4 columns).
"""
import streamlit as st


# Colour indicators for session_status values
_STATUS_COLOUR = {
    "active": "green",
    "created": "green",
    "expired": "orange",
    "none": "red",
    "error": "red",
}

# Emoji dot for status (fallback to grey)
_STATUS_DOT = {
    "active": "🟢",
    "created": "🟢",
    "expired": "🟡",
    "none": "🔴",
    "error": "🔴",
}


def render_debug_panel() -> None:
    """Render the agent debug panel in the right column.

    Reads from st.session_state.debug_info which is populated after
    each chat response in chat.py.
    """
    st.subheader("Debug Panel")

    debug: dict = st.session_state.get("debug_info", {})

    if not debug:
        st.caption("Send a message to see debug info.")
        return

    # ------------------------------------------------------------------
    # Current agent
    # ------------------------------------------------------------------

    agent_name: str = debug.get("agent_name", "unknown")
    st.metric("Current Agent", agent_name)

    # ------------------------------------------------------------------
    # Session status with colour indicator
    # ------------------------------------------------------------------

    session_status: str = debug.get("session_status", "unknown")
    dot = _STATUS_DOT.get(session_status, "⚪")
    st.metric("Session Status", f"{dot} {session_status}")

    # ------------------------------------------------------------------
    # Conversation turn count
    # ------------------------------------------------------------------

    turn_count: int = debug.get("turn_count", len(st.session_state.messages))
    st.metric("Conversation Turns", turn_count)

    st.divider()

    # ------------------------------------------------------------------
    # Raw debug data (GBV content REDACTED)
    # ------------------------------------------------------------------

    with st.expander("Raw Debug Data", expanded=False):
        is_gbv: bool = debug.get("is_gbv", False) or agent_name == "gbv_intake"

        if is_gbv:
            st.warning("GBV content redacted for privacy")
            # Only show safe metadata — NEVER show conversation content
            safe_debug = {
                k: v
                for k, v in debug.items()
                if k in ("agent_name", "session_status", "turn_count", "is_gbv")
            }
            st.json(safe_debug)
        else:
            st.json(debug)
