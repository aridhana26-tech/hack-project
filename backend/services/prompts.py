"""AI prompt templates — ported from testgen.server.ts prompts."""

import json
from services.gemini import call_gemini, parse_model_json, TestGenError


async def analyze_requirements(requirement_text: str) -> dict:
    """Step 1 — Analyze requirement text with AI."""
    system = (
        "You are a senior QA business analyst. Extract structured requirement "
        "information from the document provided. Respond with ONLY a JSON object "
        "(no markdown) with this exact shape:\n"
        "{\n"
        '  "functionalRequirements": [{"id": "FR-001", "description": "...", "priority": "High|Medium|Low"}],\n'
        '  "nonFunctionalRequirements": [{"id": "NFR-001", "description": "...", "priority": "..."}],\n'
        '  "businessRules": ["..."],\n'
        '  "validations": ["..."],\n'
        '  "actors": ["..."],\n'
        '  "inputs": ["..."],\n'
        '  "outputs": ["..."],\n'
        '  "errorConditions": ["..."],\n'
        '  "acceptanceCriteria": ["..."]\n'
        "}"
    )
    user = f"Requirement document:\n\n{requirement_text[:60_000]}"

    raw = await call_gemini(system, user)
    parsed = parse_model_json(raw)

    return {
        "functionalRequirements": parsed.get("functionalRequirements", []),
        "nonFunctionalRequirements": parsed.get("nonFunctionalRequirements", []),
        "businessRules": parsed.get("businessRules", []),
        "validations": parsed.get("validations", []),
        "actors": parsed.get("actors", []),
        "inputs": parsed.get("inputs", []),
        "outputs": parsed.get("outputs", []),
        "errorConditions": parsed.get("errorConditions", []),
        "acceptanceCriteria": parsed.get("acceptanceCriteria", []),
    }


async def generate_test_artifacts(
    analysis: dict, page_elements: dict | None
) -> dict:
    """Step 3 — Generate test cases, RTM and suggestions."""
    system = (
        "You are a principal QA architect. Given a requirement analysis and extracted UI elements, "
        "map requirements to UI elements and produce a complete test design. Respond with ONLY a JSON "
        "object (no markdown) with this exact shape:\n"
        "{\n"
        '  "summary": "2-4 paragraph executive summary of the requirement coverage and testing approach",\n'
        '  "testCases": [{"id": "TC-001", "title": "...", "category": "functional|positive|negative|boundary|edge|security|accessibility", '
        '"priority": "High|Medium|Low", "preconditions": "...", "steps": ["step 1", "step 2"], "testData": "...", '
        '"expectedResult": "...", "requirementIds": ["FR-001"], "uiElements": ["#loginBtn"]}],\n'
        '  "rtm": [{"requirementId": "FR-001", "requirementSummary": "...", "testCaseIds": ["TC-001"], '
        '"uiElement": "#loginBtn", "priority": "High", "risk": "High|Medium|Low", "severity": "Critical|Major|Minor"}],\n'
        '  "apiTests": ["..."],\n'
        '  "dbValidations": ["..."],\n'
        '  "performanceIdeas": ["..."]\n'
        "}\n"
        "Generate thorough coverage: functional, positive, negative, boundary, edge-case, security and "
        "accessibility test cases. Use the real locators from the UI elements when referencing uiElements. "
        "Keep total test cases between 15 and 40."
    )

    page_str = "No URL was provided or no elements were extracted."
    if page_elements:
        page_str = json.dumps(
            {
                "title": page_elements.get("title"),
                "url": page_elements.get("url"),
                "forms": page_elements.get("forms"),
                "elements": page_elements.get("elements", [])[:120],
            }
        )

    user = (
        f"REQUIREMENT ANALYSIS:\n{json.dumps(analysis)}\n\n"
        f"EXTRACTED UI ELEMENTS:\n{page_str}"
    )

    raw = await call_gemini(system, user, temperature=0.3)
    parsed = parse_model_json(raw)

    return {
        "summary": parsed.get("summary", ""),
        "testCases": parsed.get("testCases", []),
        "rtm": parsed.get("rtm", []),
        "apiTests": parsed.get("apiTests", []),
        "dbValidations": parsed.get("dbValidations", []),
        "performanceIdeas": parsed.get("performanceIdeas", []),
    }


