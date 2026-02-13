import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Button } from '@shared/components/ui/Button';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const skylineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion) {
      // Set elements to final state immediately for reduced motion
      gsap.set([headlineRef.current, subtitleRef.current, ctaRef.current], { opacity: 1, y: 0 });
      gsap.set(skylineRef.current, { opacity: 1 });
      return;
    }

    // Entrance animations
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

    // Fade skyline to reveal solid pink behind it
    if (skylineRef.current) {
      gsap.to(skylineRef.current, {
        opacity: 0,
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
      {/* Layer 2: Skyline photograph that fades on scroll */}
      <div ref={skylineRef} className="skyline-background" />

      {/* Layer 3: Pink/rose semi-transparent overlay for text readability */}
      <div className="hero-text-overlay" />

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
          <Link to="/dashboard">
            <Button variant="primary" size="lg" className="hero-cta">
              View Municipal Performance
            </Button>
          </Link>
        </div>
      </div>
      <div className="hero-gradient-overlay" />
    </section>
  );
}
