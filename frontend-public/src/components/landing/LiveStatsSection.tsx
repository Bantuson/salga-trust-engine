import { useRef, useEffect } from 'react';
import { animate } from 'animejs';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import { NdebelePattern } from '@shared/components/NdebelePattern';

export function LiveStatsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const ticketsRef = useRef<HTMLDivElement>(null);
  const municipalitiesRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;

        if (reducedMotion) {
          // Set final values immediately for reduced motion
          if (ticketsRef.current) ticketsRef.current.innerHTML = '12847';
          if (municipalitiesRef.current) municipalitiesRef.current.innerHTML = '5';
          if (responseRef.current) responseRef.current.innerHTML = '73';
          return;
        }

        if (ticketsRef.current) {
          animate(ticketsRef.current, {
            innerHTML: [0, 12847],
            round: 1,
            duration: 2500,
            ease: 'outExpo',
          });
        }

        if (municipalitiesRef.current) {
          animate(municipalitiesRef.current, {
            innerHTML: [0, 5],
            round: 1,
            duration: 2000,
            ease: 'outExpo',
          });
        }

        if (responseRef.current) {
          animate(responseRef.current, {
            innerHTML: [0, 73],
            round: 1,
            duration: 2200,
            ease: 'outExpo',
          });
        }
      }
    }, { threshold: 0.3 });

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="live-stats-section">
      <div style={{ marginBottom: '2rem' }}>
        <NdebelePattern variant="border" opacity={0.15} />
      </div>
      <h2 className="stats-title">Real Impact, Real Results</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div ref={ticketsRef} className="stat-number counter-tickets">{reducedMotion ? '12847' : '0'}</div>
          <div className="stat-label">Tickets Resolved</div>
        </div>
        <div className="stat-card">
          <div ref={municipalitiesRef} className="stat-number counter-municipalities">{reducedMotion ? '5' : '0'}</div>
          <div className="stat-label">Pilot Municipalities</div>
        </div>
        <div className="stat-card">
          <div ref={responseRef} className="stat-number counter-response">{reducedMotion ? '73' : '0'}</div>
          <div className="stat-suffix">%</div>
          <div className="stat-label">Faster Response</div>
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <NdebelePattern variant="border" opacity={0.15} />
      </div>
    </section>
  );
}
