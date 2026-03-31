import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 48px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text3)', display: 'flex', alignItems: 'center',
          gap: 6, padding: '0 0 20px', fontSize: '0.9rem',
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '2rem', marginBottom: 4 }}>
        Privacy Policy
      </h1>
      <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 32 }}>
        4Brazucas, LLC · Effective Date: April 1, 2026 · Contact:{' '}
        <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a>
      </p>

      <Section title="1. Introduction">
        4Brazucas, LLC ("we," "our," or "us") operates FitTrack and other digital services. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
      </Section>

      <Section title="2. Information We Collect">
        <SubSection title="Account Information">
          When you register, we collect your name and email address. This information is used to create and manage your account.
        </SubSection>
        <SubSection title="Fitness Data">
          FitTrack stores workout sessions, body weight logs, and fitness goals you enter. This data is stored locally on your device and synced to our servers solely to provide the service to you.
        </SubSection>
        <SubSection title="Email Address">
          We collect your email address for account authentication, service communications, and marketing purposes. You may opt out of marketing emails at any time by contacting{' '}
          <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a>.
        </SubSection>
        <SubSection title="Usage Data">
          We may automatically collect non-personal information such as browser type, device type, pages visited, and time spent on the service to improve our platform.
        </SubSection>
      </Section>

      <Section title="3. Cookies and Tracking Technologies">
        <p>We use cookies and similar tracking technologies to operate and improve our services. These may include:</p>
        <ul>
          <li><strong>Essential cookies</strong> — required for the service to function, including authentication sessions</li>
          <li><strong>Analytics cookies</strong> — to understand how users interact with our platform</li>
          <li><strong>Advertising cookies</strong> — we may use Google AdSense or other advertising partners who use cookies to serve ads based on your prior visits to our website and other sites on the internet</li>
        </ul>
        <p>You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of our services.</p>
      </Section>

      <Section title="4. Google AdSense and Advertising Partners">
        We may display advertisements served by Google AdSense or other third-party advertising partners. These partners may use cookies and web beacons to collect information about your visits to this and other websites to provide relevant advertisements. Google's use of advertising cookies enables it and its partners to serve ads based on your visit to our site and other sites on the internet.
        {' '}You may opt out of personalized advertising by visiting{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Google Ads Settings</a>
        {' '}or{' '}
        <a href="https://aboutads.info" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>aboutads.info</a>.
      </Section>

      <Section title="5. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul>
          <li>Create and manage your account</li>
          <li>Provide and improve our services</li>
          <li>Send service-related communications</li>
          <li>Send marketing communications (you may opt out at any time)</li>
          <li>Display relevant advertisements through our advertising partners</li>
          <li>Comply with legal obligations</li>
        </ul>
      </Section>

      <Section title="6. Data Sharing">
        <p>We do not sell your personal data. We may share your information with:</p>
        <ul>
          <li><strong>Service providers</strong> — third parties that help us operate our platform (hosting, database, email delivery)</li>
          <li><strong>Advertising partners</strong> — such as Google AdSense, who may receive anonymized usage data for ad targeting</li>
          <li><strong>Legal requirements</strong> — if required by law or to protect our rights</li>
        </ul>
      </Section>

      <Section title="7. Data Retention">
        We retain your account data for as long as your account is active. You may request deletion of your account and associated data at any time by emailing{' '}
        <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a>. We will process your request within 30 days.
      </Section>

      <Section title="8. Data Security">
        We implement industry-standard security measures including encrypted connections (HTTPS), hashed passwords, and secure authentication tokens. However, no method of transmission over the internet is 100% secure.
      </Section>

      <Section title="9. Children's Privacy">
        Our services are not directed to children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us at{' '}
        <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a>.
      </Section>

      <Section title="10. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of marketing communications</li>
          <li>Opt out of personalized advertising</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a>.
        </p>
      </Section>

      <Section title="11. Third-Party Links">
        Our service may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.
      </Section>

      <Section title="12. Changes to This Policy">
        We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated effective date. Continued use of our services after changes constitutes acceptance of the updated policy.
      </Section>

      <Section title="13. Contact Us">
        <p>If you have any questions about this Privacy Policy, please contact us:</p>
        <p>
          <strong>4Brazucas, LLC</strong><br />
          Email: <a href="mailto:contato@4brazucas.com" style={{ color: 'var(--accent)' }}>contato@4brazucas.com</a><br />
          Website: <a href="https://ftrack.4brazucas.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>https://ftrack.4brazucas.com</a>
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.15rem',
        color: 'var(--accent)', marginBottom: 10,
      }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.88rem', color: 'var(--text2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
