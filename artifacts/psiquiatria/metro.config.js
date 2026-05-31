const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// Monorepo pnpm: Metro precisa observar a raiz do workspace e procurar node_modules
// em ambos os níveis (porque pnpm symlinka pacotes hoisted no node_modules raiz).
config.watchFolders = [workspaceRoot];

// Ignora dirs voláteis (temp do pnpm, caches, builds de outros artifacts) pra
// não dar ENOENT quando arquivos somem entre o stat e o watch.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [
  new RegExp(`${escape(path.join(workspaceRoot, ".local"))}/.*`),
  new RegExp(`${escape(path.join(workspaceRoot, ".git"))}/.*`),
  new RegExp(`${escape(path.join(workspaceRoot, "artifacts/api-server/dist"))}/.*`),
  new RegExp(`${escape(path.join(workspaceRoot, "artifacts/mockup-sandbox"))}/.*`),
  /\/\.expo\/.*/,
  /\/node_modules\/.*\/\.cache\/.*/,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// IMPORTANTE: deixar hierarchicalLookup LIGADO (default).
// Em pnpm os pacotes têm symlinks; o resolver precisa subir a árvore real
// pra achar peer/transitive deps tipo @expo/metro-runtime.

module.exports = config;
