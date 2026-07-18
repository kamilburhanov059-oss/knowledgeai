// Converts a filled .docx to PDF via headless LibreOffice — the only reliable
// way to get pixel-faithful DOCX->PDF (same rendering engine Word docs were
// authored against), and the reason this whole pipeline has to run on this VPS
// rather than Vercel (serverless can't install system packages).
//
// Headless soffice has two well-known failure modes under load: concurrent
// invocations sharing a profile directory can deadlock, and it can hang
// indefinitely on malformed input. Both are guarded against here — a
// process-wide queue enforces concurrency=1, each call gets an isolated
// profile dir, and a hard timeout kills stuck conversions instead of wedging
// the queue forever.

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TIMEOUT_MS = 60000;

let queue = Promise.resolve();

function convertDocxToPdf(docxBuffer, jobId) {
  const run = queue.then(() => convertOnce(docxBuffer, jobId));
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function convertOnce(docxBuffer, jobId) {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lo_${jobId}_`));
    const inputPath = path.join(tmpDir, "input.docx");
    const profileDir = path.join(tmpDir, "profile");
    fs.writeFileSync(inputPath, docxBuffer);

    let settled = false;
    const cleanup = () => fs.rm(tmpDir, { recursive: true, force: true }, () => {});
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      fn();
    };

    const child = spawn("soffice", [
      "--headless",
      `-env:UserInstallation=file://${profileDir}`,
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      inputPath,
    ]);

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("LibreOffice conversion timed out")));
    }, TIMEOUT_MS);

    child.on("error", (err) => {
      finish(() => reject(err));
    });

    child.on("close", (code) => {
      const outputPath = path.join(tmpDir, "input.pdf");
      let buffer;
      try {
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          throw new Error(`LibreOffice produced no output (exit ${code}): ${stderr.slice(0, 500)}`);
        }
        buffer = fs.readFileSync(outputPath);
      } catch (err) {
        finish(() => reject(err));
        return;
      }
      finish(() => resolve(buffer));
    });
  });
}

module.exports = { convertDocxToPdf };
