/* CommonJS bootstrap for portable CLI TypeScript execution. */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  });
  module._compile(result.outputText, filename);
};
require(require("node:path").resolve(process.argv[2]));
