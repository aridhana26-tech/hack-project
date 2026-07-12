"""Pydantic request/response schemas."""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Requirement Analysis ──

class RequirementItem(BaseModel):
    id: str
    description: str
    priority: Optional[str] = None


class RequirementAnalysis(BaseModel):
    functionalRequirements: list[RequirementItem] = []
    nonFunctionalRequirements: list[RequirementItem] = []
    businessRules: list[str] = []
    validations: list[str] = []
    actors: list[str] = []
    inputs: list[str] = []
    outputs: list[str] = []
    errorConditions: list[str] = []
    acceptanceCriteria: list[str] = []


class AnalyzeRequirementsRequest(BaseModel):
    requirementText: str = Field(..., min_length=20, max_length=200_000)


# ── URL Inspection ──

class UiElement(BaseModel):
    kind: str
    tag: str
    id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    text: Optional[str] = None
    placeholder: Optional[str] = None
    ariaLabel: Optional[str] = None
    dataTestId: Optional[str] = None
    href: Optional[str] = None
    options: Optional[list[str]] = None
    locator: str
    locatorStrategy: str


class FormInfo(BaseModel):
    action: Optional[str] = None
    method: Optional[str] = None
    fieldCount: int = 0


class PageElements(BaseModel):
    url: str
    title: str
    forms: list[FormInfo] = []
    elements: list[UiElement] = []
    fetchedAt: str
    note: Optional[str] = None


class FetchUrlRequest(BaseModel):
    url: str


# ── Test Generation ──

class TestCase(BaseModel):
    id: str
    title: str
    category: str
    priority: str
    preconditions: Optional[str] = None
    steps: list[str] = []
    testData: Optional[str] = None
    expectedResult: str
    requirementIds: list[str] = []
    uiElements: list[str] = []


class RtmRow(BaseModel):
    requirementId: str
    requirementSummary: str
    testCaseIds: list[str] = []
    uiElement: str
    priority: str
    risk: str
    severity: str


class AnalysisResults(BaseModel):
    requirementAnalysis: RequirementAnalysis
    pageElements: Optional[PageElements] = None
    summary: str = ""
    testCases: list[TestCase] = []
    rtm: list[RtmRow] = []
    apiTests: list[str] = []
    dbValidations: list[str] = []
    performanceIdeas: list[str] = []


class GenerateTestsRequest(BaseModel):
    requirementText: str
    url: Optional[str] = None
    requirementAnalysis: RequirementAnalysis
    pageElements: Optional[PageElements] = None


class GenerateTestsResponse(BaseModel):
    analysisId: str
    results: AnalysisResults


# ── Automation ──

class GenerateAutomationRequest(BaseModel):
    analysisId: str
    framework: str = "selenium_java"


class UpdateAnalysisRequest(BaseModel):
    title: Optional[str] = None
    results_json: Optional[Any] = None


# ── Chat ──

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    analysisId: str
    question: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


# ── Analysis listing ──

class AnalysisListItem(BaseModel):
    id: str
    title: Optional[str] = None
    url: Optional[str] = None
    created_at: str
    results_json: Optional[Any] = None

    class Config:
        from_attributes = True


class AnalysisDetail(BaseModel):
    id: str
    title: Optional[str] = None
    requirement_text: str
    url: Optional[str] = None
    results_json: Optional[Any] = None
    automation_json: Optional[Any] = None
    status: str
    created_at: str

    class Config:
        from_attributes = True