async def generate_automation_project(
    results: dict, url: str | None, framework: str = "selenium_java"
) -> dict:
    """Step 4 — Generate a Selenium/Java, Playwright/TS, or Cypress/JS automation project."""
    locators = (results.get("pageElements") or {}).get("elements", [])[:80]
    test_cases = results.get("testCases", [])[:15]

    if framework == "playwright_ts":
        system = (
            "You are a senior SDET. Generate a complete Playwright + TypeScript + Page Object Model automation project "
            "as SOURCE CODE TEXT. Use the REAL locators provided (priority: id > name > data-testid > aria-label > css > xpath). "
            "Include:\n"
            "- package.json (with @playwright/test, typescript, ts-node)\n"
            "- playwright.config.ts (standard Playwright configuration)\n"
            "- tests/example.spec.ts (Playwright test spec implementing the highest-priority test cases using page objects)\n"
            "- pages/BasePage.ts (base class with common actions/methods)\n"
            "- One or more Page Object classes in pages/ folder containing selectors and actions built from locator details\n\n"
            "Respond with ONLY a JSON object (no markdown) mapping file paths to complete file contents, e.g.:\n"
            '{"package.json": "{ ... }", "tests/example.spec.ts": "import { test } from ... "}\n'
            "Escape all content correctly as JSON strings."
        )
    elif framework == "cypress_js":
        system = (
            "You are a senior SDET. Generate a complete Cypress + JavaScript + Page Object Model automation project "
            "as SOURCE CODE TEXT. Use the REAL locators provided (priority: id > name > data-testid > aria-label > css > xpath). "
            "Include:\n"
            "- package.json (with cypress dependency)\n"
            "- cypress.config.js (standard Cypress configuration)\n"
            "- cypress/e2e/example.cy.js (Cypress spec file implementing the highest-priority test cases using page objects)\n"
            "- cypress/support/e2e.js (supporting Cypress configuration)\n"
            "- One or more Page Object classes in cypress/pages/ folder built from locator details\n\n"
            "Respond with ONLY a JSON object (no markdown) mapping file paths to complete file contents, e.g.:\n"
            '{"package.json": "{ ... }", "cypress/e2e/example.cy.js": "describe(...) "}\n'
            "Escape all content correctly as JSON strings."
        )
    else:
        system = (
            "You are a senior SDET. Generate a complete Selenium + Java + TestNG + Maven automation project "
            "as SOURCE CODE TEXT. Use the Page Object Model. Use the REAL locators provided (priority: id > name > "
            "data-testid > aria-label > css > xpath). Include:\n"
            "- pom.xml (Selenium 4, TestNG, WebDriverManager)\n"
            "- testng.xml suite file\n"
            "- src/test/java/base/BaseTest.java\n"
            "- src/test/java/base/DriverFactory.java\n"
            "- src/test/java/pages/BasePage.java\n"
            "- One or more Page Object classes built from the provided locators\n"
            "- TestNG test classes implementing the highest-priority test cases\n\n"
            "Respond with ONLY a JSON object (no markdown) mapping file paths to complete file contents, e.g.:\n"
            '{"pom.xml": "<?xml ...", "src/test/java/base/BaseTest.java": "package base; ..."}\n'
            "Escape all content correctly as JSON strings."
        )

    user = (
        f"Application URL: {url or 'not provided'}\n\n"
        f"UI ELEMENT LOCATORS:\n{json.dumps(locators)}\n\n"
        f"TOP TEST CASES:\n{json.dumps(test_cases)}"
    )

    raw = await call_gemini(system, user, temperature=0.2)
    files = parse_model_json(raw)

    entries = {
        k: v for k, v in files.items() if isinstance(k, str) and isinstance(v, str) and v
    }
    if not entries:
        raise TestGenError(
            "AI did not return any project files. Please try again.", "ai_empty"
        )

    return entries


async def answer_chat(
    question: str,
    history: list[dict],
    results: dict,
    requirement_text: str,
) -> str:
    """Step 5 — QA Copilot chat about analysis results."""
    context = json.dumps(
        {
            "summary": results.get("summary"),
            "testCases": results.get("testCases"),
            "rtm": results.get("rtm"),
            "apiTests": results.get("apiTests"),
            "dbValidations": results.get("dbValidations"),
            "pageTitle": (results.get("pageElements") or {}).get("title"),
            "uiElements": (results.get("pageElements") or {}).get("elements", [])[:60],
        }
    )[:50_000]

    system = (
        "You are the AI TestGen Pro assistant, a senior QA expert. You help the user with follow-up "
        "questions about their analysis: generating additional test cases, explaining test cases by ID, "
        "spotting missing edge cases, SQL validations, etc. Answer in markdown. Be concise and practical.\n\n"
        f"CURRENT ANALYSIS CONTEXT:\n{context}\n\n"
        f"ORIGINAL REQUIREMENT (truncated):\n{requirement_text[:10_000]}"
    )

    # Build conversation for the user prompt
    conversation_parts = []
    for msg in history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        conversation_parts.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")

    conversation_parts.append(f"User: {question}")
    user = "\n\n".join(conversation_parts)

    return await call_gemini(system, user)
