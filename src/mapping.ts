import * as Taffy from "taffy-js";
import {
  Align,
  BoxSizing,
  Display,
  FlexDirection,
  Wrap,
  Justify,
  PositionType,
  Overflow,
} from "./enums.js";

/**
 * Converts Yoga FlexDirection to Taffy FlexDirection.
 * @param direction - Yoga FlexDirection.
 * @returns Taffy FlexDirection.
 */
export function fromYogaFlexDirection(
  direction: FlexDirection,
): Taffy.FlexDirection {
  switch (direction) {
    case FlexDirection.Row:
      return Taffy.FlexDirection.Row;
    case FlexDirection.Column:
      return Taffy.FlexDirection.Column;
    case FlexDirection.RowReverse:
      return Taffy.FlexDirection.RowReverse;
    case FlexDirection.ColumnReverse:
      return Taffy.FlexDirection.ColumnReverse;
    default:
      return Taffy.FlexDirection.Row;
  }
}

/**
 * Converts Taffy FlexDirection to Yoga FlexDirection.
 * @param direction - Taffy FlexDirection.
 * @returns Yoga FlexDirection.
 */
export function toYogaFlexDirection(
  direction: Taffy.FlexDirection,
): FlexDirection {
  switch (direction) {
    case Taffy.FlexDirection.Row:
      return FlexDirection.Row;
    case Taffy.FlexDirection.Column:
      return FlexDirection.Column;
    case Taffy.FlexDirection.RowReverse:
      return FlexDirection.RowReverse;
    case Taffy.FlexDirection.ColumnReverse:
      return FlexDirection.ColumnReverse;
    default:
      return FlexDirection.Row;
  }
}

/**
 * Converts Yoga Display to Taffy Display.
 * @param display - Yoga Display.
 * @returns Taffy Display.
 */
export function fromYogaDisplay(display: Display): Taffy.Display {
  switch (display) {
    case Display.Flex:
      return Taffy.Display.Flex;
    case Display.None:
      return Taffy.Display.None;
    default:
      return Taffy.Display.Flex;
  }
}

/**
 * Converts Taffy Display to Yoga Display.
 * @param display - Taffy Display.
 * @returns Yoga Display.
 */
export function toYogaDisplay(display: Taffy.Display): Display {
  switch (display) {
    case Taffy.Display.Flex:
      return Display.Flex;
    case Taffy.Display.None:
      return Display.None;
    default:
      return Display.Flex;
  }
}

/**
 * Converts Yoga Wrap to Taffy FlexWrap.
 * @param wrap - Yoga Wrap.
 * @returns Taffy FlexWrap.
 */
export function fromYogaWrap(wrap: Wrap): Taffy.FlexWrap {
  switch (wrap) {
    case Wrap.NoWrap:
      return Taffy.FlexWrap.NoWrap;
    case Wrap.Wrap:
      return Taffy.FlexWrap.Wrap;
    case Wrap.WrapReverse:
      return Taffy.FlexWrap.WrapReverse;
    default:
      return Taffy.FlexWrap.NoWrap;
  }
}

/**
 * Converts Taffy FlexWrap to Yoga Wrap.
 * @param wrap - Taffy FlexWrap.
 * @returns Yoga Wrap.
 */
export function toYogaWrap(wrap: Taffy.FlexWrap): Wrap {
  switch (wrap) {
    case Taffy.FlexWrap.NoWrap:
      return Wrap.NoWrap;
    case Taffy.FlexWrap.Wrap:
      return Wrap.Wrap;
    case Taffy.FlexWrap.WrapReverse:
      return Wrap.WrapReverse;
    default:
      return Wrap.NoWrap;
  }
}

/**
 * Converts Yoga Align to Taffy AlignItems.
 * @param align - Yoga Align.
 * @returns Taffy AlignItems.
 */
export function fromYogaAlignItems(align: Align): Taffy.AlignItems {
  switch (align) {
    case Align.FlexStart:
      return Taffy.AlignItems.FlexStart;
    case Align.Center:
      return Taffy.AlignItems.Center;
    case Align.FlexEnd:
      return Taffy.AlignItems.FlexEnd;
    case Align.Stretch:
      return Taffy.AlignItems.Stretch;
    case Align.Baseline:
      return Taffy.AlignItems.Baseline;
    case Align.Auto:
      return Taffy.AlignItems.Stretch;
    default:
      return Taffy.AlignItems.Stretch;
  }
}

/**
 * Converts Taffy AlignItems to Yoga Align.
 * @param align - Taffy AlignItems.
 * @returns Yoga Align.
 */
