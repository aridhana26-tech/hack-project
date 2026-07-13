import asyncio
import json
import os
import re

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY", "")
_model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

if _api_key and _api_key != "your_gemini_api_key_here":
    genai.configure(api_key=_api_key)


class TestGenError(Exception):
    """Custom error for test-generation failures."""

    def __init__(self, message: str, code: str = "internal"):
        super().__init__(message)
        self.code = code


async def call_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    timeout: int = 120,
) -> str:
    """Send a prompt to the Gemini model and return the text response."""
    if not _api_key or _api_key == "your_gemini_api_key_here":
        raise TestGenError(
            "Gemini API key is not configured. Set GEMINI_API_KEY in backend/.env",
            "config",
        )

    max_retries = 3
    initial_delay = 15.0  # seconds

    for attempt in range(max_retries + 1):
        try:
            model = genai.GenerativeModel(
                model_name=_model_name,
                system_instruction=system_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=temperature,
                ),
            )

            # Use thread executor or call directly since it is synchronous
            response = model.generate_content(user_prompt)

            if not response or not response.text:
                raise TestGenError(
                    "AI returned an empty response. Please try again.", "ai_empty"
                )

            return response.text

        except TestGenError:
            raise
        except Exception as e:
            error_msg = str(e).lower()
            is_rate_limit = "429" in error_msg or "resource exhausted" in error_msg or "quota" in error_msg
            
            if is_rate_limit and attempt < max_retries:
                delay = initial_delay * (2 ** attempt)
                print(f"Gemini API rate limited (429). Retrying in {delay}s... (Attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
                continue
                
            if "429" in error_msg or "resource exhausted" in error_msg:
                raise TestGenError(
                    "AI rate limit reached. Please wait a moment and try again.",
                    "rate_limit",
                )
            if "quota" in error_msg:
                raise TestGenError(
                    "AI usage quota exhausted. Check your API key billing.",
                    "credits",
                )
            print(f"Gemini API call failed: {e}")
            raise TestGenError(
                "Could not reach the AI service. Please try again.", "network"
            )


def parse_model_json(raw: str) -> dict:
    """Extract and parse JSON from the model's text response."""
    text = raw.strip()
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text)

    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace == -1 or last_brace == -1:
        print(f"Model output had no JSON object: {text[:300]}")
        raise TestGenError(
            "AI returned an unexpected format. Please try again.", "parse"
        )

    candidate = text[first_brace : last_brace + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        print(f"Failed to parse model JSON: {e}, {candidate[:300]}")
        raise TestGenError(
            "AI returned malformed JSON. Please try again.", "parse"
        )
