import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from('.feature-card', {
      y: 80,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: '.features-grid',
        start: 'top 75%',
      },
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="features-section">
      <h2 className="features-title">How It Works</h2>
      <div className="features-grid">
        <div className="feature-card card-glow-coral">
          <div className="feature-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 className="feature-title">Report</h3>
          <p className="feature-description">
            Report issues via WhatsApp or web portal. AI categorizes and routes your request automatically.
          </p>
        </div>

        <div className="feature-card card-glow-teal">
          <div className="feature-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3 className="feature-title">Track</h3>
          <p className="feature-description">
            Get a unique tracking number. Receive real-time updates on WhatsApp as your ticket progresses.
          </p>
        </div>

        <div className="feature-card card-glow-violet">
          <div className="feature-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <h3 className="feature-title">Transparency</h3>
          <p className="feature-description">
            View public performance metrics. See how municipalities respond, resolve, and improve over time.
          </p>
        </div>
      </div>
    </section>
  );
}
