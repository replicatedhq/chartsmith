/**
 * Unit tests for prompts/system.ts
 */

import {
  CHAT_SYSTEM_PROMPT,
  INTENT_CLASSIFICATION_PROMPT,
  CHAT_INSTRUCTIONS,
  buildSystemPrompt,
} from "../prompts/system";

describe("prompts/system", () => {
  describe("CHAT_SYSTEM_PROMPT", () => {
    it("should contain ChartSmith identity", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("ChartSmith");
    });

    it("should contain Helm chart expertise", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("Helm chart");
    });

    it("should contain system constraints section", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("<system_constraints>");
      expect(CHAT_SYSTEM_PROMPT).toContain("</system_constraints>");
    });

    it("should contain code formatting info section", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("<code_formatting_info>");
      expect(CHAT_SYSTEM_PROMPT).toContain("2 spaces for indentation");
    });

    it("should contain message formatting info section", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("<message_formatting_info>");
      expect(CHAT_SYSTEM_PROMPT).toContain("Markdown");
    });

    it("should contain question instructions", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("<question_instructions>");
    });

    it("should not use the word artifact", () => {
      // The prompt instructs to never use "artifact" - this checks the instruction is there
      expect(CHAT_SYSTEM_PROMPT).toContain('NEVER use the word "artifact"');
    });
  });

  describe("INTENT_CLASSIFICATION_PROMPT", () => {
    it("should contain ChartSmith identity", () => {
      expect(INTENT_CLASSIFICATION_PROMPT).toContain("ChartSmith");
    });

    it("should mention plan and chat options", () => {
      expect(INTENT_CLASSIFICATION_PROMPT).toContain("plan");
      expect(INTENT_CLASSIFICATION_PROMPT).toContain("chat");
    });

    it("should be brief and focused", () => {
      // The intent classification prompt should be relatively short
      expect(INTENT_CLASSIFICATION_PROMPT.length).toBeLessThan(600);
    });

    it("should instruct to only say plan or chat", () => {
      expect(INTENT_CLASSIFICATION_PROMPT).toContain('Only say "plan" or "chat"');
    });
  });

  describe("CHAT_INSTRUCTIONS", () => {
    it("should mention Helm chart", () => {
      expect(CHAT_INSTRUCTIONS).toContain("Helm chart");
    });

    it("should mention help with questions", () => {
      expect(CHAT_INSTRUCTIONS).toContain("help");
    });
  });

  describe("buildSystemPrompt", () => {
    it("should return base prompt without options", () => {
      const prompt = buildSystemPrompt();

      expect(prompt).toBe(CHAT_SYSTEM_PROMPT);
    });

    it("should return base prompt with empty options", () => {
      const prompt = buildSystemPrompt({});

      expect(prompt).toBe(CHAT_SYSTEM_PROMPT);
    });

    it("should include chart structure when specified", () => {
      const chartStructure = "File: Chart.yaml\nFile: values.yaml";
      const prompt = buildSystemPrompt({
        includeChartContext: true,
        chartStructure,
      });

      expect(prompt).toContain("<current_chart_structure>");
      expect(prompt).toContain("File: Chart.yaml");
      expect(prompt).toContain("File: values.yaml");
      expect(prompt).toContain("</current_chart_structure>");
    });

    it("should not include chart structure if flag is false", () => {
      const prompt = buildSystemPrompt({
        includeChartContext: false,
        chartStructure: "File: Chart.yaml",
      });

      expect(prompt).not.toContain("<current_chart_structure>");
    });

    it("should not include chart structure if chartStructure is undefined", () => {
      const prompt = buildSystemPrompt({
        includeChartContext: true,
      });

      expect(prompt).not.toContain("<current_chart_structure>");
    });
  });
});
