"""SALGA Municipal Intake Agent - Test Dashboard.

Developer testing tool for the municipal intake agent system.
Simulates WhatsApp-like conversations, allows scenario switching,
session overrides, and shows agent state in a debug panel.

This is NOT a citizen-facing application. It is a developer
tool for testing the CrewAI intake agent pipeline.

Usage:
    streamlit run streamlit_dashboard/app.py

Environment variables (optional):
    CREW_SERVER_URL      — Crew server base URL (default: http://localhost:8001)
    CREW_SERVER_API_KEY  — X-API-Key for auth (empty = dev mode, no auth)
"""
import os

import streamlit as st

from streamlit_dashboard.api_client import CrewServerClient
from streamlit_dashboard.components.chat import render_chat
from streamlit_dashboard.components.debug_panel import render_debug_panel
from streamlit_dashboard.components.sidebar import render_sidebar

# ---------------------------------------------------------------------------
# Page configuration
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="SALGA Intake Agent Tester",
    page_icon="🏛",
    layout="wide",
)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------

if "messages" not in st.session_state:
    st.session_state.messages = []

if "debug_info" not in st.session_state:
    st.session_state.debug_info = {}

if "phone" not in st.session_state:
    st.session_state.phone = ""

if "language" not in st.session_state:
    st.session_state.language = "en"

if "municipality_id" not in st.session_state:
    st.session_state.municipality_id = None

if "session_override" not in st.session_state:
    st.session_state.session_override = None

# ---------------------------------------------------------------------------
# API client (reads from env or defaults)
# ---------------------------------------------------------------------------

client = CrewServerClient(
    base_url=os.environ.get("CREW_SERVER_URL", "http://localhost:8001"),
    api_key=os.environ.get("CREW_SERVER_API_KEY", ""),
)

# ---------------------------------------------------------------------------
# Page header
# ---------------------------------------------------------------------------

st.title("SALGA Municipal Intake Agent - Test Dashboard")
st.caption("Developer testing tool — connects to live crew server at " + client.base_url)

# ---------------------------------------------------------------------------
# Layout: sidebar | chat (3 cols) | debug panel (1 col)
# ---------------------------------------------------------------------------

render_sidebar()

col1, col2 = st.columns([3, 1])

with col1:
    render_chat(client)

with col2:
    render_debug_panel()
