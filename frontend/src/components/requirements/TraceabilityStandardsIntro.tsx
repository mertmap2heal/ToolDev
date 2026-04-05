/**
 * Short, user-facing mapping of Traceability tab sections to aerospace / systems-engineering practice.
 * Standards cite themes (ISO 29148, ARP4754A, DO-178C/DO-254)—exact obligations follow the program plan.
 */
export default function TraceabilityStandardsIntro() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-left">
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
        Aerospace and systems engineering alignment
      </p>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
        Section order reflects common practice under ISO/IEC/IEEE 29148 and systems-engineering life cycles (e.g. SAE ARP4754A
        themes): backward trace to sources and documents; specification decomposition (parent/child); semantic links between
        requirements; allocation to architecture (PBS, functions, interfaces); forward trace to verification and validation;
        safety, risk, and certification or change drivers. DO-178C and DO-254 programs typically use these classes of links for
        bidirectional trace and review evidence—your certification and safety plans define what must be populated.
      </p>
    </div>
  )
}
