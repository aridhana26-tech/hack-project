"""POST /api/generate-tests — Generate test cases, RTM and save to DB."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Analysis
from schemas import GenerateTestsRequest
from services.prompts import generate_test_artifacts
from services.gemini import TestGenError

router = APIRouter()


@router.post("/generate-tests")
async def generate_tests_endpoint(
    req: GenerateTestsRequest, db: Session = Depends(get_db)
):
    """Generate test cases, RTM and suggestions; persist the analysis run."""
    if not req.requirementAnalysis:
        raise HTTPException(status_code=400, detail="Missing requirement analysis.")
    if not req.requirementText or not req.requirementText.strip():
        raise HTTPException(status_code=400, detail="Missing requirement text.")

    # Convert Pydantic models to dicts for the AI service
    analysis_dict = req.requirementAnalysis.model_dump()
    page_dict = req.pageElements.model_dump() if req.pageElements else None

    try:
        artifacts = await generate_test_artifacts(analysis_dict, page_dict)
    except TestGenError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"generate_tests AI step failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Test generation failed. Please try again.",
        )

    # Build results
    results = {
        "requirementAnalysis": analysis_dict,
        "pageElements": page_dict,
        **artifacts,
    }

    # Determine title
    title = "Requirement analysis"
    if req.url:
        try:
            from urllib.parse import urlparse

            title = urlparse(req.url).hostname or req.url[:60]
        except Exception:
            title = req.url[:60]
    else:
        title = req.requirementText.replace("\n", " ")[:60]

    # Save to database
    analysis_id = str(uuid.uuid4())
    row = Analysis(
        id=analysis_id,
        title=title,
        requirement_text=req.requirementText[:100_000],
        url=req.url,
        results_json=results,
        status="completed",
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to save analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Test cases were generated but saving the analysis failed.",
        )

    return {"analysisId": analysis_id, "results": results}
