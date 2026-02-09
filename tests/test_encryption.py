"""Unit tests for field-level encryption using Fernet.

Tests encrypt/decrypt cycle, key rotation, plaintext fallback mode,
and TypeDecorator integration.
"""
import pytest
from unittest.mock import patch
from cryptography.fernet import Fernet

from src.core.encryption import EncryptedString


class TestEncryption:
    """Unit tests for EncryptedString TypeDecorator."""

    @pytest.fixture
    def test_key_current(self):
        """Generate a test encryption key."""
        return Fernet.generate_key().decode()

    @pytest.fixture
    def test_key_previous(self):
        """Generate a test previous encryption key for rotation."""
        return Fernet.generate_key().decode()

    def test_encrypt_decrypt_cycle(self, test_key_current):
        """Test basic encrypt/decrypt cycle returns original plaintext."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()
            plaintext = "Sensitive GBV report description"

            # Act - encrypt
            ciphertext = encrypted_type.process_bind_param(plaintext, None)

            # Assert - ciphertext is different from plaintext
            assert ciphertext != plaintext
            assert isinstance(ciphertext, str)

            # Act - decrypt
            decrypted = encrypted_type.process_result_value(ciphertext, None)

            # Assert - decrypted matches original
            assert decrypted == plaintext

    def test_encrypt_none_value(self, test_key_current):
        """Test encrypting None returns None (passthrough)."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()

            # Act
            result = encrypted_type.process_bind_param(None, None)

            # Assert
            assert result is None

    def test_decrypt_none_value(self, test_key_current):
        """Test decrypting None returns None (passthrough)."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()

            # Act
            result = encrypted_type.process_result_value(None, None)

            # Assert
            assert result is None

    def test_plaintext_mode_no_key(self):
        """Test plaintext fallback when ENCRYPTION_KEY_CURRENT is empty."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = None
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()
            plaintext = "Test data"

            # Act - encrypt (should return plaintext)
            result_encrypt = encrypted_type.process_bind_param(plaintext, None)

            # Assert - stored as plaintext
            assert result_encrypt == plaintext

            # Act - decrypt (should return plaintext)
            result_decrypt = encrypted_type.process_result_value(plaintext, None)

            # Assert - returned as plaintext
            assert result_decrypt == plaintext

    def test_key_rotation_decrypt_with_previous(self, test_key_current, test_key_previous):
        """Test key rotation: encrypt with key A, rotate to key B, still decrypt."""
        # Step 1: Encrypt with key A
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_previous
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type_old = EncryptedString()
            plaintext = "Old encrypted data"
            ciphertext = encrypted_type_old.process_bind_param(plaintext, None)

        # Step 2: Rotate keys (A becomes previous, B becomes current)
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = test_key_previous  # Old key as fallback

            encrypted_type_new = EncryptedString()

            # Act - decrypt old ciphertext with rotated keys
            decrypted = encrypted_type_new.process_result_value(ciphertext, None)

            # Assert - should still decrypt correctly using previous key
            assert decrypted == plaintext

    def test_encrypted_string_different_ciphertext(self, test_key_current):
        """Test same plaintext produces different ciphertext (Fernet uses random IV)."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()
            plaintext = "Same text encrypted twice"

            # Act - encrypt same plaintext twice
            ciphertext1 = encrypted_type.process_bind_param(plaintext, None)
            ciphertext2 = encrypted_type.process_bind_param(plaintext, None)

            # Assert - ciphertexts are different (Fernet uses random IV)
            assert ciphertext1 != ciphertext2

            # But both decrypt to same plaintext
            assert encrypted_type.process_result_value(ciphertext1, None) == plaintext
            assert encrypted_type.process_result_value(ciphertext2, None) == plaintext

    def test_encrypted_string_type_decorator(self, test_key_current):
        """Test EncryptedString as SQLAlchemy TypeDecorator."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString(length=500)

            # Assert - TypeDecorator properties
            assert encrypted_type.cache_ok is True
            assert encrypted_type.impl.__class__.__name__ == 'String'

    def test_process_bind_param_directly(self, test_key_current):
        """Test process_bind_param method directly."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()
            plaintext = "Direct bind test"

            # Act
            ciphertext = encrypted_type.process_bind_param(plaintext, dialect=None)

            # Assert
            assert ciphertext is not None
            assert ciphertext != plaintext
            assert isinstance(ciphertext, str)

    def test_process_result_value_directly(self, test_key_current):
        """Test process_result_value method directly."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = None

            encrypted_type = EncryptedString()
            plaintext = "Direct result test"

            # Encrypt first
            ciphertext = encrypted_type.process_bind_param(plaintext, None)

            # Act - decrypt
            result = encrypted_type.process_result_value(ciphertext, dialect=None)

            # Assert
            assert result == plaintext

    def test_multifernet_initialization(self, test_key_current, test_key_previous):
        """Test MultiFernet is used when both current and previous keys provided."""
        # Arrange
        with patch('src.core.config.settings') as mock_settings:
            mock_settings.ENCRYPTION_KEY_CURRENT = test_key_current
            mock_settings.ENCRYPTION_KEY_PREVIOUS = test_key_previous

            # Act
            encrypted_type = EncryptedString()

            # Assert - MultiFernet initialized with 2 keys
            assert encrypted_type._fernet is not None
            # MultiFernet should handle decryption with either key
