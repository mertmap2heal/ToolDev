import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: 'What is the scope of this tool?',
    answer:
      'The tool covers the full engineering lifecycle: requirements management, traceability, change control, verification and validation, risk management, safety analysis, and documentation. It supports multi-project organization with role-based access.',
  },
  {
    question: 'How does security and access control work?',
    answer:
      'Access is controlled via role-based permissions. Administrators define roles and assign users to projects. Audit logs record key actions for compliance and accountability.',
  },
  {
    question: 'Can we integrate with other tools?',
    answer:
      'The platform supports import and export of data in standard formats. Integration capabilities can be extended based on your organization\'s needs.',
  },
  {
    question: 'Is it suitable for on-premise or cloud deployment?',
    answer:
      'The application can be deployed in both on-premise and cloud environments. Contact your administrator or deployment team for environment-specific setup.',
  },
  {
    question: 'How do we get support?',
    answer:
      'Support is provided through your organization\'s designated channels. For general inquiries, contact contact@company.com.',
  },
  {
    question: 'Is there a pricing page?',
    answer:
      'Pricing is tailored to your organization\'s needs. Please contact your sales representative or contact@company.com for more information.',
  },
]

export default function FAQAccordion() {
  const [openId, setOpenId] = useState<number | null>(0)

  const toggle = useCallback((id: number) => {
    setOpenId((prev) => (prev === id ? null : id))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle(id)
      }
    },
    [toggle]
  )

  return (
    <section id="faq" className="py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Common questions about the engineering lifecycle platform.
          </p>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, index) => {
            const isOpen = openId === index
            const panelId = `faq-panel-${index}`
            const buttonId = `faq-button-${index}`
            return (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
              >
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <span className="font-medium">{faq.question}</span>
                  {isOpen ? (
                    <ChevronDown size={20} className="shrink-0 text-gray-500" aria-hidden />
                  ) : (
                    <ChevronRight size={20} className="shrink-0 text-gray-500" aria-hidden />
                  )}
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={clsx(
                    'overflow-hidden transition-all duration-200',
                    isOpen ? 'max-h-96' : 'max-h-0'
                  )}
                >
                  <div className="px-4 pb-4 pt-0 text-gray-600 dark:text-gray-400 text-sm">
                    {faq.answer}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
