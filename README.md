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
import { Migration, Version } from "@tdreyno/versionable"
import * as z from "zod"

const V1 = new Version(
  "607246b",
  z.object({
    b: z.string(),
  }),
)

const V2 = new Version(
  "9adaf55",
  z.object({
    a: z.string(),
  }),
)

const MIGRATE_V1_TO_V2 = new Migration(V1, V2, ({ b }) => ({
  a: b,
}))

const objVersion = versionable({
  // current version
  currentVersion: V3,

  // Known versions
  versions: [V1, V2],

  migrations: [MIGRATE_V1_TO_V2],
})

const result = objVersion.initialize("607246b", { b: "hello" })

// result will be ["9adaf55", { a: "hello" }]
```
