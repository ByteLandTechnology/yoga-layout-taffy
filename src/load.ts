import * as Taffy from "taffy-js";
import { Node } from "./Node.js";
import { Config } from "./Config.js";
import { Constants } from "./enums.js";

/**
 * Asynchronously loads the WASM module and returns the Yoga interface.
 * Matches `loadYoga()` from `yoga-layout-prebuilt`.
 * @returns A promise that resolves to the Yoga namespace.
 */
async function loadYoga() {
  await Taffy.default();

  const Yoga = {
    Node,
    Config,
    ...Constants,
  };

  return Yoga;
}

export { loadYoga };
export * from "./enums.js";
export type { Node, MeasureFunction, DirtiedFunction, Size } from "./Node.js";
export type { Config } from "./Config.js";
