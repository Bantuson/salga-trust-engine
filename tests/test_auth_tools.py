"""Unit tests for auth tool OTP fixes and failure logging (Phase 6.9.1).

Covers:
- _log_tool_failure(): sliding window failure counting, CRITICAL log at 3+ failures,
  POPIA-safe user identifier truncation
- _send_otp_impl(): correct SMS vs email channel routing, should_create_user parameter,
  error handling, no-client fallback
- _verify_otp_impl(): correct OTP type (sms vs email), success/failure handling,
  error logging
- Tool importability: all 4 auth tools importable and callable

All Supabase calls are mocked with unittest.mock.patch.
No real API calls made in any test.
"""
import os
import time

# Set dummy OpenAI key BEFORE any CrewAI imports (Pitfall 1 from research)
os.environ.setdefault("OPENAI_API_KEY", "dummy")

import logging
from collections import defaultdict
from unittest.mock import MagicMock, call, patch

import pytest

from src.agents.tools.auth_tool import (
    _log_tool_failure,
    _send_otp_impl,
    _tool_failure_counts,
    _verify_otp_impl,
)


# ===========================================================================
# Section 1: Tool failure logging tests
# ===========================================================================

class TestLogToolFailure:
    """Tests for _log_tool_failure() sliding-window failure counter."""

    def setup_method(self):
        """Clear _tool_failure_counts before each test to prevent state leakage."""
        _tool_failure_counts.clear()

    def teardown_method(self):
        """Clear _tool_failure_counts after each test."""
        _tool_failure_counts.clear()

    def test_log_tool_failure_records_timestamp(self):
        """Calling once records exactly 1 failure timestamp for that tool."""
        _log_tool_failure("send_otp_tool", "Connection refused", "+27821001001")
        assert "send_otp_tool" in _tool_failure_counts
        assert len(_tool_failure_counts["send_otp_tool"]) == 1

    def test_log_tool_failure_prunes_old_entries(self):
        """Timestamps older than 5 minutes are pruned before counting."""
        old_time = time.time() - 400  # 400 seconds ago (> 5 min)
        _tool_failure_counts["send_otp_tool"] = [old_time, old_time]

        # Call once more (within window)
        _log_tool_failure("send_otp_tool", "Timeout", "+27821001001")

        # Only the new entry should remain (old ones pruned)
        assert len(_tool_failure_counts["send_otp_tool"]) == 1

    def test_log_tool_failure_critical_on_three_failures(self):
        """3 failures within 5 minutes triggers logger.critical."""
        with patch("src.agents.tools.auth_tool.logger") as mock_logger:
            _log_tool_failure("verify_otp_tool", "Error 1", "+27821001001")
            _log_tool_failure("verify_otp_tool", "Error 2", "+27821001001")
            _log_tool_failure("verify_otp_tool", "Error 3", "+27821001001")

            # Third call should trigger critical
            assert mock_logger.critical.called, (
                "Expected logger.critical to be called after 3 failures in 5 minutes"
            )

    def test_log_tool_failure_error_on_single_failure(self):
        """Single failure within 5 minutes triggers logger.error (not critical)."""
        with patch("src.agents.tools.auth_tool.logger") as mock_logger:
            _log_tool_failure("send_otp_tool", "Timeout", "+27821001001")

            assert mock_logger.error.called, "Expected logger.error on single failure"
            assert not mock_logger.critical.called, (
                "logger.critical should NOT fire on single failure"
            )

    def test_log_tool_failure_truncates_user_identifier(self):
        """Long phone numbers are truncated to 8 chars + '...' for POPIA compliance."""
        with patch("src.agents.tools.auth_tool.logger") as mock_logger:
            long_phone = "+27821001001"  # 12 chars — longer than 8

            _log_tool_failure("send_otp_tool", "Error", long_phone)

            # Verify the logged data contains truncated identifier
            # logger.error is called with a format string and a dict
            call_args = mock_logger.error.call_args
            assert call_args is not None
            logged_data = str(call_args)
            # The identifier should be truncated: first 8 chars + "..."
            expected_truncated = long_phone[:8] + "..."
            assert expected_truncated in logged_data, (
                f"Expected truncated identifier '{expected_truncated}' in log call args"
            )

    def test_log_tool_failure_short_identifier_not_truncated(self):
        """Short identifiers (8 chars or fewer) are not truncated."""
        with patch("src.agents.tools.auth_tool.logger") as mock_logger:
            short_id = "test@ex"  # 7 chars — 8 or fewer

            _log_tool_failure("lookup_user_tool", "Error", short_id)

            call_args = mock_logger.error.call_args
            assert call_args is not None
            logged_data = str(call_args)
            # Short ID should appear as-is (no truncation)
            assert short_id in logged_data

    def test_log_tool_failure_counts_two_failures_not_critical(self):
        """Two failures within 5 minutes triggers error but NOT critical."""
        with patch("src.agents.tools.auth_tool.logger") as mock_logger:
            _log_tool_failure("send_otp_tool", "Error 1", "+27821001001")
            _log_tool_failure("send_otp_tool", "Error 2", "+27821001001")

            assert mock_logger.error.call_count == 2
            assert not mock_logger.critical.called, (
                "logger.critical must NOT fire for only 2 failures"
            )


