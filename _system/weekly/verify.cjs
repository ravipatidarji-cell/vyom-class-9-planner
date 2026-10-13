const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const { ROOT, PLANNER, OUTPUT, loadPlan, buildWeeks, testContent, monday, addDays, browserExecutable, SANSKRIT_UNITS } = require("./generate.cjs");

async function verify() {
  const plan = loadPlan();
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "question-bank.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));
  const expectedWeeks = buildWeeks(plan);
  assert.equal(manifest.weeks.length, 23);
  assert.equal(manifest.start, "2026-10-12");
  assert.equal(manifest.end, "2027-03-17");
  assert.equal(plan.meta.eveningRevision, 1);
  const setup = plan.days.flatMap((day) => day.ts.filter((task) => task.setup).map((task) => ({ day, task })));
  assert.equal(setup.length, 13);
  assert.equal(setup.length * 15, 195, "Preserve all kickoff setup minutes without overloading one day");
  assert.equal(new Set(setup.map(({ day }) => day.d)).size, 13);
  assert.ok(setup.every(({ task }) => task.t === "6:20–6:35"));
  assert.ok(plan.days[0].ts.every((task) => /^\d+:\d+–\d+:\d+$/.test(task.t)), "First-day tasks need explicit clock times");
  assert.equal(plan.days[0].ts.length, 7);
  assert.equal(plan.eveningRoutine.at(-1).t, "10:00 PM");
  assert.equal(plan.sub.SK, "Sanskrit");
  assert.equal(plan.ch.filter((chapter) => chapter.s === "SK").length, SANSKRIT_UNITS.length);
  assert.ok(plan.meta.pending.some((item) => item.includes("Sanskrit") && item.includes("confirm")));
  for (const unit of SANSKRIT_UNITS) assert.ok(fs.existsSync(path.join(ROOT, "2_Books", "Sanskrit", unit.file)), `Missing Sanskrit source PDF: ${unit.file}`);
  assert.ok(!plan.tests.some((test) => test.s === "SK"), "Do not invent Sanskrit answer keys without a verified test bank");
  assert.equal(new Set(plan.ch.map((chapter) => chapter.id)).size, plan.ch.length, "Chapter IDs must be unique");
  for (const chapter of plan.ch) {
    const sessions = plan.days.flatMap((day) => day.ts.map((task) => ({ day, task })))
      .filter(({ task }) => ["old", "new", "rev"].includes(task.k) &&
        (task.c === chapter.id || task.k === "rev" && task.x.includes(chapter.name)));
    assert.ok(sessions.some(({ task }) => task.k === "old" || task.k === "new"), `Chapter has no linked first-study block: ${chapter.id}`);
    assert.ok(sessions.some(({ task }) => task.k === "rev"), `Chapter has no linked revision block: ${chapter.id}`);
    assert.ok(chapter.d1 && chapter.dl?.length && chapter.dr, `Chapter is missing planned study/revision dates: ${chapter.id}`);
  }
  assert.equal(expectedWeeks.flatMap((week) => week.days).length, 157);
  assert.equal(expectedWeeks.flatMap((week) => week.tests).length, 110);
  assert.equal(expectedWeeks.at(-1).days.length, 3);
  const allIds = manifest.weeks.flatMap((week) => week.testIds);
  assert.equal(new Set(allIds).size, 110);
  assert.deepEqual([...allIds].sort(), plan.tests.map((test) => test.id).sort());
  const html = fs.readFileSync(PLANNER, "utf8");
  const embedded = /<script id="weekly-packs" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(embedded, "Weekly manifest must work offline without fetch");
  assert.deepEqual(JSON.parse(embedded[1]), manifest.weeks);
  const embeddedPlan = /<script id="plan" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(embeddedPlan, "Sanskrit plan and schedule must be embedded for offline use");
  assert.deepEqual(JSON.parse(embeddedPlan[1]), plan);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let totalPages = 0;
  for (const [index, week] of manifest.weeks.entries()) {
    const expected = expectedWeeks[index];
    assert.notEqual(week.student, week.parent, `Student and parent PDFs must be different files: ${week.start}`);
    assert.ok(week.student.endsWith("_Student.pdf"), `Student PDF has an unexpected name: ${week.student}`);
    assert.ok(week.parent.includes("Parent_Answer_Keys/") && week.parent.endsWith("_Parent_Key.pdf"), `Parent key has an unexpected path: ${week.parent}`);
    assert.equal(week.start, monday(week.start));
    assert.equal(week.end, addDays(week.start, 6));
    assert.equal(week.start, expected.start);
    assert.equal(week.days, expected.days.length);
    assert.equal(week.tasks, expected.days.reduce((n, day) => n + day.ts.length, 0));
    assert.deepEqual(week.testIds, expected.tests.map((test) => test.id));
    const questions = expected.tests.reduce((n, test) => n + testContent(test, bank).key.length, 0);
    assert.equal(week.questions, questions);
    assert.equal(week.answers, questions);
    assert.deepEqual(week.audit.student.tests, week.testIds);
    assert.deepEqual(week.audit.parent.keys, week.testIds);
    assert.equal(week.audit.student.oversizedBlocks, 0);
    assert.equal(week.audit.parent.oversizedBlocks, 0);
    assert.equal(week.audit.student.horizontalOverflow, false);
    assert.equal(week.audit.parent.horizontalOverflow, false);
    assert.equal(week.audit.student.hindiFontLoaded, true);
    assert.equal(week.audit.parent.hindiFontLoaded, true);
    for (const kind of ["student", "parent"]) {
      const file = path.resolve(path.dirname(PLANNER), week[kind]);
      assert.ok(file.startsWith(OUTPUT + path.sep));
      assert.ok(fs.statSync(file).size > 1000);
      assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), "%PDF-");
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: false, isEvalSupported: false }).promise;
      assert.equal(pdf.numPages, kind === "student" ? week.studentPages : week.parentPages);
      assert.ok(pdf.numPages >= (kind === "student" ? week.days + 3 : 2));
      let text = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        assert.ok(Math.abs(viewport.width - 595.28) < 2, `Not A4 width: ${file}`);
        assert.ok(Math.abs(viewport.height - 841.89) < 2, `Not A4 height: ${file}`);
        const content = await page.getTextContent();
        const pageText = content.items.filter((item) => "str" in item).map((item) => item.str).join(" ");
        assert.ok(pageText.trim().length > 40, `Blank page: ${file} page ${pageNumber}`);
        text += `${pageText}\n`;
      }
      for (const id of week.testIds) assert.ok(text.includes(id), `Missing test ID ${id} in ${file}`);
      if (kind === "student") {
        assert.ok(text.includes("evening routine"), `Evening routine missing: ${file}`);
        assert.ok(text.includes("Swimming") && text.includes("dinner") && text.includes("Sleep"), `Incomplete evening routine: ${file}`);
        assert.ok(text.includes("STUDENT COPY"));
        assert.ok(text.includes("Extra answer sheet"));
        assert.ok(!text.includes("PARENT ONLY"), `Solved-key header leaked to student PDF: ${file}`);
        assert.ok(!text.includes("Week score register"), `Parent register leaked: ${file}`);
        assert.ok(!text.includes("Expected answer / marking points:"), `Solved answers leaked to student PDF: ${file}`);
      } else {
        assert.ok(text.includes("PARENT ONLY"));
        assert.ok(text.includes("Week score register"));
        assert.ok(text.includes("original question ke saath uska matching solved answer"), `Parent key must explain its question-and-answer format: ${file}`);
        if (week.testIds.length) {
          assert.ok(text.includes("Question:"));
          assert.ok(text.includes("Expected answer / marking points:"));
        }
        if (index === 0) {
          assert.ok(text.includes("Write the stages of the communication cycle in the correct order."));
          assert.ok(text.includes("Sender") && text.includes("Feedback."));
        }
      }
      if ((index === 0 && kind === "student") || (index === 0 && kind === "parent") || (index === 17 && kind === "student")) {
        const page = await pdf.getPage(index === 17 ? 25 : kind === "student" ? 3 : 2);
        const viewport = page.getViewport({ scale: 0.6 });
        const drawing = pdf.canvasFactory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: drawing.context, viewport }).promise;
        const pixels = drawing.context.getImageData(0, 0, drawing.canvas.width, drawing.canvas.height).data;
        let dark = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] < 40 && pixels[i + 2] < 40) dark++;
        assert.ok(dark / (pixels.length / 4) < 0.18, `Black-filled answer space in ${file}`);
        pdf.canvasFactory.destroy(drawing);
      }
      totalPages += pdf.numPages;
      await pdf.destroy();
    }
  }

  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  try {
    const page = await browser.newPage();
    await page.route("http://**", (route) => route.abort());
    await page.route("https://**", (route) => route.abort());
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(PLANNER).href, { waitUntil: "load" });
    await page.waitForSelector("#weeklyprint a[data-native-pdf]");
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    new (require("node:vm").Script)(script);
    const links = await page.locator('a[href$=".pdf"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    for (const link of links) assert.ok(fs.existsSync(path.resolve(path.dirname(PLANNER), link)), `Dashboard link missing: ${link}`);
    const current = await page.locator("#weeklyprint").innerText();
    assert.ok(current.includes("Week-wise print PDFs"));
    assert.equal(await page.locator("#weeklyprint > div details[open]").count(), 0, "Parent keys start collapsed");
    const native = await page.locator("#weeklyprint > div a[data-native-pdf]").first().evaluate((anchor) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.addEventListener("click", (clicked) => clicked.preventDefault(), { once: true });
      anchor.dispatchEvent(event);
      return { href: anchor.getAttribute("href"), viewerOpened: !document.querySelector("#pdfm").hidden };
    });
    assert.ok(native.href.endsWith("_Student.pdf"));
    assert.equal(native.viewerOpened, false, "Weekly PDFs must bypass the fetch-based viewer for offline printing");
    await page.evaluate(() => renderWeeklyPrint("2026-10-18"));
    const sundayLinks = await page.locator("#weeklyprint > div a[data-native-pdf]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    assert.ok(sundayLinks[0].includes("2026-10-19_to_2026-10-25"), "Sunday must put next Monday's student pack first");
    await page.evaluate(() => renderWeeklyPrint("2026-10-12"));
    const studentHref = await page.locator("#weeklyprint > div a[data-native-pdf]").first().getAttribute("href");
    const parentHref = await page.locator("#weeklyprint > div details a[data-native-pdf]").first().getAttribute("href");
    assert.ok(studentHref.endsWith("_Student.pdf"));
    assert.ok(parentHref.includes("Parent_Answer_Keys/") && parentHref.endsWith("_Parent_Key.pdf"));
    assert.notEqual(studentHref, parentHref, "Parent answer key must not link to the student PDF");
    await page.evaluate(() => renderWeeklyPrint("2026-10-11"));
    assert.ok((await page.locator("#weeklyprint > div a").first().getAttribute("href")).includes("2026-10-12_to_2026-10-18"));
    await page.evaluate(() => renderWeeklyPrint("2027-03-22"));
    assert.equal(await page.locator("#weeklyprint > div a[data-native-pdf]").count(), 0, "Do not silently show stale packs after the plan ends");
    await page.evaluate(() => renderWeeklyPrint("2027-03-14"));
    assert.ok((await page.locator("#weeklyprint").innerText()).includes("partial week"));
    await page.getByRole("tab", { name: "Hafta", exact: true }).click();
    assert.ok(await page.locator("#weekprint a[data-native-pdf]").count());
    await page.getByRole("tab", { name: "Parent", exact: true }).click();
    assert.ok(await page.locator("#parentprint details a").count());
    const parentTabHref = await page.locator("#parentprint details a").first().getAttribute("href");
    assert.ok(parentTabHref.includes("Parent_Answer_Keys/") && parentTabHref.endsWith("_Parent_Key.pdf"));
    assert.notEqual(parentTabHref, await page.locator("#parentprint > div a[data-native-pdf]").first().getAttribute("href"));
    await page.getByRole("tab", { name: "Chapters", exact: true }).click();
    assert.equal(await page.locator("#coursefilters [data-course]").count(), 4);
    assert.ok((await page.locator("#coursebars").innerText()).includes("Old course"));
    await page.locator('#coursefilters [data-course="new"]').click();
    assert.ok(await page.locator("#ctbody tr").count());
    assert.match(await page.locator("#ctbody tr").first().innerText(), /new/i);
    assert.ok(await page.locator("#ctbody .topic-details").count());
    await page.locator('#cfilters [data-s="SK"]').click();
    assert.equal(await page.locator("#ctbody tr").count(), SANSKRIT_UNITS.length);
    assert.ok((await page.locator("#ctbody").innerText()).includes("परिशिष्ट"));
    await page.locator('#cfilters [data-s="M"]').click();
    const linkedStudyDay = await page.locator("#ctbody .topic-details [data-goto]").first().getAttribute("data-goto");
    await page.locator("#ctbody .topic-details summary").first().click();
    await page.locator("#ctbody .topic-details [data-goto]").first().click();
    assert.equal(await page.locator("#pick").inputValue(), linkedStudyDay, "Topic block shortcut must open its scheduled study day");
    await page.getByRole("tab", { name: "Tests", exact: true }).click();
    assert.ok((await page.locator("#v-tests").innerText()).includes("Weekly pack ready"));
    await page.getByRole("tab", { name: "Aaj", exact: true }).click();
    const evening = await page.locator("#eveningroutine").innerText();
    assert.ok(evening.includes("6:35–7:00 PM") && evening.includes("10:00 PM") && evening.includes("Swimming"));
    await page.evaluate(() => {
      S.days["2026-10-12"] = { done: { 0: true, 6: true }, miss: { 7: { r: "Mushkil concept" } } };
      dayState("2026-10-12");
    });
    const migrated = await page.evaluate(() => S.days["2026-10-12"]);
    assert.equal(migrated.done[0], true);
    assert.equal(migrated.done[6], undefined);
    assert.equal(migrated.archivedKickoff.done[6], true);
    assert.equal(migrated.archivedKickoff.miss[7].r, "Mushkil concept");
    const testStudentHref = await page.locator('#tlist a[href$="_Student.pdf"]').first().getAttribute("href");
    const testParentHref = await page.locator("#tlist details a").first().getAttribute("href");
    assert.ok(testStudentHref.endsWith("_Student.pdf"));
    assert.ok(testParentHref.includes("Parent_Answer_Keys/") && testParentHref.endsWith("_Parent_Key.pdf"));
    assert.notEqual(testStudentHref, testParentHref, "Test tab must link its parent key, not the student PDF");
    assert.deepEqual(errors, [], "Dashboard JavaScript errors");
  } finally {
    await browser.close();
  }
  console.log(`PASS: ${manifest.weeks.length} weeks, 46 A4 PDFs, ${totalPages} pages, 157 days, 110 tests, matching keys, offline links and Sunday handover.`);
}

verify().catch((error) => { console.error(error); process.exitCode = 1; });
