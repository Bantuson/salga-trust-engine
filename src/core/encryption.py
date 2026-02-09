"""Field-level encryption using Fernet for GBV sensitive data.

EncryptedString is a SQLAlchemy TypeDecorator that transparently encrypts data
at rest using Fernet symmetric encryption with key rotation support via MultiFernet.
"""
from cryptography.fernet import Fernet, MultiFernet
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


class EncryptedString(TypeDecorator):
    """SQLAlchemy type for transparent field-level encryption with key rotation.

    Uses Fernet symmetric encryption. Supports key rotation via MultiFernet:
    - ENCRYPTION_KEY_CURRENT: Primary key for new encryptions
    - ENCRYPTION_KEY_PREVIOUS: Optional old key for decrypting legacy data

    If ENCRYPTION_KEY_CURRENT is empty (dev/test mode), stores values in plaintext.
    This allows model imports without real encryption keys configured.
    """

    impl = String
    cache_ok = True

    def __init__(self, length=None, **kwargs):
        """Initialize with encryption keys from settings.

        Args:
            length: Maximum string length (passed to String type)
            **kwargs: Additional SQLAlchemy type arguments
        """
        super().__init__(length=length, **kwargs)

        # Lazy import to avoid circular dependency
        from src.core.config import settings

        if settings.ENCRYPTION_KEY_CURRENT:
            # Build MultiFernet for key rotation support
            keys = [Fernet(settings.ENCRYPTION_KEY_CURRENT.encode())]
            if settings.ENCRYPTION_KEY_PREVIOUS:
                keys.append(Fernet(settings.ENCRYPTION_KEY_PREVIOUS.encode()))
            self._fernet = MultiFernet(keys)
        else:
            # Dev/test mode without encryption (plaintext storage)
            self._fernet = None

    def process_bind_param(self, value, dialect):
        """Encrypt value before storing in database.

        Args:
            value: Plaintext string to encrypt
            dialect: SQLAlchemy dialect (unused)

        Returns:
            Encrypted string (or plaintext if encryption disabled)
        """
        if value is None:
            return None

        if self._fernet is None:
            # Dev/test mode: store plaintext
            return value

        # Encrypt and return as string
        encrypted = self._fernet.encrypt(value.encode())
        return encrypted.decode()

    def process_result_value(self, value, dialect):
        """Decrypt value retrieved from database.

        Args:
            value: Encrypted string from database
            dialect: SQLAlchemy dialect (unused)

        Returns:
            Decrypted plaintext string (or plaintext if encryption disabled)
        """
        if value is None:
            return None

        if self._fernet is None:
            # Dev/test mode: return plaintext
            return value

        # Decrypt and return as string
        decrypted = self._fernet.decrypt(value.encode())
        return decrypted.decode()
