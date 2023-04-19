/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { z } from "zod"
import hash from "object-hash"
import { zodToJsonSchema } from "zod-to-json-schema"
import cloneDeep from "lodash.clonedeep"

export class Version<T extends z.ZodType> {
  constructor(public hash: string, public validator: T) {
    const calculatedHash = schemaHash(validator)

    if (hash !== schemaHash(validator)) {
      throw new Error(
        `Hash ${hash} does not match validator hash (${calculatedHash})`,
      )
    }
  }
}

export type VersionType<V> = V extends Version<infer T> ? z.infer<T> : never

export class Migration<
  A extends Version<any>,
  B extends Version<any>,
  AType = A extends Version<infer U>
    ? U extends z.ZodType
      ? z.infer<U>
      : never
    : never,
  BType = B extends Version<infer U>
    ? U extends z.ZodType
      ? z.infer<U>
      : never
    : never,
> {
  constructor(
    public from: A,
    public to: B,
    protected runMigration: (from: AType) => BType,
  ) {
    //
  }

  run(from: unknown): BType {
    const fromData = this.from.validator.parse(from)

    const result = this.runMigration(fromData)

    return this.to.validator.parse(result) as BType
  }
}

const validateVersions = (versions: Version<any>[]) =>
  z.array(z.instanceof(Version)).nonempty().parse(versions)

const validateCurrentVersion = (
  versions: Version<any>[],
  currentVersion: Version<any>,
) =>
  z
    .instanceof(Version)
    .refine(
      v => versions.includes(v),
      val => ({
        message: `currentVersion (${
          val.hash
        }) MUST be present in versions list (${JSON.stringify(versions)})`,
      }),
    )
    .parse(currentVersion)

type Edge = [Migration<any, any>, Node]
type Edges = Map<string, Edge>

interface Node {
  isFinalNode?: boolean
  edges: Edges
}

const validateMigrations = (
  versions: Version<any>[],
  currentVersion: Version<any>,
  migrations: Array<Migration<Version<any>, Version<any>>>,
) => {
  const root = versions
    .reduce(
      (acc, { hash }) =>
        acc.set(hash, {
          edges: new Map<string, Edge>(),
        }),
      new Map<string, Node>(),
    )
    .set(currentVersion.hash, {
      isFinalNode: true,
      edges: new Map<string, Edge>(),
    } satisfies Node)

  migrations.forEach(m => {
    const from = root.get(m.from.hash)

    if (!from) {
      throw new Error(`Unknown version ${m.from.hash}`)
    }

    const to = root.get(m.to.hash)

    if (!to) {
      throw new Error(`Unknown version ${m.to.hash}`)
    }

    from.edges.set(m.to.hash, [m, to])
  })

  const getsToFinal = (node: Node, path: string[]): string[] | false => {
    if (node.isFinalNode) {
      return path
    }

    for (const [key, [, edge]] of node.edges.entries()) {
      return getsToFinal(edge, [...path, key])
    }

    return false
  }

  const paths = new Map<string, string[]>()

  for (const [hash, node] of root.entries()) {
    if (hash === currentVersion.hash) {
      continue
    }

    const finalPath = getsToFinal(node, [])

    if (finalPath === false) {
      throw new Error(
        `${hash} unable to migrate all the way through to ${currentVersion.hash}`,
      )
    }

    paths.set(hash, finalPath)
  }

  return { root, paths }
}

const migrate = (
  root: Map<string, Node>,
  path: string[],
  currentVersion: string,
  currentData: unknown,
): [string, unknown] => {
  const node = root.get(currentVersion)

  if (!node) {
    throw new Error(`Cannot get node for ${currentVersion}`)
  }

  const [first, ...rest] = path

  const edge = first && node.edges.get(first)

  if (!edge) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Cannot get edge for ${currentVersion} -> ${first}`)
  }

  const [migration, nextNode] = edge

  const newData = migration.run(cloneDeep(currentData))

  if (nextNode.isFinalNode) {
    return [first, newData]
  }

  return migrate(root, rest, first, newData)
}

export const schemaHash = (schema: z.ZodType) =>
  hash(zodToJsonSchema(schema)).slice(-7)

export type Versionable<CurrentVersion extends Version<any>> = {
  currentVersion: CurrentVersion
  initialize(
    rawVersion: string,
    rawData: unknown,
  ): [
    version: string,
    data: CurrentVersion extends Version<infer U> ? U : never,
  ]
}

export type CurrentVersionSchema<V> = V extends Versionable<infer U>
  ? U extends Version<any>
    ? VersionType<U>
    : never
  : never

export const versionable = <CurrentVersion extends Version<any>>(params: {
  currentVersion: CurrentVersion
  versions: Version<any>[]
  migrations: Array<Migration<Version<any>, Version<any>>>
}): Versionable<CurrentVersion> => {
  const { versions, currentVersion, migrations } = params

  validateVersions(versions)
  validateCurrentVersion(versions, currentVersion)

  const { root, paths } = validateMigrations(
    versions,
    currentVersion,
    migrations,
  )

  const initialize = (
    rawVersion: string,
    rawData: unknown,
  ): [
    version: string,
    data: CurrentVersion extends Version<infer U> ? U : never,
  ] => {
    const versionHashes = versions.map(v => v.hash)

    if (!versionHashes.includes(rawVersion)) {
      throw new Error(
        `raw version (${rawVersion}) not in known versions (${JSON.stringify(
          versionHashes,
        )})`,
      )
    }

    if (rawVersion === currentVersion.hash) {
      const data = currentVersion.validator.parse(rawData)
      return [currentVersion.hash, data]
    }

    const path = paths.get(rawVersion)

    if (!path) {
      throw new Error(
        `Cannot get migration path for ${rawVersion} -> ${currentVersion.hash}`,
      )
    }

    const [newVersion, newData] = migrate(root, path, rawVersion, rawData)

    const data = currentVersion.validator.parse(newData)

    return [newVersion, data]
  }

  return {
    initialize,
    currentVersion,
  }
}
