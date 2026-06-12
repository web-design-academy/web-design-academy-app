import React, { useRef, useEffect, useState, forwardRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useChallenge } from '../context/ChallengeContext'; 
import { t } from '../utility/locales.js';

const getDecorationClass = (level) => {
  if (level === 'error') return 'error-line-highlight';
  if (level === 'warning') return 'warning-line-highlight';
  if (level === 'recommendation') return 'recommendation-line-highlight';
  if (level === 'readonly') return 'readonly-line-highlight'; 
  return '';
};

const getGlyphClass = (level) => {
  if (level === 'error') return 'error-glyph';
  if (level === 'warning') return 'warning-glyph';
  if (level === 'recommendation') return 'recommendation-glyph';
  if (level === 'readonly') return 'readonly-glyph'; 
  return '';
};

export const EditorPanel = forwardRef(({ theme = 'light', readOnly = false, showMinimap = false }, ref) => {
  
  const { 
    task, locale, userCss, setUserCss, analysisIssues, linterIssues, 
    runAnalysis, registerSyntaxChecker, setAnalysisIssues, focusSelectorStr,
    activeHint, setActiveHint, resetChallenge, resetTrigger
  } = useChallenge();

  const editorRef = useRef(null);
  const isResettingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const monaco = useMonaco();
  const [decorationIds, setDecorationIds] = useState([]);
  const flashDecRef = useRef([]);
  
  const [isResetModalOpen, setResetModalOpen] = useState(false);

  const previousCodeRef = useRef(userCss); 
  const lockedLinesRef = useRef(task?.lockedLines || []);
  const runAnalysisRef = useRef(runAnalysis);
  
  useEffect(() => {
    runAnalysisRef.current = runAnalysis;
  }, [runAnalysis]);

  useEffect(() => {
    lockedLinesRef.current = task?.lockedLines || [];
  }, [task?.lockedLines]);

   useEffect(() => {
    if (task) {
      const startCode = task.currentCode || task.initialCss || '';
      previousCodeRef.current = startCode;
      
      if (editorRef.current) {
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== startCode) {
          isRestoringRef.current = true;
          model.setValue(startCode);
          isRestoringRef.current = false; 
        }
      }
    }
  }, [task?.id]);

  function handleEditorDidMount(editor, monacoInstance) {
    editorRef.current = editor;
    monacoInstance.languages.css.cssDefaults.setDiagnosticsOptions({ validate: true });
    
    isRestoringRef.current = true;
    editor.setValue(userCss);
    previousCodeRef.current = userCss;
    isRestoringRef.current = false;

    registerSyntaxChecker(() => {
      if (!monacoInstance || !editorRef.current) return [];
      const model = editorRef.current.getModel();
      
      const markers = monacoInstance.editor.getModelMarkers({ resource: model.uri });
      markers.sort((a, b) => a.startLineNumber - b.startLineNumber);

      const filteredMarkers = [];
      let stopParsing = false; 

      for (const marker of markers) {
          if (stopParsing) break; 
          const msg = marker.message;
          
          if (msg.includes("duplicate style definitions") || msg.includes("empty rulesets")) continue;

          let code = 'syntaxError';
          let params = {};
          let level = marker.severity === 8 ? 'error' : 'warning';
          let lineNum = marker.startLineNumber; 

          if (msg.includes("Unknown property")) {
              code = 'unknownProperty';
              const match = msg.match(/'([^']+)'/);
              params = { prop: match ? match[1] : '?' };
              level = 'error';
          } 
          else if (msg.includes("semi-colon expected")) {
              code = 'missingSemicolon';
              level = 'error';
              
              if (marker.startLineNumber > 1) {
                  const prevLine = model.getLineContent(marker.startLineNumber - 1).trim();
                  if (prevLine && !prevLine.endsWith(';') && !prevLine.endsWith('{') && !prevLine.endsWith('}')) {
                      lineNum = marker.startLineNumber - 1;
                  }
              }
              stopParsing = true;
          } 
          else if (msg.includes("} expected") || msg.includes("at-rule or selector expected")) {
              code = 'missingBracket';
              level = 'error';
          }

          filteredMarkers.push({
            category: 'linter',
            level: level, 
            messageCode: code, 
            msgParams: params,
            lineNumber: lineNum, 
            isSyntaxError: true
          });
      }
      return filteredMarkers;
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      const currentCode = editor.getModel().getValue();
      setUserCss(currentCode);
      setTimeout(() => {
        runAnalysisRef.current();
      }, 50);
    });

    editor.onDidChangeCursorPosition((e) => {
      const currentLocked = lockedLinesRef.current;
      const line = e.position.lineNumber;
      
      if (currentLocked.includes(line)) {
          const model = editor.getModel();
          if (!model) return;
          const lineCount = model.getLineCount();
          
          let targetLine = line;
          while (currentLocked.includes(targetLine) && targetLine <= lineCount) { targetLine++; }
          
          if (targetLine > lineCount) {
              targetLine = line;
              while (currentLocked.includes(targetLine) && targetLine > 0) { targetLine--; }
          }
          
          if (targetLine > 0 && targetLine <= lineCount && targetLine !== line) {
              editor.setPosition({ lineNumber: targetLine, column: 1 });
          }
      }
    });

    editor.onDidChangeModelContent((event) => {
      const model = editor.getModel();
      if (!model) return;

      if (isRestoringRef.current) return;

      if (isResettingRef.current) {
          previousCodeRef.current = model.getValue();
          if (!readOnly) {
            setUserCss(model.getValue());
            setAnalysisIssues([]);
          }
          return;
      }

      let isEditForbidden = false;
      const currentLocked = lockedLinesRef.current;

      for (const change of event.changes) {
        for (let i = change.range.startLineNumber; i <= change.range.endLineNumber; i++) {
          if (currentLocked.includes(i)) { isEditForbidden = true; break; }
        }
        if (isEditForbidden) break;
      }

      if (isEditForbidden && !readOnly) {
          isRestoringRef.current = true;
          const oldVal = previousCodeRef.current;
          const currentPosition = editor.getPosition();
          model.setValue(oldVal);
          
          if (currentPosition) {
             let safeLine = currentPosition.lineNumber;
             while(currentLocked.includes(safeLine) && safeLine <= model.getLineCount()) safeLine++;
             editor.setPosition({ lineNumber: safeLine, column: 1 });
          }

          isRestoringRef.current = false;
      } else {
          previousCodeRef.current = model.getValue();
          if (!readOnly) {
            setUserCss(model.getValue());
            setAnalysisIssues([]); 
          }
      }
    });
  }

  useEffect(() => {
    if (focusSelectorStr && editorRef.current && monaco) {
      const model = editorRef.current.getModel();
      const matches = model.findMatches(focusSelectorStr, false, false, false, null, true);
      
      if (matches && matches.length > 0) {
        const line = matches[0].range.startLineNumber;
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus(); 

        const newDecoration = { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'monaco-line-flash' } };
        flashDecRef.current = editorRef.current.deltaDecorations(flashDecRef.current, [newDecoration]);
        setTimeout(() => { if (editorRef.current) flashDecRef.current = editorRef.current.deltaDecorations(flashDecRef.current, []); }, 1500);
      }
    }
  }, [focusSelectorStr, monaco]);

  useEffect(() => {
    const visibleIssues = analysisIssues.length > 0 ? analysisIssues : linterIssues;
    if (editorRef.current && monaco) {
      const groupedIssues = {};
      visibleIssues.forEach(issue => {
          if (!groupedIssues[issue.lineNumber]) groupedIssues[issue.lineNumber] = [];
          groupedIssues[issue.lineNumber].push(issue);
      });

      const finalDecorations = [];
      const model = editorRef.current.getModel();
      const lineCount = model ? model.getLineCount() : 1000;
      const currentLocked = lockedLinesRef.current;

      for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const isLocked = currentLocked.includes(lineNum);
          const lineIssues = groupedIssues[lineNum] || [];
          
          if (!isLocked && lineIssues.length === 0) continue; 

          let dominantLevel = 'readonly'; 
          let messages = [];

          if (isLocked) {
            messages.push(t(locale, 'ui', 'lockedLineMsg'));
          }

          if (lineIssues.length > 0) {
              if (lineIssues.some(i => i.level === 'error')) dominantLevel = 'error';
              else if (lineIssues.some(i => i.level === 'warning')) dominantLevel = 'warning';
              else dominantLevel = 'recommendation';

              const issueMessages = lineIssues
                 .filter(i => i.level === dominantLevel) 
                 .map(i => `**[${i.level.toUpperCase()}]** ${i.message}`);
              
              messages = [...messages, ...issueMessages];
          }

          const combinedMessage = messages.join('\n\n---\n\n');

          finalDecorations.push({
             range: new monaco.Range(lineNum, 1, lineNum, 1),
             options: { 
                 isWholeLine: true, 
                 className: getDecorationClass(dominantLevel), 
                 glyphMarginClassName: getGlyphClass(dominantLevel), 
                 inlineClassName: isLocked ? 'locked-text-inline' : '', 
                 glyphMarginHoverMessage: { value: combinedMessage } 
             }
          });
      }
      
      const newIds = editorRef.current.deltaDecorations(decorationIds, finalDecorations);
      setDecorationIds(newIds);
    }
  }, [analysisIssues, linterIssues, monaco, task?.lockedLines, userCss]);

  return (
    <div className="css-analyzer-scope editor-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {isResetModalOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)',
          zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px', width: '320px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0f172a' }}>{t(locale, 'ui', 'resetCode')}</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              {t(locale, 'ui', 'confirmReset')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setResetModalOpen(false)} 
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>
                {t(locale, 'ui', 'cancel')}
              </button>
              <button 
                onClick={() => { 
                  if (resetChallenge) resetChallenge(); 
                  
                  if (editorRef.current && task) {
                    const model = editorRef.current.getModel();
                    if (model) {
                      isResettingRef.current = true;
                      model.setValue(task.initialCss || '');
                      previousCodeRef.current = task.initialCss || '';
                      
                      setTimeout(() => {
                        isResettingRef.current = false;
                      }, 50);
                    }
                  }                  
                  setResetModalOpen(false); 
                }} 
                style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                {t(locale, 'ui', 'resetAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
        <span>style.css {readOnly && <span style={{color: 'red', fontSize: '11px', marginLeft: '8px'}}>(Read Only)</span>}</span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {!readOnly && (
            <button 
              onClick={() => setResetModalOpen(true)}
              style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}
              title="Vrátiť kód do pôvodného stavu zo zadania"
            >
              ↻ {t(locale, 'ui', 'resetCode')}
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'normal' }}>
            {t(locale, 'ui', 'shortcut')} Ctrl + Enter
          </span>
        </div>
      </h4>

      {activeHint && (
        <div className="inactivity-hint-banner">
          <span>{activeHint}</span>
          <button className="hint-close-btn" onClick={() => setActiveHint(null)}>✕</button>
        </div>
      )}

      <div className="editor-wrapper" style={{ flexGrow: 1 }}>
        <Editor
          height="100%" 
          language="css" 
          theme={theme} 
          defaultValue={userCss}
          onMount={handleEditorDidMount} 
          options={{ 
              minimap: { enabled: showMinimap }, 
              readOnly: readOnly, 
              fontSize: 14, 
              glyphMargin: true, 
              renderValidationDecorations: 'off', 
              hover: { enabled: false }, 
              colorDecorators: true, 
              wordWrap: 'on', 
              bracketPairColorization: { enabled: true }, 
              smoothScrolling: true, 
              cursorBlinking: 'smooth', 
              formatOnPaste: true, 
              padding: { top: 16, bottom: 16 }, 
              scrollBeyondLastLine: false, 
              fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace" 
          }}
        />
      </div>
      
      {!readOnly && (
        <button onClick={runAnalysis} className="evaluate-button">
          {t(locale, 'ui', 'evaluate')} <span style={{ opacity: 0.8, fontSize: '0.85em', marginLeft: '8px', fontWeight: 'normal' }}>(Ctrl + Enter)</span>
        </button>
      )}
    </div>
  );
});
export default EditorPanel;