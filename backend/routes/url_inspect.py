"""POST /api/fetch-url-elements — URL inspection and element extraction."""

from fastapi import APIRouter, HTTPException
from schemas import FetchUrlRequest
from services.html_parser import extract_page_elements
from services.gemini import TestGenError

router = APIRouter()


@router.post("/fetch-url-elements")
async def fetch_url_elements_endpoint(req: FetchUrlRequest):
    """Fetch a URL and extract interactive UI elements from static HTML."""
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="A URL is required.")

    try:
        result = await extract_page_elements(req.url.strip())
        return result
    except TestGenError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"fetch_url_elements failed: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to inspect the URL."
        )
