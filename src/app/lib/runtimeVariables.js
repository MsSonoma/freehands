// Minimal runtime variables loader.
// Returns a stable shape so callers can safely destructure.

export async function loadRuntimeVariables() {
  try {
    if (typeof window !== 'undefined') {
      const varsRaw = localStorage.getItem('runtime_variables');
      if (varsRaw) {
        return JSON.parse(varsRaw);
      }
    }
  } catch {
    // ignore parse errors
  }
  return { targets: {} };
}

const runtimeVarsApi = { loadRuntimeVariables };
export default runtimeVarsApi;
