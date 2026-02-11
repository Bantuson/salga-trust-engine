import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

export function SolutionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion) {
      // Set elements to final state immediately
      gsap.set('.solution-problem-side', { opacity: 1, x: 0, rotateY: 0 });
      gsap.set('.solution-solution-side', { opacity: 1, x: 0 });
      return;
    }

    gsap.to('.solution-problem-side', {
      opacity: 0.3,
      x: -50,
      rotateY: -5, // Slight rotation for depth
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 50%',
        end: 'bottom 50%',
        scrub: true,
      },
    });

    gsap.from('.solution-solution-side', {
      opacity: 0,
      x: 50,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 50%',
        end: 'bottom 50%',
        scrub: true,
      },
    });
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="solution-section">
      <div className="solution-problem-side">
        <h2 className="solution-heading">The Old Way</h2>
        <ul className="solution-list">
          <li>Reports go into a black hole</li>
          <li>No accountability or tracking</li>
          <li>Citizens feel powerless</li>
        </ul>
      </div>
      <div className="solution-solution-side">
        <h2 className="solution-heading text-coral">The New Way</h2>
        <ul className="solution-list">
          <li>Every report tracked with a unique ID</li>
          <li>Real-time updates via WhatsApp</li>
          <li>Public transparency dashboard</li>
          <li>Municipalities held accountable</li>
        </ul>
      </div>
    </section>
  );
}
