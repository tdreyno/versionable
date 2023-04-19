# versionable

[![npm latest version](https://img.shields.io/npm/v/@tdreyno/versionable/latest.svg)](https://www.npmjs.com/package/@tdreyno/versionable)
[![Minified Size](https://badgen.net/bundlephobia/minzip/@tdreyno/versionable)](https://bundlephobia.com/result?p=@tdreyno/versionable)

versionable is a tiny library for validating and migrating javascript data.

## Install

```bash
npm install --save @tdreyno/versionable
```

## Example

```typescript
import { create } from "@tdreyno/versionable"

const q = create()

// Will run these in order of function execution (a, b, c) rather than in parallel.
const results = await Promise.all([
  q.enqueue(() => "a"),
  q.enqueue(() => "b"),
  q.enqueue(() => "c"),
])
```
