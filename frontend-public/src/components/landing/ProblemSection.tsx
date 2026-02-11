import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    const lines = sectionRef.current?.querySelectorAll('.reveal-line');

    if (reducedMotion) {
      // Set elements to final state immediately
      gsap.set(lines, { opacity: 1, y: 0 });
      return;
    }

    lines?.forEach((line, index) => {
      gsap.from(line, {
        y: 60,
        opacity: 0,
        duration: 0.9,
        delay: index * 0.15, // Stagger delay between lines
        ease: 'power3.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });
    });
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="problem-section">
      <div className="problem-content">
        <p className="reveal-line problem-text-large">Municipal services are broken.</p>
        <p className="reveal-line problem-text-large">Citizens are unheard.</p>
        <p className="reveal-line problem-text-detail">
          Reports disappear into bureaucracy. Response times are measured in weeks, not hours.
          There is no visibility into whether anything is being done.
        </p>
      </div>
    </section>
  );
}
