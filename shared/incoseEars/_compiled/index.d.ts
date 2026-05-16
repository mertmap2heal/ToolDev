/**
 * INCOSE / EARS requirement-quality validator.
 *
 * Pure, deterministic, dependency-free. No DB, no I/O, no React, no async.
 * The frontend editor pre-check and the backend write-time gate import the
 * SAME code so the two can never drift.
 *
 * - The frontend imports the source directly via the Vite `shared` alias
 *   (`import { validateRequirementText } from 'shared/incoseEars'`).
 * - The backend imports the committed compiled output
 *   (`import { validateRequirementText } from '../../../shared/incoseEars/_compiled/index.js'`).
 *   The backend `tsconfig.json` has `rootDir: ./src`, so it cannot compile a
 *   `.ts` outside `src/`; and Node ESM cannot do a relative directory import.
 *   `_compiled/` is this file's build output, regenerated with `tsc` and
 *   committed (the same pattern as `shared/types/*.js`).
 *
 * Ruling applied (issue #428, Architecture PM gate): `support` and `handle`
 * are `warn` severity, not `error`. The `error` block-list is reserved for
 * genuinely-unmeasurable terms so a block stays credible.
 */
export type FindingSeverity = 'error' | 'warn';
export type EarsPattern = 'ubiquitous' | 'event-driven' | 'state-driven' | 'optional-feature' | 'unwanted-behaviour' | 'unstructured';
export interface QualityFinding {
    /** Stable rule identifier, e.g. `incose.vague-term`. */
    ruleId: string;
    /** `error` blocks the save; `warn` advises only. */
    severity: FindingSeverity;
    /** Engineer-voice message: the offending token in quotes + one concrete fix. */
    message: string;
    /** The offending substring, when the finding is term-scoped. */
    term?: string;
    /** Char offsets [start, end) into the validated plain text, when term-scoped. */
    span?: [number, number];
}
export interface RequirementQualityReport {
    findings: QualityFinding[];
    /** 0-100, advisory only. The block is driven by `hasErrors`, never the score. */
    score: number;
    earsPattern: EarsPattern;
    /** True when any finding is `error` severity. Drives the write-time block. */
    hasErrors: boolean;
}
/**
 * Strip TipTap rich-text HTML and `{{param:...}}` placeholders to plain text.
 * Validation runs on the plain text so markup tokens never cause spurious
 * findings. Mirrors `backend/src/utils/htmlToPlainText.ts`, plus the
 * parameter-placeholder strip the requirements editor needs.
 */
export declare function stripToPlainText(html: string | null | undefined): string;
/**
 * Classify a requirement against the EARS templates. First match wins.
 * `unstructured` is NOT itself a fault (gap-summary #3 — some requirements
 * legitimately do not fit EARS); it only downgrades the measurable / no-shall
 * heuristics. The block always comes from `error`-severity findings.
 */
export declare function classifyEars(text: string): EarsPattern;
/**
 * Validate a single requirement's description.
 *
 * @param text  The requirement description. May be raw TipTap HTML or plain
 *              text; HTML and `{{param:...}}` placeholders are stripped first.
 */
export declare function validateRequirementText(text: string): RequirementQualityReport;
