export interface RequirementItem {
  id: string;
  description: string;
  priority?: string;
}

export interface RequirementAnalysis {
  functionalRequirements: RequirementItem[];
  nonFunctionalRequirements: RequirementItem[];
  businessRules: string[];
  validations: string[];
  actors: string[];
  inputs: string[];
  outputs: string[];
  errorConditions: string[];
  acceptanceCriteria: string[];
}

export interface UiElement {
  kind: string; // input | button | link | select | checkbox | radio | form
  tag: string;
  id?: string;
  name?: string;
  type?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  dataTestId?: string;
  href?: string;
  options?: string[];
  locator: string;
  locatorStrategy: string; // id | name | data-testid | aria-label | css | xpath
}

export interface PageElements {
  url: string;
  title: string;
  forms: { action?: string; method?: string; fieldCount: number }[];
  elements: UiElement[];
  fetchedAt: string;
  note?: string;
}

export interface TestCase {
  id: string;
  title: string;
  category: string; // functional | positive | negative | boundary | edge | security | accessibility
  priority: string;
  preconditions?: string;
  steps: string[];
  testData?: string;
  expectedResult: string;
  requirementIds: string[];
  uiElements: string[];
}

export interface RtmRow {
  requirementId: string;
  requirementSummary: string;
  testCaseIds: string[];
  uiElement: string;
  priority: string;
  risk: string;
  severity: string;
}

export interface AnalysisResults {
  requirementAnalysis: RequirementAnalysis;
  pageElements: PageElements | null;
  summary: string;
  testCases: TestCase[];
  rtm: RtmRow[];
  apiTests: string[];
  dbValidations: string[];
  performanceIdeas: string[];
}

export type AutomationFiles = Record<string, string>;

export interface AnalysisRow {
  id: string;
  user_id: string;
  title: string | null;
  requirement_text: string;
  url: string | null;
  results_json: AnalysisResults | null;
  automation_json: AutomationFiles | null;
  status: string;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