export function toYogaAlign(align: Taffy.AlignItems): Align {
  switch (align) {
    case Taffy.AlignItems.FlexStart:
      return Align.FlexStart;
    case Taffy.AlignItems.Center:
      return Align.Center;
    case Taffy.AlignItems.FlexEnd:
      return Align.FlexEnd;
    case Taffy.AlignItems.Stretch:
      return Align.Stretch;
    case Taffy.AlignItems.Baseline:
      return Align.Baseline;
    default:
      return Align.Auto;
  }
}

/**
 * Converts Yoga Align to Taffy AlignSelf.
 * @param align - Yoga Align.
 * @returns Taffy AlignSelf.
 */
export function fromYogaAlignSelf(align: Align): Taffy.AlignSelf {
  switch (align) {
    case Align.Auto:
      return Taffy.AlignSelf.Auto;
    case Align.FlexStart:
      return Taffy.AlignSelf.FlexStart;
    case Align.Center:
      return Taffy.AlignSelf.Center;
    case Align.FlexEnd:
      return Taffy.AlignSelf.FlexEnd;
    case Align.Stretch:
      return Taffy.AlignSelf.Stretch;
    case Align.Baseline:
      return Taffy.AlignSelf.Baseline;
    default:
      return Taffy.AlignSelf.Auto;
  }
}

/**
 * Converts Taffy AlignSelf to Yoga Align.
 * @param align - Taffy AlignSelf.
 * @returns Yoga Align.
 */
export function toYogaAlignSelf(align: Taffy.AlignSelf): Align {
  switch (align) {
    case Taffy.AlignSelf.Auto:
      return Align.Auto;
    case Taffy.AlignSelf.FlexStart:
      return Align.FlexStart;
    case Taffy.AlignSelf.Center:
      return Align.Center;
    case Taffy.AlignSelf.FlexEnd:
      return Align.FlexEnd;
    case Taffy.AlignSelf.Stretch:
      return Align.Stretch;
    case Taffy.AlignSelf.Baseline:
      return Align.Baseline;
    default:
      return Align.Auto;
  }
}

/**
 * Converts Yoga Align to Taffy AlignContent.
 * @param align - Yoga Align.
 * @returns Taffy AlignContent.
 */
export function fromYogaAlignContent(align: Align): Taffy.AlignContent {
  switch (align) {
    case Align.FlexStart:
      return Taffy.AlignContent.FlexStart;
    case Align.Center:
      return Taffy.AlignContent.Center;
    case Align.FlexEnd:
      return Taffy.AlignContent.FlexEnd;
    case Align.Stretch:
      return Taffy.AlignContent.Stretch;
    case Align.SpaceBetween:
      return Taffy.AlignContent.SpaceBetween;
    case Align.SpaceAround:
      return Taffy.AlignContent.SpaceAround;
    case Align.SpaceEvenly:
      return Taffy.AlignContent.SpaceEvenly;
    default:
      return Taffy.AlignContent.Stretch;
  }
}

/**
 * Converts Taffy AlignContent to Yoga Align.
 * @param align - Taffy AlignContent.
 * @returns Yoga Align.
 */
export function toYogaAlignContent(align: Taffy.AlignContent): Align {
  switch (align) {
    case Taffy.AlignContent.FlexStart:
      return Align.FlexStart;
    case Taffy.AlignContent.Center:
      return Align.Center;
    case Taffy.AlignContent.FlexEnd:
      return Align.FlexEnd;
    case Taffy.AlignContent.Stretch:
      return Align.Stretch;
    case Taffy.AlignContent.SpaceBetween:
      return Align.SpaceBetween;
    case Taffy.AlignContent.SpaceAround:
      return Align.SpaceAround;
    case Taffy.AlignContent.SpaceEvenly:
      return Align.SpaceEvenly;
    default:
      return Align.Auto;
  }
}

/**
 * Converts Yoga Justify to Taffy JustifyContent.
 * @param justify - Yoga Justify.
 * @returns Taffy JustifyContent.
 */
export function fromYogaJustify(justify: Justify): Taffy.JustifyContent {
  switch (justify) {
    case Justify.FlexStart:
      return Taffy.JustifyContent.FlexStart;
    case Justify.Center:
      return Taffy.JustifyContent.Center;
    case Justify.FlexEnd:
      return Taffy.JustifyContent.FlexEnd;
    case Justify.SpaceBetween:
      return Taffy.JustifyContent.SpaceBetween;
    case Justify.SpaceAround:
      return Taffy.JustifyContent.SpaceAround;
    case Justify.SpaceEvenly:
      return Taffy.JustifyContent.SpaceEvenly;
    default:
      return Taffy.JustifyContent.FlexStart;
  }
}

