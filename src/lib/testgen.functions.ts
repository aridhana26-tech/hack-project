import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AnalysisResults,
  AutomationFiles,
  ChatMessage,
  PageElements,
  RequirementAnalysis,
} from "./testgen-types";

/**
 * Step 1: Analyze the requirement text with AI.
 */
export const analyzeRequirementsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requirementText: string }) => {
    if (!input || typeof input.requirementText !== "string" || input.requirementText.trim().length < 20) {
      throw new Error("Requirement text must be at least 20 characters.");
    }
    if (input.requirementText.length > 200_000) {
      throw new Error("Requirement text is too long (max ~200k characters).");
    }
    return { requirementText: input.requirementText.trim() };
  })
  .handler(async ({ data }): Promise<RequirementAnalysis> => {
    const { analyzeRequirements, TestGenError } = await import("./testgen.server");
    try {
      return await analyzeRequirements(data.requirementText);
    } catch (err) {
      console.error("analyzeRequirementsFn failed:", err);
      throw new Error(err instanceof TestGenError ? err.message : "Requirement analysis failed. Please try again.");
    }
  });

/**
 * Step 2: Fetch the target URL and extract UI elements from static HTML.
 */
export const fetchUrlElementsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    if (!input || typeof input.url !== "string" || !input.url.trim()) {
      throw new Error("A URL is required.");
    }
    return { url: input.url.trim() };
  })
  .handler(async ({ data }): Promise<PageElements> => {
    const { extractPageElements, TestGenError } = await import("./testgen.server");
    try {
      return await extractPageElements(data.url);
    } catch (err) {
      console.error("fetchUrlElementsFn failed:", err);
      throw new Error(err instanceof TestGenError ? err.message : "Failed to inspect the URL.");
    }
  });

/**
 * Step 3: Generate test cases, RTM and suggestions; persist the analysis run.
 */
export const generateTestsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requirementText: string;
      url: string | null;
      requirementAnalysis: RequirementAnalysis;
      pageElements: PageElements | null;
    }) => {
      if (!input?.requirementAnalysis) throw new Error("Missing requirement analysis.");
      if (typeof input.requirementText !== "string" || !input.requirementText.trim()) {
        throw new Error("Missing requirement text.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<{ analysisId: string; results: AnalysisResults }> => {
    const { generateTestArtifacts, TestGenError } = await import("./testgen.server");
    let artifacts;
    try {
      artifacts = await generateTestArtifacts(data.requirementAnalysis, data.pageElements);
    } catch (err) {
      console.error("generateTestsFn AI step failed:", err);
      throw new Error(err instanceof TestGenError ? err.message : "Test generation failed. Please try again.");
    }

    const results: AnalysisResults = {
      requirementAnalysis: data.requirementAnalysis,
      pageElements: data.pageElements,
      ...artifacts,
    };

    let title = "Requirement analysis";
    if (data.url) {
      try {
        title = new URL(data.url).hostname;
      } catch {
        title = data.url.slice(0, 60);
      }
    } else {
      title = data.requirementText.replace(/\s+/g, " ").slice(0, 60);
    }

    const { data: row, error } = await context.supabase
      .from("analyses")
      .insert({
        user_id: context.userId,
        title,
        requirement_text: data.requirementText.slice(0, 100_000),
        url: data.url,
        results_json: results as never,
        status: "completed",
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("Failed to save analysis:", error);
      throw new Error("Test cases were generated but saving the analysis failed. Please try again.");
    }

    return { analysisId: row.id, results };
  });

/**
 * Part 4: Generate the Selenium/Java automation project (text output only).
 */
export const generateAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { analysisId: string }) => {
    if (!input?.analysisId || typeof input.analysisId !== "string") {
      throw new Error("Missing analysis id.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<AutomationFiles> => {
    const { generateAutomationProject, TestGenError } = await import("./testgen.server");

    const { data: row, error } = await context.supabase
      .from("analyses")
      .select("id, url, results_json")
      .eq("id", data.analysisId)
      .single();
    if (error || !row?.results_json) {
      console.error("Analysis lookup failed:", error);
      throw new Error("Analysis not found.");
    }

    let files: AutomationFiles;
    try {
      files = await generateAutomationProject(row.results_json as unknown as AnalysisResults, row.url);
    } catch (err) {
      console.error("generateAutomationFn AI step failed:", err);
      throw new Error(
        err instanceof TestGenError ? err.message : "Automation code generation failed. Please try again.",
      );
    }

    const { error: updateError } = await context.supabase
      .from("analyses")
      .update({ automation_json: files as never })
      .eq("id", data.analysisId);
    if (updateError) {
      console.error("Failed to save automation files:", updateError);
    }

    return files;
  });

/**
 * Part 6: Chat about the current analysis.
 */
export const testgenChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { analysisId: string; question: string; history: ChatMessage[] }) => {
    if (!input?.analysisId) throw new Error("Missing analysis id.");
    if (typeof input.question !== "string" || !input.question.trim()) {
      throw new Error("Question cannot be empty.");
    }
    if (input.question.length > 4000) throw new Error("Question is too long (max 4000 characters).");
    return {
      analysisId: input.analysisId,
      question: input.question.trim(),
      history: Array.isArray(input.history) ? input.history.slice(-12) : [],
    };
  })
  .handler(async ({ data, context }): Promise<{ reply: string }> => {
    const { answerChat, TestGenError } = await import("./testgen.server");

    const { data: row, error } = await context.supabase
      .from("analyses")
      .select("requirement_text, results_json")
      .eq("id", data.analysisId)
      .single();
    if (error || !row?.results_json) {
      console.error("Chat analysis lookup failed:", error);
      throw new Error("Analysis not found.");
    }

    try {
      const reply = await answerChat(
        data.question,
        data.history,
        row.results_json as unknown as AnalysisResults,
        row.requirement_text,
      );
      return { reply };
    } catch (err) {
      console.error("testgenChatFn failed:", err);
      throw new Error(err instanceof TestGenError ? err.message : "Chat request failed. Please try again.");
    }
  });

/**
 * Settings: permanently delete the signed-in user's account.
 */
export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      console.error("Account deletion failed:", error);
      throw new Error("Account deletion failed. Please try again or contact support.");
    }
    return { ok: true };
  });
