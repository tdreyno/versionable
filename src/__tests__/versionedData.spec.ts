import { z } from "zod"
import { Migration, Version, versionable } from "../versionedData"

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

const V3 = new Version(
  "040a8fe",
  z.object({
    a2: z.string().refine(val => val === val.toUpperCase(), {
      message: "Must be uppercase",
    }),
  }),
)

const MIGRATE_V1_TO_V2 = new Migration(V1, V2, ({ b }) => ({
  a: b,
}))

const MIGRATE_V2_TO_V3 = new Migration(V2, V3, ({ a }) => ({
  a2: a.toUpperCase(),
}))

const VALID_TEST_CONFIG = {
  // current version
  currentVersion: V3,

  // Known versions
  versions: [V1, V2, V3],

  migrations: [MIGRATE_V1_TO_V2, MIGRATE_V2_TO_V3],
}

describe("versionedData", () => {
  describe("versionHashs", () => {
    it("should fail if known versions is empty", () => {
      expect(() => {
        versionable({ ...VALID_TEST_CONFIG, versions: [] })
      }).toThrow()
    })
  })

  describe("currentVersion", () => {
    it("should succeed if versions contains currentVersion", () => {
      expect(() => {
        versionable({
          ...VALID_TEST_CONFIG,
          currentVersion: V3,
          versions: [V3],
          migrations: [],
        })
      }).not.toThrow()
    })
  })

  describe("migrations", () => {
    it("should succeed if only 1 version and no migrations", () => {
      expect(() => {
        versionable({
          ...VALID_TEST_CONFIG,
          currentVersion: V3,
          versions: [V3],
          migrations: [],
        })
      }).not.toThrow()
    })

    it("should fail if any migrations fail to reach the current", () => {
      expect(() => {
        versionable({
          ...VALID_TEST_CONFIG,
          currentVersion: V3,
          versions: [V1, V2, V3],
          migrations: [MIGRATE_V2_TO_V3],
        })
      }).toThrow()
    })
  })

  describe("initialize", () => {
    it("should boot into valid current state with valid data", () => {
      const impl = versionable(VALID_TEST_CONFIG)

      impl.initialize(V3.hash, {
        a2: "TEST",
      })
    })

    it("should fail booting valid current state with invalid data", () => {
      const impl = versionable(VALID_TEST_CONFIG)

      expect(() => {
        impl.initialize(V3.hash, {
          a: 1,
        })
      }).toThrow()
    })

    it("should fail booting invalid current state with valid data", () => {
      const impl = versionable(VALID_TEST_CONFIG)

      expect(() => {
        impl.initialize("unknown", {
          a: "test",
        })
      }).toThrow()
    })
  })

  describe("migrate", () => {
    it("should migrate from V1 to V3", () => {
      const impl = versionable(VALID_TEST_CONFIG)

      const [newVersion, data] = impl.initialize(V1.hash, {
        b: "test",
      })

      expect(newVersion).toBe(V3.hash)
      expect(data).toMatchObject({
        a2: "test".toUpperCase(),
      })
    })

    it("should fail migration from unknown hash", () => {
      const impl = versionable(VALID_TEST_CONFIG)

      expect(() => {
        impl.initialize("???", {})
      }).toThrow()
    })
  })
})
