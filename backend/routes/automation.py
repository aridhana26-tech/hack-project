"""POST /api/generate-automation — Generate Selenium/Java automation project."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Analysis
from schemas import GenerateAutomationRequest
from services.prompts import generate_automation_project
from services.gemini import TestGenError

router = APIRouter()


@router.post("/generate-automation")
async def generate_automation_endpoint(
    req: GenerateAutomationRequest, db: Session = Depends(get_db)
):
    """Generate a full Selenium/Java/TestNG automation project."""
    # Look up the analysis
    row = db.query(Analysis).filter(Analysis.id == req.analysisId).first()
    if not row or not row.results_json:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    results = row.results_json

    try:
        files = await generate_automation_project(results, row.url, req.framework)
    except TestGenError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"generate_automation AI step failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Automation code generation failed. Please try again.",
        )

    # Save automation files back to DB
    try:
        row.automation_json = files
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to save automation files: {e}")

    return files
