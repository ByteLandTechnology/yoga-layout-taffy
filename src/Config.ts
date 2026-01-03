import * as Taffy from "taffy-js";
import { Errata } from "./enums.js";

/**
 * Configuration for the Yoga-like layout engine wrapper.
 * Manages the global TaffyTree instance and experimental feature settings.
 */
export class Config {
  private _tree: Taffy.TaffyTree;
  private _errata: Errata = Errata.All;

  /**
   * Creates a new configuration instance.
   * Initializes a new TaffyTree for layout computations.
   */
  constructor() {
    this._tree = new Taffy.TaffyTree();
  }

  /**
   * Factory method to create a new Config instance.
   * @returns A new Config instance.
   */
  static create(): Config {
    return new Config();
  }

  /**
   * Destroys the given Config instance, freeing associated resources.
   * @param config - The config to destroy.
   */
  static destroy(config: Config) {
    config.free();
  }

  /**
   * Frees the underlying TaffyTree resources.
   * Should be called when the Config is no longer needed to prevent memory leaks in WASM.
   */
  free() {
    this._tree.free();
  }

  /**
   * Accessor for the underlying TaffyTree instance.
   * @internal
   */
  get tree(): Taffy.TaffyTree {
    return this._tree;
  }

  private _useWebDefaults: boolean = false;

  /**
   * Sets whether an experimental feature is enabled.
   * @param feature - The feature ID (enum).
   * @param enabled - Whether to enable the feature.
   */
  setExperimentalFeatureEnabled(feature: number, enabled: boolean) {}

  /**
   * Sets the point scale factor for logical-to-physical pixel conversion.
   * @param pixelsInPoint - The scale factor.
   */
  setPointScaleFactor(pixelsInPoint: number) {}

  /**
   * Checks if using web defaults (e.g. Flex direction Row).
   * @returns True if using web defaults, false otherwise (classic Yoga defaults).
   */
  useWebDefaults(): boolean {
    return this._useWebDefaults;
  }

  /**
   * Enables or disables web standard defaults.
   * If true, flex-direction defaults to Row. If false, defaults to Column (Yoga standard).
   * @param useWebDefaults - Whether to use web defaults.
   */
  setUseWebDefaults(useWebDefaults: boolean) {
    this._useWebDefaults = useWebDefaults;
  }

  /**
   * Checks if an experimental feature is enabled.
   * @param feature - The feature ID.
   * @returns True if enabled, false otherwise.
   */
  isExperimentalFeatureEnabled(feature: number): boolean {
    return false;
  }

  /**
   * Sets the Errata compatibility flags.
   * @param errata - The bitmask of errata to enable.
   */
  setErrata(errata: Errata) {
    this._errata = errata;
  }

  /**
   * Gets the current Errata compatibility flags.
   * @returns The current errata bitmask.
   */
  getErrata(): Errata {
    return this._errata;
  }
}
