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

    const systemPrompt = CONTEXT_ANALYZER_PROMPT;

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

const CONTEXT_ANALYZER_PROMPT = `You are analyzing meeting transcripts and documents to prepare an executive for their upcoming meeting.

Given the meeting title, attendees, and extracted text from related transcripts/documents, produce a structured analysis.

Your job is to find the SUBSTANCE — what was actually discussed, what decisions were made, what problems exist, and where the project is headed. Then ADD VALUE by bringing in your own knowledge.

DO NOT:
- Be vague or generic ("the team discussed various topics")
- Comment on the fact that transcripts exist
- Repeat meeting metadata (title, time, attendees)
- State the obvious — the listener knows these meetings well
- Frame everything as questions — the listener wants insights, not an interrogation
- Use terms like "open loops" or "talking points"

DO:
- Summarize the current state of the project/initiative concretely
- Identify specific decisions pending and blockers
- Note what the listener committed to or needs to follow up on
- Bring in outside knowledge: industry trends, tools, frameworks, comparable approaches that could help
- Suggest 1-2 specific ideas or angles the listener hasn't considered — things that could unlock progress or deliver more value
- If relevant, mention a tool, technique, or resource by name that could help (e.g. "Notion AI for doc generation", "n8n for automating the intake workflow")
- Keep prep questions to 1-2 max — only if genuinely important

RATIO RULE: Your output should be 80% insights and statements, 20% or less questions. The listener wants to be TOLD what matters, not ASKED what they think. Lead with conclusions, not questions.

OUTPUT FORMAT — return valid JSON:
{
  "summary": "2-4 sentences on where this project stands and what matters most right now. Be declarative, not interrogative.",
  "keyInsights": ["specific insight stated as a fact or recommendation — NOT a question", "another concrete angle or suggestion"],
  "pendingItems": ["concrete thing that needs resolution — state it as a fact", "specific follow-up the listener owns"],
  "suggestedPrepQuestions": ["at most 1 sharp question, only if genuinely critical — most runs should have 0-1 questions"]
}

Keep keyInsights to 3-5 items. Keep pendingItems to 2-3 items. Keep suggestedPrepQuestions to 0-1 items. Be specific and substantive.`;
