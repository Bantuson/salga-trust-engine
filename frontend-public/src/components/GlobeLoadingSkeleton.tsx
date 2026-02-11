export function GlobeLoadingSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse, rgba(0, 217, 166, 0.1), transparent)',
    }}>
      <div style={{
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255, 107, 74, 0.2), rgba(0, 217, 166, 0.2))',
        animation: 'glowPulse 2s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
