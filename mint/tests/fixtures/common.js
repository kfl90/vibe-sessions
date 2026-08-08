// Shared fixture instrumentation. Each fixture's consent buttons call
// record('rejected' | 'accepted' | ...) so tests can assert exactly what
// the extension clicked, and how many times.
window.__cbClicks = 0;
window.__cbTestResult = null;
function record(result) {
  window.__cbClicks += 1;
  window.__cbTestResult = window.__cbTestResult || result;
}
