import { Link } from 'react-router-dom';

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-container">
        <div className="footer-columns">
          {/* Left Column: Logo + Tagline */}
          <div className="footer-column footer-brand">
            <div className="footer-logo">
              <span className="logo-text">SALGA Trust Engine</span>
            </div>
            <p className="footer-tagline">
              Transparent municipal service delivery for South Africa
            </p>
          </div>

          {/* Center Column: Quick Links */}
          <div className="footer-column footer-links">
            <h3 className="footer-column-title">Quick Links</h3>
            <nav className="footer-nav">
              <Link to="/" className="footer-link">Home</Link>
              <Link to="/dashboard" className="footer-link">Dashboard</Link>
              <Link to="/report" className="footer-link">Report Issue</Link>
              <Link to="/about" className="footer-link">About</Link>
            </nav>
          </div>

          {/* Right Column: Emergency Numbers */}
          <div className="footer-column footer-emergency">
            <h3 className="footer-column-title footer-column-title--emergency">Emergency Numbers</h3>
            <div className="emergency-numbers">
              <div className="emergency-item">
                <span className="emergency-label">Police:</span>
                <a href="tel:10111" className="emergency-number">10111</a>
              </div>
              <div className="emergency-item">
                <span className="emergency-label">GBV Helpline:</span>
                <a href="tel:0800150150" className="emergency-number">0800 150 150</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright + Privacy Notice */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {new Date().getFullYear()} SALGA Trust Engine. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
