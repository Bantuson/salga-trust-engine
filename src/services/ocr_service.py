"""OCR service for proof of residence document extraction.

Provides OCR capabilities using Tesseract to extract address, name, and document
type from South African proof of residence documents (utility bills, bank statements,
lease agreements, municipal accounts).
"""
import logging
import re
from typing import Optional

from pydantic import BaseModel

from src.services.image_utils import preprocess_image_for_ocr

logger = logging.getLogger(__name__)


class ProofOfResidenceData(BaseModel):
    """Extracted data from proof of residence document."""

    address: Optional[str] = None
    name: Optional[str] = None
    document_type: Optional[str] = None
    confidence: float = 0.0
    raw_text: str = ""


class OCRService:
    """OCR service for extracting proof of residence data from images."""

    def __init__(self):
        """Initialize OCR service with Tesseract availability check."""
        self._tesseract_available = self._check_tesseract_availability()
        if not self._tesseract_available:
            logger.warning(
                "Tesseract OCR not available. OCR features will be degraded. "
                "Install tesseract-ocr for full functionality."
            )

    @staticmethod
    def _check_tesseract_availability() -> bool:
        """Check if Tesseract is installed and available."""
        try:
            import pytesseract
            # Try to get version - will raise exception if not installed
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract_proof_of_residence(self, image_bytes: bytes) -> ProofOfResidenceData:
        """Extract address, name, and document type from proof of residence image.

        Args:
            image_bytes: Raw image bytes of proof of residence document

        Returns:
            ProofOfResidenceData with extracted information and confidence score
        """
        if not self._tesseract_available:
            logger.error("Tesseract not available - cannot perform OCR")
            return ProofOfResidenceData(
                confidence=0.0,
                raw_text="",
                document_type=None
            )

        try:
            import pytesseract

            # Preprocess image for OCR
            processed_img = preprocess_image_for_ocr(image_bytes)

            # Run OCR for confidence scores
            ocr_data = pytesseract.image_to_data(
                processed_img,
                output_type=pytesseract.Output.DICT
            )

            # Calculate average confidence from non-empty words
            confidences = [
                int(conf) for conf, text in zip(ocr_data['conf'], ocr_data['text'])
                if text.strip() and int(conf) > 0
            ]
            avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0

            # Extract full text
            full_text = pytesseract.image_to_string(processed_img)

            # Extract components
            address = self._extract_address_pattern(full_text)
            name = self._extract_name_pattern(full_text)
            document_type = self._detect_document_type(full_text)

            return ProofOfResidenceData(
                address=address,
                name=name,
                document_type=document_type,
                confidence=avg_confidence,
                raw_text=full_text
            )

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ProofOfResidenceData(
                confidence=0.0,
                raw_text="",
                document_type=None
            )

    def _extract_address_pattern(self, text: str) -> Optional[str]:
        """Extract South African address from text using regex patterns.

        Args:
            text: OCR extracted text

        Returns:
            Extracted address or None
        """
        # Pattern 1: Street address with postal code
        # e.g., "123 Main Street, Johannesburg, 2001"
        street_pattern = r'\d+\s+[A-Za-z\s]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Crescent|Cres),?\s*[A-Za-z\s]+,?\s*\d{4}'
        match = re.search(street_pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()

        # Pattern 2: PO Box with postal code
        # e.g., "P.O. Box 1234, Cape Town, 8000"
        po_box_pattern = r'P\.?O\.?\s*Box\s+\d+,?\s*[A-Za-z\s]+,?\s*\d{4}'
        match = re.search(po_box_pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()

        # Pattern 3: Address line with 4-digit postal code
        # More generic pattern for various address formats
        postal_code_pattern = r'([A-Za-z0-9\s,]+\d{4})'
        matches = re.findall(postal_code_pattern, text)
        if matches:
            # Return the first match that looks like an address (contains multiple words)
            for match in matches:
                if len(match.split()) >= 3:
                    return match.strip()

        return None

    def _extract_name_pattern(self, text: str) -> Optional[str]:
        """Extract person's name from text using common patterns.

        Args:
            text: OCR extracted text

        Returns:
            Extracted name or None
        """
        # Pattern 1: Title followed by name (Mr/Mrs/Ms/Dr)
        title_pattern = r'(?:Mr|Mrs|Ms|Dr|Miss)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)'
        match = re.search(title_pattern, text)
        if match:
            return match.group(0).strip()

        # Pattern 2: "Name:" or "Account Holder:" followed by name
        name_label_pattern = r'(?:Name|Account Holder|Customer):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)'
        match = re.search(name_label_pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Pattern 3: Lines with capitalized words (potential names)
        # Look for 2-3 capitalized words in sequence
        capitalized_pattern = r'\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
        matches = re.findall(capitalized_pattern, text)
        if matches:
            # Filter out common words that aren't names
            common_words = {'Street', 'Road', 'Avenue', 'Drive', 'Box', 'Post', 'Office', 'Bank', 'Municipal'}
            for match in matches:
                words = match.split()
                if not any(word in common_words for word in words) and len(words) >= 2:
                    return match.strip()

        return None

    def _detect_document_type(self, text: str) -> Optional[str]:
        """Detect document type from OCR text based on keywords.

        Args:
            text: OCR extracted text

        Returns:
            Document type: utility_bill, bank_statement, lease_agreement,
            municipal_account, or None
        """
        text_lower = text.lower()

        # Utility bill keywords
        if any(keyword in text_lower for keyword in [
            'electricity', 'eskom', 'prepaid', 'kilowatt', 'kwh'
        ]):
            return 'utility_bill'

        # Bank statement keywords
        if any(keyword in text_lower for keyword in [
            'bank statement', 'capitec', 'fnb', 'absa', 'standard bank',
            'nedbank', 'account balance', 'transaction', 'debit', 'credit'
        ]):
            return 'bank_statement'

        # Lease agreement keywords
        if any(keyword in text_lower for keyword in [
            'lease agreement', 'rental', 'tenancy', 'landlord', 'tenant',
            'monthly rent', 'lease period'
        ]):
            return 'lease_agreement'

        # Municipal account keywords
        if any(keyword in text_lower for keyword in [
            'municipal', 'water', 'sewerage', 'refuse', 'rates',
            'municipality', 'city council'
        ]):
            return 'municipal_account'

        return None

    def determine_verification_result(self, ocr_data: ProofOfResidenceData) -> dict:
        """Determine verification result based on OCR confidence and extracted data.

        Args:
            ocr_data: Extracted proof of residence data

        Returns:
            dict with status ('verified', 'pending', 'rejected'), auto (bool),
            and optional reason (str)
        """
        # Auto-verify: High confidence with complete data
        if ocr_data.confidence >= 0.7 and ocr_data.address and ocr_data.name:
            return {
                "status": "verified",
                "auto": True
            }

        # Manual review: Medium confidence with partial data
        if ocr_data.confidence >= 0.5 and (ocr_data.address or ocr_data.name):
            return {
                "status": "pending",
                "auto": False,
                "reason": "Partial extraction - manual review needed"
            }

        # Reject: Low confidence
        return {
            "status": "rejected",
            "auto": True,
            "reason": "Document quality too low for OCR. Please upload a clearer image."
        }
