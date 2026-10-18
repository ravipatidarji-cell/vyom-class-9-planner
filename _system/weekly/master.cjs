const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright-core");
const { ROOT, PLANNER, OUTPUT, loadPlan, wrapper, browserExecutable } = require("./generate.cjs");

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function main() {
  const plan = loadPlan();
  const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));
  const destination = path.join(OUTPUT, "Vyom_Complete_Student_Project.pdf");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "vyom-master-"));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 695, height: 1100 });
    await page.route("http://**", (route) => route.abort());
    await page.route("https://**", (route) => route.abort());
    await page.goto(pathToFileURL(PLANNER).href, { waitUntil: "load" });
    const checklist = await page.evaluate(() => {
      window.print = () => {};
      printChapterChecklist(true);
      return {
        html: document.getElementById("chapter-print").innerHTML,
        chapters: CH.length,
        listed: document.querySelectorAll("#chapter-print h3").length,
      };
    });
    assert.equal(checklist.chapters, checklist.listed);
    const weeks = manifest.weeks;
    assert.equal(weeks.reduce((n, w) => n + w.days, 0), plan.days.length);
    assert.equal(weeks.reduce((n, w) => n + w.testIds.length, 0), plan.tests.length);
    const subject = (id) => plan.sub[id] || id;
    let body = `<section class="section"><h1>Vyom Class 9<br>Complete Student Project</h1>
      <p><b>${escape(plan.days[0].d)} to ${escape(plan.days.at(-1).d)} · NDPS 2026-27</b></p>
      <p>${plan.days.length} days · ${plan.tests.length} scheduled tests · ${checklist.chapters} chapter/units · ${weeks.length} weekly student packs</p>
      <div class="note">STUDENT COPY: no solved answer keys. Parent keys stay separate and password-protected. This is the current planner syllabus, not textbook scans or a replacement for school textbooks. Official exam dates/pattern still need school confirmation.</div>
      <h2>How to use this book</h2><ol><li>Find the chapter/topic checklist and tick each completed study/revision block.</li>
      <li>Follow the dated daily pages in the weekly packs. Attempt questions in the provided answer space.</li>
      <li>Enter daily progress and test marks in the registers below. Note mistakes, corrections and retest results.</li>
      <li>Update the app separately: handwritten PDF/print ticks do not automatically sync to the app. This master is a blank reusable progress copy, not an export of saved device progress.</li></ol>
      <p>Existing October dates and holidays are retained. Start at your selected date; record earlier pending work honestly rather than marking it complete.</p>
      <h2>Contents</h2><p>1. Full-course chapter/topic checklist<br>2. Daily progress register<br>3. Test marks and retest register<br>4. All weekly student packs in date order</p>
      <p class="small">Use PDF bookmarks to jump to the checklist/registers or a weekly pack.</p>
      <table class="summary"><thead><tr><th>Week</th><th>Dates</th><th>Tests</th></tr></thead><tbody>${weeks.map((w, i) => `<tr><td>${i + 1}</td><td>${escape(w.firstDay)} to ${escape(w.lastDay)}</td><td>${w.testIds.length}</td></tr>`).join("")}</tbody></table></section>`;
    body += `<section class="section" data-master="checklist">${checklist.html}</section>`;
    body += `<section class="section" data-master="daily"><h1>Daily progress register</h1><p>Daily pages also provide task ticks and notes. Completed / total tasks; minutes studied; pending/weak topic; parent initials.</p>
      <table class="summary review"><thead><tr><th>Date</th><th>Tasks done</th><th>Study min</th><th>Pending / weak topic / next action</th><th>Sign</th></tr></thead><tbody>${plan.days.map(day => `<tr data-progress-day="${day.d}"><td>${day.d}</td><td>___ / ${day.ts.length}</td><td>____</td><td>________________________</td><td>____</td></tr>`).join("")}</tbody></table></section>`;
    body += `<section class="section" data-master="marks"><h1>Test marks / correction / retest register</h1><p>Write actual scores only. Retest uses the same maximum unless noted. Daily/weekly papers and answer space follow in the weekly packs.</p>
      <table class="summary review"><thead><tr><th>Date / Test ID / Subject</th><th>Marks</th><th>Mistakes / correction done</th><th>Retest date / marks</th></tr></thead><tbody>${plan.tests.map(test => `<tr data-score-test="${escape(test.id)}"><td>${test.d}<br>${escape(test.id)}<br>${escape(subject(test.s))} · ${escape(test.kind)}</td><td>___ / ${test.max}</td><td>________________<br>[ ] Corrected</td><td>__________<br>___ / ${test.max}</td></tr>`).join("")}</tbody></table></section>`;
    const input = path.join(temporary, "front.html");
    fs.writeFileSync(input, wrapper("Complete Student Project", body).replace("</style>", "\n.print-subject{break-before:page}.print-subject:first-of-type{break-before:auto}li{margin-bottom:2mm}h3{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}</style>"));
    await page.goto(pathToFileURL(input).href, { waitUntil: "load" });
    await page.evaluate(async () => { await document.fonts.load("11px Mukta", "व्याकरण"); await document.fonts.ready; });
    const audit = await page.evaluate(() => ({
      days: document.querySelectorAll("[data-progress-day]").length,
      tests: document.querySelectorAll("[data-score-test]").length,
      overflow: document.body.scrollWidth > Math.ceil(184 * 96 / 25.4),
    }));
    assert.equal(audit.days, plan.days.length);
    assert.equal(audit.tests, plan.tests.length);
    assert.equal(audit.overflow, false, "Master register horizontal overflow");
    const front = path.join(temporary, "front.pdf");
    await page.pdf({ path: front, format: "A4", preferCSSPageSize: true, printBackground: true });
    const result = spawnSync("python", ["-c", `
import json, sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter
data=json.load(sys.stdin)
writer=PdfWriter()
expected=0
for item in data["inputs"]:
    reader=PdfReader(item["path"])
    if reader.is_encrypted:
        raise ValueError("Student master cannot include encrypted parent keys")
    expected+=len(reader.pages)
    writer.append(reader, outline_item=item["title"])
writer.add_metadata({"/Title":"Vyom Complete Student Project", "/Subject":"Schedule, topic checklists, progress, marks and student tests; no answer keys"})
staged=Path(data["output"]+".new")
try:
    with staged.open("wb") as output:
        writer.write(output)
    check=PdfReader(staged)
    assert not check.is_encrypted and len(check.pages)==expected
    staged.replace(data["output"])
finally:
    staged.unlink(missing_ok=True)
print(f"PASS: combined student PDF, {expected} pages, {len(data['inputs'])} bookmarked sections.")
`], {
      input: JSON.stringify({
        output: destination,
        inputs: [
          { path: front, title: "Syllabus checklist, daily progress and test marks registers" },
          ...weeks.map((w, i) => {
            assert.ok(w.student.endsWith("_Student.pdf") && !w.student.includes("Parent"), "Only student packs allowed");
            const file = path.resolve(path.dirname(PLANNER), w.student);
            assert.ok(fs.existsSync(file), `Missing student PDF: ${file}`);
            return { path: file, title: `Week ${i + 1}: ${w.firstDay} to ${w.lastDay}` };
          }),
        ],
      }),
      encoding: "utf8", maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    console.log(result.stdout.trim());
    console.log(destination);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
