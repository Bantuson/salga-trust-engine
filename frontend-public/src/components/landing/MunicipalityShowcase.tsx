import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const pilotMunicipalities = [
  { name: 'City of Johannesburg', tickets: 4521, response: 18, resolution: 82 },
  { name: 'City of Cape Town', tickets: 3892, response: 22, resolution: 78 },
  { name: 'eThekwini Municipality', tickets: 2947, response: 26, resolution: 71 },
  { name: 'City of Tshwane', tickets: 1876, response: 31, resolution: 68 },
  { name: 'Ekurhuleni Municipality', tickets: 1611, response: 29, resolution: 73 },
];

export function MunicipalityShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    const cards = sectionRef.current?.querySelectorAll('.showcase-card');

    if (reducedMotion) {
      // Set elements to final state immediately
      gsap.set(cards, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(cards, {
      y: 60,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.showcase-carousel',
        start: 'top 75%',
      },
    });
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="municipality-showcase-section">
      <h2 className="showcase-title">Pilot Municipalities</h2>
      <p className="showcase-subtitle">
        Leading the way in transparent, accountable service delivery
      </p>
      <div className="showcase-carousel">
        {pilotMunicipalities.map((muni, i) => (
          <div key={i} className="showcase-card">
            <h3 className="showcase-card-name">{muni.name}</h3>
            <div className="showcase-card-stats">
              <div className="showcase-stat">
                <div className="showcase-stat-value">{muni.tickets.toLocaleString()}</div>
                <div className="showcase-stat-label">Tickets</div>
              </div>
              <div className="showcase-stat">
                <div className="showcase-stat-value">{muni.response}h</div>
                <div className="showcase-stat-label">Avg Response</div>
              </div>
              <div className="showcase-stat">
                <div className="showcase-stat-value">{muni.resolution}%</div>
                <div className="showcase-stat-label">Resolved</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
