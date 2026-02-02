import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "mammoth",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "passport",
  "passport-local",
  "pdf-parse",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Build standalone server for local production
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Build Express app for Vercel serverless import
  console.log("building serverless app bundle...");
  await esbuild({
    entryPoints: ["server/app.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/server-app.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy connect-pg-simple table.sql to dist (required for session store)
  console.log("copying connect-pg-simple table.sql...");
  await copyFile(
    "node_modules/connect-pg-simple/table.sql",
    "dist/table.sql"
  );

  // Copy server-app type declarations for Vercel API routes
  console.log("copying server-app type declarations...");
  await copyFile(
    "server/server-app.d.ts",
    "dist/server-app.d.ts"
  );

  // Copy server-app bundle to api folder for Vercel functions
  console.log("copying server-app bundle to api folder...");
  try {
    await copyFile(
      "dist/server-app.cjs",
      "api/server-app.cjs"
    );
    console.log("✅ Successfully copied server-app.cjs to api/");
  } catch (err) {
    console.error("❌ Failed to copy server-app.cjs:", err);
    throw new Error("Build failed: server-app.cjs copy failed");
  }

  // Copy table.sql to api folder for Vercel serverless (connect-pg-simple needs it)
  console.log("copying table.sql to api folder for Vercel...");
  try {
    await copyFile(
      "node_modules/connect-pg-simple/table.sql",
      "api/table.sql"
    );
    console.log("✅ Successfully copied table.sql to api/");
  } catch (err) {
    console.error("❌ Failed to copy table.sql:", err);
    throw new Error("Build failed: table.sql copy failed");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
