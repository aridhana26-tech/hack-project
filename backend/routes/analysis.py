"""POST /api/analyze-requirements — AI requirement analysis."""

from fastapi import APIRouter, HTTPException
from schemas import AnalyzeRequirementsRequest
from services.prompts import analyze_requirements
from services.gemini import TestGenError

router = APIRouter()


@router.post("/analyze-requirements")
async def analyze_requirements_endpoint(req: AnalyzeRequirementsRequest):
    """Analyze requirement text with AI and return structured analysis."""
    try:
        result = await analyze_requirements(req.requirementText.strip())
        return result
    except TestGenError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"analyze_requirements failed: {e}")
        raise HTTPException(
            status_code=500, detail="Requirement analysis failed. Please try again."
        )
