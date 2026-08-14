import * as csstree from 'css-tree';
import DOMPurify from 'dompurify';
import { IGNORED_PROPERTIES, SHORTHAND_MAP, DEPRECATED_PROPERTIES, SPECIAL_RULES, VALID_UNITS } from './cssRules';

export function sanitizeHtml(rawHtml) {
    if (!rawHtml) return '';
    return DOMPurify.sanitize(rawHtml, { 
        USE_PROFILES: { html: true },
        FORBID_ATTR: ['style']
    });
}

function normalizeComputedValue(val) {
    if (!val) return '';
    return val.toString().toLowerCase().replace(/\s+/g, '');
}

const SAFE_VISUAL_PROPS = [
    'background-color', 'color', 'border-radius', 'opacity', 'text-align', 'font-weight'
];

function getResolvedValues(ast, targetSelector, targetProperty, expectedMedia, doc) {
    const values = []; const lines = []; let selectorLine = 1; 
    const targetElement = doc.querySelector(targetSelector);
    if (!targetElement) return { values: [], lines: [], selectorLine: 1, elementExists: false };

    let currentMediaContext = null;
    csstree.walk(ast, {
        enter: (node) => {
            if (node.type === 'Atrule' && node.name === 'media') currentMediaContext = csstree.generate(node.prelude).replace(/\s+/g, '');
            if (node.type === 'Rule') {
                let matchesTarget = false;
                const selectorString = csstree.generate(node.prelude);
                for (let sel of selectorString.split(',')) {
                    try {
                        const cleanSel = sel.split(':')[0].trim(); 
                        if (cleanSel && targetElement.matches(cleanSel)) { matchesTarget = true; selectorLine = node.loc.start.line; break; }
                    } catch (e) {}
                }
                if (matchesTarget) {
                    let isMediaMatch = true;
                    if (expectedMedia) {
                        const cleanExpectedMedia = expectedMedia.replace(/\s+/g, '');
                        if (currentMediaContext !== cleanExpectedMedia) isMediaMatch = false;
                    } else if (currentMediaContext) {
                        isMediaMatch = false;
                    }
                    if (isMediaMatch) {
                        csstree.walk(node.block, {
                            visit: 'Declaration',
                            enter: (decl) => {
                                if (decl.property === targetProperty) { 
                                    values.push(csstree.generate(decl.value).trim()); 
                                    lines.push(decl.loc.start.line); 
                                }
                            }
                        });
                    }
                }
            }
        },
        leave: (node) => { if (node.type === 'Atrule' && node.name === 'media') currentMediaContext = null; }
    });
    return { values, lines, selectorLine, elementExists: true };
}

function evaluateTeacherChecks(ast, checks, doc) {
    const issues = []; let failedCount = 0; 
    if (!checks || checks.length === 0) return { issues, failedCount };

    checks.forEach(check => {
        const { values, lines, selectorLine, elementExists } = getResolvedValues(ast, check.selector, check.property, check.media, doc);
        if (!elementExists) return;

        const lastValue = values.length > 0 ? values[values.length - 1] : null;
        const errorLine = lines.length > 0 ? lines[lines.length - 1] : selectorLine;
        let checkFailed = false; 
        const mediaHint = check.media ? ` v bloku @media ${check.media}` : '';

        const pushIssue = (code, params) => {
            issues.push({ checkId: check.id, level: check.level || 'error', lineNumber: errorLine, category: 'checks', messageCode: code, msgParams: { ...params, media: mediaHint }, message: check.message || null });
            checkFailed = true;
        };

        if (check.type === 'forbidden-property' && values.length > 0) pushIssue('forbiddenProp', { prop: check.property });
        if ((check.type === 'required-property' || check.type === 'exists') && lastValue === null) pushIssue('missingProp', { prop: check.property });
        if (check.type === 'exact-match') {
            if (lastValue === null) pushIssue('missingExact', { prop: check.property });
            else if (lastValue !== check.value) pushIssue('wrongValue', { exp: check.value, act: lastValue });
        }
        if (check.type === 'regex-match') {
             if (lastValue === null) pushIssue('missingExact', { prop: check.property });
             else if (!new RegExp(check.value).test(lastValue)) pushIssue('wrongFormat', { act: lastValue });
        }
        if (check.type === 'min-count' && values.length < check.value) pushIssue('minCount', { prop: check.property, cnt: check.value });
        if (check.type === 'max-count' && values.length > check.value) pushIssue('maxCount', { prop: check.property, cnt: check.value });
        if (check.type === 'forbidden-value') {
            const idx = values.findIndex(val => val.includes(check.value));
            if (idx !== -1) pushIssue('forbiddenValue', { val: check.value });
        }
        if (checkFailed) failedCount++;
    });
    return { issues, failedCount };
}

