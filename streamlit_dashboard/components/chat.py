"""WhatsApp-style chat component for the SALGA testing dashboard.

Renders conversation history using st.chat_message, which produces
left-aligned bubbles for "assistant" and right-aligned for "user" —
matching WhatsApp's visual convention.

Key design decisions:
- Agent labels are NOT shown in the main chat view (per locked decision).
  Agent identity is visible only in the debug panel.
- Chat input is disabled until a phone number is set in the sidebar.
- Agent errors are displayed as assistant messages so the conversation
  log stays complete.
- st.rerun() is called after each response to refresh all components
  (sidebar agent state, debug panel).
"""
import streamlit as st


def render_chat(client) -> None:
    """Render the WhatsApp-style chat interface.

    Displays conversation history, handles user input, calls the crew
    server, and updates session state with the response.

    Args:
        client: CrewServerClient instance for API calls.
    """
    # ------------------------------------------------------------------
    # Display conversation history
    # ------------------------------------------------------------------

    for msg in st.session_state.messages:
        # "user" role = right-aligned bubble (WhatsApp sender style)
        # "assistant" role = left-aligned bubble (WhatsApp received style)
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # ------------------------------------------------------------------
    # Chat input (disabled until phone number is set)
    # ------------------------------------------------------------------

    if prompt := st.chat_input(
        "Type your message...",
        disabled=not st.session_state.phone,
    ):
        # Show the user message immediately
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Call the crew server
        with st.spinner("Agent is thinking..."):
            response = client.chat(
                phone=st.session_state.phone,
                message=prompt,
                language=st.session_state.language,
                municipality_id=st.session_state.get("municipality_id"),
                session_override=st.session_state.get("session_override"),
            )

        # Extract reply (no agent label in main view — label is debug-panel-only)
        reply = response.get("reply", "No response received.")

        # Add agent response to history
        st.session_state.messages.append({"role": "assistant", "content": reply})

        # Update debug info for the debug panel and sidebar agent state
        debug = response.get("debug", {})
        debug["agent_name"] = response.get("agent_name", "unknown")
        debug["session_status"] = response.get("session_status", "unknown")
        # Preserve GBV flag if present in debug
        if "is_gbv" not in debug:
            debug["is_gbv"] = response.get("agent_name") == "gbv_intake"
        st.session_state.debug_info = debug

        # Rerun to refresh all components (debug panel, sidebar agent state)
        st.rerun()

    # ------------------------------------------------------------------
    # Hint when no phone number is configured
    # ------------------------------------------------------------------

    if not st.session_state.phone:
        st.info("Enter a phone number in the sidebar to start chatting.")
