import LegalLayout from './LegalLayout'

export default function TermsOfUse() {
  return (
    <LegalLayout title="Terms of Use" lastUpdated="2026-04-17">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          1. Acceptance of terms
        </h2>
        <p>
          These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of
          Engineering Tool (the &ldquo;Service&rdquo;). By creating an account,
          accessing, or using the Service, you agree to be bound by these Terms and by
          our Privacy Policy. If you do not agree, you must not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          2. Accounts
        </h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials
          and for any activity under your account. You must provide accurate information
          at registration and keep it up to date. You must promptly notify us of any
          unauthorized use of your account.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          3. Acceptable use
        </h2>
        <p className="mb-2">You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Service for any unlawful purpose or in violation of applicable law.</li>
          <li>
            Upload content you do not have the right to share, or content that infringes
            intellectual property or privacy rights of others.
          </li>
          <li>
            Attempt to disrupt, probe, reverse engineer, or circumvent security
            mechanisms of the Service.
          </li>
          <li>
            Use the Service to transmit malware, conduct automated scraping beyond
            published APIs, or otherwise abuse system resources.
          </li>
          <li>Share your account credentials with unauthorized third parties.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          4. Your content
        </h2>
        <p>
          You retain all rights to the engineering data, requirements, diagrams,
          attachments, and other content you create in the Service (&ldquo;Your
          Content&rdquo;). You grant us a limited licence to host, process, and display
          Your Content solely for the purpose of providing the Service to you and your
          project collaborators.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          5. Our content and intellectual property
        </h2>
        <p>
          The Service, its software, design, branding, and documentation are protected
          by copyright, trademark, and other intellectual-property laws. Except for
          rights expressly granted in these Terms, no rights to our intellectual property
          are transferred to you.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          6. Availability and modifications
        </h2>
        <p>
          The Service is provided on an &ldquo;as available&rdquo; basis. We may modify,
          suspend, or discontinue features of the Service at any time. We will make
          reasonable efforts to notify active customers of material service changes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          7. Disclaimers
        </h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind,
          whether express or implied, including but not limited to warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do
          not warrant that the Service will be uninterrupted, error-free, or secure.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          8. Limitation of liability
        </h2>
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect,
          incidental, special, consequential, or punitive damages, or for any loss of
          profits, revenue, data, or goodwill arising out of or related to your use of
          the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          9. Indemnification
        </h2>
        <p>
          You agree to indemnify and hold us harmless from any claims, liabilities,
          damages, and expenses (including reasonable legal fees) arising out of your
          use of the Service, your content, or your violation of these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          10. Termination
        </h2>
        <p>
          We may suspend or terminate your access to the Service at any time for
          violation of these Terms or for reasonable operational or legal reasons. You
          may terminate your account at any time by contacting us or by using in-product
          account deletion if available. Provisions that by their nature should survive
          termination will survive.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          11. Governing law
        </h2>
        <p>
          These Terms are governed by the laws of the jurisdiction specified in your
          order form or, absent such specification, the jurisdiction in which we operate.
          Any disputes will be resolved in the courts of that jurisdiction.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          12. Changes to the terms
        </h2>
        <p>
          We may update these Terms from time to time. Material changes will be announced
          in the Service and the &ldquo;Last updated&rdquo; date at the top of this page
          will be revised. Continued use of the Service after the effective date of the
          revised Terms constitutes acceptance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          13. Contact
        </h2>
        <p>
          For questions about these Terms, please contact us at the address configured
          in your deployment&rsquo;s support channel. In a production deployment this
          section must include a verified legal contact address.
        </p>
      </section>
    </LegalLayout>
  )
}
