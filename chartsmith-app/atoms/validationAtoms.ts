/**
 * PR4: Validation Atoms
 *
 * Jotai atoms for managing validation state and results.
 * These atoms are used by ValidationResults component to display
 * validation findings from the validateChart tool.
 */

import { atom } from 'jotai';
import type { ValidationResult } from '@/lib/ai/tools/validateChart';

/**
 * Validation data structure stored in atoms
 */
export interface ValidationData {
  id: string;
  result: ValidationResult;
  workspaceId: string;
  timestamp: Date;
}

/**
 * Store all validations
 */
export const validationsAtom = atom<ValidationData[]>([]);

/**
 * Getter atom for fetching validation by ID
 */
export const validationByIdAtom = atom((get) => {
  const validations = get(validationsAtom);
  return (id: string) => validations.find((v) => v.id === id);
});

/**
 * Action atom for adding/updating validations
 */
export const handleValidationUpdatedAtom = atom(
  null,
  (get, set, validation: ValidationData) => {
    const current = get(validationsAtom);
    const existing = current.findIndex((v) => v.id === validation.id);
    if (existing >= 0) {
      const updated = [...current];
      updated[existing] = validation;
      set(validationsAtom, updated);
    } else {
      set(validationsAtom, [...current, validation]);
    }
  }
);

/**
 * Action atom for clearing all validations (e.g., on workspace change)
 */
export const clearValidationsAtom = atom(null, (get, set) => {
  set(validationsAtom, []);
});
