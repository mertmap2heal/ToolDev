import { useState } from 'react'

/**
 * Section - FAQ. Landing-local accessible accordion (NOT a shared
 * primitive - the Phase-3 component library is the out-of-scope
 * follow-on). The six questions are the aerospace chief engineer's
 * decisive objections; the answers echo vision-and-usp.md positioning.
 */

type QA = { q: string; a: string }

const FAQS: QA[] = [
  {
    q: 'Which standards do you support?',
    a: 'DO-178C (DAL A through D), DO-254, ARP4754A, and DO-326A today. ISO 26262 and IEC 62304 are next - the objective engine extends to each.',
  },
  {
    q: 'Is the tool itself certified?',
    a: 'No tool is a certification. Verum is built around the objectives so your evidence is audit-shaped from the moment you write it; certification is yours to earn, with us.',
  },
  {
    q: 'Can an AI sign anything off?',
    a: 'Never. AI proposes; a human disposes. Every AI suggestion is recorded with its model, prompt, and context - and the export pipeline rejects any artefact whose review chain is AI-only.',
  },
  {
    q: 'Do you replace Jira, DOORS, or Azure DevOps?',
    a: 'We replace requirements, baselines, and evidence. We integrate with your task tracker - keep the queue your team already runs. The hub is bidirectional and provenance-aware.',
  },
  {
    q: 'Where does our data go - we ship ITAR work?',
    a: 'You choose per project: default-hosted, your own API key, or fully self-hosted on your tenant. No AI call leaves your environment unless you configure it to.',
  },
  {
    q: 'What if we cancel?',
    a: 'One command exports the full project - requirements, evidence, baselines, and signatures - as structured JSON alongside the original files. Your data stays in your hands.',
  },
]

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="pl-section" aria-label="Frequently asked questions">
      <div className="pl-container">
        <div className="pl-section__lede">
          <div className="pl-eyebrow">For aerospace buyers</div>
          <h2 className="pl-display pl-display-lg pl-section-head__heading">
            The questions that decide it.
          </h2>
        </div>
        <div className="pl-faq__list">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i
            const panelId = `pl-faq-panel-${i}`
            const buttonId = `pl-faq-button-${i}`
            return (
              <div className="pl-faq__item" key={item.q}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    className="pl-faq__question"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="pl-faq__icon" aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="pl-faq__answer"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
