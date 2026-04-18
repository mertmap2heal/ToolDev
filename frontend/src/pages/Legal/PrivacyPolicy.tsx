import LegalLayout from './LegalLayout'

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="2026-04-17">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          1. Introduction
        </h2>
        <p>
          This Privacy Policy describes how Engineering Tool (&ldquo;we&rdquo;,
          &ldquo;our&rdquo;, or &ldquo;the Service&rdquo;) collects, uses, and protects
          information about you when you use the Service. By creating an account or
          using the Service you agree to the practices described below. If you do not
          agree, please do not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          2. Information we collect
        </h2>
        <p className="mb-2">We collect the following categories of information:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Account data:</strong> name, email address, username, password
            hash, organization or company name, and role.
          </li>
          <li>
            <strong>Project content:</strong> data you enter into the platform such as
            requirements, parameters, verification records, tasks, attachments, comments,
            and diagrams.
          </li>
          <li>
            <strong>Session data:</strong> a JSON Web Token (JWT) is stored in your
            browser&rsquo;s local storage to keep you signed in. This token is not a
            cookie and is not transmitted to third parties.
          </li>
          <li>
            <strong>Activity logs:</strong> records of login events, changes to records,
            and audit trails required for engineering traceability and security.
          </li>
          <li>
            <strong>Technical data:</strong> browser user agent, IP address, and basic
            request metadata collected by our servers for operational and security
            purposes.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          3. How we use your information
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To authenticate you and provide access to your projects.</li>
          <li>To operate, maintain, and improve the Service.</li>
          <li>To communicate account or service-related notices.</li>
          <li>To investigate abuse, enforce our Terms of Use, and comply with law.</li>
          <li>
            To generate anonymized, aggregated usage statistics that do not identify any
            individual.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          4. Cookies and local storage
        </h2>
        <p>
          The Service uses browser local storage to store your authentication token and
          user-interface preferences (for example theme and active project). We do not
          use third-party advertising cookies. Clearing your browser storage will sign
          you out and reset your preferences.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          5. Third-party services
        </h2>
        <p>
          The Service may optionally integrate with third-party providers such as SMTP
          email delivery (for password reset emails and invitations) and self-hosted
          database infrastructure. When used, only the information strictly necessary
          for that service is shared. No personal data is sold.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          6. Data retention
        </h2>
        <p>
          Account data is retained for the lifetime of your account. Project content is
          retained for the lifetime of the project workspace. Soft-deleted records are
          permanently purged after 30 days by a scheduled cleanup job. You may request
          deletion of your account at any time by contacting us.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          7. Your rights
        </h2>
        <p className="mb-2">
          Depending on your location, you may have the following rights under GDPR, UK
          GDPR, CCPA, or similar regulations:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>The right to access a copy of the personal data we hold about you.</li>
          <li>The right to correct inaccurate or incomplete personal data.</li>
          <li>The right to request deletion of your personal data.</li>
          <li>The right to object to or restrict certain processing.</li>
          <li>The right to data portability in a commonly used machine-readable format.</li>
          <li>The right to withdraw consent where processing is based on consent.</li>
          <li>The right to lodge a complaint with a supervisory authority.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          8. Security
        </h2>
        <p>
          We use industry-standard security measures including bcrypt password hashing,
          JWT-based authentication, HTTPS transport encryption, and access controls at
          the project membership level. No system is completely secure, and we cannot
          guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          9. Changes to this policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          announced in the Service and the &ldquo;Last updated&rdquo; date at the top of
          this page will be revised. Continued use of the Service after changes take
          effect constitutes acceptance of the revised policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          10. Contact
        </h2>
        <p>
          For questions, concerns, or requests regarding this Privacy Policy or your
          personal data, please contact us at the address configured in your
          deployment&rsquo;s support channel. In a production deployment this section
          must include a verified contact address and, where required, a designated
          data protection officer.
        </p>
      </section>
    </LegalLayout>
  )
}
