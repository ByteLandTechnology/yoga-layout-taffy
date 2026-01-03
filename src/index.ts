import { Node } from "./Node.js";
import { Config } from "./Config.js";
import { Constants } from "./enums.js";
import { initTaffy } from "./init.js";

await initTaffy();

const Yoga = {
  Node,
  Config,
  ...Constants,
};

export default Yoga;
export * from "./enums.js";
export type { Node, MeasureFunction, DirtiedFunction, Size } from "./Node.js";
export type { Config } from "./Config.js";