export function lintCssAst(userCss, doc = null, targetSelectors = []) {
    const issues = []; let ast;
    
    try { 
        ast = csstree.parse(userCss, { positions: true }); 
    } catch (e) { 
        return []; 
    }

    const seenSelectors = new Set();
    const exactRequiresUnit = new Set([
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'top', 'right', 'bottom', 'left',
        'font-size', 'border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
        'border-radius', 'letter-spacing', 'word-spacing', 'text-indent', 'outline-width',
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'outline'
    ]);

    const UNITLESS_PROPS = new Set([
        'line-height', 'z-index', 'opacity', 'flex', 'flex-grow', 'flex-shrink', 
        'order', 'font-weight', 'column-count', 'scale', 'zoom', 
        'border-image-width', 'font-size-adjust', 'aspect-ratio'
    ]);

    const pushLinter = (line, level, code, params) => issues.push({ category: 'linter', lineNumber: line, level, messageCode: code, msgParams: params });

    let currentMediaContext = 'global';
    let allowedTeacherDepth = 3; 
    targetSelectors.forEach(sel => {
        const depth = sel.split(/[\s>+~]+/).filter(Boolean).length;
        if (depth > allowedTeacherDepth) allowedTeacherDepth = depth;
    });

    csstree.walk(ast, {
        enter: (node) => {
            if (node.type === 'Atrule' && node.name === 'media') currentMediaContext = csstree.generate(node.prelude).replace(/\s+/g, '');

            if (node.type === 'Rule') {
                const selectorText = csstree.generate(node.prelude);

                if (node.block.children.head === null) {
                    pushLinter(node.loc.start.line, 'warning', 'emptySelector', { sel: selectorText });
                }
                
                const uniqueSelectorKey = `${currentMediaContext}::${selectorText}`;
                if (seenSelectors.has(uniqueSelectorKey)) pushLinter(node.loc.start.line, 'warning', 'duplicateSelector', { sel: selectorText });
                seenSelectors.add(uniqueSelectorKey);

                if (node.prelude.type === 'SelectorList') {
                    node.prelude.children.forEach(singleSelectorAst => {
                        let combinatorCount = 0; let idCount = 0; let usesAllowedId = false;
                        csstree.walk(singleSelectorAst, {
                            enter: (part) => {
                                if (part.type === 'Combinator') combinatorCount++;
                                if (part.type === 'IdSelector') {
                                    idCount++;
                                    if (targetSelectors.some(ts => ts.includes(`#${part.name}`))) usesAllowedId = true;
                                }
                            }
                        });
                        const structuralDepth = combinatorCount + 1;
                        const singleSelText = csstree.generate(singleSelectorAst);

                        if (idCount > 0 && !usesAllowedId) pushLinter(node.loc.start.line, 'recommendation', 'avoidId', { sel: singleSelText });
                        if (structuralDepth > allowedTeacherDepth) pushLinter(node.loc.start.line, 'recommendation', 'overlySpecific', { sel: singleSelText, cnt: structuralDepth });
                    });
                }

                if (doc) {
                    try {
                        selectorText.split(',').forEach(singleSel => {
                            const baseSelector = singleSel.trim().split(':')[0]; 
                            if (baseSelector && baseSelector !== '*' && baseSelector !== 'body' && baseSelector !== 'html') {
                                if (!doc.querySelector(baseSelector)) pushLinter(node.loc.start.line, 'warning', 'deadCode', { sel: baseSelector });
                            }
                        });
                    } catch (e) {}
                }

                const props = new Map(); const declaredPropsList = []; 
                csstree.walk(node.block, {
                    visit: 'Declaration',
                    enter: (decl) => {
                        const propName = decl.property.toLowerCase();
                        let value = ''; try { value = csstree.generate(decl.value).trim(); } catch(e){}
                        const propData = { name: propName, value: value, loc: decl.loc, important: decl.important };

                        if (props.has(propName)) pushLinter(decl.loc.start.line, 'warning', 'duplicateProp', { prop: propName });
                        if (DEPRECATED_PROPERTIES.includes(propName)) pushLinter(decl.loc.start.line, 'warning', 'deprecatedProp', { prop: propName });
                        if (SHORTHAND_MAP[propName]) {
                            SHORTHAND_MAP[propName].forEach(long => {
                                if (declaredPropsList.some(p => p.name === long)) pushLinter(decl.loc.start.line, 'warning', 'shorthandOverride', { short: propName, long });
                            });
                        }
                        if (decl.important) pushLinter(decl.loc.start.line, 'warning', 'important');

                         csstree.walk(decl, {
                            enter: (n) => {
                                if (n.type === 'Number' && n.value !== '0') {
                                    if (UNITLESS_PROPS.has(propName)) {
                                        return; 
                                    }

                                    if (propName.startsWith('--')) {
                                        return;
                                    }

                                    if (exactRequiresUnit.has(propName)) {
                                        pushLinter(decl.loc.start.line, 'error', 'missingUnit', { val: n.value });
                                    }
                                }
                                
                                if (n.type === 'Dimension' && !VALID_UNITS.has(n.unit.toLowerCase())) {
                                    pushLinter(decl.loc.start.line, 'error', 'unknownUnit', { unit: n.unit });
                                }
                            }
                        });

                        props.set(propName, propData); declaredPropsList.push(propData);
                    }
                });

                IGNORED_PROPERTIES.forEach(rule => {
                    const trig = props.get(rule.property);
                    let active = trig ? (rule.value instanceof RegExp ? rule.value.test(trig.value) : trig.value === rule.value) : rule.isDefault;
                    if (active) {
                        rule.ignored.forEach(ig => {
                            if (props.has(ig)) issues.push({ category: 'linter', level: 'warning', messageCode: 'ignoredProp', msgParams: { prop: ig, reasonCode: rule.reasonCode }, lineNumber: props.get(ig).loc.start.line });
                        });
                    }
                });

                SPECIAL_RULES.forEach(rule => {
                    const err = rule.check(props);
                    if (err && props.get(err.prop)) issues.push({ category: 'linter', level: 'warning', messageCode: 'specialRule', msgParams: { reasonCode: err.code }, lineNumber: props.get(err.prop).loc.start.line });
                });
            }
            if (node.type === 'Atrule' && node.name === 'keyframes') {
                csstree.walk(node, { visit: 'Declaration', enter: (decl) => { if (decl.important) pushLinter(decl.loc.start.line, 'error', 'importantKeyframes'); } });
            }
        },
        leave: (node) => { if (node.type === 'Atrule' && node.name === 'media') currentMediaContext = 'global'; }
    });
    return issues;
}

