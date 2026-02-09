"""Unit tests for OCR service with mocked Tesseract.

Tests address extraction patterns, document type detection, confidence scoring,
and verification determination without requiring Tesseract installation.
"""
import pytest
from unittest.mock import MagicMock, patch

from src.services.ocr_service import OCRService, ProofOfResidenceData


class TestOCRService:
    """Unit tests for OCRService."""

    @pytest.fixture
    def ocr_service(self):
        """Create OCRService with mocked Tesseract."""
        with patch.object(OCRService, '_check_tesseract_availability', return_value=True):
            return OCRService()

    @pytest.fixture
    def ocr_service_no_tesseract(self):
        """Create OCRService without Tesseract (graceful degradation)."""
        with patch.object(OCRService, '_check_tesseract_availability', return_value=False):
            return OCRService()

    def test_extract_address_street_pattern(self, ocr_service):
        """Test regex matches South African street address pattern."""
        # Arrange
        text = """
        John Doe
        123 Main Street, Johannesburg, 2001
        Account Number: 123456
        """

        # Act
        result = ocr_service._extract_address_pattern(text)

        # Assert
        assert result is not None
        assert "123 Main Street" in result
        assert "Johannesburg" in result
        assert "2001" in result

    def test_extract_address_po_box(self, ocr_service):
        """Test regex matches P.O. Box pattern."""
        # Arrange
        text = """
        Jane Smith
        P.O. Box 456, Pretoria, 0001
        Municipal Account
        """

        # Act
        result = ocr_service._extract_address_pattern(text)

        # Assert
        assert result is not None
        assert "P.O. Box 456" in result
        assert "Pretoria" in result
        assert "0001" in result

    def test_extract_address_no_match(self, ocr_service):
        """Test returns None when no address pattern found."""
        # Arrange
        text = "This is just some random text without an address"

        # Act
        result = ocr_service._extract_address_pattern(text)

        # Assert
        assert result is None

    def test_detect_document_type_utility(self, ocr_service):
        """Test detects utility bill from keywords."""
        # Arrange
        text = """
        ESKOM ELECTRICITY BILL
        Account Holder: John Doe
        123 Main Street, Johannesburg, 2001
        Total kWh used: 450
        """

        # Act
        result = ocr_service._detect_document_type(text)

        # Assert
        assert result == "utility_bill"

    def test_detect_document_type_bank(self, ocr_service):
        """Test detects bank statement from keywords."""
        # Arrange
        text = """
        FNB BANK STATEMENT
        Account Holder: Jane Smith
        Account Balance: R 12,500.00
        Transaction History
        """

        # Act
        result = ocr_service._detect_document_type(text)

        # Assert
        assert result == "bank_statement"

    def test_detect_document_type_unknown(self, ocr_service):
        """Test returns None for unrecognized document type."""
        # Arrange
        text = "This is a letter from my friend with no specific keywords"

        # Act
        result = ocr_service._detect_document_type(text)

        # Assert
        assert result is None

    def test_determine_verification_high_confidence(self, ocr_service):
        """Test auto-verification with high confidence and complete data."""
        # Arrange
        ocr_data = ProofOfResidenceData(
            address="123 Main St, Johannesburg, 2001",
            name="John Doe",
            document_type="utility_bill",
            confidence=0.85,
            raw_text="Sample text"
        )

        # Act
        result = ocr_service.determine_verification_result(ocr_data)

        # Assert
        assert result["status"] == "verified"
        assert result["auto"] is True

    def test_determine_verification_low_confidence(self, ocr_service):
        """Test rejection with low confidence."""
        # Arrange
        ocr_data = ProofOfResidenceData(
            address=None,
            name=None,
            document_type=None,
            confidence=0.3,
            raw_text="Blurry unreadable text"
        )

        # Act
        result = ocr_service.determine_verification_result(ocr_data)

        # Assert
        assert result["status"] == "rejected"
        assert result["auto"] is True
        assert "quality too low" in result["reason"]

    def test_determine_verification_medium_confidence(self, ocr_service):
        """Test manual review with medium confidence."""
        # Arrange
        ocr_data = ProofOfResidenceData(
            address="123 Main St, Johannesburg, 2001",
            name=None,  # Partial data
            document_type="utility_bill",
            confidence=0.6,
            raw_text="Partially readable text"
        )

        # Act
        result = ocr_service.determine_verification_result(ocr_data)

        # Assert
        assert result["status"] == "pending"
        assert result["auto"] is False
        assert "manual review" in result["reason"]

    def test_extract_proof_of_residence_success(self, ocr_service):
        """Test successful OCR extraction with mocked Tesseract."""
        # Arrange
        from PIL import Image

        # Create a real test image to avoid PIL errors
        mock_image = Image.new('RGB', (100, 100), color='white')

        with patch('src.services.image_utils.Image.open') as mock_image_open, \
             patch('pytesseract.image_to_data') as mock_image_to_data, \
             patch('pytesseract.image_to_string') as mock_image_to_string:

            # Mock PIL Image.open to return our test image
            mock_image_open.return_value = mock_image

            # Mock image_to_data (for confidence)
            mock_image_to_data.return_value = {
                'conf': ['80', '90', '85', '75'],
                'text': ['John', 'Doe', '123', 'Main']
            }

            # Mock image_to_string (for full text)
            mock_image_to_string.return_value = """
            ESKOM ELECTRICITY
            Mr John Doe
            123 Main Street, Johannesburg, 2001
            Account: 123456
            """

            image_bytes = b"fake image data"

            # Act
            result = ocr_service.extract_proof_of_residence(image_bytes)

        # Assert
        assert result.confidence > 0.7  # Average of 80, 90, 85, 75
        assert result.address is not None
        assert "123 Main Street" in result.address
        assert result.name is not None
        assert "John Doe" in result.name
        assert result.document_type == "utility_bill"
        assert "ESKOM" in result.raw_text

    def test_tesseract_not_installed(self, ocr_service_no_tesseract):
        """Test graceful degradation when Tesseract not available."""
        # Arrange
        image_bytes = b"fake image data"

        # Act
        result = ocr_service_no_tesseract.extract_proof_of_residence(image_bytes)

        # Assert
        assert result.confidence == 0.0
        assert result.address is None
        assert result.name is None
        assert result.document_type is None
        assert result.raw_text == ""

    def test_extract_name_with_title(self, ocr_service):
        """Test name extraction with title pattern."""
        # Arrange
        text = "Mr John Smith is the account holder"

        # Act
        result = ocr_service._extract_name_pattern(text)

        # Assert
        assert result is not None
        assert "John Smith" in result

    def test_extract_name_with_label(self, ocr_service):
        """Test name extraction with label pattern."""
        # Arrange
        text = "Account Holder: Jane Doe\nAddress: 123 Main St"

        # Act
        result = ocr_service._extract_name_pattern(text)

        # Assert
        assert result is not None
        assert "Jane Doe" in result

    def test_extract_name_no_match(self, ocr_service):
        """Test returns None when no name pattern found."""
        # Arrange
        text = "just some random lowercase text without names"

        # Act
        result = ocr_service._extract_name_pattern(text)

        # Assert
        assert result is None

    def test_detect_document_type_municipal(self, ocr_service):
        """Test detects municipal account from keywords."""
        # Arrange
        text = """
        City of Johannesburg
        Municipal Account
        Water and Sewerage Charges
        """

        # Act
        result = ocr_service._detect_document_type(text)

        # Assert
        assert result == "municipal_account"

    def test_detect_document_type_lease(self, ocr_service):
        """Test detects lease agreement from keywords."""
        # Arrange
        text = """
        LEASE AGREEMENT
        Landlord: John Smith
        Tenant: Jane Doe
        Monthly Rent: R5000
        """

        # Act
        result = ocr_service._detect_document_type(text)

        # Assert
        assert result == "lease_agreement"
