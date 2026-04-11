import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const analyzeContextStage: PipelineStage = {
  name: "analyze-context",

  async execute(context: RunContext): Promise<void> {
    const { config, logger, store, data } = context;
    const log = logger.child("analyze-context");

    if (!data.meetingContext || !data.selectedMeeting) {
      log.warn("No meeting context to analyze — skipping");
      return;
    }

    // Check if we have any extracted text from documents
    const docsWithText = data.relatedDocuments.filter(
      (d) => d.extractedText && d.extractedText.length > 100
    );

    if (docsWithText.length === 0) {
      log.info("No document text extracted — skipping LLM analysis");
      return;
    }

    log.info(`Analyzing ${docsWithText.length} documents with extracted text for meeting: "${data.meetingContext.meetingTitle}"`);

    // Build the prompt with transcript content
    const systemPrompt = await readFile(
      resolve("prompts", "context-analyzer.txt"),
      "utf-8"
    );

    const textChunks = docsWithText
      .slice(0, 3) // Top 3 docs
      .map((d) => `--- Document: ${d.title} ---\n${d.extractedText!.slice(0, 5000)}`)
      .join("\n\n");

    const userPrompt = [
      `Meeting: ${data.meetingContext.meetingTitle}`,
      `Attendees: ${data.meetingContext.attendeeSummary}`,
      `Meeting is recurring: ${data.selectedMeeting.event.isRecurring}`,
      "",
      "TRANSCRIPT / DOCUMENT CONTENT:",
      textChunks,
    ].join("\n");

    const genAI = new GoogleGenerativeAI(config.llm.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          // @ts-expect-error - thinkingConfig available on 2.5
          thinkingConfig: { thinkingBudget: 2048 },
        },
      });

      const responseText = result.response.text();
      const analysis = JSON.parse(responseText) as {
        summary?: string;
        keyInsights?: string[];
        pendingItems?: string[];
        suggestedPrepQuestions?: string[];
      };

      // Enrich the meeting context with analyzed content
      if (analysis.summary) {
        data.meetingContext.summary = analysis.summary;
      }
      if (analysis.keyInsights?.length) {
        data.meetingContext.keyInsights = analysis.keyInsights;
        log.info(`Found ${analysis.keyInsights.length} key insights`);
      }
      if (analysis.pendingItems?.length) {
        data.meetingContext.pendingItems = analysis.pendingItems;
        log.info(`Found ${analysis.pendingItems.length} pending items`);
      }
      if (analysis.suggestedPrepQuestions?.length) {
        data.meetingContext.suggestedPrepQuestions = analysis.suggestedPrepQuestions;
        log.info(`Found ${analysis.suggestedPrepQuestions.length} prep questions`);
      }

      log.info("Context analysis complete");

      // Save enriched context
      await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
    } catch (err) {
      log.warn(`Context analysis failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      // Non-fatal — script writer can still work with basic context
    }
  },
};
