"""GET/DELETE /api/analyses — History management."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Analysis
from schemas import UpdateAnalysisRequest

router = APIRouter()


@router.get("/analyses")
def list_analyses(limit: int = 100, db: Session = Depends(get_db)):
    """List all analyses, most recent first."""
    rows = (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "title": r.title,
            "url": r.url,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "results_json": r.results_json,
        }
        for r in rows
    ]


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    """Get a single analysis by ID."""
    row = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    return {
        "id": row.id,
        "title": row.title,
        "requirement_text": row.requirement_text,
        "url": row.url,
        "results_json": row.results_json,
        "automation_json": row.automation_json,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: str, db: Session = Depends(get_db)):
    """Delete an analysis by ID."""
    row = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    db.delete(row)
    db.commit()
    return {"ok": True}


@router.put("/analyses/{analysis_id}")
def update_analysis(
    analysis_id: str, req: UpdateAnalysisRequest, db: Session = Depends(get_db)
):
    """Update analysis results and/or title."""
    row = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if req.title is not None:
        row.title = req.title
    if req.results_json is not None:
        row.results_json = req.results_json

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to update analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to save updates.")

    return {"ok": True}
