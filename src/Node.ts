import { Config } from "./Config.js";
import * as Taffy from "taffy-js";
import {
  Align,
  BoxSizing,
  Direction,
  Display,
  Edge,
  FlexDirection,
  Wrap,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Unit,
} from "./enums.js";
import * as Mapping from "./mapping.js";

/**
 * Represents a size with width and height.
 */
export type Size = {
  width: number;
  height: number;
};

/**
 * Represents a value with a unit.
 */
export type Value = {
  unit: Unit;
  value: number;
};

/**
 * Function type for custom measurement logic.
 * Used to calculate the size of leaf nodes (like text) based on available space.
 *
 * @param width - The available width.
 * @param widthMode - The measure mode for width (Undefined, Exactly, AtMost).
 * @param height - The available height.
 * @param heightMode - The measure mode for height.
 * @returns The measured size.
 */
export type MeasureFunction = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => Size;

/**
 * Default configuration used when a Node is created without an explicit Config.
 */
let defaultConfig: Config | null = null;

/**
 * Retrieves the lazily initialized default configuration.
 * @returns The default Config instance.
 */
function getDefaultConfig(): Config {
  if (!defaultConfig) {
    defaultConfig = new Config();
  }
  return defaultConfig;
}

/**
 * A Wrapper around a TaffyTree node, implementing the Yoga Layout Node API.
 *
 * Provides style setting, layout calculation, and tree management to match Yoga's interface.
 */
export class Node {
  /**
   * The unique identifier for the node in the Taffy tree.
   */
  private id: bigint;

  /**
   * The underlying Taffy tree instance.
   */
  private tree: Taffy.TaffyTree;

  /**
   * The configuration associated with this node.
   */
  private config: Config;

  /**
   * Global cache of Node instances by their ID.
   * Ensures that retrieving a node by ID (e.g., via `getChild`) always returns the same JavaScript object instance.
   * This mimics Yoga's behavior and is crucial for object identity comparisons.
   */
  private static instanceCache: Map<bigint, Node> = new Map();

  /**
   * List of children nodes.
   * Maintained to ensure consistent order and easy access to child instances.
   */
  private childList: Node[] = [];

  /**
   * The parent node of this node.
   * Used for dirty state propagation.
   */
  private parent: Node | null = null;

  /**
   * Gets the parent node.
   * @returns The parent node or null.
   */
  getParent(): Node | null {
    return this.parent;
  }

  /**
   * Custom function to measure the node's dimensions.
   * Used for leaf nodes like text.
   */
  private measureFunc: MeasureFunction | null = null;

  /**
   * Callback function triggered when the node becomes dirty.
   */
  private dirtiedFunc: DirtiedFunction | null = null;

  /**
   * Internal flag tracking the dirty state of the node.
   * Used to prevent redundant callbacks.
   */
  private _isDirty: boolean = false;

  /**
   * Flag tracking if a new layout has been calculated but not yet "seen" by the user.
   */
  private _hasNewLayout: boolean = true;

  /**
   * Flag indicating if this node is a reference baseline for its parent.
   * This is a Yoga-specific feature not natively supported by Taffy, but stored for API compatibility.
   */
  private _isReferenceBaseline: boolean = false;

  /**
   * Creates a new Node instance with an optional configuration.
   * @param config - Optional configuration object.
   * @returns A new Node instance.
   */
  static create(config?: Config): Node {
    return config ? Node.createWithConfig(config) : Node.createDefault();
  }

  /**
   * Creates a new Node instance with default configuration.
   * @returns A new Node instance.
   */
  static createDefault(): Node {
    return new Node();
  }

  /**
   * Creates a new Node instance with strict configuration.
   * @param config - The configuration object.
   * @returns A new Node instance.
   */
  static createWithConfig(config: Config): Node {
    return new Node(config);
  }

  /**
   * Destroys a node, freeing its underlying resources.
   * @param node - The node to destroy.
   */
  static destroy(node: Node) {
    node.free();
  }

  /**
   * Initializes a new Node.
   * Internal constructor; use static `create` methods instead.
   * @param config - Optional configuration.
   */
  constructor(config?: Config) {
    this.config = config || getDefaultConfig();
    this.tree = this.config.tree;
    this.id = this.tree.newLeaf(new Taffy.Style());
    Node.instanceCache.set(this.id, this);

    if (!this.config.useWebDefaults()) {
      this.setFlexDirection(FlexDirection.Column);
      this.setAlignContent(Align.FlexStart);
    }
  }

  /**
   * Frees the node from the underlying Taffy tree.
   * Does NOT recursively free children (unlike `freeRecursive`).
   */
  free() {
    this.tree.remove(this.id);
    Node.instanceCache.delete(this.id);
    // Remove from parent's childList if tracked there?
    // User is responsible for tree integrity usually.
  }

  /**
   * Recursively frees the node and all its children.
   */
  freeRecursive() {
    // Yoga's freeRecursive
    for (const child of this.childList) {
      child.freeRecursive();
    }
    this.free();
  }

  /**
   * Internal helper to update Taffy style and mark dirtiness.
   * @param updater - Function to mutate the style object.
   */
  private updateStyle(updater: (style: Taffy.Style) => void) {
    const style = this.tree.getStyle(this.id);
    updater(style);
    this.tree.setStyle(this.id, style);
    // Style changes should mark the node dirty and trigger callback
    this.markDirtyInternal();
  }

  /**
   * Copies the style from another node to this one.
   * Performs a deep copy of style properties.
   * @param node - The source node to copy from.
   */
  copyStyle(node: Node) {
    // Deep copy style cache
    this._styleCache = JSON.parse(JSON.stringify(node._styleCache));

    // Sync all styles to Taffy
    this.syncStyle();
    this.resolveBordersToTaffy();
    this.resolveMarginsToTaffy();
    this.resolvePaddingsToTaffy();
    // Insets are handled in syncStyle -> resolveInsets

    // Also copy simple properties that are not part of "resolve" wrappers but in updateStyle
    this.updateStyle((s) => {
      const other = node.tree.getStyle(node.id);
      s.display = other.display;
      s.flex_direction = other.flex_direction;
      s.flex_wrap = other.flex_wrap;
      s.align_items = other.align_items;
      s.align_self = other.align_self;
      s.align_content = other.align_content;
      s.justify_content = other.justify_content;
      s.flex_grow = other.flex_grow;
      s.flex_shrink = other.flex_shrink;
      s.flex_basis = other.flex_basis;
      s.overflow = other.overflow;
      s.aspect_ratio = other.aspect_ratio;
      s.gap = other.gap;
      s.size = other.size;
      s.min_size = other.min_size;
      s.max_size = other.max_size;
      s.box_sizing = other.box_sizing;
    });
  }

  // --- Style Setters ---

  /**
   * Sets the flex direction (Row, Column, etc.).
   * @param flexDirection - The direction to set.
   */
  setFlexDirection(flexDirection: FlexDirection) {
    this._styleCache.flexDirection = flexDirection;
    this.updateStyle((s) => {
      s.flex_direction = Mapping.fromYogaFlexDirection(flexDirection);
    });
  }

  /**
   * Gets the current flex direction.
   * @returns The flex direction.
   */
  getFlexDirection(): FlexDirection {
    const style = this.tree.getStyle(this.id);
    return Mapping.toYogaFlexDirection(style.flex_direction);
  }

  /**
   * Sets the flex wrap property (NoWrap, Wrap, WrapReverse).
   * @param flexWrap - The wrap mode.
   */
  setFlexWrap(flexWrap: Wrap) {
    this.updateStyle((s) => {
      s.flex_wrap = Mapping.fromYogaWrap(flexWrap);
    });
  }

