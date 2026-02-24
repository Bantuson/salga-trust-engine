import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import { VideoModal } from '../VideoModal';

gsap.registerPlugin(useGSAP);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [showVideo, setShowVideo] = useState(false);

  useGSAP(() => {
    if (reducedMotion) {
      gsap.set([headlineRef.current, subtitleRef.current], { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline();
    tl.from(headlineRef.current, {
      y: 80, opacity: 0, duration: 1.2, ease: 'power3.out', clearProps: 'opacity,transform'
    })
    .from(subtitleRef.current, {
      y: 40, opacity: 0, duration: 0.8, ease: 'power2.out', clearProps: 'opacity,transform'
    }, '-=0.5');
  }, { scope: sectionRef, dependencies: [reducedMotion] });

  return (
    <>
      <section ref={sectionRef} className="hero-section">
        <div className="hero-content">
          <h1 ref={headlineRef} className="hero-headline">
            Transparent Municipal Services.<br />
            <span className="text-coral">For Every Citizen.</span>
          </h1>
          <div ref={subtitleRef} className="hero-subtitle-container">
            <p className="hero-subtitle">
              Track service delivery, hold municipalities accountable, and see real results across South Africa.
            </p>
            <button className="hero-cta" onClick={() => setShowVideo(true)}>
              Watch Video Demo
            </button>
          </div>
        </div>
      </section>

      <VideoModal isOpen={showVideo} onClose={() => setShowVideo(false)} />
    </>
  );
}
