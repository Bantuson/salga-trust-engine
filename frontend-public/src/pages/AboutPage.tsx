import { GlassCard } from '@shared/components/ui/GlassCard';
import { NdebelePattern } from '@shared/components/NdebelePattern';
import { useState } from 'react';

export function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <h1 className="about-title">How SALGA Trust Engine Works</h1>
        <p className="about-subtitle">
          Empowering South African citizens with transparent municipal service delivery
        </p>
      </div>

      <div className="about-content">
        <GlassCard variant="default">
          <h2>What is SALGA Trust Engine?</h2>
          <p>
            SALGA Trust Engine is South Africa's first AI-powered platform for transparent municipal service delivery.
            We connect citizens with their municipalities through WhatsApp and web reporting, while providing
            real-time visibility into service requests, response times, and resolution rates. Every report is tracked,
            every municipality is accountable, and every citizen can see the results.
          </p>
        </GlassCard>

        <NdebelePattern variant="border" />

        <GlassCard variant="default">
          <h2>How It Works</h2>
          <div className="how-it-works-steps">
            <div className="step">
              <div className="step-icon">📱</div>
              <h3>1. Report</h3>
              <p>
                Citizens report issues via WhatsApp or the web portal. Our AI classifies the issue and routes it
                to the correct municipal department within seconds.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">👁️</div>
              <h3>2. Track</h3>
              <p>
                Every report gets a unique tracking number. Citizens receive real-time WhatsApp updates as their
                issue progresses from reported to assigned to in-progress to resolved.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">✅</div>
              <h3>3. Resolve</h3>
              <p>
                Municipal teams respond within SLA timeframes. Citizens are notified when work begins and when
                issues are resolved. All data is publicly visible on the transparency dashboard.
              </p>
            </div>
          </div>
        </GlassCard>

        <NdebelePattern variant="border" />

        <div className="about-benefits">
          <GlassCard variant="default">
            <h2>For Citizens</h2>
            <ul>
              <li>Report issues in seconds via WhatsApp or web</li>
              <li>Track your reports with a unique tracking number</li>
              <li>Get WhatsApp notifications at every stage</li>
              <li>See municipality performance data publicly</li>
              <li>Hold municipalities accountable with transparent statistics</li>
              <li>Available in English, Zulu, and Afrikaans</li>
            </ul>
          </GlassCard>

          <GlassCard variant="default">
            <h2>For Municipalities</h2>
            <ul>
              <li>AI-powered automatic issue classification and routing</li>
              <li>Real-time dashboards for team managers and field workers</li>
              <li>SLA monitoring and automatic escalation</li>
              <li>Geospatial team assignment for efficient response</li>
              <li>Built-in POPIA compliance and audit logging</li>
              <li>Transparent performance metrics build public trust</li>
            </ul>
          </GlassCard>
        </div>

        <NdebelePattern variant="border" />

        <GlassCard variant="default">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            <FAQItem
              question="How do I report an issue?"
              answer="You can report issues via WhatsApp or through the municipal dashboard. Visit the 'Report Issue' page to get started. You'll need to create a verified account linked to your municipality."
            />
            <FAQItem
              question="Is my data safe?"
              answer="Yes. We are POPIA compliant from day one. Your personal information is encrypted, access is strictly controlled, and all data handling is audited. GBV and sensitive reports have additional security layers and are never shown in public statistics."
            />
            <FAQItem
              question="How long does it take for municipalities to respond?"
              answer="Response times vary by municipality and issue type. Each municipality has SLA (Service Level Agreement) targets. You can see average response and resolution times on the transparency dashboard."
            />
            <FAQItem
              question="Can I track my report?"
              answer="Yes. Every report receives a unique tracking number (format: TKT-YYYYMMDD-XXXXXX). You'll receive WhatsApp notifications at every stage: received, assigned, in progress, and resolved."
            />
            <FAQItem
              question="Why can't I see all tickets on the transparency dashboard?"
              answer="The public dashboard shows aggregated statistics and trends, not individual tickets. This protects citizen privacy. GBV and sensitive reports are completely excluded from public statistics. You can track your own reports through the municipal dashboard after signing in."
            />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details className="faq-item" open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="faq-question">{question}</summary>
      <p className="faq-answer">{answer}</p>
    </details>
  );
}