function obfuscateHtmlAndCss(html, css, targetSelectors) {
    let obfuscatedHtml = html; let obfuscatedCss = css; const mapping = {};
    targetSelectors.forEach(selector => {
        if (selector.startsWith('.')) {
            const originalClass = selector.substring(1);
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const newClass = `sol-${randomSuffix}`;
            const classRegex = new RegExp(`class=["']([^"']*?)\\b${originalClass}\\b([^"']*?)["']`, 'g');
            obfuscatedHtml = obfuscatedHtml.replace(classRegex, (match, p1, p2) => `class="${p1}${newClass}${p2}"`);
            const cssRegex = new RegExp(`\\.${originalClass}\\b`, 'g');
            obfuscatedCss = obfuscatedCss.replace(cssRegex, `.${newClass}`);
            mapping[selector] = `.${newClass}`;
        }
    });
    return { obfuscatedHtml, obfuscatedCss, mapping };
}

function createIframe(html, css) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-same-origin';
        Object.assign(iframe.style, { position: 'absolute', left: '-10000px', top: '-10000px', width: '1000px', height: '1000px' });
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        doc.open(); doc.write(`<!DOCTYPE html><html><head><style>* { box-sizing: border-box; } html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; } ${css}</style></head><body>${html}</body></html>`); doc.close();
        setTimeout(() => resolve(iframe), 100);
    });
}

