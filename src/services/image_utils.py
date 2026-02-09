"""Image preprocessing utilities for OCR and privacy compliance.

Provides image preprocessing for OCR accuracy, EXIF metadata stripping for privacy,
GPS extraction, and image quality validation.
"""
from io import BytesIO
from typing import Optional

import exifread
from PIL import Image, ImageEnhance, ImageFilter


def preprocess_image_for_ocr(image_bytes: bytes) -> Image.Image:
    """Preprocess image for improved OCR accuracy.

    Args:
        image_bytes: Raw image bytes

    Returns:
        Preprocessed PIL Image (grayscale, high contrast, thresholded, denoised)
    """
    # Open image from bytes
    img = Image.open(BytesIO(image_bytes))

    # Convert to grayscale
    img = img.convert('L')

    # Increase contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    # Apply binary threshold (128)
    img = img.point(lambda p: 255 if p > 128 else 0)

    # Denoise with MedianFilter
    img = img.filter(ImageFilter.MedianFilter(size=3))

    return img


def strip_exif_metadata(image_bytes: bytes) -> bytes:
    """Strip EXIF metadata from image for privacy compliance.

    Creates a clean image containing only pixel data, removing all metadata
    including GPS coordinates, device information, and capture timestamps.

    Args:
        image_bytes: Raw image bytes with potential EXIF data

    Returns:
        Clean image bytes without EXIF metadata
    """
    # Open image
    img = Image.open(BytesIO(image_bytes))

    # Preserve format (default to JPEG if unknown)
    format_name = img.format if img.format else 'JPEG'

    # Create new image from pixel data only (strips all metadata)
    data = list(img.getdata())
    clean_img = Image.new(img.mode, img.size)
    clean_img.putdata(data)

    # Save to BytesIO buffer
    buffer = BytesIO()
    clean_img.save(buffer, format=format_name)
    buffer.seek(0)

    return buffer.read()


def extract_gps_from_exif(image_bytes: bytes) -> Optional[tuple[float, float]]:
    """Extract GPS coordinates from image EXIF data.

    Args:
        image_bytes: Raw image bytes with potential GPS EXIF data

    Returns:
        (latitude, longitude) tuple or None if no GPS data present
    """
    # Use exifread to extract EXIF tags
    buffer = BytesIO(image_bytes)
    tags = exifread.process_file(buffer, details=False)

    # Check for GPS tags
    if 'GPS GPSLatitude' not in tags or 'GPS GPSLongitude' not in tags:
        return None

    try:
        # Extract latitude
        lat = tags['GPS GPSLatitude'].values
        lat_ref = tags.get('GPS GPSLatitudeRef', None)
        latitude = _convert_dms_to_decimal(lat)
        if lat_ref and str(lat_ref.values) == 'S':
            latitude = -latitude

        # Extract longitude
        lon = tags['GPS GPSLongitude'].values
        lon_ref = tags.get('GPS GPSLongitudeRef', None)
        longitude = _convert_dms_to_decimal(lon)
        if lon_ref and str(lon_ref.values) == 'W':
            longitude = -longitude

        return (latitude, longitude)
    except (KeyError, ValueError, AttributeError):
        return None


def _convert_dms_to_decimal(dms) -> float:
    """Convert DMS (degrees/minutes/seconds) to decimal degrees.

    Args:
        dms: List of [degrees, minutes, seconds] as Ratios

    Returns:
        Decimal degrees
    """
    degrees = float(dms[0].num) / float(dms[0].den)
    minutes = float(dms[1].num) / float(dms[1].den) / 60.0
    seconds = float(dms[2].num) / float(dms[2].den) / 3600.0
    return degrees + minutes + seconds


def validate_image_quality(image_bytes: bytes) -> dict:
    """Validate image quality for OCR processing.

    Checks minimum dimensions and file size to ensure image is suitable
    for OCR processing (not a thumbnail or low-quality screenshot).

    Args:
        image_bytes: Raw image bytes

    Returns:
        dict with keys: valid (bool), width (int), height (int),
        size_bytes (int), reason (str|None)
    """
    try:
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size
        size_bytes = len(image_bytes)

        # Check minimum dimensions (800x600 for OCR)
        if width < 800 or height < 600:
            return {
                "valid": False,
                "width": width,
                "height": height,
                "size_bytes": size_bytes,
                "reason": f"Image dimensions too small for OCR: {width}x{height} (minimum 800x600)"
            }

        # Check minimum file size (50KB - too small likely means screenshot/thumbnail)
        if size_bytes < 50 * 1024:
            return {
                "valid": False,
                "width": width,
                "height": height,
                "size_bytes": size_bytes,
                "reason": f"File size too small: {size_bytes} bytes (minimum 50KB)"
            }

        return {
            "valid": True,
            "width": width,
            "height": height,
            "size_bytes": size_bytes,
            "reason": None
        }
    except Exception as e:
        return {
            "valid": False,
            "width": 0,
            "height": 0,
            "size_bytes": len(image_bytes),
            "reason": f"Invalid image file: {str(e)}"
        }
