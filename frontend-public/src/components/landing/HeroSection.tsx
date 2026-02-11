import React, { Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { GlobeLoadingSkeleton } from '../GlobeLoadingSkeleton';
import { Button } from '@shared/components/ui/Button';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

const Globe3D = React.lazy(() => import('../Globe3D'));

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion) {
      // Set elements to final state immediately for reduced motion
      gsap.set([headlineRef.current, subtitleRef.current], { opacity: 1, y: 0 });
      return;
    }

    // Entrance animations
    const tl = gsap.timeline();
    tl.from(headlineRef.current, {
      y: 80, opacity: 0, duration: 1.2, ease: 'power3.out'
    })
    .from(subtitleRef.current, {
      y: 40, opacity: 0, duration: 0.8, ease: 'power2.out'
    }, '-=0.5');

    // Parallax effect on globe container
    if (globeRef.current) {
      gsap.to(globeRef.current, {
        y: -80,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="hero-section">
      <div ref={globeRef} className="hero-globe-container">
        <Suspense fallback={<GlobeLoadingSkeleton />}>
          <Globe3D />
        </Suspense>
      </div>
      <div className="hero-content">
        <h1 ref={headlineRef} className="hero-headline" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
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
