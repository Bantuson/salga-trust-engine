import React, { Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { GlobeLoadingSkeleton } from '../GlobeLoadingSkeleton';
import { Button } from '@shared/components/ui/Button';

const Globe3D = React.lazy(() => import('../Globe3D'));

gsap.registerPlugin(useGSAP);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(headlineRef.current, {
      y: 80, opacity: 0, duration: 1.2, ease: 'power3.out'
    })
    .from(subtitleRef.current, {
      y: 40, opacity: 0, duration: 0.8, ease: 'power2.out'
    }, '-=0.5');
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="hero-section">
      <div className="hero-globe-container">
        <Suspense fallback={<GlobeLoadingSkeleton />}>
          <Globe3D />
        </Suspense>
      </div>
      <div className="hero-content">
        <h1 ref={headlineRef} className="hero-headline">
          Transparent Municipal Services.<br />
          <span className="text-coral">For Every Citizen.</span>
        </h1>
        <p ref={subtitleRef} className="hero-subtitle">
          Track service delivery, hold municipalities accountable, and see real results across South Africa.
        </p>
        <Link to="/dashboard">
          <Button variant="primary" size="lg" className="hero-cta">
            View Municipal Performance
          </Button>
        </Link>
      </div>
      <div className="hero-gradient-overlay" />
    </section>
  );
}
