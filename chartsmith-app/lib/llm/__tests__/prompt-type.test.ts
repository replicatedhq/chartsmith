/**
 * Unit tests for intent classification (prompt-type.ts)
 */

import {
  isAmbiguousIntent,
  PromptType,
  PromptRole,
  type Intent,
} from "../prompt-type";

describe("prompt-type", () => {
  describe("isAmbiguousIntent", () => {
    it("should return true when all flags are false", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(true);
    });

    it("should return false when isConversational is true", () => {
      const intent: Intent = {
        isConversational: true,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isPlan is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: true,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isOffTopic is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: true,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isChartDeveloper is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: true,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isChartOperator is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: true,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isProceed is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: true,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when isRender is true", () => {
      const intent: Intent = {
        isConversational: false,
        isPlan: false,
        isOffTopic: false,
        isChartDeveloper: false,
        isChartOperator: false,
        isProceed: false,
        isRender: true,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });

    it("should return false when multiple flags are true", () => {
      const intent: Intent = {
        isConversational: true,
        isPlan: true,
        isOffTopic: false,
        isChartDeveloper: true,
        isChartOperator: false,
        isProceed: false,
        isRender: false,
      };

      expect(isAmbiguousIntent(intent)).toBe(false);
    });
  });

  describe("Legacy exports", () => {
    it("should have PromptType enum with Plan and Chat values", () => {
      expect(PromptType.Plan).toBe("plan");
      expect(PromptType.Chat).toBe("chat");
    });

    it("should have PromptRole enum with Packager and User values", () => {
      expect(PromptRole.Packager).toBe("packager");
      expect(PromptRole.User).toBe("user");
    });
  });
});
