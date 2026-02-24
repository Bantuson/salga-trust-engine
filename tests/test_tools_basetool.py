"""Verify all 7 tools are BaseTool instances with correct schemas.

Tests cover:
- Each tool is isinstance(BaseTool)
- tool.name matches expected string exactly
- tool.args_schema is a valid Pydantic model
- Required fields raise ValidationError when missing
"""
import os

os.environ.setdefault("OPENAI_API_KEY", "dummy")

import pytest
from crewai.tools import BaseTool
from pydantic import ValidationError

from src.agents.tools.auth_tool import (
    SendOtpTool,
    VerifyOtpTool,
    CreateSupabaseUserTool,
    LookupUserTool,
    send_otp_tool,
    verify_otp_tool,
    create_supabase_user_tool,
    lookup_user_tool,
)
from src.agents.tools.ticket_tool import (
    CreateMunicipalTicketTool,
    create_municipal_ticket,
)
from src.agents.tools.saps_tool import (
    NotifySapsTool,
    notify_saps,
)
from src.agents.tools.ticket_lookup_tool import (
    LookupTicketTool,
    lookup_ticket,
)


# ---------------------------------------------------------------------------
# Parametrized: all 7 tools
# ---------------------------------------------------------------------------

ALL_TOOLS = [
    (send_otp_tool, "send_otp_tool", SendOtpTool),
    (verify_otp_tool, "verify_otp_tool", VerifyOtpTool),
    (create_supabase_user_tool, "create_supabase_user_tool", CreateSupabaseUserTool),
    (lookup_user_tool, "lookup_user_tool", LookupUserTool),
    (create_municipal_ticket, "create_municipal_ticket", CreateMunicipalTicketTool),
    (notify_saps, "notify_saps", NotifySapsTool),
    (lookup_ticket, "lookup_ticket", LookupTicketTool),
]


@pytest.mark.parametrize("tool_instance,expected_name,tool_class", ALL_TOOLS,
                         ids=[t[1] for t in ALL_TOOLS])
class TestBaseToolMigration:
    """Verify each tool is a proper BaseTool with correct schema."""

    def test_is_basetool_instance(self, tool_instance, expected_name, tool_class):
        assert isinstance(tool_instance, BaseTool), (
            f"{expected_name} must be a BaseTool instance, got {type(tool_instance)}"
        )

    def test_name_matches(self, tool_instance, expected_name, tool_class):
        assert tool_instance.name == expected_name

    def test_has_args_schema(self, tool_instance, expected_name, tool_class):
        assert tool_instance.args_schema is not None, f"{expected_name} must have args_schema"
        schema = tool_instance.args_schema.model_json_schema()
        assert "properties" in schema, f"{expected_name} schema must have properties"

    def test_has_run_method(self, tool_instance, expected_name, tool_class):
        assert hasattr(tool_instance, "_run"), f"{expected_name} must have _run method"


# ---------------------------------------------------------------------------
# Specific schema validation tests
# ---------------------------------------------------------------------------

class TestSendOtpSchema:
    def test_required_field_phone_or_email(self):
        from src.agents.tools.auth_tool import SendOtpInput
        with pytest.raises(ValidationError):
            SendOtpInput()  # phone_or_email is required

    def test_defaults(self):
        from src.agents.tools.auth_tool import SendOtpInput
        inp = SendOtpInput(phone_or_email="+27821001001")
        assert inp.channel == "sms"
        assert inp.is_returning_user is False


class TestVerifyOtpSchema:
    def test_required_fields(self):
        from src.agents.tools.auth_tool import VerifyOtpInput
        with pytest.raises(ValidationError):
            VerifyOtpInput()  # phone_or_email and otp_code are required

    def test_defaults(self):
        from src.agents.tools.auth_tool import VerifyOtpInput
        inp = VerifyOtpInput(phone_or_email="+27821001001", otp_code="123456")
        assert inp.otp_type == "sms"


class TestCreateUserSchema:
    def test_required_fields(self):
        from src.agents.tools.auth_tool import CreateUserInput
        with pytest.raises(ValidationError):
            CreateUserInput()  # phone_or_email, full_name, tenant_id required

    def test_defaults(self):
        from src.agents.tools.auth_tool import CreateUserInput
        inp = CreateUserInput(
            phone_or_email="+27821001001",
            full_name="Test User",
            tenant_id="tenant-123",
        )
        assert inp.preferred_language == "en"
        assert inp.residence_verified is False
        assert inp.secondary_contact == ""
        assert inp.address == ""


class TestLookupUserSchema:
    def test_required_field(self):
        from src.agents.tools.auth_tool import LookupUserInput
        with pytest.raises(ValidationError):
            LookupUserInput()  # phone_or_email required


class TestCreateTicketSchema:
    def test_required_fields(self):
        from src.agents.tools.ticket_tool import CreateTicketInput
        with pytest.raises(ValidationError):
            CreateTicketInput()  # category, description, user_id, tenant_id, language required

    def test_defaults(self):
        from src.agents.tools.ticket_tool import CreateTicketInput
        inp = CreateTicketInput(
            category="water",
            description="Pipe burst on Main Street",
            user_id="user-123",
            tenant_id="tenant-456",
            language="en",
        )
        assert inp.severity == "medium"
        assert inp.latitude is None
        assert inp.longitude is None
        assert inp.address is None


class TestNotifySapsSchema:
    def test_required_fields(self):
        from src.agents.tools.saps_tool import NotifySapsInput
        with pytest.raises(ValidationError):
            NotifySapsInput()  # all fields required


class TestLookupTicketSchema:
    def test_required_field(self):
        from src.agents.tools.ticket_lookup_tool import LookupTicketInput
        with pytest.raises(ValidationError):
            LookupTicketInput()  # user_id required

    def test_defaults(self):
        from src.agents.tools.ticket_lookup_tool import LookupTicketInput
        inp = LookupTicketInput(user_id="user-123")
        assert inp.tracking_number == ""
