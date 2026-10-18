const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { browserExecutable, loadPlan, originalDate } = require("./generate.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const DATE = process.argv[2];

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function fontData(file) {
  return `data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, "node_modules", "@fontsource", file)).toString("base64")}`;
}

function styles() {
  const fonts = [
    ["mukta-latin-400-normal.woff2", 400, ""],
    ["mukta-latin-700-normal.woff2", 700, ""],
    ["mukta-devanagari-400-normal.woff2", 400, "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20B9,U+25CC"],
    ["mukta-devanagari-700-normal.woff2", 700, "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20B9,U+25CC"],
  ].map(([file, weight, range]) =>
    `@font-face{font-family:Mukta;src:url("${fontData(`mukta/files/${file}`)}");font-weight:${weight};${range ? `unicode-range:${range};` : ""}}`,
  ).join("");
  return `${fonts}
    @page{size:A4;margin:14mm 14mm 17mm}
    *{box-sizing:border-box}
    body{font:11pt/1.4 Mukta,Arial,sans-serif;color:#161616;margin:0}
    h1,h2{line-height:1.2;margin:0 0 4mm}
    h1{font-size:21pt}h2{font-size:15pt;margin-top:6mm}
    p{margin:2mm 0}
    .head{border-bottom:1px solid #333;padding-bottom:3mm;margin-bottom:4mm}
    .tag{display:inline-block;border:1px solid #333;padding:1mm 3mm;font-size:9pt;font-weight:bold}
    .small{font-size:9pt;color:#444}
    .section{break-inside:avoid;margin:5mm 0 2mm}
    .question{margin:3mm 0 4mm;break-inside:avoid}
    .qtitle{display:grid;grid-template-columns:11mm 1fr 12mm;gap:2mm}
    .opts{margin:2mm 0 0 13mm;display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm}
    .passage{border-left:2px solid #555;background:#f5f5f5;padding:2mm 3mm;margin:2mm 0}
    .or{text-align:center;font-weight:bold;margin:2mm}
    .lines{height:7mm;border-bottom:1px solid #aaa;margin-left:13mm}
    .keyanswer{border-left:2px solid #666;padding:2mm 3mm;margin:2mm 0}
  `;
}

function questionHtml(question, number, answer, parent) {
  const options = question.opts
    ? `<div class="opts">${question.opts.map((option, index) => `<div>${String.fromCharCode(97 + index)}. ${option}</div>`).join("")}</div>`
    : "";
  const choice = question.or ? `<div class="or">OR</div><div style="margin-left:13mm">${question.or}</div>` : "";
  const response = parent
    ? `<div class="keyanswer"><b>Expected answer / marking points:</b> ${answer}</div>`
    : '<div class="lines"></div>'.repeat(Math.max(2, Math.min(8, question.m * 2)));
  return `<article class="question"><div class="qtitle"><b>Q${number} [${question.m}]</b><div>${question.q}</div><b>${question.m} mark${question.m === 1 ? "" : "s"}</b></div>${options}${choice}${response}</article>`;
}

function documentHtml(paper, testId, parent) {
  const questions = paper.sections.flatMap((section) => section.qs);
  const title = escape(paper.title);
  const date = escape(paper.date);
  const label = parent ? "PARENT ONLY — SOLVED ANSWER KEY" : "STUDENT COPY — NO ANSWERS";
  const sections = paper.sections.map((section) => {
    const body = section.qs.map((question) => {
      const index = questions.indexOf(question);
      return questionHtml(question, index + 1, paper.key[index], parent);
    }).join("");
    return `<section><h2>${escape(section.name)}</h2>${body}</section>`;
  }).join("");
  const instructions = paper.ins.map(escape).join(" · ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${styles()}</style></head><body>
    <header class="head"><span class="tag">${label}</span><h1>Class 9 · ${title}</h1>
      <p><b>${date}</b> · ${escape(paper.time)} · ${paper.marks} marks · Test ID: ${escape(testId)}</p>
      <p class="small">${escape(paper.sub)}</p></header>
    ${parent ? "" : '<p>Name: ____________________________________ &nbsp; Roll No.: __________</p><p>Date: ____________________ &nbsp; Score: ______ / ' + paper.marks + "</p>"}
    <p><b>Instructions:</b> ${instructions}</p>${sections}
    <p class="small">${parent ? "Parent copy — keep separate from the student paper." : "Student copy — solved answers are in the separate parent key."}</p>
  </body></html>`;
}

async function renderPdf(browser, pdfjs, html, destination, checks) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => { await document.fonts.ready; });
    const layout = await page.evaluate(() => ({
      questions: document.querySelectorAll(".question").length,
      answers: document.querySelectorAll(".keyanswer").length,
      overflow: document.body.scrollWidth > document.documentElement.clientWidth,
      devanagariFont: document.fonts.check("11px Mukta", "व्याकरण"),
    }));
    if (layout.questions !== checks.questions || layout.answers !== checks.answers || layout.overflow || !layout.devanagariFont) {
      throw new Error(`Paper layout validation failed: ${JSON.stringify(layout)}`);
    }
    const staged = `${destination}.new`;
    const bytes = await page.pdf({
      path: staged,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center">${checks.footer} | Page <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    });
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
    if (pdf.numPages < 1) throw new Error("Generated PDF has no pages.");
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const pdfPage = await pdf.getPage(pageNumber);
      const content = await pdfPage.getTextContent();
      text += content.items.map((item) => item.str).join(" ");
    }
    await pdf.destroy();
    if (!text.includes(checks.requiredText)) throw new Error(`Generated PDF text check failed: ${checks.requiredText}`);
    fs.renameSync(staged, destination);
    console.log(`${destination} (${pdf.numPages} pages)`);
  } finally {
    await page.close();
  }
}

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE || "")) {
    throw new Error("Usage: node generate-paper.cjs YYYY-MM-DD");
  }
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "question-bank.json"), "utf8"));
  const paper = bank.papers[DATE];
  if (!paper) throw new Error(`No weekly paper in the question bank for ${DATE}.`);
  const test = loadPlan().tests.find((item) => item.kind !== "Daily test" && originalDate(item.d) === DATE);
  if (!test || test.max !== paper.marks) throw new Error(`No matching scheduled weekly test for ${DATE}.`);
  const questions = paper.sections.flatMap((section) => section.qs);
  const total = questions.reduce((sum, question) => sum + question.m, 0);
  if (total !== paper.marks || questions.length !== paper.key.length) {
    throw new Error(`Question/answer or marks mismatch for ${DATE}: ${total}/${paper.marks}, ${questions.length}/${paper.key.length}.`);
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const output = path.join(ROOT, "3_Test_Papers");
  const keys = path.join(output, "Answer_Keys");
  fs.mkdirSync(keys, { recursive: true });
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  try {
    await renderPdf(browser, pdfjs, documentHtml(paper, test.id, false), path.join(output, paper.file), {
      questions: questions.length, answers: 0, footer: "STUDENT COPY", requiredText: "STUDENT COPY",
    });
    const keyName = paper.file.replace(/\.pdf$/i, "_Answer_Key.pdf");
    await renderPdf(browser, pdfjs, documentHtml(paper, test.id, true), path.join(keys, keyName), {
      questions: questions.length, answers: questions.length, footer: "PARENT ANSWER KEY", requiredText: "PARENT ONLY",
    });
    console.log(`${paper.title}: ${questions.length} questions, ${total} marks.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
