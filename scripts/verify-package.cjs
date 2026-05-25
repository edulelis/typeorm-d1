const { execFileSync } = require("node:child_process");
const { EntitySchema } = require("typeorm");
const { Miniflare } = require("miniflare");

function runNode(args) {
  execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

function getPackFiles() {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const pack = JSON.parse(output)[0];
  return pack.files.map((file) => file.path);
}

function assertPackageContents(files) {
  const required = [
    "package.json",
    "README.md",
    "LICENSE",
    "ISSUES.md",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "dist/index.cjs",
    "dist/index.mjs",
    "dist/index.d.ts",
  ];

  const forbiddenPrefixes = [
    "coverage/",
    "src/",
    "tests/",
    "scripts/",
    "node_modules/",
  ];

  const forbiddenFiles = [
    "debug-broadcaster.js",
    "debug-subject-executor.js",
    "test-broadcaster.js",
    "vitest.config.ts",
    "jest.config.js",
    "tsconfig.json",
    "tsconfig.test.json",
    "tsup.config.ts",
  ];

  for (const file of required) {
    if (!files.includes(file)) {
      throw new Error(`Package is missing required file: ${file}`);
    }
  }

  for (const file of files) {
    if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
      throw new Error(`Package includes forbidden path: ${file}`);
    }
    if (forbiddenFiles.includes(file) || file.endsWith(".test.ts") || file.endsWith(".d.ts.map")) {
      throw new Error(`Package includes forbidden file: ${file}`);
    }
  }
}

async function smokeDataSource() {
  const { createD1DataSource } = require("../dist/index.cjs");
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('OK') } }",
    d1Databases: { DB: "test-db" },
  });

  try {
    const database = await mf.getD1Database("DB");
    const SmokeUser = new EntitySchema({
      name: "SmokeUser",
      tableName: "smoke_users",
      columns: {
        id: {
          type: Number,
          primary: true,
          generated: true,
        },
        email: {
          type: String,
          unique: true,
        },
      },
    });

    const dataSource = createD1DataSource({
      database,
      entities: [SmokeUser],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    await dataSource.getRepository("SmokeUser").save({ email: "smoke@example.com" });
    const row = await dataSource.getRepository("SmokeUser").findOneBy({ email: "smoke@example.com" });
    if (!row) {
      throw new Error("Built package DataSource smoke failed to read saved row");
    }
    await dataSource.destroy();
  } finally {
    await mf.dispose();
  }
}

(async () => {
  runNode(["-e", "require('./dist/index.cjs')"]);
  runNode([
    "--input-type=module",
    "-e",
    "import('./dist/index.mjs').then(() => undefined)",
  ]);

  await smokeDataSource();
  assertPackageContents(getPackFiles());
  console.log("Package verification passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
