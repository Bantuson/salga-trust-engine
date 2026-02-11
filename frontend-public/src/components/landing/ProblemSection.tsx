import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const lines = sectionRef.current?.querySelectorAll('.reveal-line');
    lines?.forEach((line) => {
      gsap.from(line, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });
    });
  }, { scope: sectionRef });

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
