"""Unit tests for language detection module.

Tests trilingual detection (EN/ZU/AF) with confidence thresholds and fallback logic.
No external dependencies - pure unit tests.
"""
import pytest
from src.core.language import language_detector


def test_detect_english():
    """Test English language detection."""
    text = "There is a water pipe burst on Main Street"
    result = language_detector.detect(text)
    assert result == "en"


def test_detect_isizulu():
    """Test isiZulu language detection."""
    text = "Amanzi ami ayaphuma endlini yami"
    result = language_detector.detect(text)
    assert result == "zu"


def test_detect_afrikaans():
    """Test Afrikaans language detection."""
    text = "My water lek by die pyp naby die winkel"
    result = language_detector.detect(text)
    assert result == "af"


def test_short_text_fallback_to_default():
    """Test that short text (<20 chars) falls back to default language."""
    short_text = "ok"
    result = language_detector.detect(short_text)
    assert result == "en"  # Default fallback


def test_short_text_fallback_to_custom():
    """Test that short text (<20 chars) falls back to custom language."""
    short_text = "yebo"
    result = language_detector.detect(short_text, fallback="zu")
    assert result == "zu"


def test_empty_string_fallback():
    """Test that empty string falls back to default."""
    result = language_detector.detect("")
    assert result == "en"


def test_empty_string_custom_fallback():
    """Test that empty string falls back to custom language."""
    result = language_detector.detect("   ", fallback="af")
    assert result == "af"


def test_detect_with_confidence_returns_tuple():
    """Test detect_with_confidence returns language code and confidence score."""
    text = "There is a water pipe burst on Main Street"
    result = language_detector.detect_with_confidence(text)

    assert isinstance(result, tuple)
    assert len(result) == 2
    language_code, confidence = result
    assert isinstance(language_code, str)
    assert isinstance(confidence, float)
    assert language_code == "en"
    assert confidence > 0.0


def test_detect_with_confidence_short_text():
    """Test detect_with_confidence returns zero confidence for short text."""
    short_text = "hi"
    language_code, confidence = language_detector.detect_with_confidence(short_text)

    assert language_code == "en"
    assert confidence == 0.0


def test_fallback_for_ambiguous_text():
    """Test fallback for text that may have low confidence."""
    # Numbers and symbols - should fall back
    ambiguous_text = "123 456 789"
    result = language_detector.detect(ambiguous_text, fallback="zu")
    assert result == "zu"  # Should use fallback


def test_longer_english_text():
    """Test detection with longer English text for higher confidence."""
    text = "The municipal water services have been disrupted in our area for the past three days"
    result = language_detector.detect(text)
    assert result == "en"


def test_longer_zulu_text():
    """Test detection with longer isiZulu text for higher confidence."""
    text = "Umgwaqo udonakele kakhulu futhi kudingeka ukulungiswa ngokushesha"
    result = language_detector.detect(text)
    assert result == "zu"


def test_longer_afrikaans_text():
    """Test detection with longer Afrikaans text for higher confidence."""
    text = "Die padtoestande in ons area is baie sleg en moet dringend aandag kry"
    result = language_detector.detect(text)
    assert result == "af"
