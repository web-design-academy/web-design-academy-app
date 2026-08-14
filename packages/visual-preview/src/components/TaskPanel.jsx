import React from 'react';
import { t } from '../utility/locales.js'; 
import { useChallenge } from '../context/ChallengeContext';
import { sanitizeHtml } from '../utility/cssAnalyzer.js';

function TaskPanel({ 
  showChecks = true, 
  customPadding = '25px 30px', 
  bgColor = '#ffffff',
  hideCompleted = false
}) {
  
  const { task, locale, hasEvaluated, checklistIssues } = useChallenge();

  const getCheckStatus = (check) => {
    if (!hasEvaluated) return 'pending';
    const failedIssue = checklistIssues.find(issue => (check.id && issue.checkId === check.id) || (!check.id && issue.message === check.message));
    if (failedIssue) return check.level === 'error' ? 'error' : 'warning';
    return 'success'; 
  };

  const visibleChecks = (task?.checks || []).filter(check => check.studentHint && check.studentHint.trim() !== '');

  return (
    <div className="css-analyzer-scope task-panel" style={{ height: '100%', overflowY: 'auto', padding: customPadding, backgroundColor: bgColor, boxSizing: 'border-box' }}>
      
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(task?.instructions || '') }} />

      {showChecks && visibleChecks.length > 0 && (
        <div className="task-checklist-container">
          <h4 className="checklist-title">{t(locale, 'ui', 'goals')}</h4>
          <ul className="task-checklist">
            {visibleChecks.map((check, index) => {
              const status = getCheckStatus(check);
              
              if (hideCompleted && status === 'success') return null;

              return (
                <li key={index} className={`checklist-item status-${status}`}>
                  <span className="checklist-icon">
                    {status === 'pending' && <svg viewBox="0 0 512 512" fill="#cbd5e1"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM256 112a144 144 0 1 1 0 288 144 144 0 1 1 0-288z"/></svg>}
                    {status === 'success' && <svg viewBox="0 0 512 512" fill="#10b981"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>}
                    {status === 'error' && <svg viewBox="0 0 512 512" fill="#ef4444"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/></svg>}
                    {status === 'warning' && <svg viewBox="0 0 512 512" fill="#f59e0b"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>}
                  </span>
                  <span className="checklist-text">
                     {check.studentHint}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TaskPanel;