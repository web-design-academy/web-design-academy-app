import React, { useState, useEffect } from 'react';
import * as csstree from 'css-tree'; 
import './TeacherTaskCreator.css'; 
import { t } from '../utility/locales.js';
import { createPortal } from 'react-dom'; 

function TeacherTaskCreator({ 
  initialTask, 
  onSave, 
  locale = 'sk', 
  className = '', 
  style = {} 
}) {
  const [task, setTask] = useState({
    id: initialTask?.id || `task-${Date.now()}`,
    title: initialTask?.title || '',
    instructions: initialTask?.instructions || '',
    initialHtml: initialTask?.initialHtml || '',
    initialCss: initialTask?.initialCss || '',
    solutionCss: initialTask?.solutionCss || '',
    targetSelectors: initialTask?.targetSelectors ? initialTask.targetSelectors.join(', ') : '',
    lockedLines: initialTask?.lockedLines ? initialTask.lockedLines.join(', ') : '',
    hintTimeout: initialTask?.hintTimeout || 45
  });

  const [checks, setChecks] = useState(initialTask?.checks || []);
  const [showJson, setShowJson] = useState(false);
  const [isCopied, setIsCopied] = useState(false); 
  const [toast, setToast] = useState({ isOpen: false, type: 'success', title: '', text: '' });

  useEffect(() => {
    let timer;
    if (toast.isOpen) {
      timer = setTimeout(() => {
        setToast(prev => ({ ...prev, isOpen: false }));
      }, 4000); 
    }
    return () => clearTimeout(timer);
  }, [toast.isOpen]);

  const showToast = (type, title, text) => {
    setToast({ isOpen: true, type, title, text });
  };

  const [newCheck, setNewCheck] = useState({
    type: 'exact-match',
    selector: '',
    property: '',
    value: '',
    media: '',
    level: 'error',
    message: '',
    studentHint: '' 
  });

  const handleAddCheck = () => {
    if (!newCheck.selector || !newCheck.property) {
      showToast('error', t(locale, 'teacher', 'toastMissingDataTitle'), t(locale, 'teacher', 'alertMissing'));
      return;
    }
    
    const checkWithId = { ...newCheck, id: `check-${Date.now()}-${Math.floor(Math.random() * 1000)}` }; 
    if (!checkWithId.media.trim()) delete checkWithId.media;
    
    setChecks([...checks, checkWithId]);
    setNewCheck({ type: 'exact-match', selector: '', property: '', value: '', media: '', level: 'error', message: '', studentHint: '' });
    
    showToast('success', t(locale, 'teacher', 'toastRuleAddedTitle'), t(locale, 'teacher', 'toastRuleAddedText', { prop: newCheck.property }));
  };

  const handleRemoveCheck = (index) => {
    const updated = [...checks];
    updated.splice(index, 1);
    setChecks(updated);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(finalJsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); 
    showToast('success', t(locale, 'teacher', 'toastCopiedTitle'), t(locale, 'teacher', 'toastCopiedText'));
  };

  const handleAutoGenerateRules = () => {
    if (!task.solutionCss.trim()) {
      showToast('error', t(locale, 'teacher', 'toastEmptySolutionTitle'), t(locale, 'teacher', 'alertMissingSolution'));
      return;
    }

    try {
      const ast = csstree.parse(task.solutionCss);
      const generatedChecks = [];
      let currentMediaContext = '';

      csstree.walk(ast, {
        enter: (node) => {
          if (node.type === 'Atrule' && node.name === 'media') {
             currentMediaContext = csstree.generate(node.prelude).trim();
          }

          if (node.type === 'Rule') {
             const selector = csstree.generate(node.prelude).trim();
             
             csstree.walk(node.block, {
                visit: 'Declaration',
                enter: (decl) => {
                   const property = decl.property.toLowerCase();
                   const value = csstree.generate(decl.value).trim();
                   
                   let ruleType = 'exact-match';
                   let ruleValue = value;
                   let ruleMessage = `Očakávala sa hodnota '${value}' pre vlastnosť '${property}'.`;
                   let ruleLevel = 'error';

                   if (['display', 'position', 'float', 'flex-direction', 'flex-wrap', 'grid-template-columns'].includes(property)) {
                       ruleType = 'exact-match';
                       ruleMessage = `Element musí používať ${property}: ${value}.`;
                   } 
                   else if (property.includes('color') || property.includes('background')) {
                       ruleType = 'regex-match';
                       ruleValue = `^(#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})|rgba?\\(.*\\)|hsla?\\(.*\\)|${value})$`;
                       ruleLevel = 'warning'; 
                       ruleMessage = `Nezabudni nastaviť správnu farbu pre '${property}'. Skontroluj formát.`;
                   }
                   else if (['margin', 'padding', 'border', 'width', 'height', 'top', 'left', 'bottom', 'right'].some(p => property.includes(p))) {
                       ruleType = 'required-property';
                       ruleValue = ''; 
                       ruleMessage = `Elementu chýba vlastnosť '${property}'.`;
                       ruleLevel = 'recommendation'; 
                   }
                   else if (property.includes('font') || property.includes('text')) {
                       ruleType = 'required-property';
                       ruleValue = ''; 
                       ruleMessage = `Nezabudni nastaviť vlastnosť '${property}'.`;
                   }
                   else {
                       ruleType = 'required-property';
                       ruleValue = '';
                       ruleMessage = `Vyžaduje sa vlastnosť '${property}'.`;
                   }

                   const newAutoCheck = {
                      id: `auto-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                      type: ruleType,
                      level: ruleLevel,
                      selector: selector,
                      property: property,
                      value: ruleValue,
                      message: ruleMessage,
                      studentHint: `Nastav '${property}' pre element ${selector}` 
                   };

                   if (currentMediaContext) {
                       newAutoCheck.media = currentMediaContext;
                   }

                   const isDuplicateExisting = checks.some(c => c.selector === selector && c.property === property && c.media === currentMediaContext);
                   const isDuplicateGenerated = generatedChecks.some(c => c.selector === selector && c.property === property && c.media === currentMediaContext);

                   if (!isDuplicateExisting && !isDuplicateGenerated) {
                       generatedChecks.push(newAutoCheck);
                   }
                }
             });
          }
        },
        leave: (node) => {
          if (node.type === 'Atrule' && node.name === 'media') {
             currentMediaContext = '';
          }
        }
      });

      if (generatedChecks.length === 0) {
          showToast('warning', t(locale, 'teacher', 'toastNoRulesTitle'), t(locale, 'teacher', 'alertNoRulesGenerated'));
          return;
      }

      setChecks([...checks, ...generatedChecks]);
      
      const successMsg = t(locale, 'teacher', 'alertSuccessGenerated').replace('{cnt}', generatedChecks.length);
      
      showToast('success', t(locale, 'teacher', 'toastSuccessGenTitle'), successMsg);

    } catch (e) {
      showToast('error', t(locale, 'teacher', 'toastErrorGenTitle'), t(locale, 'teacher', 'alertSyntaxError'));
    }
  };

  const generateFinalTaskObject = () => {
    return {
      ...task,
      targetSelectors: task.targetSelectors.split(',').map(s => s.trim()).filter(s => s !== ''),
      lockedLines: task.lockedLines.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)), 
      hintTimeout: parseInt(task.hintTimeout, 10) || 45,
      checks: checks
    };
  };

  const handleSaveAndTest = () => {
    const finalTask = generateFinalTaskObject();
    if (onSave) onSave(finalTask);
  };

  const finalJsonString = JSON.stringify(generateFinalTaskObject(), null, 2);

  const toastMarkup = (
    <div className={`challenge-toast ${toast.isOpen ? 'open' : ''} ${toast.type}`}>
        <div className="toast-icon">
          {toast.type === 'success' && <svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>}
          {toast.type === 'warning' && <svg viewBox="0 0 512 512"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>}
          {toast.type === 'error' && <svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>}
        </div>
        <div className="toast-content">
          <h4>{toast.title}</h4>
          <p>{toast.text}</p>
        </div>
        <button className="toast-close" onClick={() => setToast(prev => ({ ...prev, isOpen: false }))}>✕</button>
    </div>
  );

  return (
    <div className={`css-analyzer-scope teacher-creator-container ${className}`} style={style}>  
      {typeof document !== 'undefined' && createPortal(toastMarkup, document.body)}

      <header className="teacher-header" style={{ position: 'relative', top: 0, zIndex: 1, marginBottom: '20px' }}>
        <h2>{t(locale, 'teacher', 'title')}</h2>
        <div className="action-buttons">
          <button className="btn-secondary" onClick={() => setShowJson(!showJson)}>
            {showJson ? t(locale, 'teacher', 'hideJson') : t(locale, 'teacher', 'showJson')}
          </button>
        </div>
      </header>

      {showJson && (
        <div className="json-viewer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#e2e8f0', fontSize: '14px' }}>
              {t(locale, 'teacher', 'jsonGeneratedTitle')} <span style={{ color: '#94a3b8', fontWeight: 'normal', marginLeft: '8px' }}>{t(locale, 'teacher', 'jsonCopyHint')}</span>
            </h4>
            <button 
              onClick={handleCopyCode} 
              style={{ 
                background: isCopied ? '#10b981' : '#3b82f6', 
                color: 'white', 
                border: 'none', 
                padding: '6px 12px', 
                borderRadius: '6px', 
                fontSize: '12px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isCopied ? t(locale, 'teacher', 'copiedBtn') : t(locale, 'teacher', 'copyBtn')}
            </button>
          </div>
          <textarea readOnly value={finalJsonString} className="json-textarea" />
        </div>
      )}
      
      <div className="creator-grid">
        
        <div className="card">
          <h3>{t(locale, 'teacher', 'step1')}</h3>
          
          <div className="form-group">
            <label className="form-label">{t(locale, 'teacher', 'taskName')}</label>
            <input type="text" className="form-input" value={task.title} onChange={e => setTask({...task, title: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="form-label">{t(locale, 'teacher', 'instructions')}</label>
            <textarea className="form-textarea" rows="3" value={task.instructions} onChange={e => setTask({...task, instructions: e.target.value})} placeholder="<p>...</p>" />
          </div>

          <div className="form-group">
            <label className="form-label">{t(locale, 'teacher', 'selectors')}</label>
            <input type="text" className="form-input" value={task.targetSelectors} onChange={e => setTask({...task, targetSelectors: e.target.value})} placeholder=".wrapper, .btn" />
          </div>
          
          <div className="form-group">
            <label className="form-label">{t(locale, 'teacher', 'lockedLines')}</label>
            <input type="text" className="form-input" value={task.lockedLines} onChange={e => setTask({...task, lockedLines: e.target.value})} placeholder="1, 2, 3" />
          </div>

          <div className="form-group">
            <label className="form-label">{t(locale, 'teacher', 'hintTime')}</label>
            <input type="number" className="form-input" value={task.hintTimeout} onChange={e => setTask({...task, hintTimeout: e.target.value})} />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t(locale, 'teacher', 'htmlStart')}</label>
              <textarea className="form-textarea code-input" rows="5" value={task.initialHtml} onChange={e => setTask({...task, initialHtml: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t(locale, 'teacher', 'cssStart')}</label>
              <textarea className="form-textarea code-input" rows="5" value={task.initialCss} onChange={e => setTask({...task, initialCss: e.target.value})} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t(locale, 'teacher', 'cssSolution')}</label>
            <textarea className="form-textarea code-input" rows="4" value={task.solutionCss} onChange={e => setTask({...task, solutionCss: e.target.value})} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', marginBottom: '20px', paddingBottom: '12px' }}>
             <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>{t(locale, 'teacher', 'step2')}</h3>
             
             <button 
                onClick={handleAutoGenerateRules} 
                style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                {t(locale, 'teacher', 'autoGenerateBtn')}
             </button>
          </div>
          
          <div className="rules-list">
            {checks.length === 0 && <div className="empty-rules">{t(locale, 'teacher', 'noRules')}</div>}
            {checks.map((c, i) => (
              <div key={i} className="rule-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div className="rule-content">
                        <span className={`badge ${c.level}`}>{c.level}</span> 
                        {c.media && <span className="badge recommendation">@media</span>}
                        <span className="rule-selector">{c.selector}</span> 
                        {c.type}: <strong>{c.property}</strong> {c.value ? `= ${c.value}` : ''}
                        {c.media && <div style={{ fontSize: '11px', marginTop: '4px', color: '#db2777' }}>Media: {c.media}</div>}
                    </div>
                    <button className="btn-delete" onClick={() => handleRemoveCheck(i)}>✕</button>
                </div>
                {c.studentHint && (
                   <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                       {t(locale, 'teacher', 'visibleGoal')} "{c.studentHint}"
                   </div>
                )}
              </div>
            ))}
          </div>

          <div className="rule-builder">
            <h4>{t(locale, 'teacher', 'addRuleTitle')}</h4>
            <div className="builder-grid">
              
              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'ruleType')}</label>
                <select className="form-select" value={newCheck.type} onChange={e => setNewCheck({...newCheck, type: e.target.value})}>
                  <option value="exact-match">exact-match</option>
                  <option value="required-property">required-property</option>
                  <option value="forbidden-property">forbidden-property</option>
                  <option value="forbidden-value">forbidden-value</option>
                  <option value="regex-match">regex-match</option>
                  <option value="min-count">min-count</option>
                  <option value="max-count">max-count</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'severity')}</label>
                <select className="form-select" value={newCheck.level} onChange={e => setNewCheck({...newCheck, level: e.target.value})}>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="recommendation">Recommendation</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'selectorDef')}</label>
                <input type="text" className="form-input code-input" value={newCheck.selector} onChange={e => setNewCheck({...newCheck, selector: e.target.value})} placeholder=".btn" />
              </div>

              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'propertyDef')}</label>
                <input type="text" className="form-input code-input" value={newCheck.property} onChange={e => setNewCheck({...newCheck, property: e.target.value})} placeholder="border" />
              </div>

              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'valueDef')}</label>
                <input type="text" className="form-input" value={newCheck.value} onChange={e => setNewCheck({...newCheck, value: e.target.value})} placeholder="red / solid / ^#([A-Fa-f0-9]{6})$" />
              </div>

              <div className="form-group">
                <label className="form-label">{t(locale, 'teacher', 'mediaDef')}</label>
                <input type="text" className="form-input code-input" value={newCheck.media} onChange={e => setNewCheck({...newCheck, media: e.target.value})} placeholder="(max-width: 600px)" />
              </div>

              <div className="form-group full-width">
                <label className="form-label">{t(locale, 'teacher', 'customMsg')}</label>
                <input type="text" className="form-input" value={newCheck.message} onChange={e => setNewCheck({...newCheck, message: e.target.value})} />
              </div>

              <div className="form-group full-width" style={{ marginBottom: 0 }}>
                <label className="form-label">{t(locale, 'teacher', 'checklistName')}</label>
                <input type="text" className="form-input" value={newCheck.studentHint} onChange={e => setNewCheck({...newCheck, studentHint: e.target.value})} />
              </div>

            </div>
            
            <button className="btn-success" onClick={handleAddCheck}>
              {t(locale, 'teacher', 'addBtn')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default TeacherTaskCreator;