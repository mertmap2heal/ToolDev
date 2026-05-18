// NX-7 (#460) — the objective-completion matrix contract.
//
// The shared shape returned by GET /certification/:projectId/objective-matrix
// and consumed by the frontend <ObjectiveCompletionMatrix> component. The
// frontend imports this `.ts` directly via the Vite `shared` alias; the
// backend imports the committed `_compiled/index.js` build artefact (its
// tsconfig `rootDir` is `./src` and cannot compile a `.ts` outside src/ —
// kb/infrastructure.md, the shared `_compiled/` pattern, as N-2.3 established
// for shared/incoseEars). This `.ts` is the single source of truth — after
// editing it, regenerate the artefacts: `cd shared/objectiveMatrix && npx tsc`.
//
// One contract, no duplicate definition — backend and frontend share this.
export {};
