"""POST /api/chat — QA Copilot follow-up chat."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Analysis
from schemas import ChatRequest, ChatResponse
from services.prompts import answer_chat
from services.gemini import TestGenError

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    """Answer follow-up questions about an analysis using AI."""
    # Look up the analysis
    row = db.query(Analysis).filter(Analysis.id == req.analysisId).first()
    if not row or not row.results_json:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    history = [msg.model_dump() for msg in req.history[-12:]]

    try:
        reply = await answer_chat(
            question=req.question.strip(),
            history=history,
            results=row.results_json,
            requirement_text=row.requirement_text or "",
        )
        return ChatResponse(reply=reply)
    except TestGenError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"chat failed: {e}")
        raise HTTPException(
            status_code=500, detail="Chat request failed. Please try again."
        )
