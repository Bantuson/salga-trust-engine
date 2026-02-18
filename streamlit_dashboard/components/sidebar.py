"""Test controls sidebar for the SALGA testing dashboard.

Provides developer controls for configuring test scenarios:
- Phone number input (E.164 format, +27821234567)
- Language selector (EN / isiZulu / Afrikaans)
- Municipality ID (UUID free text)
- Session override (auto-detect / expired / new)
- Scenario presets (Municipal / GBV)
- Reset Conversation button
- Agent State viewer (shows debug JSON from last response)

This sidebar is developer-focused — it exposes internals that would never
be shown to citizens (session state, agent routing, debug JSON).
"""
import streamlit as st


def render_sidebar() -> None:
    """Render the test controls sidebar."""
    with st.sidebar:
        st.header("Test Controls")

        # ------------------------------------------------------------------
        # Phone number input
        # ------------------------------------------------------------------

        phone = st.text_input(
            "Phone Number",
            value=st.session_state.phone,
            placeholder="+27821234567",
            help="South African phone number in E.164 format (e.g. +27821234567)",
        )
        if phone != st.session_state.phone:
            st.session_state.phone = phone

        st.divider()

        # ------------------------------------------------------------------
        # Language selector
        # ------------------------------------------------------------------

        language_options = ["en", "zu", "af"]
        language_labels = {"en": "English", "zu": "isiZulu", "af": "Afrikaans"}

        current_lang_index = language_options.index(st.session_state.language)
        language = st.selectbox(
            "Language",
            language_options,
            format_func=lambda x: language_labels[x],
            index=current_lang_index,
            help="Language hint sent to the crew server. Agent may detect a different language.",
        )
        st.session_state.language = language

        # ------------------------------------------------------------------
        # Municipality picker (free text — UUID)
        # ------------------------------------------------------------------

        municipality_id = st.text_input(
            "Municipality ID (UUID)",
            value=st.session_state.get("municipality_id") or "",
            help="UUID of target municipality for multi-tenant routing. Leave blank for default.",
        )
        st.session_state.municipality_id = municipality_id or None

        st.divider()

        # ------------------------------------------------------------------
        # Session override (test mode)
        # ------------------------------------------------------------------

        session_options = [None, "expired", "new"]
        session_override = st.selectbox(
            "Session Override",
            session_options,
            format_func=lambda x: x or "Auto-detect",
            help=(
                "Override phone detection for testing without a real database.\n\n"
                "- Auto-detect: real DB lookup\n"
                "- new: treat as unregistered user (full registration flow)\n"
                "- expired: treat as registered user with expired session (OTP re-auth)"
            ),
        )
        st.session_state.session_override = session_override

        # ------------------------------------------------------------------
        # Scenario presets
        # ------------------------------------------------------------------

        st.subheader("Scenario Presets")
        st.caption("Pre-fill the chat with a test scenario message.")

        col1, col2 = st.columns(2)

        with col1:
            if st.button("Municipal", use_container_width=True):
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "There is a water pipe burst on Main Street, Braamfontein",
                    }
                ]
                st.rerun()

        with col2:
            if st.button("GBV", use_container_width=True, type="secondary"):
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "I need help, my partner is threatening me",
                    }
                ]
                st.rerun()

        # ── Manager flow presets (Phase 6.9) ──────────────────────────────

        st.caption("Manager routing scenarios (Phase 6.9):")

        col3, col4 = st.columns(2)

        with col3:
            if st.button(
                "Ticket Status",
                use_container_width=True,
                help="Tests ticket status lookup via manager routing. Requires active session.",
            ):
                st.session_state.session_override = "active"
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "I want to check on my water leak report",
                    }
                ]
                st.rerun()

        with col4:
            if st.button(
                "Greeting",
                use_container_width=True,
                help="Tests manager greeting for generic hello. Uses new user session.",
            ):
                st.session_state.session_override = "new"
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "Hi",
                    }
                ]
                st.rerun()

        col5, col6 = st.columns(2)

        with col5:
            if st.button(
                "Off-topic",
                use_container_width=True,
                help="Tests manager off-topic warm redirect. Active session.",
            ):
                st.session_state.session_override = "active"
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "What is the weather today?",
                    }
                ]
                st.rerun()

        with col6:
            if st.button(
                "Intent+Auth",
                use_container_width=True,
                help="Tests pending_intent preservation through auth. New user session.",
            ):
                st.session_state.session_override = "new"
                st.session_state.messages = [
                    {
                        "role": "user",
                        "content": "I need to report a water leak on Main Street",
                    }
                ]
                st.rerun()

        st.divider()

        # ------------------------------------------------------------------
        # Reset Conversation button
        # ------------------------------------------------------------------

        if st.button("Reset Conversation", type="primary", use_container_width=True):
            st.session_state.messages = []
            st.session_state.debug_info = {}

            # Also reset session on the server side if phone is set
            if st.session_state.phone:
                from streamlit_dashboard.api_client import CrewServerClient

                reset_client = CrewServerClient(
                    base_url=__import__("os").environ.get(
                        "CREW_SERVER_URL", "http://localhost:8001"
                    ),
                    api_key=__import__("os").environ.get("CREW_SERVER_API_KEY", ""),
                )
                result = reset_client.reset_session(st.session_state.phone)
                if not result.get("success", True):
                    st.warning(f"Server reset warning: {result.get('error', 'unknown')}")

            st.rerun()

        st.divider()

        # ------------------------------------------------------------------
        # Agent State viewer
        # ------------------------------------------------------------------

        st.subheader("Agent State")

        if st.session_state.debug_info:
            st.json(st.session_state.debug_info)
        else:
            st.caption("No agent activity yet.")
