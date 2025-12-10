/**
 * Unit tests for intent classification (prompt-type.ts)
 *
 * Only tests meaningful business logic - TypeScript handles type safety.
 */

import { isAmbiguousIntent, type Intent } from "../prompt-type";

describe("prompt-type", () => {
  describe("isAmbiguousIntent", () => {
    it("should return true when all flags are false (ambiguous)", () => {
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

    it("should return false when any flag is true (not ambiguous)", () => {
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
  });
});
