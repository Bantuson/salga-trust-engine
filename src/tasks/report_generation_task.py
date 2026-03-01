"""Celery task for statutory report PDF and DOCX generation.

Generates PDF (via WeasyPrint + Jinja2) and DOCX (via docxtpl) files for
statutory reports. Triggered on-demand by POST /api/v1/statutory-reports/{id}/generate.

Supported report types:
- section_52:  Section 52 quarterly performance report -> section_52.html
- section_72:  Section 72 mid-year assessment         -> section_72.html
- section_46:  Section 46 annual performance report   -> section_46.html (Plan 30-02)
- section_121: Section 121 annual financial statements -> section_121.html (Plan 30-02)

Storage:
    For MVP, generated files are stored in src/generated_reports/{report_id}/.
    Production deployment would use Supabase Storage or S3.

Pattern follows src/tasks/pa_notify_task.py:
- asyncio.run() wraps async logic (Celery workers are synchronous)
- Windows event loop compatibility via WindowsSelectorEventLoopPolicy
- Tenant discovery via set_tenant_context() with try/finally

REPORT-08 (Branded Export):
    Templates include municipality logo_url passed from assemble_report_data().
    Draft watermark shown when status < mm_approved (show_watermark=True context key).
"""
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)

# Base directory for generated report files
_GENERATED_REPORTS_DIR = Path(__file__).parent.parent / "generated_reports"
_TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "statutory"


# Template mapping by report type
_TEMPLATE_MAP = {
    "section_52": "section_52.html",
    "section_72": "section_72.html",
    "section_46": "section_46.html",
    "section_121": "section_121.html",
}


@app.task(
    bind=True,
    name="src.tasks.report_generation_task.generate_statutory_report",
    max_retries=3,
)
def generate_statutory_report(self, report_id: str, user_id: str) -> dict:
    """Generate PDF and DOCX files for a statutory report.

    Args:
        report_id: UUID string of the StatutoryReport to generate.
        user_id:   UUID string of the user who triggered generation.

    Returns:
        Dict with keys: report_id, pdf_path, docx_path, generated_at.
    """
    # Windows event loop compatibility (required for development on Windows)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run() -> dict:
        from sqlalchemy import text

        from src.core.database import AsyncSessionLocal
        from src.core.tenant import clear_tenant_context, set_tenant_context
        from src.models.statutory_report import StatutoryReport, ReportStatus
        from src.services.statutory_report_service import StatutoryReportService
        from sqlalchemy import select

        service = StatutoryReportService()

        async with AsyncSessionLocal() as db:
            # Tenant discovery via raw SQL — bypasses ORM do_orm_execute RLS filter
            tenant_result = await db.execute(
                text(
                    "SELECT tenant_id FROM statutory_reports "
                    "WHERE id = :report_id"
                ).bindparams(report_id=report_id)
            )
            row = tenant_result.fetchone()
            if row is None:
                raise ValueError(f"Statutory report {report_id} not found")
            tenant_id = row[0]

        set_tenant_context(tenant_id)
        try:
            async with AsyncSessionLocal() as db:
                # Fetch the report
                from uuid import UUID
                result = await db.execute(
                    select(StatutoryReport).where(StatutoryReport.id == UUID(report_id))
                )
                report = result.scalar_one_or_none()
                if report is None:
                    raise ValueError(f"Statutory report {report_id} not found in tenant context")

                # Verify template exists
                template_filename = _TEMPLATE_MAP.get(report.report_type)
                if template_filename is None:
                    raise ValueError(f"Unknown report type: {report.report_type}")

                template_path = _TEMPLATES_DIR / template_filename
                if not template_path.exists():
                    raise FileNotFoundError(
                        f"Template for {report.report_type} not found at {template_path}. "
                        "Ensure Plan 30-02 has been executed for section_46 and section_121 templates."
                    )

                # Assemble template context
                context = await service.assemble_report_data(report, db)

                # Create output directory
                output_dir = _GENERATED_REPORTS_DIR / report_id
                output_dir.mkdir(parents=True, exist_ok=True)

                # --- PDF Generation (WeasyPrint) ---
                pdf_path = output_dir / f"{report.report_type}_{report.financial_year.replace('/', '-')}.pdf"
                try:
                    import jinja2
                    from weasyprint import HTML

                    # Render HTML from Jinja2 template
                    env = jinja2.Environment(
                        loader=jinja2.FileSystemLoader(str(_TEMPLATES_DIR)),
                        autoescape=True,
                    )
                    template = env.get_template(template_filename)
                    html_string = template.render(**context)

                    # Generate PDF
                    HTML(string=html_string).write_pdf(str(pdf_path))
                    report.pdf_storage_path = str(pdf_path)
                    logger.info(
                        "PDF generated: report=%s path=%s",
                        report_id,
                        pdf_path,
                    )
                except ImportError as e:
                    logger.warning(
                        "WeasyPrint not available (%s). PDF generation skipped.", e
                    )
                except Exception as e:
                    logger.error(
                        "PDF generation failed for report %s: %s",
                        report_id,
                        e,
                        exc_info=True,
                    )

                # --- DOCX Generation (docxtpl) ---
                docx_template_path = _TEMPLATES_DIR / f"{report.report_type}.docx"
                if docx_template_path.exists():
                    docx_path = output_dir / f"{report.report_type}_{report.financial_year.replace('/', '-')}.docx"
                    try:
                        from docxtpl import DocxTemplate

                        doc = DocxTemplate(str(docx_template_path))
                        doc.render(context)
                        doc.save(str(docx_path))
                        report.docx_storage_path = str(docx_path)
                        logger.info(
                            "DOCX generated: report=%s path=%s",
                            report_id,
                            docx_path,
                        )
                    except ImportError as e:
                        logger.warning(
                            "docxtpl not available (%s). DOCX generation skipped.", e
                        )
                    except Exception as e:
                        logger.error(
                            "DOCX generation failed for report %s: %s",
                            report_id,
                            e,
                            exc_info=True,
                        )
                else:
                    logger.info(
                        "DOCX template not found at %s — skipping DOCX generation (graceful degradation).",
                        docx_template_path,
                    )

                # Update report metadata
                report.generated_by = user_id
                report.generated_at = datetime.now(timezone.utc)
                report.updated_by = user_id

                await db.commit()

                return {
                    "report_id": report_id,
                    "pdf_path": str(report.pdf_storage_path) if report.pdf_storage_path else None,
                    "docx_path": str(report.docx_storage_path) if report.docx_storage_path else None,
                    "generated_at": report.generated_at.isoformat() if report.generated_at else None,
                }

        except Exception as exc:
            logger.error(
                "Report generation failed for %s: %s",
                report_id,
                exc,
                exc_info=True,
            )
            raise
        finally:
            clear_tenant_context()

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(f"Report generation task failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
