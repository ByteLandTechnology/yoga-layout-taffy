import * as Taffy from "taffy-js";

/**
 * Checks if running in a Node.js environment.
 */
function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Initializes the Taffy WASM module in a cross-platform manner.
 * In Node.js, reads the WASM file from disk using fs/path.
 * In browser, uses fetch via the default initialization.
 */
export async function initTaffy(): Promise<void> {
  if (isNode()) {
    // Node.js environment: load WASM from disk
    const { readFileSync } = await import("fs");
    const { dirname, resolve } = await import("path");
    const { fileURLToPath } = await import("url");

    // Get the path to the taffy-js WASM file
    const taffyJsPath = await import.meta.resolve?.("taffy-js");
    let wasmPath: string;

    if (taffyJsPath) {
      // Resolve from the taffy-js package location
      const taffyDir = dirname(fileURLToPath(taffyJsPath));
      wasmPath = resolve(taffyDir, "taffy_js_bg.wasm");
    } else {
      // Fallback: assume node_modules structure
      wasmPath = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../node_modules/taffy-js/taffy_js_bg.wasm",
      );
    }

    const wasmBuffer = readFileSync(wasmPath);
    Taffy.initSync({ module: wasmBuffer });
  } else {
    // Browser environment: use default fetch-based initialization
    await Taffy.default();
  }
}
