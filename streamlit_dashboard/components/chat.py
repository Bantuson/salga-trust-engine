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
- Document upload simulates WhatsApp document attachment for proof of
  residence testing. Uploaded file metadata is sent as a text message.
"""
import streamlit as st


def _send_message(client, message: str) -> None:
    """Send a text message to the crew server and update session state.

    Centralises the chat→server→response→rerun cycle used by both
    typed messages and document upload notifications.

    Args:
        client: CrewServerClient instance for API calls.
        message: The message text to send.
    """
    st.session_state.messages.append({"role": "user", "content": message})

    with st.spinner("Agent is thinking..."):
        response = client.chat(
            phone=st.session_state.phone,
            message=message,
            language=st.session_state.language,
            municipality_id=st.session_state.get("municipality_id"),
            session_override=st.session_state.get("session_override"),
        )

    reply = response.get("reply", "No response received.")
    st.session_state.messages.append({"role": "assistant", "content": reply})

    debug = response.get("debug", {})
    debug["agent_name"] = response.get("agent_name", "unknown")
    debug["session_status"] = response.get("session_status", "unknown")
    if "is_gbv" not in debug:
        debug["is_gbv"] = response.get("agent_name") == "gbv_intake"
    st.session_state.debug_info = debug


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
    # Document upload (proof of residence)
    # ------------------------------------------------------------------

    if st.session_state.phone:
        uploaded_file = st.file_uploader(
            "Upload document (proof of residence)",
            type=["pdf", "png", "jpg", "jpeg"],
            key="doc_upload",
            help="Upload a proof of residence document (SA ID, utility bill, SARS letter, lease agreement)",
        )

        if uploaded_file is not None and not st.session_state.get("_last_uploaded_file") == uploaded_file.name:
            # Mark as processed to prevent re-sending on rerun
            st.session_state._last_uploaded_file = uploaded_file.name

            # Build a descriptive message the auth agent can understand
            size_kb = len(uploaded_file.getvalue()) / 1024
            doc_message = (
                f"[Document uploaded: {uploaded_file.name} "
                f"({uploaded_file.type}, {size_kb:.0f} KB) — "
                f"Proof of residence document submitted for verification]"
            )

            _send_message(client, doc_message)
            st.rerun()

    # ------------------------------------------------------------------
    # Chat input (disabled until phone number is set)
    # ------------------------------------------------------------------

    if prompt := st.chat_input(
        "Type your message...",
        disabled=not st.session_state.phone,
    ):
        # Show the user message immediately
        with st.chat_message("user"):
            st.markdown(prompt)

        _send_message(client, prompt)
        st.rerun()

    # ------------------------------------------------------------------
    # Hint when no phone number is configured
    # ------------------------------------------------------------------

    if not st.session_state.phone:
        st.info("Enter a phone number in the sidebar to start chatting.")