  /**
   * Sets the align-items property (how children are aligned on the cross axis).
   * @param alignItems - The alignment mode.
   */
  setAlignItems(alignItems: Align) {
    this.updateStyle((s) => {
      s.align_items = Mapping.fromYogaAlignItems(alignItems);
    });
  }

  /**
   * Sets the align-self property (overrides parent's align-items).
   * @param alignSelf - The alignment mode.
   */
  setAlignSelf(alignSelf: Align) {
    this.updateStyle((s) => {
      s.align_self = Mapping.fromYogaAlignSelf(alignSelf);
    });
  }

  /**
   * Sets the text direction (LTR or RTL).
   * @param direction - The direction to set.
   */
  setDirection(direction: Direction) {
    this._styleCache.direction = direction;
  }

  /**
   * Gets the current text direction.
   * @returns The direction.
   */
  getDirection(): Direction {
    return this._styleCache.direction;
  }

  /**
   * Sets the align-content property (distribution of lines on cross axis).
   * @param alignContent - The alignment mode.
   */
  setAlignContent(alignContent: Align) {
    this.updateStyle((s) => {
      s.align_content = Mapping.fromYogaAlignContent(alignContent);
    });
  }

  /**
   * Sets the justify-content property (alignment along the main axis).
   * @param justifyContent - The justification mode.
   */
  setJustifyContent(justifyContent: Justify) {
    this.updateStyle((s) => {
      s.justify_content = Mapping.fromYogaJustify(justifyContent);
    });
  }

  /**
   * Sets the display property (Flex, None).
   * @param display - The display mode.
   */
  setDisplay(display: Display) {
    this.updateStyle((s) => {
      const d = Mapping.fromYogaDisplay(display);
      s.display = d;
      if (d === Taffy.Display.None) {
        // Yoga behaves as if display: none removes it from layout? Taffy does too.
      }
    });
  }

  /**
   * Sets the flex grow factor.
   * @param flexGrow - The growth factor (>= 0).
   */
  setFlexGrow(flexGrow: number | undefined): void {
    this.updateStyle((s) => {
      s.flex_grow = flexGrow ?? 0;
    });
  }

  /**
   * Sets the flex shrink factor.
   * @param flexShrink - The shrink factor (>= 0).
   */
  setFlexShrink(flexShrink: number | undefined): void {
    this.updateStyle((s) => {
      s.flex_shrink = flexShrink ?? 0;
    });
  }

  /**
   * Sets the flex basis (initial main size).
   * @param flexBasis - The size (number for points, string for %, or 'auto').
   */
  setFlexBasis(flexBasis: number | "auto" | `${number}%` | undefined): void {
    this.updateStyle((s) => {
      s.flex_basis = this.parseValue(flexBasis ?? "auto");
    });
  }

  /**
   * Sets the flex basis as a percentage.
   * @param flexBasis - Percentage value (0-100).
   */
  setFlexBasisPercent(flexBasis: number | undefined): void {
    this.updateStyle((s) => {
      s.flex_basis =
        flexBasis !== undefined ? { Percent: flexBasis / 100.0 } : "Auto"; // Yoga uses 0-100 for percent args usually? Or 0-1?
      // Yoga API setWidth("50%") is common. setWidthPercent(50) -> usually means 50%.
      // Taffy takes 0.0-1.0.
    });
  }

  /**
   * Sets flex basis to 'auto'.
   */
  setFlexBasisAuto(): void {
    this.updateStyle((s) => {
      s.flex_basis = "Auto";
    });
  }

  /**
   * Sets the flex property.
   * In Yoga, this acts as a shorthand that sets flexGrow = flex, flexShrink = 1, and flexBasis = 0.
   * @param flex - The flex value.
   */
  setFlex(flex: number | undefined): void {
    this.setFlexGrow(flex ?? 0);
    this.setFlexShrink(1);
    this.setFlexBasis(0);
  }

  /**
   * Gets the current flex basis.
   * @returns Value object with unit and value.
   */
  getFlexBasis(): { unit: number; value: number } {
    const style = this.tree.getStyle(this.id);
    const flexBasis = style.flex_basis;

    if (flexBasis === "Auto") {
      return { unit: Unit.Auto, value: 0 };
    }
    if (typeof flexBasis === "object") {
      if ("Length" in flexBasis) {
        return { unit: Unit.Point, value: flexBasis.Length };
      }
      if ("Percent" in flexBasis) {
        return { unit: Unit.Percent, value: flexBasis.Percent * 100 };
      }
    }
    return { unit: Unit.Auto, value: 0 };
  }

  /**
   * Sets the overflow property (Visible, Hidden, Scroll).
   * @param overflow - The overflow mode.
   */
  setOverflow(overflow: Overflow) {
    this.updateStyle((s) => {
      const val = Mapping.fromYogaOverflow(overflow);
      s.overflow = { x: val, y: val };
    });
  }

  /**
   * Sets whether this node always forms a containing block.
   * Currently a stub (not supported in Taffy).
   * @param alwaysFormsContainingBlock - Boolean flag.
   */
  setAlwaysFormsContainingBlock(alwaysFormsContainingBlock: boolean) {
    // Not supported in Taffy yet
  }

  // --- Dimensions Getters ---

  /**
   * Converts a Taffy style value to a Yoga-compatible Value object.
   * @param val - The Taffy value to convert.
   * @returns A Value object with unit and value.
   */
  private getTypeFromTaffyValue(val: any): Value {
    if (val === "Auto") {
      return { unit: Unit.Auto, value: NaN };
    }
    if (typeof val === "object") {
      if ("Length" in val) return { unit: Unit.Point, value: val.Length };
      if ("Percent" in val)
        return { unit: Unit.Percent, value: val.Percent * 100 };
    }
    return { unit: Unit.Undefined, value: NaN };
  }

  /**
   * Parses a raw value (number, string, or undefined) into a Value object.
   * @param val - The value to parse.
   * @returns A Value object with unit and value.
   */
  private parseToValue(val: number | string | undefined): Value {
    if (val === undefined) return { unit: Unit.Undefined, value: NaN };
    if (val === "auto") return { unit: Unit.Auto, value: NaN };
    if (typeof val === "number") return { unit: Unit.Point, value: val };
    if (typeof val === "string") {
      if (val.endsWith("%")) {
        return { unit: Unit.Percent, value: parseFloat(val) };
      }
      const num = parseFloat(val);
      if (!isNaN(num)) return { unit: Unit.Point, value: num };
    }
    return { unit: Unit.Undefined, value: NaN };
  }