function calculateIoU(rect1, rect2) {
    if (rect1.width === 0 || rect1.height === 0 || rect2.width === 0 || rect2.height === 0) return 0;
    const intersectX = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
    const intersectY = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
    const intersectArea = intersectX * intersectY;
    const unionArea = rect1.width * rect1.height + rect2.width * rect2.height - intersectArea;
    if (unionArea <= 0) return 0;
    return intersectArea / unionArea;
}

export async function analyzeCss(html, userCss, initialCss, solutionCss, targetSelectors, teacherChecks, solutionHtml) {
    let userAst;
    try { 
        userAst = csstree.parse(userCss, { positions: true }); 
    } 
    catch(e) { 
        userAst = null; 
    }

    const fullSolutionCss = `${initialCss}\n${solutionCss}`;
    const safeHtml = sanitizeHtml(html);
    const safeSolutionHtml = sanitizeHtml(solutionHtml || html);
    const { obfuscatedHtml, obfuscatedCss, mapping } = obfuscateHtmlAndCss(safeSolutionHtml, fullSolutionCss, targetSelectors);

    const [studentIframe, solutionIframe] = await Promise.all([ createIframe(safeHtml, userCss), createIframe(obfuscatedHtml, obfuscatedCss) ]);
    
    const linterIssues = lintCssAst(userCss, studentIframe.contentDocument, targetSelectors);

    let penaltyPoints = 0;
    linterIssues.forEach(issue => { penaltyPoints += issue.level === 'error' ? 100 : (issue.level === 'warning' ? 2 : 1); });

    let teacherIssues = []; let checkPoints = 0; let totalCheckWeight = 0; let earnedCheckWeight = 0;
    const hasTeacherChecks = teacherChecks && teacherChecks.length > 0;

    if (userAst && hasTeacherChecks) {
        const checkResult = evaluateTeacherChecks(userAst, teacherChecks, studentIframe.contentDocument);
        teacherIssues = checkResult.issues;
        teacherChecks.forEach(check => {
            let weight = check.level === 'error' ? 3 : (check.level === 'warning' ? 2 : 1);
            totalCheckWeight += weight;
            if (!teacherIssues.some(issue => issue.checkId === check.id)) earnedCheckWeight += weight;
        });
        checkPoints = (earnedCheckWeight / totalCheckWeight) * 50;
    }

    let totalIoU = 0; let validSelectorsCount = 0; let lowestIoUSelector = null; let lowestIoUValue = 1;
    let visualIssues = []; 

    for (const selector of targetSelectors) {
        const sEl = studentIframe.contentDocument.querySelector(selector);
        const solEl = solutionIframe.contentDocument.querySelector(mapping[selector] || selector);
        
        if (sEl && solEl) {
            const sRect = sEl.getBoundingClientRect();
            const solRect = solEl.getBoundingClientRect();

            let iou = calculateIoU(sRect, solRect);
            if (iou > 0.98) iou = 1.0;
            totalIoU += iou; validSelectorsCount++;
            if (iou < lowestIoUValue) { lowestIoUValue = iou; lowestIoUSelector = selector; }

            const foundLine = userCss.split('\n').findIndex(l => l.includes(selector.replace('.', '')));
            const lineIndex = foundLine !== -1 ? foundLine + 1 : 1;

            if (iou < 1.0) {
                const diffW = sRect.width - solRect.width;
                const diffH = sRect.height - solRect.height;
                const diffX = sRect.left - solRect.left;
                const diffY = sRect.top - solRect.top;

                const pushGeoHint = (code) => {
                    visualIssues.push({ category: 'analyzer', level: iou < 0.8 ? 'error' : 'warning', messageCode: code, msgParams: { sel: selector }, lineNumber: lineIndex });
                };

                let sizeWrong = false;
                if (diffW > 2) { pushGeoHint('tooWide'); sizeWrong = true; }
                else if (diffW < -2) { pushGeoHint('tooNarrow'); sizeWrong = true; }
                
                if (diffH > 2) { pushGeoHint('tooTall'); sizeWrong = true; }
                else if (diffH < -2) { pushGeoHint('tooShort'); sizeWrong = true; }

                if (!sizeWrong) {
                    if (diffX > 2) pushGeoHint('movedRight');
                    else if (diffX < -2) pushGeoHint('movedLeft');
                    if (diffY > 2) pushGeoHint('movedDown');
                    else if (diffY < -2) pushGeoHint('movedUp');
                }
            }

            const sStyle = studentIframe.contentWindow.getComputedStyle(sEl);
            const solStyle = solutionIframe.contentWindow.getComputedStyle(solEl);

            for (const prop of SAFE_VISUAL_PROPS) {
                const sVal = normalizeComputedValue(sStyle.getPropertyValue(prop));
                const solVal = normalizeComputedValue(solStyle.getPropertyValue(prop));

                if (solVal && solVal !== 'rgba(0,0,0,0)' && solVal !== 'transparent' && solVal !== '0px' && solVal !== 'normal') {
                    if (sVal !== solVal) {
                        let propLine = lineIndex;
                        if (userAst) {
                            csstree.walk(userAst, {
                                visit: 'Rule',
                                enter: (node) => {
                                    if (csstree.generate(node.prelude).includes(selector)) {
                                        csstree.walk(node.block, {
                                            visit: 'Declaration',
                                            enter: (decl) => {
                                                const declProp = decl.property.toLowerCase();
                                                const targetBase = prop.split('-')[0]; 
                                                if (declProp === prop || declProp === targetBase) propLine = decl.loc.start.line; 
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        visualIssues.push({ category: 'analyzer', level: 'warning', messageCode: 'visualMismatch', msgParams: { sel: selector, prop: prop }, lineNumber: propLine });
                        penaltyPoints += 5; 
                    }
                }
            }
        } else {
            validSelectorsCount++; lowestIoUValue = 0; lowestIoUSelector = selector;
        }
    }

    let avgVisualMatch = validSelectorsCount > 0 ? (totalIoU / validSelectorsCount) : 0;
    if (avgVisualMatch < 0) avgVisualMatch = 0;
    let visualPoints = avgVisualMatch * (hasTeacherChecks ? 50 : 100);

    document.body.removeChild(studentIframe); 
    document.body.removeChild(solutionIframe);

    let calculatedScore = Math.max(0, Math.min(100, Math.round(visualPoints + checkPoints - penaltyPoints)));
    const allIssues = [...linterIssues, ...teacherIssues, ...visualIssues];

    if (lowestIoUValue < 1.0) {
        let lineIndex = 1;
        if (lowestIoUSelector) {
            const foundLine = userCss.split('\n').findIndex(l => l.includes(lowestIoUSelector.replace('.', '')));
            if (foundLine !== -1) lineIndex = foundLine + 1;
        }
        
        const geometryPercent = Math.round(lowestIoUValue * 100);
        const visualPercent = Math.max(0, geometryPercent - (penaltyPoints > 0 ? 15 : 0)); 

        if (geometryPercent < 98) {
             allIssues.push({ 
                 category: 'analyzer', 
                 level: 'error', 
                 messageCode: 'geometryError', 
                 msgParams: { sel: lowestIoUSelector || '?', match: geometryPercent, visMatch: visualPercent },
                 lineNumber: lineIndex 
             });
        } else if (geometryPercent < 100) {
             allIssues.push({ 
                 category: 'analyzer', 
                 level: 'warning', 
                 messageCode: 'geometryError', 
                 msgParams: { sel: lowestIoUSelector || '?', match: geometryPercent, visMatch: visualPercent }, 
                 lineNumber: lineIndex 
             });
        }
    }

    const hasError = allIssues.some(i => i.level === 'error');
    const hasWarning = allIssues.some(i => i.level === 'warning');
    let status = 'success_perfect';
    if (hasError || calculatedScore < 80) status = 'error'; else if (hasWarning || calculatedScore < 100) status = 'success_with_warning';

    return { status, results: allIssues, score: calculatedScore, teacherIssues, scoreDetails: { visualScore: Math.round(visualPoints), visualMatchPercentage: Math.round(avgVisualMatch * 100), checksScore: Math.round(checkPoints), penaltyPoints } };
}