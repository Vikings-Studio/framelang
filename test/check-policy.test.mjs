import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCheck, frameTimes } from '../src/check-policy.mjs';

test('verified mode requires every requested frame and rejects brief geometry findings', () => {
  const frames = frameTimes({ mode: 'allFrames', fps: 24, totalFrames: 3 });
  assert.deepEqual(frames, [0, 0.041667, 0.083333]);
  const report = { ok: true, lint: { findings: [] }, layout: { samples: [0, 0.042, 0.083], findings: [] } };
  assert.equal(assessCheck(report, 0, frames).ok, true);
  report.layout.findings.push({ code: 'container_overflow', severity: 'info', time: 0.042 });
  assert.equal(assessCheck(report, 0, frames).ok, false);
  report.layout.findings = [];
  report.runtime = { findings: [{ code: 'console_warning', severity: 'warning', message: 'GSAP target missing' }] };
  assert.equal(assessCheck(report, 0, frames).ok, false);
  report.runtime.findings = [];
  report.layout.samples = [0, 0.083];
  assert.equal(assessCheck(report, 0, frames).ok, false);
});

test('ordinary browser checks also reject sampled geometry findings', () => {
  const report = { ok: true, lint: { findings: [] }, layout: { samples: [0, 1], findings: [{ code: 'element_overlap', severity: 'info', time: 1 }] } };
  assert.equal(assessCheck(report, 0, null).ok, false);
  report.layout.findings = [];
  report.runtime = { findings: [{ code: 'console_warning', severity: 'warning', message: 'FrameLang text fit failed: fl-s1-headline' }] };
  assert.equal(assessCheck(report, 0, null).ok, false);
});