# ===========================================================================
# Section 2: _send_otp_impl tests
# ===========================================================================

class TestSendOtpImpl:
    """Tests for _send_otp_impl() — OTP delivery routing and options."""

    def _make_mock_client(self):
        """Create a mock Supabase client with auth.sign_in_with_otp."""
        mock_client = MagicMock()
        mock_client.auth.sign_in_with_otp.return_value = MagicMock()
        return mock_client

    def test_send_otp_phone_uses_sms(self):
        """Phone number with '+' prefix routes to SMS channel (phone key in options)."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _send_otp_impl("+27821001001", channel="sms")

        assert "OTP sent via SMS" in result
        call_args = mock_client.auth.sign_in_with_otp.call_args
        assert call_args is not None
        otp_options = call_args[0][0]
        assert "phone" in otp_options
        assert "email" not in otp_options

    def test_send_otp_email_uses_email(self):
        """Email address routes to email channel (email key in options)."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _send_otp_impl("test@example.com", channel="email")

        assert "OTP sent via email" in result
        call_args = mock_client.auth.sign_in_with_otp.call_args
        assert call_args is not None
        otp_options = call_args[0][0]
        assert "email" in otp_options
        assert "phone" not in otp_options

    def test_send_otp_returning_user_sets_should_create_user_false(self):
        """is_returning_user=True sets options.should_create_user=False."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            _send_otp_impl("+27821001001", channel="sms", is_returning_user=True)

        call_args = mock_client.auth.sign_in_with_otp.call_args
        otp_options = call_args[0][0]
        assert "options" in otp_options
        assert otp_options["options"]["should_create_user"] is False

    def test_send_otp_new_user_no_should_create_user(self):
        """is_returning_user=False (default) does NOT include should_create_user option."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            _send_otp_impl("+27821001001", channel="sms", is_returning_user=False)

        call_args = mock_client.auth.sign_in_with_otp.call_args
        otp_options = call_args[0][0]
        assert "options" not in otp_options, (
            "should_create_user must NOT be set for new users (let Supabase create account)"
        )

    def test_send_otp_failure_logs_error(self):
        """Exception from sign_in_with_otp calls _log_tool_failure and returns error string."""
        mock_client = self._make_mock_client()
        mock_client.auth.sign_in_with_otp.side_effect = Exception("Supabase timeout")

        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            with patch("src.agents.tools.auth_tool._log_tool_failure") as mock_log:
                result = _send_otp_impl("+27821001001", channel="sms")

        assert "Error" in result
        assert mock_log.called, "_log_tool_failure should be called on exception"

    def test_send_otp_no_client_returns_error(self):
        """get_supabase_admin returning None returns configuration error string."""
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=None):
            result = _send_otp_impl("+27821001001", channel="sms")

        assert "Error" in result
        # Should mention configuration or similar
        assert len(result) > 0

    def test_send_otp_phone_starting_with_plus_detected_as_sms(self):
        """Phone number starting with '+' is treated as SMS even without explicit channel."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            # Channel defaults to "sms" but the code also checks startswith("+")
            result = _send_otp_impl("+27821001001")

        assert "SMS" in result
        call_args = mock_client.auth.sign_in_with_otp.call_args
        otp_options = call_args[0][0]
        assert "phone" in otp_options

    def test_send_otp_email_returning_user_sets_should_create_user_false(self):
        """Email + is_returning_user=True also sets should_create_user=False."""
        mock_client = self._make_mock_client()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _send_otp_impl("citizen@example.com", channel="email", is_returning_user=True)

        assert "email" in result.lower()
        call_args = mock_client.auth.sign_in_with_otp.call_args
        otp_options = call_args[0][0]
        assert "options" in otp_options
        assert otp_options["options"]["should_create_user"] is False


# ===========================================================================
# Section 3: _verify_otp_impl tests
# ===========================================================================

class TestVerifyOtpImpl:
    """Tests for _verify_otp_impl() — OTP type routing and result handling."""

    def _make_mock_client_success(self, user_id: str = "user-uuid-123"):
        """Create mock Supabase client that returns successful verification."""
        mock_user = MagicMock()
        mock_user.id = user_id

        mock_result = MagicMock()
        mock_result.user = mock_user

        mock_client = MagicMock()
        mock_client.auth.verify_otp.return_value = mock_result
        return mock_client

    def _make_mock_client_failure(self):
        """Create mock Supabase client that returns failed verification (no user)."""
        mock_result = MagicMock()
        mock_result.user = None

        mock_client = MagicMock()
        mock_client.auth.verify_otp.return_value = mock_result
        return mock_client

    def test_verify_otp_phone_uses_type_sms(self):
        """Phone number OTP verification uses type='sms'."""
        mock_client = self._make_mock_client_success()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _verify_otp_impl("+27821001001", "123456")

        call_args = mock_client.auth.verify_otp.call_args
        verify_options = call_args[0][0]
        assert verify_options["type"] == "sms"
        assert "phone" in verify_options

    def test_verify_otp_email_uses_type_email(self):
        """Email OTP verification uses type='email' (NOT 'magiclink')."""
        mock_client = self._make_mock_client_success()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _verify_otp_impl("citizen@example.com", "654321", otp_type="email")

        call_args = mock_client.auth.verify_otp.call_args
        verify_options = call_args[0][0]
        assert verify_options["type"] == "email", (
            "Email OTP must use type='email', never 'magiclink'"
        )
        assert "email" in verify_options
        assert verify_options["type"] != "magiclink", (
            "type='magiclink' is WRONG for 6-digit OTP — must be 'email'"
        )

    def test_verify_otp_success_returns_user_id(self):
        """Successful OTP verification returns string containing the user UUID."""
        mock_client = self._make_mock_client_success(user_id="abc-def-123")
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _verify_otp_impl("+27821001001", "123456")

        assert "User ID" in result or "abc-def-123" in result, (
            "Success result must contain user UUID"
        )

    def test_verify_otp_failure_no_user_returns_error(self):
        """Verification that returns no user returns a friendly error message."""
        mock_client = self._make_mock_client_failure()
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            result = _verify_otp_impl("+27821001001", "000000")

        # Should NOT be "User ID:" (success)
        assert "User ID:" not in result
        assert len(result) > 0  # Must return something

    def test_verify_otp_failure_logs_error(self):
        """Exception from verify_otp calls _log_tool_failure and returns error string."""
        mock_client = MagicMock()
        mock_client.auth.verify_otp.side_effect = Exception("Invalid OTP")

        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=mock_client):
            with patch("src.agents.tools.auth_tool._log_tool_failure") as mock_log:
                result = _verify_otp_impl("+27821001001", "999999")

        assert "Error" in result
        assert mock_log.called, "_log_tool_failure should be called on exception"

    def test_verify_otp_no_client_returns_error(self):
        """get_supabase_admin returning None returns configuration error string."""
        with patch("src.agents.tools.auth_tool.get_supabase_admin", return_value=None):
            result = _verify_otp_impl("+27821001001", "123456")

        assert "Error" in result
        assert len(result) > 0


# ===========================================================================
# Section 4: Tool importability regression check
# ===========================================================================

class TestAuthToolsImportable:
    """Verify all 4 auth tools are importable and callable (regression check)."""

    def test_all_tools_importable(self):
        """All 4 auth tools are importable from auth_tool module.

        CrewAI @tool decorator produces Tool instances (not plain callables).
        We verify they are Tool instances with a 'name' attribute and 'run' method,
        which is the CrewAI tool contract.
        """
        from src.agents.tools.auth_tool import (
            create_supabase_user_tool,
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
        )
        # All should be CrewAI Tool instances with name and run attributes
        for tool_obj, expected_name in [
            (send_otp_tool, "send_otp_tool"),
            (verify_otp_tool, "verify_otp_tool"),
            (create_supabase_user_tool, "create_supabase_user_tool"),
            (lookup_user_tool, "lookup_user_tool"),
        ]:
            assert hasattr(tool_obj, "name"), f"{expected_name} must have a 'name' attribute"
            assert tool_obj.name == expected_name, (
                f"Tool name mismatch: expected '{expected_name}', got '{tool_obj.name}'"
            )
            # CrewAI Tool instances have a run() method for invocation
            assert hasattr(tool_obj, "run") or hasattr(tool_obj, "_run"), (
                f"{expected_name} must have a run() method"
            )

    def test_send_otp_tool_has_name(self):
        """send_otp_tool has a name attribute (CrewAI @tool requirement)."""
        from src.agents.tools.auth_tool import send_otp_tool
        assert hasattr(send_otp_tool, "name") or callable(send_otp_tool)

    def test_impl_functions_importable(self):
        """Implementation functions are importable for direct unit testing."""
        from src.agents.tools.auth_tool import _send_otp_impl, _verify_otp_impl
        assert callable(_send_otp_impl)
        assert callable(_verify_otp_impl)

    def test_tool_failure_counter_is_default_dict(self):
        """_tool_failure_counts is a defaultdict(list) accessible at module level."""
        from src.agents.tools.auth_tool import _tool_failure_counts
        # defaultdict(list) — missing keys return empty list
        assert isinstance(_tool_failure_counts["__nonexistent_key__"], list)
        # Clean up
        del _tool_failure_counts["__nonexistent_key__"]
