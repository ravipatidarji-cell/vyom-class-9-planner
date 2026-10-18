const path = require("node:path");
const { execFileSync } = require("node:child_process");

function parentPassword() {
  const password = process.env.VYOM_PARENT_PDF_PASSWORD;
  if (!password) throw new Error("Set VYOM_PARENT_PDF_PASSWORD before generating or verifying parent keys.");
  return password;
}
function protectParentPdf(file) {
  execFileSync("python", [path.join(__dirname, "protect_pdf.py"), file], {
    input: parentPassword(), stdio: ["pipe", "pipe", "pipe"],
  });
}
module.exports = { parentPassword, protectParentPdf };
