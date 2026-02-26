import React, { useState, useRef } from 'react';

interface Props {
  children: React.ReactNode;
  zoomImage?: string;
  isEnabled: boolean;
}

export const ImageInspector: React.FC<Props> = ({ children, zoomImage, isEnabled }) => {
  const [pos, setPos] = useState({ x: 0, y: 0, show: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !isEnabled) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y, show: true });
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isEnabled ? 'cursor-crosshair' : ''}`}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setPos(p => ({ ...p, show: true }))}
      onMouseLeave={() => setPos(p => ({ ...p, show: false }))}
    >
      <div className={isEnabled ? "pointer-events-none" : ""}>
        {children}
      </div>
      {isEnabled && pos.show && zoomImage && (
        <div 
          className="absolute pointer-events-none border-2 border-blue-500 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.5)] overflow-hidden"
          style={{
            width: '180px',
            height: '180px',
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
          }}
        >
          <div 
            className="w-full h-full bg-no-repeat"
            style={{
              backgroundImage: `url(${zoomImage})`,
              backgroundSize: '400% 400%', // 4x zoom
              backgroundPosition: `${pos.x}% ${pos.y}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};
