import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

export function DashboardPreview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    // Ensure DOM element exists before creating ScrollTrigger
    if (!sectionRef.current) return;

    const mockup = sectionRef.current.querySelector('.preview-mockup');

    if (reducedMotion) {
      // Set elements to final state immediately
      gsap.set(mockup, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(mockup, {
      y: 50,
      opacity: 0,
    }, {
      y: 0,
      opacity: 1,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        end: 'top 40%',
        scrub: true,
      },
    });
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <section ref={sectionRef} className="dashboard-preview-section">
      <div className="dashboard-preview-content">
        <h2 className="dashboard-preview-title">See It In Action</h2>
        <p className="dashboard-preview-subtitle">
          Real-time transparency data for municipalities across South Africa
        </p>
        <div className="dashboard-preview-frame">
          <div className="preview-mockup">
            <div className="preview-mockup-header"></div>
            <div className="preview-mockup-cards">
              <div className="preview-mockup-card"></div>
              <div className="preview-mockup-card"></div>
              <div className="preview-mockup-card"></div>
            </div>
            <div className="preview-mockup-chart"></div>
          </div>
        </div>
        <Link to="/dashboard" className="preview-cta-link">
          <div className="preview-cta-button">
            Explore Live Dashboard →
          </div>
        </Link>
      </div>
    </section>
  );
}