  /**
   * Gets the width of the node.
   * @returns The width as a Value object.
   */
  getWidth(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.size.width);
  }

  /**
   * Gets the height of the node.
   * @returns The height as a Value object.
   */
  getHeight(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.size.height);
  }

  /**
   * Gets the minimum width of the node.
   * @returns The minimum width as a Value object.
   */
  getMinWidth(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.min_size.width);
  }

  /**
   * Gets the minimum height of the node.
   * @returns The minimum height as a Value object.
   */
  getMinHeight(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.min_size.height);
  }

  /**
   * Gets the maximum width of the node.
   * @returns The maximum width as a Value object.
   */
  getMaxWidth(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.max_size.width);
  }

  /**
   * Gets the maximum height of the node.
   * @returns The maximum height as a Value object.
   */
  getMaxHeight(): Value {
    const style = this.tree.getStyle(this.id);
    return this.getTypeFromTaffyValue(style.max_size.height);
  }

  // Dimension & Rect Setters Helper
  /**
   * Helper to parse a value (number, "auto", "50%") into a Yoga-compatible format.
   * @param value - The value to parse.
   * @returns A Taffy-compatible length/percentage object or "Auto".
   */
  private parseValue(value: number | string): any {
    if (value === "auto") return "Auto";
    if (typeof value === "string") {
      if (value.endsWith("%")) {
        const num = parseFloat(value);
        return { Percent: num / 100.0 };
      }
      const num = parseFloat(value);
      if (!isNaN(num)) return { Length: num };
    }
    if (typeof value === "number") {
      return { Length: value };
    }
    return "Auto";
  }

  // Cache for style properties that need JS-side logic (like Static vs Relative)
  /**
   * Internal cache for style properties that require JavaScript-side logic.
   *
   * Taffy doesn't support all Yoga features natively (like direction-aware resolution for some properties
   * or "Static" positioning affecting insets in specific ways), so we cache them here
   * and resolve them before syncing to Taffy.
   */
  private _styleCache = {
    position: PositionType.Relative,
    flexDirection: FlexDirection.Column as FlexDirection,
    boxSizing: BoxSizing.BorderBox as BoxSizing,
    insets: {
      [Edge.Left]: "auto" as any,
      [Edge.Right]: "auto" as any,
      [Edge.Top]: "auto" as any,
      [Edge.Bottom]: "auto" as any,
      [Edge.Start]: "auto" as any,
      [Edge.End]: "auto" as any,
    } as Record<number, any>,
    borders: {
      [Edge.Left]: undefined as number | undefined,
      [Edge.Right]: undefined as number | undefined,
      [Edge.Top]: undefined as number | undefined,
      [Edge.Bottom]: undefined as number | undefined,
      [Edge.Start]: undefined as number | undefined,
      [Edge.End]: undefined as number | undefined,
      [Edge.Horizontal]: undefined as number | undefined,
      [Edge.Vertical]: undefined as number | undefined,
      [Edge.All]: undefined as number | undefined,
    } as Record<number, number | undefined>,
    margins: {
      [Edge.Left]: undefined as number | string | undefined,
      [Edge.Right]: undefined as number | string | undefined,
      [Edge.Top]: undefined as number | string | undefined,
      [Edge.Bottom]: undefined as number | string | undefined,
      [Edge.Start]: undefined as number | string | undefined,
      [Edge.End]: undefined as number | string | undefined,
      [Edge.Horizontal]: undefined as number | string | undefined,
      [Edge.Vertical]: undefined as number | string | undefined,
      [Edge.All]: undefined as number | string | undefined,
    } as Record<number, number | string | undefined>,
    paddings: {
      [Edge.Left]: undefined as number | string | undefined,
      [Edge.Right]: undefined as number | string | undefined,
      [Edge.Top]: undefined as number | string | undefined,
      [Edge.Bottom]: undefined as number | string | undefined,
      [Edge.Start]: undefined as number | string | undefined,
      [Edge.End]: undefined as number | string | undefined,
      [Edge.Horizontal]: undefined as number | string | undefined,
      [Edge.Vertical]: undefined as number | string | undefined,
      [Edge.All]: undefined as number | string | undefined,
    } as Record<number, number | string | undefined>,
    lastDirection: Direction.LTR as Direction,
    direction: Direction.Inherit as Direction,
  };

  // Helper to sync cached style to Taffy
  /**
   * Synchronizes the cached style properties (position, insets) to the underlying Taffy node.
   * Should be called whenever these properties in `_styleCache` change.
   */
  private syncStyle() {
    this.updateStyle((s) => {
      // Sync Position
      s.position = Mapping.fromYogaPositionType(this._styleCache.position);

      // Sync Insets
      // If Static, insets are ignored (treated as Auto) in layout, but preserved in storage.
      // Taffy doesn't implement Static, so we emulate it by passing Auto for insets.
      const isStatic = this._styleCache.position === PositionType.Static;
      const effectiveInsets = isStatic
        ? { left: "Auto", right: "Auto", top: "Auto", bottom: "Auto" }
        : this.resolveInsets();

      s.inset = effectiveInsets;
    });
  }

  // Resolve logical/physical edges to Taffy's Rect { left, right, top, bottom }
  /**
   * Resolves logical edges (Start/End) and physical edges to Taffy's expected Rect { left, right, top, bottom }.
   * Handles the current text direction (LTR/RTL).
   * @returns An object with resolved Taffy inset values.
   */
  private resolveInsets() {
    // Taffy JS Style.inset expects { left, right, top, bottom }
    // We need to map Start/End to Left/Right based on direction
    const isRTL = this._styleCache.lastDirection === Direction.RTL;
    const parser = (v: any) => (v === "auto" ? "Auto" : v);
    const get = (e: Edge) => this._styleCache.insets[e] ?? "auto";

    const l = parser(get(Edge.Left));
    const r = parser(get(Edge.Right));
    const t = parser(get(Edge.Top));
    const b = parser(get(Edge.Bottom));
    const s = parser(get(Edge.Start));
    const e = parser(get(Edge.End));

    // Resolve logical edges (Start/End) to physical edges based on direction
    // Start = Left in LTR, Right in RTL
    // End = Right in LTR, Left in RTL
    // Logical edges override physical edges if explicitly set (not auto)
    let left = l;
    let right = r;

    if (s !== "Auto") {
      if (isRTL) {
        right = s;
      } else {
        left = s;
      }
    }
    if (e !== "Auto") {
      if (isRTL) {
        left = e;
      } else {
        right = e;
      }
    }

    return { left, right, top: t, bottom: b };
  }

  // --- Position ---

  /**
   * Sets the position type (Relative, Absolute, etc.).
   * @param positionType - The position type.
   */
  setPositionType(positionType: PositionType) {
    this._styleCache.position = positionType;
    this.syncStyle();
  }

  /**
   * Gets the current position type.
   * @returns The position type.
   */
  getPositionType(): PositionType {
    const style = this.tree.getStyle(this.id);
    return Mapping.toYogaPositionType(style.position);
  }

  /**
   * Sets a position value for a specific edge.
   * @param edge - The edge to set.
   * @param position - The value (number, percentage string, or undefined).
   */
  setPosition(
    edge: Edge,
    position: number | "auto" | `${number}%` | undefined,
  ): void {
    const val = this.parseValue(position ?? "auto");

    // Fan out to specific edges in cache
    if (edge === Edge.All) {
      this._styleCache.insets[Edge.Left] = val;
      this._styleCache.insets[Edge.Right] = val;
      this._styleCache.insets[Edge.Top] = val;
      this._styleCache.insets[Edge.Bottom] = val;
      this._styleCache.insets[Edge.Start] = val;
      this._styleCache.insets[Edge.End] = val;
    } else if (edge === Edge.Horizontal) {
      this._styleCache.insets[Edge.Left] = val;
      this._styleCache.insets[Edge.Right] = val;
      this._styleCache.insets[Edge.Start] = val; // Assuming horizontal includes start/end
      this._styleCache.insets[Edge.End] = val;
    } else if (edge === Edge.Vertical) {
      this._styleCache.insets[Edge.Top] = val;
      this._styleCache.insets[Edge.Bottom] = val;
    } else {
      this._styleCache.insets[edge] = val;
    }

    this.syncStyle();
  }

  /**
   * Sets a position value as a percentage.
   * @param edge - The edge to set.
   * @param position - The percentage value.
   */
  setPositionPercent(edge: Edge, position: number | undefined): void {
    this.setPosition(edge, position !== undefined ? `${position}%` : undefined);
  }

  /**
   * Sets a position value to "auto".
   * @param edge - The edge to set.
   */
  setPositionAuto(edge: Edge): void {
    this.setPosition(edge, "auto");
  }

  // Resolve cached insets to Taffy based on current direction
  /**
   * Recursively resolves cached insets to Taffy based on the node's direction.
   * Updates the underlying Taffy style for this node and all children.
   */
  private resolveInsetsToTaffy() {
    const isStatic = this._styleCache.position === PositionType.Static;
    if (isStatic) {
      // Static position uses Auto for all insets
      this.updateStyle((s) => {
        s.inset = { left: "Auto", right: "Auto", top: "Auto", bottom: "Auto" };
      });
    } else {
      // For Relative/Absolute, use the resolved insets
      this.updateStyle((s) => {
        s.inset = this.resolveInsets();
      });
    }

    // Recursively resolve insets for all children
    // Children inherit the same direction for resolution
    for (const child of this.childList) {
      child._styleCache.lastDirection = this._styleCache.lastDirection;
      child.resolveInsetsToTaffy();
    }
  }

  /**
   * Gets the position value for a specific edge.
   * @param edge - The edge to retrieve.
   * @returns The position value.
   */
  getPosition(edge: Edge): Value {
    // Return from cache to preserve logical edges and exact values
    if (
      edge === Edge.All ||
      edge === Edge.Horizontal ||
      edge === Edge.Vertical
    ) {
      // Yoga getters for compound edges usually return Undefined or specific logic?
      // Typically people get specific edges. We'll return Left as a proxy or Undefined.
      // Assuming we return what's in cache for that key (which might be used for 'all' setting).
      // Our cache fans out 'All' to all edges, so 'All' key itself might be undefined in cache if we only implemented fan-out?
      // Looking at setPosition, we only set specific edges in `insets`. We don't store 'All'.
      // So getting 'All' will likely return Undefined.
      return { unit: Unit.Undefined, value: NaN };
    }
    return this.parseToValue(this._styleCache.insets[edge]);
  }

  // --- Margin ---

  /**
   * Sets the margin for a specific edge.
   * @param edge - The edge to set.
   * @param margin - The margin value (number, percent string, "auto", or undefined).
   */
  setMargin(
    edge: Edge,
    margin: number | "auto" | `${number}%` | undefined,
  ): void {
    // Cache the margin setting (for logical edge resolution)
    this._styleCache.margins[edge] = margin;
    // Resolve and apply to Taffy based on current direction
    this.resolveMarginsToTaffy();
  }

  /**
   * Sets the margin for a specific edge as a percentage.
   * @param edge - The edge to set.
   * @param margin - The percentage value.
   */
  setMarginPercent(edge: Edge, margin: number | undefined): void {
    this.setMargin(edge, margin !== undefined ? `${margin}%` : undefined);
  }

  /**
   * Sets the margin for a specific edge to "auto".
   * @param edge - The edge to set.
   */
  setMarginAuto(edge: Edge): void {
    this.setMargin(edge, "auto");
  }

  // Resolve cached margin settings to physical edges and apply to Taffy
  /**
   * Resolves cached margins to Taffy style.
   * Handles converting logical edges to physical ones based on direction.
   */
  private resolveMarginsToTaffy() {
    const isRTL = this._styleCache.lastDirection === Direction.RTL;
    const margins = this._styleCache.margins;

    this.updateStyle((s) => {
      // Start fresh - reset all margins to Auto (0)
      const current = {
        left: "Auto",
        right: "Auto",
        top: "Auto",
        bottom: "Auto",
      };

      // Helper to set a physical edge
      const setPhysical = (edge: Edge, value: number | string | undefined) => {
        if (value !== undefined) {
          const parsed = this.parseValue(value);
          if (edge === Edge.Left) current.left = parsed;
          else if (edge === Edge.Right) current.right = parsed;
          else if (edge === Edge.Top) current.top = parsed;
          else if (edge === Edge.Bottom) current.bottom = parsed;
        }
      };

      // Apply compound edges first (All, Horizontal, Vertical)
      if (margins[Edge.All] !== undefined) {
        setPhysical(Edge.Left, margins[Edge.All]);
        setPhysical(Edge.Right, margins[Edge.All]);
        setPhysical(Edge.Top, margins[Edge.All]);
        setPhysical(Edge.Bottom, margins[Edge.All]);
      }
      if (margins[Edge.Horizontal] !== undefined) {
        setPhysical(Edge.Left, margins[Edge.Horizontal]);
        setPhysical(Edge.Right, margins[Edge.Horizontal]);
      }
      if (margins[Edge.Vertical] !== undefined) {
        setPhysical(Edge.Top, margins[Edge.Vertical]);
        setPhysical(Edge.Bottom, margins[Edge.Vertical]);
      }

      // Apply logical edges (Start/End) based on direction
      if (margins[Edge.Start] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Right, margins[Edge.Start]);
        } else {
          setPhysical(Edge.Left, margins[Edge.Start]);
        }
      }
      if (margins[Edge.End] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Left, margins[Edge.End]);
        } else {
          setPhysical(Edge.Right, margins[Edge.End]);
        }
      }

      // Apply physical edges (Left, Right, Top, Bottom)
      // These override logical edges if explicitly set
      setPhysical(Edge.Left, margins[Edge.Left]);
      setPhysical(Edge.Right, margins[Edge.Right]);
      setPhysical(Edge.Top, margins[Edge.Top]);
      setPhysical(Edge.Bottom, margins[Edge.Bottom]);

      s.margin = current;
    });
  }

  /**
   * Gets the margin for a specific edge.
   * @param edge - The edge to retrieve.
   * @returns The margin value.
   */
  getMargin(edge: Edge): Value {
    if (
      edge === Edge.All ||
      edge === Edge.Horizontal ||
      edge === Edge.Vertical
    ) {
      return { unit: Unit.Undefined, value: NaN };
    }
    return this.parseToValue(this._styleCache.margins[edge]);
  }

  /**
   * Gets the computed margin for a specific edge in pixels.
   * @param edge - The edge to retrieve.
   * @returns The computed margin value.
   */
  getComputedMargin(edge: Edge): number {
    const style = this.tree.getStyle(this.id);
    const margin = style.margin || {
      left: "Auto",
      right: "Auto",
      top: "Auto",
      bottom: "Auto",
    };

    // Get parent width for percentage calculation
    const layout = this.tree.getLayout(this.id);
    const parentWidth =
      this.parent && this.parent.id
        ? this.tree.getLayout(this.parent.id).size.width
        : layout.size.width;

    const extractValue = (val: any): number => {
      if (val === "Auto") return 0;
      if (val && typeof val === "object") {
        if ("Length" in val) return val.Length;
        if ("Percent" in val) return Math.round(val.Percent * parentWidth);
      }
      return 0;
    };

    switch (edge) {
      case Edge.Left:
        return extractValue(margin.left);
      case Edge.Right:
        return extractValue(margin.right);
      case Edge.Top:
        return extractValue(margin.top);
      case Edge.Bottom:
        return extractValue(margin.bottom);
      case Edge.Start: {
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(margin.right) : extractValue(margin.left);
      }
      case Edge.End: {
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(margin.left) : extractValue(margin.right);
      }
      case Edge.Horizontal:
      case Edge.Vertical:
      case Edge.All:
        return extractValue(margin.left);
      default:
        return 0;
    }
  }

  // --- Padding ---

  /**
   * Sets the padding for a specific edge.
   * @param edge - The edge to set.
   * @param padding - The padding value (number, percent string, or undefined).
   */
  setPadding(edge: Edge, padding: number | `${number}%` | undefined): void {
    // Cache the padding setting (for logical edge resolution)
    this._styleCache.paddings[edge] = padding;
    // Resolve and apply to Taffy based on current direction
    this.resolvePaddingsToTaffy();
  }

  /**
   * Sets the padding for a specific edge as a percentage.
   * @param edge - The edge to set.
   * @param padding - The percentage value.
   */
  setPaddingPercent(edge: Edge, padding: number | undefined): void {
    this.setPadding(edge, padding !== undefined ? `${padding}%` : undefined);
  }

  // Resolve cached padding settings to physical edges and apply to Taffy
  /**
   * Resolves cached paddings to Taffy style.
   * Handles converting logical edges to physical ones based on direction.
   */
  private resolvePaddingsToTaffy() {
    const isRTL = this._styleCache.lastDirection === Direction.RTL;
    const paddings = this._styleCache.paddings;

    this.updateStyle((s) => {
      // Start fresh - reset all paddings to 0
      const current = {
        left: { Length: 0 },
        right: { Length: 0 },
        top: { Length: 0 },
        bottom: { Length: 0 },
      };

      // Helper to set a physical edge
      const setPhysical = (edge: Edge, value: number | string | undefined) => {
        if (value !== undefined) {
          const parsed = this.parseValue(value);
          if (edge === Edge.Left) current.left = parsed;
          else if (edge === Edge.Right) current.right = parsed;
          else if (edge === Edge.Top) current.top = parsed;
          else if (edge === Edge.Bottom) current.bottom = parsed;
        }
      };

      // Apply compound edges first (All, Horizontal, Vertical)
      if (paddings[Edge.All] !== undefined) {
        setPhysical(Edge.Left, paddings[Edge.All]);
        setPhysical(Edge.Right, paddings[Edge.All]);
        setPhysical(Edge.Top, paddings[Edge.All]);
        setPhysical(Edge.Bottom, paddings[Edge.All]);
      }
      if (paddings[Edge.Horizontal] !== undefined) {
        setPhysical(Edge.Left, paddings[Edge.Horizontal]);
        setPhysical(Edge.Right, paddings[Edge.Horizontal]);
      }
      if (paddings[Edge.Vertical] !== undefined) {
        setPhysical(Edge.Top, paddings[Edge.Vertical]);
        setPhysical(Edge.Bottom, paddings[Edge.Vertical]);
      }

      // Apply logical edges (Start/End) based on direction
      if (paddings[Edge.Start] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Right, paddings[Edge.Start]);
        } else {
          setPhysical(Edge.Left, paddings[Edge.Start]);
        }
      }
      if (paddings[Edge.End] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Left, paddings[Edge.End]);
        } else {
          setPhysical(Edge.Right, paddings[Edge.End]);
        }
      }

      // Apply physical edges (Left, Right, Top, Bottom)
      setPhysical(Edge.Left, paddings[Edge.Left]);
      setPhysical(Edge.Right, paddings[Edge.Right]);
      setPhysical(Edge.Top, paddings[Edge.Top]);
      setPhysical(Edge.Bottom, paddings[Edge.Bottom]);

      s.padding = current;
    });
  }

  /**
   * Gets the padding for a specific edge.
   * @param edge - The edge to retrieve.
   * @returns The padding value.
   */
  getPadding(edge: Edge): Value {
    if (
      edge === Edge.All ||
      edge === Edge.Horizontal ||
      edge === Edge.Vertical
    ) {
      return { unit: Unit.Undefined, value: NaN };
    }
    return this.parseToValue(this._styleCache.paddings[edge]);
  }

  /**
   * Gets the computed padding for a specific edge in pixels.
   * @param edge - The edge to retrieve.
   * @returns The computed padding value.
   */
  getComputedPadding(edge: Edge): number {
    const style = this.tree.getStyle(this.id);
    const padding = style.padding || {
      left: { Length: 0 },
      right: { Length: 0 },
      top: { Length: 0 },
      bottom: { Length: 0 },
    };

    // Get own width for percentage calculation (padding is relative to own width)
    const layout = this.tree.getLayout(this.id);
    const ownWidth = layout.size.width;

    const extractValue = (val: any): number => {
      if (val === "Auto") return 0;
      if (val && typeof val === "object") {
        if ("Length" in val) return val.Length;
        if ("Percent" in val) return Math.round(val.Percent * ownWidth);
      }
      return 0;
    };

    switch (edge) {
      case Edge.Left:
        return extractValue(padding.left);
      case Edge.Right:
        return extractValue(padding.right);
      case Edge.Top:
        return extractValue(padding.top);
      case Edge.Bottom:
        return extractValue(padding.bottom);
      case Edge.Start: {
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(padding.right) : extractValue(padding.left);
      }
      case Edge.End: {
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(padding.left) : extractValue(padding.right);
      }
      case Edge.Horizontal:
      case Edge.Vertical:
      case Edge.All:
        return extractValue(padding.left);
      default:
        return 0;
    }
  }

  // --- Border ---

  /**
   * Sets the border width for a specific edge.
   * @param edge - The edge to set.
   * @param borderWidth - The border width.
   */
  setBorder(edge: Edge, borderWidth: number | undefined): void {
    // Cache the border setting (for logical edge resolution)
    this._styleCache.borders[edge] = borderWidth;
    // Resolve and apply to Taffy based on current direction
    this.resolveBordersToTaffy();
  }

  // Resolve cached border settings to physical edges and apply to Taffy
  /**
   * Resolves cached borders to Taffy style.
   * Handles converting logical edges to physical ones based on direction.
   */
  private resolveBordersToTaffy() {
    const isRTL = this._styleCache.lastDirection === Direction.RTL;
    const borders = this._styleCache.borders;

    this.updateStyle((s) => {
      // Start fresh - reset all borders to 0
      const current = {
        left: { Length: 0 },
        right: { Length: 0 },
        top: { Length: 0 },
        bottom: { Length: 0 },
      };

      // Helper to set a physical edge
      const setPhysical = (edge: Edge, value: number | undefined) => {
        if (value !== undefined) {
          if (edge === Edge.Left) current.left = { Length: value };
          else if (edge === Edge.Right) current.right = { Length: value };
          else if (edge === Edge.Top) current.top = { Length: value };
          else if (edge === Edge.Bottom) current.bottom = { Length: value };
        }
      };

      // Apply compound edges first (All, Horizontal, Vertical)
      if (borders[Edge.All] !== undefined) {
        setPhysical(Edge.Left, borders[Edge.All]);
        setPhysical(Edge.Right, borders[Edge.All]);
        setPhysical(Edge.Top, borders[Edge.All]);
        setPhysical(Edge.Bottom, borders[Edge.All]);
      }
      if (borders[Edge.Horizontal] !== undefined) {
        setPhysical(Edge.Left, borders[Edge.Horizontal]);
        setPhysical(Edge.Right, borders[Edge.Horizontal]);
      }
      if (borders[Edge.Vertical] !== undefined) {
        setPhysical(Edge.Top, borders[Edge.Vertical]);
        setPhysical(Edge.Bottom, borders[Edge.Vertical]);
      }

      // Apply logical edges (Start/End) based on direction
      // Start = Left in LTR, Right in RTL
      // End = Right in LTR, Left in RTL
      if (borders[Edge.Start] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Right, borders[Edge.Start]);
        } else {
          setPhysical(Edge.Left, borders[Edge.Start]);
        }
      }
      if (borders[Edge.End] !== undefined) {
        if (isRTL) {
          setPhysical(Edge.Left, borders[Edge.End]);
        } else {
          setPhysical(Edge.Right, borders[Edge.End]);
        }
      }

      // Apply physical edges (Left, Right, Top, Bottom)
      // These override logical edges if explicitly set
      setPhysical(Edge.Left, borders[Edge.Left]);
      setPhysical(Edge.Right, borders[Edge.Right]);
      setPhysical(Edge.Top, borders[Edge.Top]);
      setPhysical(Edge.Bottom, borders[Edge.Bottom]);

      s.border = current;
    });
  }

  /**
   * Gets the border width for a specific edge.
   * @param edge - The edge to retrieve.
   * @returns The border width.
   */
  getBorder(edge: Edge): number {
    if (
      edge === Edge.All ||
      edge === Edge.Horizontal ||
      edge === Edge.Vertical
    ) {
      return NaN;
    }
    const val = this._styleCache.borders[edge];
    return val !== undefined ? val : NaN;
  }

  /**
   * Gets the computed border width for a specific edge in pixels.
   * @param edge - The edge to retrieve.
   * @returns The computed border width.
   */
  getComputedBorder(edge: Edge): number {
    const style = this.tree.getStyle(this.id);
    const border = style.border || {
      left: { Length: 0 },
      right: { Length: 0 },
      top: { Length: 0 },
      bottom: { Length: 0 },
    };

    const extractValue = (val: any): number => {
      if (val && typeof val === "object" && "Length" in val) {
        return val.Length;
      }
      return 0;
    };

    switch (edge) {
      case Edge.Left:
        return extractValue(border.left);
      case Edge.Right:
        return extractValue(border.right);
      case Edge.Top:
        return extractValue(border.top);
      case Edge.Bottom:
        return extractValue(border.bottom);
      case Edge.Start: {
        // Return the start side value based on current direction
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(border.right) : extractValue(border.left);
      }
      case Edge.End: {
        // Return the end side value based on current direction
        const isRTL = this._styleCache.lastDirection === Direction.RTL;
        return isRTL ? extractValue(border.left) : extractValue(border.right);
      }
      case Edge.Horizontal:
      case Edge.Vertical:
      case Edge.All:
        // For compound edges, return left as representative
        return extractValue(border.left);
      default:
        return 0;
    }
  }

  // --- Gap ---

  /**
   * Sets the gap (gutter) between items.
   * @param gutter - The gap type (Column, Row, All).
   * @param gapLength - The gap size.
   * @returns The parsed Value object.
   */
  setGap(gutter: Gutter, gapLength: number | `${number}%` | undefined): Value {
    // Allowing string for compat, though Taffy Gap is length
    // Taffy gap is Length (Points) usually.
    const val = this.parseValue(gapLength ?? 0);

    // Taffy JS Style.gap is { width: LengthPercentage | Auto, height: ... }
    // Actually, check Taffy definitions. Taffy gap supports Length and Percent (if using Taffy Flexbox fully).
    // Let's assume point for number.

    this.updateStyle((s) => {
      const current = s.gap || { width: { Length: 0 }, height: { Length: 0 } };
      // Map to Taffy gap properties which are width (column gap) and height (row gap)
      if (gutter === Gutter.Column || gutter === Gutter.All)
        current.width = val;
      if (gutter === Gutter.Row || gutter === Gutter.All) current.height = val;
      s.gap = current;
    });

    return this.parseToValue(gapLength);
  }

  /**
   * Sets the gap as a percentage.
   * @param gutter - The gutter type.
   * @param gapLength - The percentage value.
   * @returns The parsed Value object with Unit.Percent.
   */
  setGapPercent(gutter: Gutter, gapLength: number | undefined): Value {
    this.setGap(gutter, gapLength !== undefined ? `${gapLength}%` : undefined);
    return { unit: Unit.Percent, value: gapLength ?? 0 };
  }

  /**
   * Gets the gap value for a specific gutter type.
   * @param gutter - The gutter type.
   * @returns The gap value with unit.
   */
  getGap(gutter: Gutter): { unit: Unit; value: number } {
    const style = this.tree.getStyle(this.id);
    const gap = style.gap || { width: { Length: 0 }, height: { Length: 0 } };

    let val: any = undefined;
    if (gutter === Gutter.Column) val = gap.width;
    else if (gutter === Gutter.Row) val = gap.height;
    else val = gap.width; // Default or All?

    if (val && typeof val === "object" && "Length" in val) {
      return { unit: Unit.Point, value: val.Length };
    }
    return { unit: Unit.Point, value: 0 };
  }

  // --- Dimensions ---

  /**
   * Sets the width of the node.
   * @param width - The width (number, percentage string, or "auto").
   */
  setWidth(width: number | "auto" | `${number}%` | undefined): void {
    this.updateStyle(
      (s) => (s.size = { ...s.size, width: this.parseValue(width ?? "auto") }),
    );
  }

  /**
   * Sets the width as a percentage.
   * @param width - The percentage value.
   */
  setWidthPercent(width: number | undefined): void {
    this.setWidth(width !== undefined ? `${width}%` : "auto");
  }

  /**
   * Sets the width to "auto".
   */
  setWidthAuto(): void {
    this.setWidth("auto");
  }

  /**
   * Sets the height of the node.
   * @param height - The height (number, percentage string, or "auto").
   */
  setHeight(height: number | "auto" | `${number}%` | undefined): void {
    this.updateStyle(
      (s) =>
        (s.size = { ...s.size, height: this.parseValue(height ?? "auto") }),
    );
  }

  /**
   * Sets the height as a percentage.
   * @param height - The percentage value.
   */
  setHeightPercent(height: number | undefined): void {
    this.setHeight(height !== undefined ? `${height}%` : "auto");
  }

  /**
   * Sets the height to "auto".
   */
  setHeightAuto(): void {
    this.setHeight("auto");
  }

  /**
   * Sets the minimum width.
   * @param minWidth - The minimum width.
   */
  setMinWidth(minWidth: number | `${number}%` | undefined): void {
    this.updateStyle((s) => {
      const val =
        minWidth === undefined
          ? "Auto"
          : typeof minWidth === "number"
            ? { Length: minWidth }
            : { Percent: parseFloat(minWidth) / 100 };
      s.min_size = { ...s.min_size, width: val };
    });
  }

  /**
   * Sets the minimum width as a percentage.
   * @param minWidth - The percentage value.
   */
  setMinWidthPercent(minWidth: number | undefined): void {
    this.setMinWidth(minWidth !== undefined ? `${minWidth}%` : undefined);
  }

  /**
   * Sets the maximum width.
   * @param maxWidth - The maximum width.
   */
  setMaxWidth(maxWidth: number | `${number}%` | undefined): void {
    this.updateStyle((s) => {
      const val =
        maxWidth === undefined
          ? "Auto"
          : typeof maxWidth === "number"
            ? { Length: maxWidth }
            : { Percent: parseFloat(maxWidth) / 100 };
      s.max_size = { ...s.max_size, width: val };
    });
  }

  /**
   * Sets the maximum width as a percentage.
   * @param maxWidth - The percentage value.
   */
  setMaxWidthPercent(maxWidth: number | undefined): void {
    this.setMaxWidth(maxWidth !== undefined ? `${maxWidth}%` : undefined);
  }

  /**
   * Sets the minimum height.
   * @param minHeight - The minimum height.
   */
  setMinHeight(minHeight: number | `${number}%` | undefined): void {
    this.updateStyle((s) => {
      const val =
        minHeight === undefined
          ? "Auto"
          : typeof minHeight === "number"
            ? { Length: minHeight }
            : { Percent: parseFloat(minHeight) / 100 };
      s.min_size = { ...s.min_size, height: val };
    });
  }

  /**
   * Sets the minimum height as a percentage.
   * @param minHeight - The percentage value.
   */
  setMinHeightPercent(minHeight: number | undefined): void {
    this.setMinHeight(minHeight !== undefined ? `${minHeight}%` : undefined);
  }

  /**
   * Sets the maximum height.
   * @param maxHeight - The maximum height.
   */
  setMaxHeight(maxHeight: number | `${number}%` | undefined): void {
    this.updateStyle((s) => {
      const val =
        maxHeight === undefined
          ? "Auto"
          : typeof maxHeight === "number"
            ? { Length: maxHeight }
            : { Percent: parseFloat(maxHeight) / 100 };
      s.max_size = { ...s.max_size, height: val };
    });
  }

  /**
   * Sets the maximum height as a percentage.
   * @param maxHeight - The percentage value.
   */
  setMaxHeightPercent(maxHeight: number | undefined): void {
    this.setMaxHeight(maxHeight !== undefined ? `${maxHeight}%` : undefined);
  }

  /**
   * Sets the aspect ratio.
   * @param aspectRatio - The aspect ratio (width / height).
   */
  setAspectRatio(aspectRatio: number | undefined): void {
    this.updateStyle((s) => {
      s.aspect_ratio = aspectRatio;
    });
  }

  /**
   * Gets the current aspect ratio.
   * @returns The aspect ratio.
   */
  getAspectRatio(): number {
    const style = this.tree.getStyle(this.id);
    return style.aspect_ratio ?? NaN;
  }

  /**
   * Set the box-sizing model for this node.
   * Taffy supports box-sizing: BorderBox (default) or ContentBox.
   */
  setBoxSizing(boxSizing: BoxSizing) {
    this._styleCache.boxSizing = boxSizing;
    this.updateStyle((s) => {
      s.box_sizing = Mapping.fromYogaBoxSizing(boxSizing);
    });
  }

  getBoxSizing(): BoxSizing {
    const style = this.tree.getStyle(this.id);
    const taffyBoxSizing = style.box_sizing;
    return Mapping.toYogaBoxSizing(taffyBoxSizing);
  }
  // --- Tree Operations ---

  /**
   * Inserts a child node at the specified index.
   * @param child - The child node to insert.
   * @param index - The index to insert at.
   */
  insertChild(child: Node, index: number) {
    this.tree.insertChildAtIndex(this.id, index, child.id);
    this.childList.splice(index, 0, child);
    child.parent = this; // Track parent
  }

  /**
   * Removes a child node.
   * @param child - The child node to remove.
   */
  removeChild(child: Node) {
    this.tree.removeChild(this.id, child.id);
    const index = this.childList.indexOf(child);
    if (index !== -1) {
      this.childList.splice(index, 1);
      child.parent = null; // Clear parent reference
    }
  }

  /**
   * Gets the number of children.
   * @returns The child count.
   */
  getChildCount(): number {
    return this.childList.length;
  }

  /**
   * Gets the child at the specified index.
   * @param index - The index of the child.
   * @returns The child Node.
   */
  getChild(index: number): Node {
    return this.childList[index];
  }

  // --- Layout Calculation ---

  /**
   * Calculates the layout for this node and its descendants.
   * @param width - The available width (or NaN for undefined).
   * @param height - The available height (or NaN for undefined).
   * @param direction - The layout direction (LTR/RTL).
   */
  calculateLayout(
    width: number = NaN,
    height: number = NaN,
    direction?: number,
  ) {
    // Determine direction: arg > style > LTR default
    let effectiveDirection = direction;
    if (effectiveDirection === undefined) {
      effectiveDirection = this.getDirection();
      if (effectiveDirection === Direction.Inherit) {
        effectiveDirection = Direction.LTR;
      }
    }

    // Store the direction for edge resolution
    this._styleCache.lastDirection = effectiveDirection;

    const isRTL = effectiveDirection === Direction.RTL;

    // Re-resolve borders, margins, paddings, and insets based on the new direction
    this.resolveBordersToTaffy();
    this.resolveMarginsToTaffy();
    this.resolvePaddingsToTaffy();
    this.resolveInsetsToTaffy();

    // If RTL, flip Row <-> RowReverse for this node and all descendants
    if (isRTL) {
      this.applyRTLFlip();
    }

    const availableSpace = {
      width: isNaN(width) ? "MaxContent" : { Definite: width },
      height: isNaN(height) ? "MaxContent" : { Definite: height },
    };

    const measureDispatcher = (
      knownDimensions: any,
      availableSpace: any,
      _nodeId: any,
    ) => {
      const nodeId = typeof _nodeId === "bigint" ? _nodeId : BigInt(_nodeId);
      const node = Node.getNodeById(nodeId);

      if (node && node.measureFunc) {
        const mapToYoga = (space: any): [number, MeasureMode] => {
          if (typeof space === "object" && space.Definite !== undefined) {
            return [space.Definite, MeasureMode.Exactly];
          }
          if (space === "MaxContent") {
            return [NaN, MeasureMode.Undefined];
          }
          if (space === "MinContent") {
            return [0, MeasureMode.AtMost];
          }
          return [NaN, MeasureMode.Undefined];
        };

        const [w, wMode] = mapToYoga(availableSpace.width);
        const [h, hMode] = mapToYoga(availableSpace.height);

        const result = node.measureFunc(w, wMode, h, hMode);
        return { width: result.width, height: result.height };
      }
      return { width: 0, height: 0 };
    };

    this.tree.computeLayoutWithMeasure(
      this.id,
      availableSpace,
      measureDispatcher,
    );

    // Restore original flex directions after layout
    if (isRTL) {
      this.restoreFlexDirection();
    }

    // Reset dirty state and mark new layout for all nodes after layout
    this.markNewLayoutRecursive();
  }

  // Mark all nodes as having new layout and reset dirty state
  private markNewLayoutRecursive() {
    this._isDirty = false;
    this._hasNewLayout = true;
    for (const child of this.childList) {
      child.markNewLayoutRecursive();
    }
  }

  // Apply RTL flip: Row <-> RowReverse for horizontal layouts
  /**
   * Internal helper to apply RTL flip (Row <-> RowReverse) for layout calculation.
   * Taffy doesn't native support automatic Direction flipping, so we handle it here.
   */
  private applyRTLFlip() {
    const fd = this._styleCache.flexDirection;
    let flippedFd = fd;

    if (fd === FlexDirection.Row) {
      flippedFd = FlexDirection.RowReverse;
    } else if (fd === FlexDirection.RowReverse) {
      flippedFd = FlexDirection.Row;
    }
    // Column and ColumnReverse are not affected by RTL for main axis

    // Apply flipped direction to Taffy (without changing cache)
    this.updateStyle((s) => {
      s.flex_direction = Mapping.fromYogaFlexDirection(flippedFd);
    });

    // Recursively apply to children
    for (const child of this.childList) {
      child.applyRTLFlip();
    }
  }

  // Restore original flex direction from cache
  /**
   * Internal helper to restore original flex direction after RTL flip.
   */
  private restoreFlexDirection() {
    const fd = this._styleCache.flexDirection;
    this.updateStyle((s) => {
      s.flex_direction = Mapping.fromYogaFlexDirection(fd);
    });

    // Recursively restore for children
    for (const child of this.childList) {
      child.restoreFlexDirection();
    }
  }

  // --- Layout Getters ---

  /**
   * Gets the computed left layout position (absolute X coordinate).
   * @returns The left position.
   */
  getComputedLeft(): number {
    const l = this.tree.getLayout(this.id);
    return l.location.x;
  }

  /**
   * Gets the computed top layout position (absolute Y coordinate).
   * @returns The top position.
   */
  getComputedTop(): number {
    const l = this.tree.getLayout(this.id);
    return l.location.y;
  }

  /**
   * Gets the computed right layout position.
   * @returns The right position (left + width).
   */
  getComputedRight(): number {
    const l = this.tree.getLayout(this.id);
    return l.location.x + l.size.width;
  }

  /**
   * Gets the computed bottom layout position.
   * @returns The bottom position (top + height).
   */
  getComputedBottom(): number {
    const l = this.tree.getLayout(this.id);
    return l.location.y + l.size.height;
  }

  /**
   * Gets the computed width.
   * @returns The width.
   */
  getComputedWidth(): number {
    const l = this.tree.getLayout(this.id);
    return l.size.width;
  }

  /**
   * Gets the computed height.
   * @returns The height.
   */
  getComputedHeight(): number {
    const l = this.tree.getLayout(this.id);
    return l.size.height;
  }

  /**
   * Gets the full computed layout object.
   * @returns Object with left, top, width, height, right, bottom.
   */
  getComputedLayout() {
    const l = this.tree.getLayout(this.id);
    return {
      left: l.location.x,
      top: l.location.y,
      width: l.size.width,
      height: l.size.height,
      right: l.location.x + l.size.width,
      bottom: l.location.y + l.size.height,
    };
  }

  // --- Measure ---

  /**
   * Sets a custom measure function for this node.
   * Used for leaf nodes (like text) to calculate their size based on constraints.
   * @param measureFunc - The measure function, or null to unset.
   */
  setMeasureFunc(measureFunc: MeasureFunction | null) {
    if (!measureFunc) {
      this.tree.setNodeContext(this.id, null);
      this.measureFunc = null;
      return;
    }
    this.measureFunc = measureFunc;
    this.tree.setNodeContext(this.id, this.id);
  }

  /**
   * Unsets the measure function.
   */
  unsetMeasureFunc() {
    this.setMeasureFunc(null);
  }

  /**
   * Unsets the dirtied function.
   */
  unsetDirtiedFunc() {
    this.setDirtiedFunc(null);
  }

  // --- Dirtied Callback System ---

  /**
   * Set a callback function that will be called when this node becomes dirty.
   * The callback is only called once when transitioning from clean to dirty state.
   */
  setDirtiedFunc(dirtiedFunc: DirtiedFunction | null) {
    this.dirtiedFunc = dirtiedFunc;
  }

  /**
   * Internal method to mark node as dirty and trigger callback.
   * Called by updateStyle and other style-modifying methods.
   */
  private markDirtyInternal() {
    // Only trigger callback if we're transitioning from clean to dirty
    // and we have a measure function (Yoga requirement)
    if (!this._isDirty && this.measureFunc && this.dirtiedFunc) {
      this._isDirty = true;
      this.dirtiedFunc(this);
    } else if (!this._isDirty) {
      this._isDirty = true;
    }

    // Also propagate dirty state up to parent via Taffy
    // (Taffy handles this internally when we call markDirty)
  }

  /**
   * Manually mark this node as dirty, requiring re-layout.
   * This is typically only callable on nodes with a measure function.
   */
  markDirty() {
    // Yoga only allows marking dirty if node has measure func
    if (this.measureFunc) {
      this.tree.markDirty(this.id);
      this.markDirtyInternal();
      // Propagate to parent chain
      this.propagateDirtyToParent();
    }
  }

  /**
   * Propagate dirty state up to parent chain, triggering their callbacks.
   */
  private propagateDirtyToParent() {
    if (this.parent) {
      // Parent becomes dirty due to child change
      if (!this.parent._isDirty) {
        this.parent._isDirty = true;
        // If parent has dirtiedFunc, call it (but Yoga only calls it if parent has measureFunc)
        if (this.parent.dirtiedFunc) {
          this.parent.dirtiedFunc(this.parent);
        }
      }
      // Continue propagation up
      this.parent.propagateDirtyToParent();
    }
  }

  /**
   * Check if this node is dirty (needs re-layout).
   */
  isDirty(): boolean {
    return this.tree.dirty(this.id);
  }

  /**
   * Reset the node to its initial state.
   * Clears all styles, children, measure function, and dirtied callback.
   */
  reset() {
    // Reset style to default
    this.tree.setStyle(this.id, new Taffy.Style());
    this.measureFunc = null;
    this.dirtiedFunc = null;
    this._isDirty = false;
    this._hasNewLayout = true; // Reset restores to initial state (unseen)
    this._styleCache = {
      position: PositionType.Relative,
      flexDirection: FlexDirection.Column,
      boxSizing: BoxSizing.BorderBox,
      insets: {
        [Edge.Left]: "auto" as any,
        [Edge.Right]: "auto" as any,
        [Edge.Top]: "auto" as any,
        [Edge.Bottom]: "auto" as any,
        [Edge.Start]: "auto" as any,
        [Edge.End]: "auto" as any,
      } as Record<number, any>,
      borders: {
        [Edge.Left]: undefined,
        [Edge.Right]: undefined,
        [Edge.Top]: undefined,
        [Edge.Bottom]: undefined,
        [Edge.Start]: undefined,
        [Edge.End]: undefined,
        [Edge.Horizontal]: undefined,
        [Edge.Vertical]: undefined,
        [Edge.All]: undefined,
      } as Record<number, number | undefined>,
      margins: {
        [Edge.Left]: undefined,
        [Edge.Right]: undefined,
        [Edge.Top]: undefined,
        [Edge.Bottom]: undefined,
        [Edge.Start]: undefined,
        [Edge.End]: undefined,
        [Edge.Horizontal]: undefined,
        [Edge.Vertical]: undefined,
        [Edge.All]: undefined,
      } as Record<number, number | string | undefined>,
      paddings: {
        [Edge.Left]: undefined,
        [Edge.Right]: undefined,
        [Edge.Top]: undefined,
        [Edge.Bottom]: undefined,
        [Edge.Start]: undefined,
        [Edge.End]: undefined,
        [Edge.Horizontal]: undefined,
        [Edge.Vertical]: undefined,
        [Edge.All]: undefined,
      } as Record<number, number | string | undefined>,
      lastDirection: Direction.LTR,
      direction: Direction.Inherit,
    };
    this.tree.setNodeContext(this.id, null);
    // Clear all children
    this.tree.setChildren(this.id, new BigUint64Array([]));
    this.childList = [];
  }

  // --- Layout Tracking ---

  /**
   * Check if this node has a new layout since the last call to markLayoutSeen().
   * Returns true if calculateLayout has been called and markLayoutSeen has not been called since.
   */
  hasNewLayout(): boolean {
    return this._hasNewLayout;
  }

  /**
   * Mark the current layout as "seen".
   * After calling this, hasNewLayout() will return false until the next calculateLayout().
   */
  markLayoutSeen() {
    this._hasNewLayout = false;
  }

  // --- Baseline ---
  //
  // Taffy supports baseline alignment natively through align_items: Baseline.
  //
  // IMPORTANT: Taffy's baseline model differs from Yoga:
  // - Taffy ALWAYS uses the FIRST child as the baseline reference (cannot be overridden)
  // - Yoga allows manual selection via setIsReferenceBaseline()
  // - This difference causes test failures in YGAlignBaselineTest
  //
  // For example, in Yoga:
  //   parent with 2 children, setIsReferenceBaseline(true) on 2nd child
  //   → 1st child aligns to 2nd child's baseline
  //
  // In Taffy:
  //   parent with 2 children
  //   → 2nd child aligns to 1st child's baseline (always)

  /**
   * Set whether this node should be used as the baseline reference for its parent.
   *
   * NOTE: This is a Yoga-specific feature. Taffy ALWAYS uses the first child
   * as the baseline reference and cannot be overridden. This flag is stored
   * for API compatibility but has no effect on Taffy layout.
   */
  setIsReferenceBaseline(isReferenceBaseline: boolean) {
    this._isReferenceBaseline = isReferenceBaseline;
  }

  /**
   * Check if this node is marked as the baseline reference for its parent.
   */
  isReferenceBaseline(): boolean {
    return this._isReferenceBaseline;
  }

  /**
   * Set a custom baseline function for this node.
   *
   * NOTE: This is a Yoga-specific feature. Taffy calculates baselines
   * automatically from child content and doesn't support custom functions.
   */
  setBaselineFunc(
    _baselineFunc: ((width: number, height: number) => number) | null,
  ) {
    // Taffy doesn't support custom baseline functions
  }

  /**
   * Get the computed baseline of this node.
   * Returns the distance from the top of the node to its baseline.
   *
   * NOTE: Taffy doesn't expose explicit baseline offset in layout results.
   * This returns height as a reasonable approximation (baseline at bottom).
   */
  getBaseline(): number {
    const layout = this.tree.getLayout(this.id);
    // Taffy uses `first_baselines.y.unwrap_or(size.height)` internally
    return layout.size.height;
  }

  /**
   * Internal helper to lookup node by ID for measure dispatch.
   * @param id - The node ID.
   * @returns The Node instance.
   */
  static getNodeById(id: bigint): Node | undefined {
    return Node.instanceCache.get(id);
  }
}

export type DirtiedFunction = (node: Node) => void;