/**
 * Converts Taffy JustifyContent to Yoga Justify.
 * @param justify - Taffy JustifyContent.
 * @returns Yoga Justify.
 */
export function toYogaJustify(justify: Taffy.JustifyContent): Justify {
  switch (justify) {
    case Taffy.JustifyContent.FlexStart:
      return Justify.FlexStart;
    case Taffy.JustifyContent.Center:
      return Justify.Center;
    case Taffy.JustifyContent.FlexEnd:
      return Justify.FlexEnd;
    case Taffy.JustifyContent.SpaceBetween:
      return Justify.SpaceBetween;
    case Taffy.JustifyContent.SpaceAround:
      return Justify.SpaceAround;
    case Taffy.JustifyContent.SpaceEvenly:
      return Justify.SpaceEvenly;
    default:
      return Justify.FlexStart;
  }
}

/**
 * Converts Yoga PositionType to Taffy Position.
 * @param pos - Yoga PositionType.
 * @returns Taffy Position.
 */
export function fromYogaPositionType(pos: PositionType): Taffy.Position {
  switch (pos) {
    case PositionType.Relative:
      return Taffy.Position.Relative;
    case PositionType.Absolute:
      return Taffy.Position.Absolute;
    case PositionType.Static:
      return Taffy.Position.Relative;
    default:
      return Taffy.Position.Relative;
  }
}

/**
 * Converts Taffy Position to Yoga PositionType.
 * @param pos - Taffy Position.
 * @returns Yoga PositionType.
 */
export function toYogaPositionType(pos: Taffy.Position): PositionType {
  switch (pos) {
    case Taffy.Position.Relative:
      return PositionType.Relative;
    case Taffy.Position.Absolute:
      return PositionType.Absolute;
    default:
      return PositionType.Relative;
  }
}

/**
 * Converts Yoga Overflow to a format suitable for Taffy (currently string for JS binding).
 * @param overflow - Yoga Overflow.
 * @returns Taffy compatible overflow value.
 */
export function fromYogaOverflow(overflow: Overflow): any {
  return getOverflowString(overflow);
}

/**
 * Internal helper to map Yoga Overflow enum to Taffy Overflow enum.
 */
function getOverflowString(overflow: Overflow): Taffy.Overflow {
  switch (overflow) {
    case Overflow.Visible:
      return Taffy.Overflow.Visible;
    case Overflow.Hidden:
      return Taffy.Overflow.Hidden;
    case Overflow.Scroll:
      return Taffy.Overflow.Scroll;
    default:
      return Taffy.Overflow.Visible;
  }
}

/**
 * Converts Taffy Overflow to Yoga Overflow.
 * @param overflow - Taffy Overflow.
 * @returns Yoga Overflow.
 */
export function toYogaOverflow(overflow: Taffy.Overflow): Overflow {
  switch (overflow) {
    case Taffy.Overflow.Visible:
      return Overflow.Visible;
    case Taffy.Overflow.Hidden:
      return Overflow.Hidden;
    case Taffy.Overflow.Scroll:
      return Overflow.Scroll;
    case Taffy.Overflow.Auto:
      return Overflow.Scroll;
    default:
      return Overflow.Visible;
  }
}

/**
 * Converts Yoga BoxSizing to Taffy BoxSizing.
 * @param boxSizing - Yoga BoxSizing.
 * @returns Taffy BoxSizing.
 */
export function fromYogaBoxSizing(boxSizing: BoxSizing): Taffy.BoxSizing {
  switch (boxSizing) {
    case BoxSizing.BorderBox:
      return Taffy.BoxSizing.BorderBox;
    case BoxSizing.ContentBox:
      return Taffy.BoxSizing.ContentBox;
    default:
      return Taffy.BoxSizing.BorderBox;
  }
}

/**
 * Converts Taffy BoxSizing to Yoga BoxSizing.
 * @param boxSizing - Taffy BoxSizing.
 * @returns Yoga BoxSizing.
 */
export function toYogaBoxSizing(boxSizing: Taffy.BoxSizing): BoxSizing {
  switch (boxSizing) {
    case Taffy.BoxSizing.BorderBox:
      return BoxSizing.BorderBox;
    case Taffy.BoxSizing.ContentBox:
      return BoxSizing.ContentBox;
    default:
      return BoxSizing.BorderBox;
  }
}
