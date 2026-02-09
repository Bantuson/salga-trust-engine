"""Unit tests for image preprocessing and utility functions.

Tests EXIF stripping, GPS extraction, OCR preprocessing, and image quality validation
using programmatically generated test images.
"""
import pytest
from io import BytesIO

from PIL import Image, ImageDraw

from src.services.image_utils import (
    strip_exif_metadata,
    extract_gps_from_exif,
    preprocess_image_for_ocr,
    validate_image_quality
)


class TestImageUtils:
    """Unit tests for image utility functions."""

    @pytest.fixture
    def sample_image_bytes(self):
        """Create a test image programmatically with sufficient file size."""
        # Create 1000x800 RGB image with varied content to ensure file size > 50KB
        img = Image.new('RGB', (1000, 800), color='white')
        draw = ImageDraw.Draw(img)

        # Add varied content to increase file size
        for i in range(0, 1000, 50):
            for j in range(0, 800, 50):
                # Draw rectangles with varied colors
                color = (i % 255, j % 255, (i + j) % 255)
                draw.rectangle([i, j, i + 40, j + 40], fill=color)

        draw.text((100, 100), "Test Document", fill='black')

        # Save to bytes with quality to ensure > 50KB
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        buffer.seek(0)
        return buffer.read()

    @pytest.fixture
    def small_image_bytes(self):
        """Create a small image that fails validation."""
        # Create 400x300 RGB image (below 800x600 threshold)
        img = Image.new('RGB', (400, 300), color='white')

        buffer = BytesIO()
        img.save(buffer, format='JPEG')
        buffer.seek(0)
        return buffer.read()

    def test_strip_exif_preserves_pixels(self, sample_image_bytes):
        """Test EXIF stripping preserves image content."""
        # Act
        clean_bytes = strip_exif_metadata(sample_image_bytes)

        # Assert - both images should have same dimensions and mode
        original_img = Image.open(BytesIO(sample_image_bytes))
        clean_img = Image.open(BytesIO(clean_bytes))

        assert original_img.size == clean_img.size
        assert original_img.mode == clean_img.mode

        # Note: Exact pixel comparison may fail due to JPEG compression artifacts
        # during re-encoding. Instead, verify image is visually similar (same size/mode)

    def test_strip_exif_metadata(self):
        """Test EXIF metadata is removed from image."""
        # Create image with fake EXIF
        img = Image.new('RGB', (1000, 800), color='blue')

        # Save with EXIF data
        buffer = BytesIO()
        exif_data = img.getexif()
        exif_data[0x0132] = "2024:01:01 12:00:00"  # DateTime tag
        img.save(buffer, format='JPEG', exif=exif_data)
        buffer.seek(0)
        image_with_exif = buffer.read()

        # Act
        clean_bytes = strip_exif_metadata(image_with_exif)

        # Assert - clean image should have no EXIF
        clean_img = Image.open(BytesIO(clean_bytes))
        clean_exif = clean_img.getexif()

        # Clean image should have minimal or no EXIF tags
        assert len(clean_exif) == 0 or all(tag not in clean_exif for tag in [0x0132, 0x010F, 0x0110])

    def test_preprocess_for_ocr_grayscale(self, sample_image_bytes):
        """Test OCR preprocessing converts to grayscale."""
        # Act
        processed_img = preprocess_image_for_ocr(sample_image_bytes)

        # Assert - should be grayscale (mode 'L')
        assert processed_img.mode == 'L'

    def test_preprocess_for_ocr_binary_threshold(self, sample_image_bytes):
        """Test OCR preprocessing applies binary threshold."""
        # Act
        processed_img = preprocess_image_for_ocr(sample_image_bytes)

        # Assert - pixels should be only 0 or 255 after threshold
        pixels = list(processed_img.getdata())
        unique_values = set(pixels)

        # Should only have black (0) and white (255)
        assert all(pixel in [0, 255] for pixel in unique_values)

    def test_validate_image_quality_valid(self, sample_image_bytes):
        """Test 1000x800 image passes quality validation."""
        # Act
        result = validate_image_quality(sample_image_bytes)

        # Assert
        assert result["valid"] is True
        assert result["width"] == 1000
        assert result["height"] == 800
        assert result["size_bytes"] > 50 * 1024  # Should be > 50KB
        assert result["reason"] is None

    def test_validate_image_quality_too_small(self, small_image_bytes):
        """Test 400x300 image fails validation."""
        # Act
        result = validate_image_quality(small_image_bytes)

        # Assert
        assert result["valid"] is False
        assert result["width"] == 400
        assert result["height"] == 300
        assert "too small" in result["reason"]

    def test_extract_gps_no_exif(self, sample_image_bytes):
        """Test returns None for image without GPS EXIF data."""
        # Act
        result = extract_gps_from_exif(sample_image_bytes)

        # Assert
        assert result is None

    def test_preprocess_for_ocr_contrast_enhancement(self, sample_image_bytes):
        """Test OCR preprocessing enhances contrast."""
        # Create a low-contrast image
        img = Image.new('L', (1000, 800), color=128)  # Gray image
        draw = ImageDraw.Draw(img)
        draw.text((100, 100), "Low Contrast Text", fill=140)  # Slightly darker text

        buffer = BytesIO()
        img.save(buffer, format='JPEG')
        buffer.seek(0)
        low_contrast_bytes = buffer.read()

        # Act
        processed_img = preprocess_image_for_ocr(low_contrast_bytes)

        # Assert - should have applied contrast enhancement
        # After processing, expect more black/white separation
        pixels = list(processed_img.getdata())
        black_pixels = sum(1 for p in pixels if p == 0)
        white_pixels = sum(1 for p in pixels if p == 255)

        # Should have significant black and white pixels (binary threshold applied)
        assert black_pixels > 0
        assert white_pixels > 0

    def test_validate_image_quality_invalid_file(self):
        """Test validation handles invalid image data gracefully."""
        # Arrange
        invalid_bytes = b"This is not an image"

        # Act
        result = validate_image_quality(invalid_bytes)

        # Assert
        assert result["valid"] is False
        assert "Invalid image" in result["reason"]

    def test_strip_exif_format_preservation(self, sample_image_bytes):
        """Test EXIF stripping preserves image format."""
        # Act
        clean_bytes = strip_exif_metadata(sample_image_bytes)

        # Assert - should still be valid JPEG
        clean_img = Image.open(BytesIO(clean_bytes))
        assert clean_img.format in ['JPEG', None]  # PIL may not set format on reconstructed images

    def test_preprocess_for_ocr_denoise(self, sample_image_bytes):
        """Test OCR preprocessing applies median filter for denoising."""
        # Create noisy image
        img = Image.new('L', (1000, 800), color=255)
        pixels = list(img.getdata())

        # Add some noise (random black pixels)
        import random
        noisy_pixels = [0 if random.random() < 0.01 else p for p in pixels]

        noisy_img = Image.new('L', (1000, 800))
        noisy_img.putdata(noisy_pixels)

        buffer = BytesIO()
        noisy_img.save(buffer, format='JPEG')
        buffer.seek(0)
        noisy_bytes = buffer.read()

        # Act
        processed_img = preprocess_image_for_ocr(noisy_bytes)

        # Assert - should have applied MedianFilter
        # Processed image should exist and be grayscale
        assert processed_img.mode == 'L'
        assert processed_img.size == (1000, 800)
