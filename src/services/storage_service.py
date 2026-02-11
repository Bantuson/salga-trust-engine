"""Supabase Storage service for media uploads and downloads.

Handles file upload/download via Supabase Storage with RLS-enforced access control.
Supports three private buckets: evidence, documents, gbv-evidence.
"""
from uuid import uuid4
import httpx

from src.core.supabase import get_supabase_admin
from src.core.config import settings


class StorageServiceError(Exception):
    """Exception raised when Supabase Storage service is not configured or fails."""
    pass


class StorageService:
    """Supabase Storage service for media management."""

    def __init__(self):
        """Initialize Supabase Storage client if configured."""
        self._supabase = get_supabase_admin()
        if self._supabase is None:
            # Dev mode without Supabase
            self._storage_available = False
        else:
            self._storage_available = True

    def generate_upload_url(
        self,
        purpose: str,
        tenant_id: str,
        file_id: str,
        filename: str,
        content_type: str,
    ) -> dict:
        """Generate upload path info for Supabase Storage.

        Unlike S3 presigned POST URLs, Supabase Storage uses the JS client directly.
        This endpoint returns the bucket and path pattern for the frontend to use.

        Args:
            purpose: "evidence", "documents", or "gbv-evidence"
            tenant_id: Tenant ID for path prefix
            file_id: Unique file identifier (UUID string)
            filename: Original filename
            content_type: MIME type (for reference)

        Returns:
            dict with bucket, path, and file_id

        Raises:
            StorageServiceError: If Supabase Storage not configured
        """
        if not self._storage_available:
            raise StorageServiceError("Supabase Storage service not configured (SUPABASE_URL missing)")

        # Determine bucket from purpose
        bucket = self._get_bucket_from_purpose(purpose)

        # Generate storage path: {tenant_id}/{file_id}/{filename}
        storage_path = f"{tenant_id}/{file_id}/{filename}"

        return {
            "bucket": bucket,
            "path": storage_path,
            "file_id": file_id
        }

    async def upload_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str
    ) -> dict:
        """Server-side upload using admin client (for WhatsApp media).

        Args:
            bucket: Bucket name (evidence, documents, gbv-evidence)
            path: Storage path (e.g., {tenant_id}/{file_id}/{filename})
            content: File content bytes
            content_type: MIME type

        Returns:
            dict with bucket and path

        Raises:
            StorageServiceError: If upload fails
        """
        if not self._storage_available:
            raise StorageServiceError("Supabase Storage service not configured (SUPABASE_URL missing)")

        try:
            # Upload file via Supabase admin client (bypasses RLS)
            response = self._supabase.storage.from_(bucket).upload(
                path=path,
                file=content,
                file_options={
                    "content-type": content_type,
                    "upsert": "false"
                }
            )

            # Supabase SDK returns response with 'path' on success
            # Check for error in response
            if hasattr(response, 'error') and response.error:
                raise StorageServiceError(f"Supabase upload failed: {response.error}")

            return {
                "bucket": bucket,
                "path": path
            }
        except Exception as e:
            raise StorageServiceError(f"Failed to upload file to Supabase Storage: {e}")

    def get_signed_url(
        self,
        bucket: str,
        path: str,
        expiry: int = 3600
    ) -> str:
        """Generate signed URL for secure file access.

        Args:
            bucket: Bucket name
            path: Storage path
            expiry: URL expiration in seconds (default 1 hour)

        Returns:
            Signed URL string

        Raises:
            StorageServiceError: If URL generation fails
        """
        if not self._storage_available:
            raise StorageServiceError("Supabase Storage service not configured (SUPABASE_URL missing)")

        try:
            # Create signed URL via Supabase admin client
            response = self._supabase.storage.from_(bucket).create_signed_url(
                path=path,
                expires_in=expiry
            )

            # Response format: {"signedURL": "...", "error": null}
            if hasattr(response, 'error') and response.error:
                raise StorageServiceError(f"Failed to create signed URL: {response.error}")

            # Extract signed URL from response
            if isinstance(response, dict):
                signed_url = response.get('signedURL')
            else:
                signed_url = getattr(response, 'signed_url', None)

            if not signed_url:
                raise StorageServiceError("Signed URL not returned from Supabase")

            return signed_url
        except Exception as e:
            raise StorageServiceError(f"Failed to generate signed URL: {e}")

    async def download_and_upload_media(
        self,
        media_url: str,
        media_content_type: str,
        ticket_id: str,
        tenant_id: str,
        auth_credentials: tuple[str, str],
        is_sensitive: bool = False
    ) -> dict:
        """Download media from Twilio and upload to Supabase Storage.

        Args:
            media_url: Twilio MediaUrl to download from
            media_content_type: Content type of the media
            ticket_id: Ticket ID for storage path
            tenant_id: Tenant ID for storage path
            auth_credentials: (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) tuple
            is_sensitive: If True, upload to gbv-evidence bucket (default False)

        Returns:
            dict with bucket, path, file_id, content_type, file_size

        Raises:
            StorageServiceError: If Supabase not configured or download/upload fails
        """
        if not self._storage_available:
            raise StorageServiceError("Supabase Storage service not configured (SUPABASE_URL missing)")

        # Download from Twilio
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    media_url,
                    auth=auth_credentials,
                    timeout=30.0
                )
                response.raise_for_status()
                media_content = response.content
        except httpx.HTTPError as e:
            raise StorageServiceError(f"Failed to download media from Twilio: {e}")

        # Generate file_id and determine extension
        file_id = str(uuid4())
        extension = self._get_extension_from_content_type(media_content_type)

        # Determine bucket based on sensitivity (SEC-05)
        bucket = "gbv-evidence" if is_sensitive else "evidence"

        # Generate storage path: {tenant_id}/{ticket_id}/{file_id}.{extension}
        storage_path = f"{tenant_id}/{ticket_id}/{file_id}.{extension}"

        # Upload to Supabase Storage
        await self.upload_file(
            bucket=bucket,
            path=storage_path,
            content=media_content,
            content_type=media_content_type
        )

        return {
            "bucket": bucket,
            "path": storage_path,
            "file_id": file_id,
            "content_type": media_content_type,
            "file_size": len(media_content)
        }

    @staticmethod
    def _get_bucket_from_purpose(purpose: str) -> str:
        """Map purpose to Supabase Storage bucket name."""
        bucket_map = {
            "evidence": "evidence",
            "documents": "documents",
            "gbv-evidence": "gbv-evidence",
            "proof_of_residence": "documents",  # Legacy alias
        }
        return bucket_map.get(purpose, "evidence")

    @staticmethod
    def _get_extension_from_content_type(content_type: str) -> str:
        """Map content type to file extension."""
        content_type_map = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
            "application/pdf": "pdf",
            "video/mp4": "mp4",
            "video/quicktime": "mov",
        }
        return content_type_map.get(content_type, "bin")
