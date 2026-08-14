import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { analyzeCss, lintCssAst } from '../utility/cssAnalyzer';
import { t } from '../utility/locales';

const ChallengeContext = createContext(null);

export const ChallengeProvider = ({ task, locale = 'sk', onComplete, children }) => {
  const [userCss, setUserCss] = useState(task.currentCode || task.initialCss || '');
  const safeUserCssRef = useRef(task.currentCode || task.initialCss || '');

  const [analysisIssues, setAnalysisIssues] = useState([]);
  const [linterIssues, setLinterIssues] = useState([]);
  const [checklistIssues, setChecklistIssues] = useState([]);
  const [score, setScore] = useState(null);
  const [detailedScore, setDetailedScore] = useState(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [activeHint, setActiveHint] = useState(null);
  const [toast, setToast] = useState({ isOpen: false, type: 'success', title: '', text: '' });
  const [focusSelectorStr, setFocusSelectorStr] = useState(null);
  const [getSyntaxErrors, setGetSyntaxErrors] = useState(null);
  
  const [resetTrigger, setResetTrigger] = useState(0); 

  const lastActivityRef = useRef(Date.now());
  const hintTimeoutSecs = task.hintTimeout || 60;
  const hintShownRef = useRef(false);
  const dbLoadSyncRef = useRef(false);

  const getCurrentCode = () => safeUserCssRef.current;

  const setUserCssSafe = (newCss) => {
    safeUserCssRef.current = newCss;
    setUserCss(newCss);
  };

  useEffect(() => {
    const startCode = task.currentCode || task.initialCss || '';
    setUserCssSafe(startCode); 
    setAnalysisIssues([]);
    setLinterIssues([]);
    setChecklistIssues(task.checks?.map(c => ({ checkId: c.id, level: 'error' })) || []);
    setScore(null);
    setDetailedScore(null);
    setHasEvaluated(false);
    setActiveHint(null);
    setToast({ isOpen: false, type: 'success', title: '', text: '' });
    setFocusSelectorStr(null);
    dbLoadSyncRef.current = false; 
  }, [task.id]); 

  useEffect(() => {
    if (task.currentCode !== safeUserCssRef.current) {
      setUserCssSafe(task.currentCode || '');
    }
  }, [task.currentCode]);

  useEffect(() => {
    let timer;
    if (toast.isOpen) {
      timer = setTimeout(() => {
        setToast(prev => ({ ...prev, isOpen: false }));
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [toast.isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parser = new DOMParser();
      const virtualDoc = parser.parseFromString(task.initialHtml, 'text/html');
      const realtimeErrors = lintCssAst(userCss, virtualDoc, task.targetSelectors);
      
      const translated = realtimeErrors.map(issue => {
        if (issue.message) return issue;
        let msg = "";
        if (issue.messageCode === 'ignoredProp') {
            const reason = t(locale, 'rules', issue.msgParams.reasonCode);
            msg = t(locale, 'linter', 'ignoredProp', { prop: issue.msgParams.prop, reason });
        } else if (issue.messageCode === 'specialRule') {
            msg = t(locale, 'rules', issue.msgParams.reasonCode);
        } else {
            msg = t(locale, issue.category, issue.messageCode, issue.msgParams);
        }
        return { ...issue, message: msg || issue.messageCode };
      });
      setLinterIssues(translated);
    }, 500);
    return () => clearTimeout(timer);
  }, [userCss, task, locale]);

   useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (hintShownRef.current) {
        hintShownRef.current = false;
        setActiveHint(null); 
      }
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = (now - lastActivityRef.current) / 1000;

      if (hintShownRef.current || score === 100) return;

      if (timeSinceLastActivity >= hintTimeoutSecs) {
        hintShownRef.current = true;
        
        let hintMessage = "";

        const linterError = linterIssues.find(i => i.level === 'error');
        if (linterError) {
          hintMessage = t(locale, 'ui', 'hintError', { msg: linterError.message });
        } 
        else if (hasEvaluated && checklistIssues.length > 0) {
          const firstFailed = checklistIssues.find(i => i.level === 'error') || checklistIssues[0];
          hintMessage = t(locale, 'ui', 'hintNext', { msg: firstFailed.message });
        } 
        else if (!hasEvaluated) {
          hintMessage = t(locale, 'ui', 'hintDefault');
        }

        if (hintMessage) {
          setActiveHint(hintMessage);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      clearInterval(interval);
    };
  }, [hintTimeoutSecs, linterIssues, checklistIssues, hasEvaluated, score, locale]);


  const handleRunAnalysis = async () => {
    let syntaxIssues = [];
    if (getSyntaxErrors) {
        syntaxIssues = getSyntaxErrors();
    }

    if (syntaxIssues.length > 0) {
        const translatedSyntax = syntaxIssues.map(issue => ({
            ...issue,
            message: t(locale, issue.category, issue.messageCode, issue.msgParams) || issue.messageCode
        }));
        
        setAnalysisIssues(translatedSyntax);
        setScore(0);
        setHasEvaluated(true);
        
        const failedChecks = task.checks?.map(c => ({ checkId: c.id, level: 'error' })) || [];
        setChecklistIssues(failedChecks);
        
        setToast({ isOpen: true, type: 'error', title: t(locale, 'ui', 'errorTitle'), text: t(locale, 'ui', 'errorText') });
        return; 
    }

    const { status, results, score: newScore, teacherIssues, scoreDetails } = await analyzeCss(
      task.initialHtml, userCss, task.initialCss, task.solutionCss, task.targetSelectors, task.checks || [], task.solutionHtml
    );

    setScore(newScore);
    setDetailedScore(scoreDetails); 
    setHasEvaluated(true);

    const translateArr = (arr) => arr.map(issue => {
        if (issue.message) return issue;
        let msg = "";
        
        if (issue.messageCode === 'ignoredProp') {
            const reason = t(locale, 'rules', issue.msgParams.reasonCode);
            msg = t(locale, 'linter', 'ignoredProp', { prop: issue.msgParams.prop, reason });
        } else if (issue.messageCode === 'specialRule') {
            msg = t(locale, 'rules', issue.msgParams.reasonCode);
        } else {
            msg = t(locale, issue.category, issue.messageCode, issue.msgParams);
        }
        
        return { ...issue, message: msg || issue.messageCode };
    });

    const translatedResults = translateArr(results);
    setChecklistIssues(translateArr(teacherIssues || []));

    const errors = translatedResults.filter(i => i.level === 'error');
    const warnings = translatedResults.filter(i => i.level === 'warning');
    const recommendations = translatedResults.filter(i => i.level === 'recommendation');

    if (errors.length > 0) setAnalysisIssues(errors);
    else if (warnings.length > 0) setAnalysisIssues(warnings);
    else setAnalysisIssues(recommendations);

    if (newScore === 0) {
        setToast({ isOpen: true, type: 'error', title: t(locale, 'ui', 'errorTitle'), text: t(locale, 'ui', 'errorText') });
    } else if (errors.length > 0) {
        setToast({ isOpen: true, type: 'error', title: t(locale, 'ui', 'keepTryingTitle'), text: t(locale, 'ui', 'keepTryingText') });
    } else if (errors.length === 0 && warnings.length > 0) {
        setToast({ isOpen: true, type: 'warning', title: t(locale, 'ui', 'almostDoneTitle'), text: t(locale, 'ui', 'almostDoneText') });
    } else if (errors.length === 0 && warnings.length === 0) {
        setToast({ isOpen: true, type: 'success', title: t(locale, 'ui', 'perfectTitle'), text: t(locale, 'ui', 'perfectText') });
        if (onComplete) {
            setTimeout(() => {
                onComplete({ status: 'success_perfect', code: userCss, finalScore: newScore, scoreDetails: scoreDetails });
            }, 50);
        }
    }
  };

  const resetChallenge = () => {
    setUserCssSafe(task.initialCss || '');
    setScore(null);
    setDetailedScore(null);
    setHasEvaluated(false);
    setAnalysisIssues([]);
    setChecklistIssues([]);
    setResetTrigger(prev => prev + 1); 

    setToast({ 
      isOpen: true, 
      type: 'warning', 
      title: t(locale, 'ui', 'resetTitle'), 
      text: t(locale, 'ui', 'resetText') 
    });
  };

  const value = {
    task, locale, userCss, setUserCss: setUserCssSafe, analysisIssues, setAnalysisIssues, linterIssues, checklistIssues, 
    score, hasEvaluated, activeHint, setActiveHint, toast, 
    runAnalysis: handleRunAnalysis,
    resetChallenge,
    resetTrigger,
    getCurrentCode,
    focusSelectorStr, setFocusSelectorStr,
    registerSyntaxChecker: (fn) => setGetSyntaxErrors(() => fn)
  };

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
    <ChallengeContext.Provider value={value}>
      {children}     
      {typeof document !== 'undefined' && createPortal(toastMarkup, document.body)}
    </ChallengeContext.Provider>
  );
};

export const useChallenge = () => useContext(ChallengeContext);