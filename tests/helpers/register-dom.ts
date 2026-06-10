import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Registers happy-dom globals for React component tests. Import this module
// before react-dom so a document exists when react-dom evaluates. Registration
// is intentionally never undone: under `bun test` all files share one process
// and module side effects run once, so an unregister in one file would leave
// later DOM test files without a document. Existing non-DOM tests stub
// `globalThis.fetch` themselves, so the leaked globals are inert for them.
if (typeof document === "undefined") {
  GlobalRegistrator.register();
}

// Allow `act()` from React without environment warnings.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
