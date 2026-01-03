import * as Taffy from "taffy-js";
import { Node } from "./Node.js";
import { Config } from "./Config.js";
import { Constants } from "./enums.js";

await Taffy.default();

const Yoga = {
  Node,
  Config,
  ...Constants,
};

export default Yoga;
export * from "./enums.js";
export type { Node, MeasureFunction, DirtiedFunction, Size } from "./Node.js";
export type { Config } from "./Config.js";
