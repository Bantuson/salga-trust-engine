"""S3 storage service for media uploads and downloads.

Handles presigned URL generation for direct browser uploads, Twilio media downloads,
and presigned GET URLs for secure file access.
"""
from uuid import uuid4
import httpx
import boto3
from botocore.exceptions import ClientError

from src.core.config import settings


class StorageServiceError(Exception):
    """Exception raised when S3 storage service is not configured or fails."""
    pass


class StorageService:
    """S3 storage service for presigned URLs and media management."""

    def __init__(self):
        """Initialize S3 client if AWS credentials are configured."""
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            self._client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        else:
            # Dev mode without S3
            self._client = None

    def generate_presigned_post(
        self,
        purpose: str,
        tenant_id: str,
        user_id: str,
        file_id: str,
        filename: str,
        content_type: str,
        max_size: int = 10 * 1024 * 1024  # 10MB default
    ) -> dict:
        """Generate presigned POST URL for direct browser upload.

        Args:
            purpose: "evidence" or "proof_of_residence"
            tenant_id: Tenant ID for S3 key prefix
            user_id: User ID for S3 key prefix
            file_id: Unique file identifier (UUID string)
            filename: Original filename
            content_type: MIME type
            max_size: Maximum file size in bytes

        Returns:
            dict with url, fields, and file_id

        Raises:
            StorageServiceError: If S3 not configured
        """
        if self._client is None:
            raise StorageServiceError("S3 storage service not configured (AWS credentials missing)")

        # Determine bucket from purpose
        bucket = settings.S3_BUCKET_EVIDENCE if purpose == "evidence" else settings.S3_BUCKET_DOCUMENTS

        # Generate S3 key: {purpose}/{tenant_id}/{file_id}/{filename}
        s3_key = f"{purpose}/{tenant_id}/{file_id}/{filename}"

        try:
            # Generate presigned POST
            presigned = self._client.generate_presigned_post(
                Bucket=bucket,
                Key=s3_key,
                Fields={"Content-Type": content_type},
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 0, max_size]
                ],
                ExpiresIn=900  # 15 minutes
            )

            return {
                "url": presigned["url"],
                "fields": presigned["fields"],
                "file_id": file_id
            }
        except ClientError as e:
            raise StorageServiceError(f"Failed to generate presigned POST: {e}")

    async def download_and_upload_media(
        self,
        media_url: str,
        media_content_type: str,
        ticket_id: str,
        tenant_id: str,
        auth_credentials: tuple[str, str]
    ) -> dict:
        """Download media from Twilio and upload to S3.

        Args:
            media_url: Twilio MediaUrl to download from
            media_content_type: Content type of the media
            ticket_id: Ticket ID for S3 key prefix
            tenant_id: Tenant ID for S3 key prefix
            auth_credentials: (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) tuple

        Returns:
            dict with s3_bucket, s3_key, file_id, content_type, file_size

        Raises:
            StorageServiceError: If S3 not configured or download/upload fails
        """
        if self._client is None:
            raise StorageServiceError("S3 storage service not configured (AWS credentials missing)")

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

        # Generate S3 key: evidence/{tenant_id}/{ticket_id}/{file_id}.{extension}
        s3_key = f"evidence/{tenant_id}/{ticket_id}/{file_id}.{extension}"
        bucket = settings.S3_BUCKET_EVIDENCE

        # Upload to S3
        try:
            self._client.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=media_content,
                ContentType=media_content_type,
                ServerSideEncryption='AES256'
            )
        except ClientError as e:
            raise StorageServiceError(f"Failed to upload media to S3: {e}")

        return {
            "s3_bucket": bucket,
            "s3_key": s3_key,
            "file_id": file_id,
            "content_type": media_content_type,
            "file_size": len(media_content)
        }

    def generate_presigned_get(
        self,
        bucket: str,
        key: str,
        expiry: int = 3600
    ) -> str:
        """Generate presigned GET URL for downloading files.

        Args:
            bucket: S3 bucket name
            key: S3 object key
            expiry: URL expiration in seconds (default 1 hour)

        Returns:
            Presigned GET URL

        Raises:
            StorageServiceError: If S3 not configured or URL generation fails
        """
        if self._client is None:
            raise StorageServiceError("S3 storage service not configured (AWS credentials missing)")

        try:
            url = self._client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expiry
            )
            return url
        except ClientError as e:
            raise StorageServiceError(f"Failed to generate presigned GET URL: {e}")

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
