import React, { useState, useRef, useEffect } from 'react';

export const ChallengeLayout = ({ children, initialWidths, minWidth = 10 }) => {
  const containerRef = useRef(null);
  const isDragging = useRef(-1);
  const panels = React.Children.toArray(children).filter(Boolean);
  const [widths, setWidths] = useState(
      initialWidths && initialWidths.length === panels.length 
      ? initialWidths 
      : Array(panels.length).fill(100 / panels.length)
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging.current === -1 || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      let mouseXPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      setWidths(prev => {
        const newWidths = [...prev];
        const dragIdx = isDragging.current;
        const totalSpace = prev[dragIdx] + prev[dragIdx + 1];
        
        let leftBoundary = 0;
        for(let i = 0; i < dragIdx; i++) leftBoundary += prev[i];
        
        let newLeftPercent = mouseXPercent - leftBoundary;
        
        if (newLeftPercent < minWidth) newLeftPercent = minWidth;
        if (newLeftPercent > totalSpace - minWidth) newLeftPercent = totalSpace - minWidth;
        
        newWidths[dragIdx] = newLeftPercent;
        newWidths[dragIdx + 1] = totalSpace - newLeftPercent;
        
        return newWidths;
      });
    };

    const handleMouseUp = () => {
      if (isDragging.current !== -1) {
        isDragging.current = -1;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        document.querySelectorAll('iframe').forEach(iframe => iframe.style.pointerEvents = 'auto');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth]);

  const startDrag = (index, e) => {
    e.preventDefault();
    isDragging.current = index;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.querySelectorAll('iframe').forEach(iframe => iframe.style.pointerEvents = 'none');
  };

  return (
      <div className="css-analyzer-scope css-challenge-tool" ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%' }}>
        {panels.map((panel, index) => (
          <React.Fragment key={index}>
            <div className="css-challenge-pane" style={{ width: `${widths[index]}%`, flexShrink: 0, height: '100%' }}>
              {panel}
            </div>
            
            {index < panels.length - 1 && (
              <div className="resizer-bar" onMouseDown={(e) => startDrag(index, e)} style={{ width: '6px', cursor: 'col-resize', background: '#e2e8f0', zIndex: 50 }} />
            )}
          </React.Fragment>
      ))}
    </div>
  );
};