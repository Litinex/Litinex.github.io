const http = require("node:http");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function workspaceDependencyPaths() {
  return [
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
    path.join(
      process.env.USERPROFILE || "",
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules"
    ),
  ].filter(Boolean);
}

function isMissingRequestedPackage(error, packageName) {
  return (
    error?.code === "MODULE_NOT_FOUND" &&
    typeof error.message === "string" &&
    error.message.includes(`'${packageName}'`)
  );
}

function requireWorkspaceDependency(packageName) {
  try {
    return require(packageName);
  } catch (originalError) {
    if (!isMissingRequestedPackage(originalError, packageName)) {
      throw originalError;
    }

    const fallbackErrors = [];

    for (const dependencyPath of workspaceDependencyPaths()) {
      if (!fs.existsSync(dependencyPath)) continue;

      try {
        return createRequire(path.join(dependencyPath, "_workspace.js"))(packageName);
      } catch (error) {
        if (!isMissingRequestedPackage(error, packageName)) {
          throw error;
        }

        fallbackErrors.push(`${dependencyPath}: ${error.message}`);
      }
    }

    const error = new Error(
      `Unable to load "${packageName}". Tried project dependencies and workspace dependency paths:\n` +
        fallbackErrors.join("\n")
    );
    error.cause = originalError;
    throw error;
  }
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.normalize(path.join(rootDir, normalizedPath));
  const relativePath = path.relative(rootDir, filePath);
  const isInsideRoot = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);

  return isInsideRoot ? filePath : null;
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const filePath = resolveRequestPath(request.url || "/");

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(response);
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function browserExecutablePath() {
  if (process.env.BROWSER_EXECUTABLE_PATH) {
    return process.env.BROWSER_EXECUTABLE_PATH;
  }

  const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  return fs.existsSync(edgePath) ? edgePath : undefined;
}

module.exports = {
  browserExecutablePath,
  closeServer,
  createStaticServer,
  listen,
  requireWorkspaceDependency,
};
