export function frameTimes(verification) {
  if (verification?.mode !== 'allFrames') return null;
  return Array.from({ length: verification.totalFrames }, (_, index) => Number((index / verification.fps).toFixed(6)));
}

export function assessCheck(parsed, exitCode, frames) {
  const samples = parsed?.layout?.samples;
  const layoutRan = Array.isArray(samples) && samples.length > 0;
  // HyperFrames reports sampled timestamps rounded to milliseconds.
  const allFramesObserved = !frames || frames.every(frame => samples?.some(sample => Math.abs(sample - frame) <= 0.00051));
  // The browser checker can demote brief collisions to info. Any sampled
  // geometry finding blocks a render, including in ordinary check mode.
  const geometryClear = parsed?.layout?.findings?.length === 0;
  const runtimeClear = !parsed?.runtime?.findings?.some(finding => finding.severity === 'warning' || finding.severity === 'error');
  const hardWarnings = (parsed?.lint?.findings || []).filter(f => f.code === 'gsap_timeline_set_initial_hide');
  return {
    ok: exitCode === 0 && parsed?.ok === true && layoutRan && allFramesObserved && geometryClear && runtimeClear && hardWarnings.length === 0,
    exitCode, layoutRan, allFramesObserved, geometryClear, runtimeClear, hardWarnings, report: parsed,
  };
}
