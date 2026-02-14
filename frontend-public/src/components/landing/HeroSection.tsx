import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(useGSAP);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion) {
      gsap.set([headlineRef.current, subtitleRef.current, ctaRef.current], { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline();
    tl.from(headlineRef.current, {
      y: 80, opacity: 0, duration: 1.2, ease: 'power3.out'
    })
    .from(subtitleRef.current, {
      y: 40, opacity: 0, duration: 0.8, ease: 'power2.out'
    }, '-=0.5')
    .from(ctaRef.current, {
      y: 30, opacity: 0, duration: 0.6, ease: 'power2.out'
    }, '-=0.3');
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="hero-section">
      {/* Hero content */}
      <div className="hero-content">
        <h1 ref={headlineRef} className="hero-headline">
          Transparent Municipal Services.<br />
          <span className="text-coral">For Every Citizen.</span>
        </h1>
        <div className="hero-subtitle-container">
          <p ref={subtitleRef} className="hero-subtitle">
            Track service delivery, hold municipalities accountable, and see real results across South Africa.
          </p>
        </div>
        <div ref={ctaRef} className="hero-cta-container">
          <GlassCard variant="elevated" className="hero-cta-card">
            <Link to="/dashboard" className="hero-cta">
              <span className="text-coral">View Municipal Performance</span>
            </Link>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
