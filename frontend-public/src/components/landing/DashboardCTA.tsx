import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

export function DashboardCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion) {
      gsap.set(sectionRef.current, { opacity: 1, y: 0 });
      return;
    }

    // Section fade + slide entrance with immediate pink tint visibility
    gsap.fromTo(sectionRef.current,
      { opacity: 0.3, y: 60 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="dashboard-cta-section">
      <GlassCard variant="elevated">
        <div className="dashboard-cta-content">
          <h2 className="dashboard-cta-title">
            Ready to see how your municipality performs?
          </h2>
          <p className="dashboard-cta-subtitle">
            Explore real-time performance data, service delivery metrics, and transparency statistics
            for municipalities across South Africa.
          </p>
          <Link to="/dashboard" className="preview-cta-link" style={{ marginTop: 'var(--space-xl)' }}>
            <span className="preview-cta-button">View Dashboard</span>
          </Link>
        </div>
      </GlassCard>
    </section>
  );
}
