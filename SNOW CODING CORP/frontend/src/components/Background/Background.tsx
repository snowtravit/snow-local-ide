import React from 'react';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Video background layer */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: 'blur(3px) brightness(0.35)',
        }}
      >
        <source src="/assets/background/video.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg, 
              rgba(5, 5, 15, 0.85) 0%, 
              rgba(10, 10, 20, 0.75) 30%, 
              rgba(12, 12, 18, 0.7) 60%, 
              rgba(5, 5, 15, 0.85) 100%
            )
          `,
        }}
      />

      {/* Subtle silver/ice gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(192, 192, 192, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(176, 196, 222, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(200, 200, 220, 0.05) 0%, transparent 40%)
          `,
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
