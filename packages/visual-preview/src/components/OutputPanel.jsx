import React, { useState, useEffect, useRef } from 'react';
import InspectorOverlay from './InspectorOverlay';
import { sanitizeHtml } from '../utility/cssAnalyzer.js';
import { t } from '../utility/locales.js';
import { useChallenge } from '../context/ChallengeContext';

export const OutputPanel = ({ 
  allowInspect = true,
  defaultMode = 'student',
  showControls = true,
  hideProgress = false,
  disableDiffView = false
}) => {
  
  const { task, locale, userCss, setFocusSelectorStr, score } = useChallenge();

  const [previewMode, setPreviewMode] = useState(defaultMode);
  const [isInspectionMode, setInspectionMode] = useState(false);
  const [solutionImageUrl, setSolutionImageUrl] = useState(null);
  const [inspectData, setInspectData] = useState(null); 
  const [solutionGhostData, setSolutionGhostData] = useState([]);  
  const [overlayOpacity, setOverlayOpacity] = useState(0.5); 
  
  const [previewWidth, setPreviewWidth] = useState('0px'); 
  const [previewHeight, setPreviewHeight] = useState('0px'); 

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const wrapperRef = useRef(null);
  const resizableBoxRef = useRef(null); 
  const iframeRef = useRef(null);

  const safeHtml = sanitizeHtml(task?.initialHtml || '');
  const safeSolutionHtml = sanitizeHtml(task?.solutionHtml || task?.initialHtml || '');
  const fullSolutionCss = `${task?.initialCss || ''}\n${task?.solutionCss || ''}`;

  const userSrcDoc = `
    <!DOCTYPE html>
    <html><head><style>* { box-sizing: border-box; } html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; cursor: default; } ${userCss}</style></head><body>${safeHtml}</body></html>
  `;

  useEffect(() => {
    if (resizableBoxRef.current) {
        resizableBoxRef.current.style.width = '100%';
        resizableBoxRef.current.style.height = '100%';
    }
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(prevZoom => Math.min(Math.max(0.2, prevZoom * zoomFactor), 4));
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.target === wrapperRef.current)) {
      e.preventDefault();
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (wrapperRef.current) wrapperRef.current.style.cursor = 'grabbing';
      if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';
    }
  };

  const handlePointerMove = (e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
      if (wrapperRef.current) wrapperRef.current.style.cursor = 'grab';
      if (iframeRef.current) iframeRef.current.style.pointerEvents = 'auto';
    }
  };

  useEffect(() => {
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    return () => {
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
    };
  }, []);

  useEffect(() => {
    if (disableDiffView && previewMode === 'diff') {
      setPreviewMode('student');
    }
  }, [disableDiffView, previewMode]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (!isInspectionMode || previewMode !== 'student' || !allowInspect) {
        if (previewMode === 'student') setInspectData(null);
        return;
    }

    const attachListeners = () => {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) return;

        const handleMouseMove = (e) => {
            const target = e.target;
            if (target === doc.documentElement || target === doc.body) { setInspectData(null); return; }
            const rect = target.getBoundingClientRect();
            const computedStyle = iframe.contentWindow.getComputedStyle(target);
            const isGrid = computedStyle.display === 'grid' || computedStyle.display === 'inline-grid';
            const isFlex = computedStyle.display === 'flex' || computedStyle.display === 'inline-flex';
            let layoutInfo = null;

            if (isGrid || isFlex) {
                layoutInfo = {
                    type: isGrid ? 'grid' : 'flex',
                    rowGap: parseFloat(computedStyle.rowGap) || 0,
                    columnGap: parseFloat(computedStyle.columnGap) || 0,
                    gridCols: isGrid ? computedStyle.gridTemplateColumns : null,
                    gridRows: isGrid ? computedStyle.gridTemplateRows : null,
                    direction: isFlex ? computedStyle.flexDirection : null,
                    wrap: isFlex ? computedStyle.flexWrap : null
                };
            }
            setInspectData({ rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, style: computedStyle, tagName: target.tagName, className: target.className, layout: layoutInfo });
        };

        const handleMouseClick = (e) => {
            e.preventDefault(); e.stopPropagation();
            const target = e.target;
            if (target === doc.documentElement || target === doc.body) return;
            let selector = target.tagName.toLowerCase();
            if (target.className && typeof target.className === 'string') selector = '.' + target.className.trim().split(/\s+/).join('.');
            else if (target.id) selector = '#' + target.id;
            
            setFocusSelectorStr(selector);
        };

        const handleMouseLeave = () => setInspectData(null);

        doc.body.addEventListener('mousemove', handleMouseMove);
        doc.body.addEventListener('click', handleMouseClick);
        doc.body.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
          if (doc && doc.body) {
            doc.body.removeEventListener('mousemove', handleMouseMove);
            doc.body.removeEventListener('click', handleMouseClick);
            doc.body.removeEventListener('mouseleave', handleMouseLeave);
          }
        };
    };

    let cleanupFn = null;
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') cleanupFn = attachListeners();
    const onLoad = () => { if (cleanupFn) cleanupFn(); cleanupFn = attachListeners(); };
    iframe.addEventListener('load', onLoad);
    return () => { iframe.removeEventListener('load', onLoad); if (cleanupFn) cleanupFn(); };
  }, [isInspectionMode, userSrcDoc, previewMode, allowInspect, setFocusSelectorStr]); 

  useEffect(() => {
    const box = resizableBoxRef.current;
    if (!box) return;
    let debounceTimer;

    const updateImageAndGhostData = () => {
      const box = resizableBoxRef.current;
      if (!box || !iframeRef.current || !iframeRef.current.contentWindow) return;

      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      
      const width = box.clientWidth;
      const height = box.clientHeight;

      if (width <= 0 || height <= 0) return;
      
      setPreviewWidth(`${width}px`);
      setPreviewHeight(`${height}px`);

      const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; overflow: hidden; background: white; margin: 0; padding: 0;"><style>* { box-sizing: border-box; } html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; } ${fullSolutionCss}</style>${safeSolutionHtml}</div></foreignObject></svg>`;
      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const newUrl = URL.createObjectURL(blob);
      setSolutionImageUrl(prevUrl => { if (prevUrl) URL.revokeObjectURL(prevUrl); return newUrl; });

      if(isInspectionMode && previewMode === 'solution') {
          const hiddenIframe = document.createElement('iframe');
          hiddenIframe.sandbox = 'allow-same-origin';
          Object.assign(hiddenIframe.style, { position: 'fixed', top: '-9999px', left: '-9999px', width: `${width}px`, height: `${height}px`, border: 'none', visibility: 'hidden' });
          document.body.appendChild(hiddenIframe);

          const doc = hiddenIframe.contentDocument;
          doc.open(); doc.write(`<!DOCTYPE html><html><head><style>* { box-sizing: border-box; } html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; } ${fullSolutionCss}</style></head><body>${safeSolutionHtml}</body></html>`); doc.close();

          setTimeout(() => {
              if (!hiddenIframe.contentWindow) return;
              const elements = doc.body.querySelectorAll('*');
              const ghostData = [];

              elements.forEach(el => {
                  if (el === doc.documentElement || el === doc.body) return;
                  const rect = el.getBoundingClientRect();
                  if (rect.width === 0 && rect.height === 0) return; 

                  const style = hiddenIframe.contentWindow.getComputedStyle(el);
                  const safeStyles = { marginTop: style.marginTop, marginRight: style.marginRight, marginBottom: style.marginBottom, marginLeft: style.marginLeft, paddingTop: style.paddingTop, paddingRight: style.paddingRight, paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft, borderTopWidth: style.borderTopWidth, borderRightWidth: style.borderRightWidth, borderBottomWidth: style.borderBottomWidth, borderLeftWidth: style.borderLeftWidth };

                  const isGrid = style.display === 'grid' || style.display === 'inline-grid';
                  const isFlex = style.display === 'flex' || style.display === 'inline-flex';
                  let layoutInfo = null;

                  if (isGrid || isFlex) layoutInfo = { type: isGrid ? 'grid' : 'flex', rowGap: parseFloat(style.rowGap) || 0, columnGap: parseFloat(style.columnGap) || 0, gridCols: isGrid ? style.gridTemplateColumns : null, gridRows: isGrid ? style.gridTemplateRows : null, direction: isFlex ? style.flexDirection : null, wrap: isFlex ? style.flexWrap : null };

                  ghostData.push({ rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, style: safeStyles, tagName: el.tagName, className: el.className, layout: layoutInfo });
              });
              setSolutionGhostData(ghostData);
              document.body.removeChild(hiddenIframe); 
          }, 50);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => window.requestAnimationFrame(updateImageAndGhostData), 100);
    });
    
    resizeObserver.observe(box);
    updateImageAndGhostData();

    return () => {
      resizeObserver.disconnect();
      clearTimeout(debounceTimer);
      if (solutionImageUrl) URL.revokeObjectURL(solutionImageUrl);
    };
  }, [safeHtml, fullSolutionCss, previewMode, isInspectionMode, zoom]);

  useEffect(() => { setInspectData(null); }, [previewMode, isInspectionMode]);

  const handleFitToScreen = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (resizableBoxRef.current) {
      resizableBoxRef.current.style.width = '100%';
      resizableBoxRef.current.style.height = '100%';
    }
  };

  const getScoreColor = (sc) => {
    if (sc === 100) return '#10b981'; 
    if (sc >= 50) return '#f59e0b';  
    return '#ef4444';                
  };

  return (
    <div className="css-analyzer-scope" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {!hideProgress && (
        <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: score !== null ? `${score}%` : '0%', backgroundColor: getScoreColor(score) }}></div>
            <span className="progress-text">{score !== null ? `${t(locale, 'ui', 'scoreResult')} ${score}%` : t(locale, 'ui', 'scoreWait')}</span>
        </div>
      )}

      <div className="output-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        <div className="output-panel-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#334155' }}>
                {t(locale, 'ui', 'preview')} 
            </h3>
            
            <span style={{ 
                fontSize: '15px', 
                background: '#e0e7ff', 
                color: '#3730a3', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                fontWeight: '800', 
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                border: '1px solid #c7d2fe',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                {previewWidth} × {previewHeight}
            </span>

            <div className="canvas-zoom-controls">
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} title={t(locale, 'ui', 'zoomOut')}>-</button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.1))} title={t(locale, 'ui', 'zoomIn')}>+</button>
              <button onClick={handleFitToScreen} title={t(locale, 'ui', 'fitToScreen')} className="zoom-reset">⤢</button>
            </div>
          </div>
          
          {showControls && (
            <div className="preview-controls">
              {allowInspect && (
                <>
                  <button onClick={() => setInspectionMode(!isInspectionMode)} className={`control-button ${isInspectionMode ? 'active-inspect' : ''}`} title="Zapnúť inšpekciu Box Modelu">
                    {t(locale, 'ui', 'inspect')}
                  </button>
                  <div className="control-divider"></div>
                </>
              )}
              <button onClick={() => setPreviewMode('student')} className={`control-button ${previewMode === 'student' ? 'active' : ''}`}>{t(locale, 'ui', 'mySolution')}</button>
              <button onClick={() => setPreviewMode('solution')} className={`control-button ${previewMode === 'solution' ? 'active' : ''}`}>{t(locale, 'ui', 'pattern')}</button>
              <button onClick={() => setPreviewMode('overlay')} className={`control-button ${previewMode === 'overlay' ? 'active' : ''}`}>{t(locale, 'ui', 'overlay')}</button>
              
              {!disableDiffView && (
                <button onClick={() => setPreviewMode('diff')} className={`control-button ${previewMode === 'diff' ? 'active' : ''}`} style={{ color: previewMode === 'diff' ? '#db2777' : '' }}>
                  {t(locale, 'ui', 'diffView')}
                </button>
              )}
            </div>
          )}
        </div>

        {showControls && previewMode === 'overlay' && (
          <div className="opacity-slider-container">
            <label htmlFor="opacity-slider">
              {t(locale, 'ui', 'opacity')} <strong>{Math.round(overlayOpacity * 100)}%</strong>
            </label>
            <input 
              type="range" id="opacity-slider" min="0" max="1" step="0.05"
              value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="opacity-slider"
            />
          </div>
        )}

        {!disableDiffView && previewMode === 'diff' && (
          <div style={{ backgroundColor: '#fdf2f8', padding: '6px 12px', fontSize: '11px', color: '#be185d', borderBottom: '1px solid #fbcfe8', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
             {t(locale, 'ui', 'diffViewText')}
          </div>
        )}

        <div 
          className="preview-wrapper canvas-background" 
          ref={wrapperRef}
          onMouseDown={handlePointerDown}
          style={{ 
            overflow: 'hidden', 
            position: 'relative',
            flexGrow: 1,
            cursor: 'grab' 
          }}
        >
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning.current ? 'none' : 'transform 0.1s ease-out', 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none' 
            }}
          >
            <div 
              ref={resizableBoxRef} 
              className="resizable-preview-box canvas-resizable-item" 
              style={{ pointerEvents: 'auto' }}
            >
                <iframe ref={iframeRef} srcDoc={userSrcDoc} title="preview" sandbox="allow-same-origin" className="student-iframe" style={{ visibility: previewMode === 'solution' ? 'hidden' : 'visible', zIndex: 1 }} />

                {isInspectionMode && previewMode === 'solution' && solutionGhostData.map((data, idx) => (
                    <div key={idx} style={{ position: 'absolute', top: data.rect.top, left: data.rect.left, width: data.rect.width, height: data.rect.height, zIndex: 15 + idx, cursor: 'crosshair', background: 'transparent' }} onMouseEnter={() => setInspectData(data)} onMouseLeave={() => setInspectData(null)} />
                ))}

                {isInspectionMode && inspectData && (
                    <div className="inspector-layer" style={{ zIndex: 100 }}>
                        <InspectorOverlay data={inspectData} />
                    </div>
                )}

                {solutionImageUrl && previewMode === 'solution' && (
                <img src={solutionImageUrl} className="solution-image" alt="Vzor" onContextMenu={(e) => e.preventDefault()} style={{ zIndex: 10 }} />
                )}
                
                {solutionImageUrl && previewMode === 'overlay' && (
                <img src={solutionImageUrl} className="solution-overlay" alt="Overlay" onContextMenu={(e) => e.preventDefault()} style={{ zIndex: 20, opacity: overlayOpacity, pointerEvents: 'none', border: '1px dashed rgba(0, 123, 255, 0.4)' }} />
                )}

                {!disableDiffView && solutionImageUrl && previewMode === 'diff' && (
                <img src={solutionImageUrl} className="solution-overlay" alt="Diff" onContextMenu={(e) => e.preventDefault()} 
                     style={{ zIndex: 20, opacity: 1, pointerEvents: 'none', border: 'none', mixBlendMode: 'difference' }} 
                />
                )}
            </div>
          </div>
          
          <div style={{ position: 'absolute', bottom: '10px', right: 0, left: 0, textAlign: 'center', fontSize: '11px', color: '#64748b', pointerEvents: 'none', fontWeight: '600', textShadow: '0 0 4px white, 0 0 2px white' }}>
            {t(locale, 'ui', 'canvasHint')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutputPanel;