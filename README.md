# yoga-layout-taffy

A lightweight WebAssembly layout library based on the [Taffy](https://github.com/DioxusLabs/taffy) Rust layout engine, providing a Yoga-compatible API.

![License](https://img.shields.io/npm/l/yoga-layout-taffy)
![Version](https://img.shields.io/npm/v/yoga-layout-taffy)

## Features

- 🚀 **High Performance**: Powered by Rust + WebAssembly (via `taffy-js`).
- 📦 **Yoga Compatibility**: Implementation of the Yoga Node API, allowing easy migration.
- 🎯 **Flexbox Support**: Supports standard Flexbox layout properties.
- 📝 **Type-Safe**: Written in TypeScript with comprehensive TSDoc documentation.
- 📱 **Cross-Platform**: Works in both Browser and Node.js environments.

## Installation

```bash
npm install yoga-layout-taffy
```

> **Note**: This package is a wrapper around `taffy-js` to expose a Yoga-like API.

## Usage

### Basic Usage with Yoga API

The library provides a `loadYoga()` function to initialize the WASM module and return a Yoga-compatible namespace.

```typescript
import { loadYoga } from "yoga-layout-taffy/load";

async function main() {
  // 1. Initialize the library
  const Yoga = await loadYoga();

  // 2. Create Config and Node
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);

  // 3. Set Styles (Chainable API is usually not supported in standard Yoga JS, but methods exist)
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(300);
  root.setHeight(200);
  root.setJustifyContent(Yoga.JUSTIFY_CENTER);

  // 4. Create and Add Child
  const child = Yoga.Node.create(config);
  child.setWidth(100);
  child.setHeight(100);
  child.setMargin(Yoga.EDGE_ALL, 10);

  root.insertChild(child, 0);

  // 5. Calculate Layout
  root.calculateLayout(300, 200, Yoga.DIRECTION_LTR);

  // 6. Read Results
  console.log("Root Layout:", root.getComputedLayout());
  console.log("Child Layout:", {
    left: child.getComputedLeft(),
    top: child.getComputedTop(),
    width: child.getComputedWidth(),
    height: child.getComputedHeight(),
  });

  // 7. Cleanup (Important when using WASM/Rust resources)
  root.freeRecursive();
  config.free();
}

main();
```

### Direct Taffy Usage

You can also access the underlying `taffy-js` API directly if needed, though the primary goal of this package is the Yoga wrapper.

```typescript
import * as Taffy from "taffy-js";

// See taffy-js documentation for direct usage
```

## Yoga Compatibility

This library aims to be a replacement for `yoga-layout`, but due to differences between Yoga and Taffy (the underlying engine), 100% parity is not guaranteed.

| Feature             | Status       | Notes                                                                                         |
| ------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| **Flexbox**         | ✅ Supported | Most properties (direction, wrap, grow, shrink, etc.) map 1:1.                                |
| **Alignment**       | ✅ Supported | `AlignItems`, `AlignSelf`, `JustifyContent`, etc.                                             |
| **Gap**             | ✅ Supported | Full support for `gap` (row/column).                                                          |
| **Margins/Padding** | ✅ Supported | Including logical edges (Start/End).                                                          |
| **Positioning**     | ⚠️ Partial   | `Relative` and `Absolute` are supported. `Static` acts like `Relative` in Taffy.              |
| **RTL Layout**      | ⚠️ Emulated  | Taffy does not auto-flip Flex directions key-words on its own; this library handles it in JS. |
| **Performance**     | 🚀 Fast      | Comparable or better than standard ASM.js Yoga builds.                                        |

## API Reference

### Configuration

- **`Yoga.Config.create()`**: Create a new configuration object.
- **`config.useWebDefaults()`**: Check if web defaults are enabled.
- **`config.setUseWebDefaults(boolean)`**: Toggle web-standard defaults (e.g., `flexDirection: row`).

### Nodes

Nodes are the core building blocks.

- **`Yoga.Node.create(config?)`**: Create a new layout node.
- **`node.calculateLayout(width?, height?, direction?)`**: Compute layout.
- **`node.free()` / `node.freeRecursive()`**: Release memory.

#### Style Methods

Most Yoga style methods are implemented:

- `setFlexDirection`, `setFlexWrap`, `setFlexBasis`, `setFlexGrow`, `setFlexShrink`
- `setAlignItems`, `setAlignSelf`, `setAlignContent`, `setJustifyContent`
- `setWidth`, `setHeight`, `setMinWidth`, `setMinHeight`, `setMaxWidth`, `setMaxHeight`
- `setMargin`, `setPadding`, `setBorder`, `setPosition`
- `setDisplay`, `setOverflow`
- `setGap`, `setAspectRatio`

#### Layout Methods

Read the results after calculation:

- `getComputedLeft()`, `getComputedTop()`, `getComputedRight()`, `getComputedBottom()`
- `getComputedWidth()`, `getComputedHeight()`
- `getComputedLayout()`: Returns the full layout object.

## Development

### Setup

```bash
# Install dependencies
npm install
```

### Testing

```bash
# Run tests (Vitest)
npm test
```

### Build

```bash
# Compile TypeScript
npm run build
```

## License

MIT
