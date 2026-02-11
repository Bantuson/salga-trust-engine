import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export function DashboardPreview() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.fromTo('.dashboard-preview-overlay', {
      opacity: 1,
    }, {
      opacity: 0,
      scrollTrigger: {
        trigger: '.dashboard-preview-section',
        start: 'top 50%',
        end: 'bottom 30%',
        scrub: true,
      },
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="dashboard-preview-section">
      <div className="dashboard-preview-content">
        <h2 className="dashboard-preview-title">See It In Action</h2>
        <p className="dashboard-preview-subtitle">
          Scroll down to explore the live transparency dashboard
        </p>
        <div className="dashboard-preview-frame">
          <div className="dashboard-preview-overlay">
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
        </div>
        <div className="scroll-indicator">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7"></path>
          </svg>
          <span>Scroll to see live data</span>
        </div>
      </div>
    </section>
  );
}
