"""Language detection module using lingua-py for trilingual support (EN/ZU/AF).

This module provides deterministic language detection for South African citizens
reporting issues in English, isiZulu, or Afrikaans. Uses confidence thresholds
and minimum text length to ensure reliable detection.

Key decisions:
- Short text (<20 chars) falls back to user's preferred language (unreliable)
- Minimum confidence 0.7 required to avoid false positives
- Minimum relative distance 0.25 to distinguish between similar languages
"""
from lingua import Language, LanguageDetectorBuilder, LanguageDetector as LinguaDetector


class LanguageDetector:
    """Singleton language detector for EN/ZU/AF trilingual detection.

    Uses lingua-py with optimized settings for South African language mix.
    Implements confidence thresholds and short-text fallback logic.
    """

    # ISO 639-1 language codes
    LANGUAGE_MAP = {
        Language.ENGLISH: "en",
        Language.ZULU: "zu",
        Language.AFRIKAANS: "af",
    }

    MIN_CONFIDENCE = 0.7
    MIN_TEXT_LENGTH = 20

    def __init__(self):
        """Initialize the language detector for EN/ZU/AF only."""
        self._detector: LinguaDetector = (
            LanguageDetectorBuilder
            .from_languages(Language.ENGLISH, Language.ZULU, Language.AFRIKAANS)
            .with_minimum_relative_distance(0.25)
            .build()
        )

    def detect(self, text: str, fallback: str = "en") -> str:
        """Detect language from text with fallback logic.

        Args:
            text: Input text to detect language from
            fallback: ISO language code to return if detection unreliable (default: "en")

        Returns:
            ISO 639-1 language code: "en", "zu", or "af"

        Fallback scenarios:
        - Text length < 20 characters (too short for reliable detection)
        - No language detected (unrecognizable text)
        - Confidence < 0.7 (ambiguous language)
        """
        # Short text unreliable - use fallback
        if len(text.strip()) < self.MIN_TEXT_LENGTH:
            return fallback

        # Detect language
        detected = self._detector.detect_language_of(text)

        # No detection - use fallback
        if detected is None:
            return fallback

        # Check confidence
        confidence_values = self._detector.compute_language_confidence_values(text)

        # Find confidence for detected language
        detected_confidence = 0.0
        for lang_conf in confidence_values:
            if lang_conf.language == detected:
                detected_confidence = lang_conf.value
                break

        # Low confidence - use fallback
        if detected_confidence < self.MIN_CONFIDENCE:
            return fallback

        # Return ISO code
        return self.LANGUAGE_MAP.get(detected, fallback)

    def detect_with_confidence(self, text: str) -> tuple[str, float]:
        """Detect language and return confidence score for logging/debugging.

        Args:
            text: Input text to detect language from

        Returns:
            Tuple of (language_code, confidence_score)
            Returns ("en", 0.0) if detection fails
        """
        if len(text.strip()) < self.MIN_TEXT_LENGTH:
            return ("en", 0.0)

        detected = self._detector.detect_language_of(text)

        if detected is None:
            return ("en", 0.0)

        confidence_values = self._detector.compute_language_confidence_values(text)

        detected_confidence = 0.0
        for lang_conf in confidence_values:
            if lang_conf.language == detected:
                detected_confidence = lang_conf.value
                break

        language_code = self.LANGUAGE_MAP.get(detected, "en")

        return (language_code, detected_confidence)


# Module-level singleton
language_detector = LanguageDetector()
