function sourceFor(selector, sourceMap, profile) {
  if (typeof selector !== 'string') return null;
  const match = Object.entries(sourceMap || {}).find(([id]) => selector === id || selector.startsWith(`${id} `) || selector.startsWith(`${id}>`) || selector.startsWith(`${id}.`));
  if (!match) return null;
  const source = match[1];
  return { sceneId: source.sceneId, nodeId: source.nodeId, location: source.layoutLocations?.[profile] || source.location };
}

function runtimeSource(finding, sourceMap, profile) {
  const selected = sourceFor(finding.selector, sourceMap, profile);
  if (selected) return selected;
  const entry = Object.entries(sourceMap || {}).find(([selector]) => finding.message?.includes(selector.slice(1)));
  return entry ? sourceFor(entry[0], sourceMap, profile) : null;
}

export function checkFeedback(report) {
  const findings = [];
  for (const [profile, check] of Object.entries(report.checks || {})) {
    const parsed = check.report;
    const groups = new Map();
    for (const finding of parsed?.layout?.findings || []) {
      const selector = finding.selector || null;
      const source = sourceFor(selector, report.sourceMap, profile);
      const key = JSON.stringify([finding.code, selector, finding.relatedSelector || null, source?.nodeId]);
      if (!groups.has(key)) groups.set(key, { code: finding.code || 'geometry.finding', severity: 'error', profile, ...source, selector, relatedSelector: finding.relatedSelector || null, message: finding.message || 'Browser layout finding', firstTime: finding.time ?? null, lastTime: finding.time ?? null, occurrences: 0, bbox: finding.bbox || null, hint: source ? `Revise ${source.location} for ${profile}; rerun check. Keep required content visible and inside the safe canvas.` : `Inspect the affected scene in ${profile}; revise its FrameLang layout and rerun check.` });
      const group = groups.get(key);
      group.occurrences++;
      if (typeof finding.time === 'number') {
        group.firstTime = Math.min(group.firstTime ?? finding.time, finding.time);
        group.lastTime = Math.max(group.lastTime ?? finding.time, finding.time);
      }
    }
    findings.push(...groups.values());
    if (!check.allFramesObserved) findings.push({ code: 'verification.missingFrames', severity: 'error', profile, message: 'Not every requested frame timestamp was checked', hint: 'Rerun check and inspect the browser checker output.' });
    if (!check.layoutRan) findings.push({ code: 'verification.noLayout', severity: 'error', profile, message: 'Browser layout audit did not run', hint: 'Rerun check and inspect the browser checker output.' });
    for (const finding of (parsed?.runtime?.findings || []).filter(item => ['warning', 'error'].includes(item.severity))) {
      const textFit = finding.message?.includes('FrameLang text fit failed:');
      findings.push({ code: textFit ? 'geometry.textFit' : finding.code || 'runtime.finding', severity: 'error', profile, ...runtimeSource(finding, report.sourceMap, profile), message: finding.message || 'Browser runtime finding', time: finding.time ?? null, hint: textFit ? 'Shorten this text or enlarge its canvas rectangle; preserve required meaning, then recompile and check.' : 'Revise the indicated scene or animation, then rerun check.' });
    }
    if (!check.ok && groups.size === 0 && check.layoutRan && check.allFramesObserved && !parsed?.runtime?.findings?.some(item => ['warning', 'error'].includes(item.severity))) {
      findings.push({ code: 'verification.failed', severity: 'error', profile, message: 'The browser checker rejected this profile', hint: 'Inspect compile-report.json for the underlying lint, contrast, media, or checker failure.' });
    }
  }
  return { version: 1, stage: 'browser-check', inputHash: report.inputHash, recipe: report.recipe?.id || null, ok: report.checked === true, findings, instruction: report.checked ? 'Browser layout checks passed. Render may proceed.' : report.recipe ? 'Revise recipe copy for text-fit findings. Layout repairs require the full scene template. Recompile and recheck before rendering.' : 'Revise the FrameLang source using these findings, then compile and check again. Do not render until every profile passes.' };
}
