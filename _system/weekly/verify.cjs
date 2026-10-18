const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const { parentPassword } = require("./pdf-protection.cjs");
const { ROOT, PLANNER, OUTPUT, loadPlan, buildWeeks, testContent, monday, addDays, browserExecutable, SANSKRIT_UNITS } = require("./generate.cjs");

async function verify() {
  const plan = loadPlan();
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "question-bank.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));
  const expectedWeeks = buildWeeks(plan);
  const weeklyTests = plan.tests.filter((test) => test.kind === "Weekly test");
  const weeklyMocks = plan.tests.filter((test) => test.kind === "Pre-annual mock");
  assert.ok(weeklyTests.every((test) => new Date(`${test.d}T12:00:00`).getDay() === 0), "Weekly tests must be on Sundays");
  assert.ok(weeklyMocks.every((test) => new Date(`${test.d}T12:00:00`).getDay() === 0), "Pre-annual mock must be on Sunday");
  assert.ok(plan.tests.filter((test) => test.kind === "Daily test").every((test) => new Date(`${test.d}T12:00:00`).getDay() !== 0), "Sundays must not carry normal daily tests");
  for (const test of [...weeklyTests, ...weeklyMocks]) {
    const day = plan.days.find((item) => item.d === test.d);
    assert.equal(day?.ty, "sunday", `${test.id} must use the Sunday schedule`);
    assert.ok(day.ts.some((task) => task.test === test.id), `${test.id} must be listed on its schedule day`);
  }
  assert.equal(plan.days.find((day) => day.d === "2026-10-18")?.ty, "sunday", "First Sunday must use the Sunday schedule");
  assert.ok(weeklyTests.some((test) => test.d === "2026-10-18"), "First Sunday must include its weekly Maths test");
  assert.equal(plan.days.find((day) => day.d === "2026-10-19")?.ty, "holiday", "Dussehra break must not become a school day");
  assert.equal(plan.days.find((day) => day.d === "2026-10-20")?.ty, "light", "Dussehra schedule must stay on October 20");
  assert.equal(plan.days.find((day) => day.d === "2026-10-21")?.ty, "holiday", "The Dussehra break must remain in place");
  assert.equal(plan.days.find((day) => day.d === "2026-12-06")?.ty, "sunday", "Pre-annual mock must match the dated Sunday schedule");
  assert.equal(plan.days.find((day) => day.d === "2026-12-07")?.ty, "exam", "Pre-annual exams must start on December 7");
  assert.equal(plan.days.find((day) => day.d === "2026-12-20")?.lb, "Pre-annual analysis", "Post-exam analysis must remain on December 20");
  const movedKickoffQuiz = plan.tests.find((test) => test.id === "D2026-10-12");
  assert.equal(movedKickoffQuiz?.d, "2026-11-14", "Kickoff quiz must follow the rescheduled lessons");
  assert.equal(movedKickoffQuiz?.sourceDate, "2026-10-12", "Moved kickoff quiz must keep its original question bank");
  assert.ok(plan.days.find((day) => day.d === "2026-10-14")?.ts.some((task) => task.c === "M5" && task.x.includes("5.1–5.2")), "Circle foundations must be rescheduled before the weekly test");
  assert.ok(plan.days.find((day) => day.d === "2026-10-31")?.ts.some((task) => task.c === "AI1" && task.k === "new"), "Communication Skills must have a weekday study block");
  assert.ok(plan.days.find((day) => day.d === "2026-11-14")?.ts.some((task) => task.c === "AI3" && task.k === "new"), "Self-Management must have a weekday study block");
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
  assert.equal(expectedWeeks.flatMap((week) => week.tests).length, 108);
  assert.equal(expectedWeeks.at(-1).days.length, 3);
  const allIds = manifest.weeks.flatMap((week) => week.testIds);
  assert.equal(new Set(allIds).size, 108);
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
      if (kind === "parent") {
        for (const password of [undefined, "incorrect-password"]) {
          await assert.rejects(pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), password, isEvalSupported: false }).promise, error => error.name === "PasswordException", `Parent key must reject missing/wrong passwords: ${file}`);
        }
      }
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), password: kind === "parent" ? parentPassword() : undefined, useSystemFonts: false, isEvalSupported: false }).promise;
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
        if (index === 4) {
          assert.ok(text.includes("Define osmosis."), "Moved kickoff quiz must be in its new parent pack.");
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
    assert.equal(await page.locator("#master-project-pdf").isVisible(), true, "Master PDF card must be visible on the dashboard");
    const masterLinks = await page.locator("#master-project-pdf a[data-native-pdf]").evaluateAll(anchors => anchors.map(a => ({ href: a.getAttribute("href"), download: a.hasAttribute("download") })));
    assert.equal(masterLinks.length, 2);
    for (const link of masterLinks) {
      assert.equal(link.href, "../5_Weekly_Packs/Vyom_Complete_Student_Project.pdf");
      assert.ok(fs.existsSync(path.resolve(path.dirname(PLANNER), link.href)), "Master PDF dashboard link must resolve");
    }
    assert.equal(masterLinks[1].download, true);
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    new (require("node:vm").Script)(script);
    const loginErrors = await page.evaluate(() => [
      cloudSignInError({ code: "invalid_credentials", message: "Invalid login credentials", status: 400 }),
      cloudSignInError({ code: "email_not_confirmed", message: "Email not confirmed", status: 400 }),
      cloudSignInError({ code: "over_request_rate_limit", message: "Too many requests", status: 429 }),
      cloudSignInError({ message: "Failed to fetch" }),
    ]);
    assert.match(loginErrors[0], /Invalid login credentials \[invalid_credentials\] \(HTTP 400\)/);
    const mappedLogin = await page.evaluate(async () => {
      const previous=supabaseClient,calls=[];
      try {
        supabaseClient={auth:{async signInWithPassword(value){calls.push(value);return {data:{user:{id:'member'}},error:null}}}};
        await signInPlannerAccount({phone:'+919876543210',password:'test-password'});
        await signInPlannerAccount({email:'admin@example.test',password:'admin-password'});
        supabaseClient={auth:{async signInWithPassword(value){calls.push(value);return {data:null,error:{code:value.phone?'phone_provider_disabled':'invalid_credentials'}}}}};
        const failed=await signInPlannerAccount({phone:'+919876543210',password:'wrong-password'});
        return {calls,code:failed.error.code};
      }finally{supabaseClient=previous}
    });
    assert.equal(mappedLogin.calls[0].email, "member.919876543210@members.vyom.invalid");
    assert.equal(mappedLogin.calls[0].phone, undefined);
    assert.equal(mappedLogin.calls[1].email, "admin@example.test");
    assert.equal(mappedLogin.calls[3].phone, "+919876543210", "Existing phone accounts must still be attempted");
    assert.equal(mappedLogin.code, "invalid_credentials", "Disabled legacy phone auth must not mask the actual password error");
    assert.match(loginErrors[1], /Email verification/);
    assert.match(loginErrors[2], /ruk kar/);
    assert.match(loginErrors[3], /Failed to fetch/);
    await page.getByRole("tab", { name: "Aaj", exact: true }).click();
    await page.locator("#pick").fill("2026-10-12");
    await page.locator("#pick").dispatchEvent("change");
    assert.ok((await page.locator("#dailychapters").innerText()).includes("Cell: The Building Block of Life"));
    await page.locator('#dailychapters [data-ch="S2"][data-k="0"]').check();
    await page.getByRole("tab", { name: "Chapters", exact: true }).click();
    await page.locator('#cfilters [data-s="S"]').click();
    assert.equal(await page.locator('#ctbody [data-ch="S2"][data-k="0"]').isChecked(), true, "Daily checklist must share chapter progress");
    await page.getByRole("tab", { name: "Aaj", exact: true }).click();
    await page.locator('#dailychapters [data-day-task="0"]').click();
    assert.equal(await page.locator("#tk-0").evaluate((input) => input === document.activeElement), true);
    await page.locator("#tk-0").check();
    assert.ok((await page.locator("#dailychapters li").filter({ has: page.locator('[data-day-task="0"]') }).innerText()).includes("Done"), "Daily chapter status must follow the schedule tick");
    await page.locator("#tk-0").uncheck();
    await page.getByRole("tab", { name: "Chapters", exact: true }).click();
    await page.locator('#ctbody [data-ch="S2"][data-k="0"]').uncheck();
    assert.equal(await page.locator('#dailychapters [data-ch="S2"][data-k="0"]').isChecked(), false, "Overview changes must update the daily checklist");
    await page.getByRole("tab", { name: "Aaj", exact: true }).click();
    for (const date of ["2026-10-18", "2026-10-20", "2027-01-20"]) {
      await page.locator("#pick").fill(date);
      await page.locator("#pick").dispatchEvent("change");
      const counts = await page.evaluate(() => ({
        actual: document.querySelectorAll("#dailychapters [data-ch]").length,
        expected: CH.filter(chapter => DAYS[dayIdx[cur]].ts.some(task => isChapterSession(task, chapter))).length * CHAPTER_STAGES.length,
      }));
      assert.equal(counts.actual, counts.expected, `Daily chapters must match the selected date: ${date}`);
    }
    await page.locator("#pick").fill("2026-10-12");
    await page.locator("#pick").dispatchEvent("change");
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
    assert.match(await page.locator("#parent-access-status").innerText(), /Admin/i);
    assert.equal(await page.locator("#parent-content").isVisible(), false, "Parent review must stay hidden without Admin sign-in");
    await page.locator("#close-cloud-sync").click();
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
    await page.getByRole("tab", { name: "Chapters", exact: true }).click();
    await page.locator('#coursefilters [data-course="all"]').click();
    await page.locator("#ctbody .topic-details summary").first().click();
    const topic = page.locator("#ctbody [data-topic-date]").first();
    const topicDate = await topic.getAttribute("data-topic-date");
    const topicIndex = await topic.getAttribute("data-topic-index");
    await topic.check();
    assert.equal(await page.evaluate(({ date, index }) => !!S.days[date].done[index], { date: topicDate, index: topicIndex }), true);
    await page.reload({ waitUntil: "load" });
    assert.equal(await page.evaluate(({ date, index }) => !!S.days[date].done[index], { date: topicDate, index: topicIndex }), true, "Topic progress must persist after reload");
    await page.evaluate(({ date }) => { cur = date; showTab("today"); renderDay(); }, { date: topicDate });
    assert.equal(await page.locator(`#tk-${topicIndex}`).isChecked(), true, "Topic checkbox must update its daily task");
    await page.locator(`#tk-${topicIndex}`).uncheck();
    await page.getByRole("tab", { name: "Chapters", exact: true }).click();
    await page.locator('#cfilters [data-s="M"]').click();
    assert.equal(await page.locator(`#ctbody [data-topic-date="${topicDate}"][data-topic-index="${topicIndex}"]`).first().isChecked(), false, "Daily uncheck must update topic progress");
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator("#print-chapter-subject").click();
    const selectedPrint = await page.evaluate(() => ({
      actual: document.querySelectorAll("#chapter-print li").length,
      expected: filteredChapters().reduce((sum, c) => sum + Math.max(1, chapterSessions(c.id).length), 0),
      subjects: document.querySelectorAll("#chapter-print .print-subject").length,
    }));
    assert.equal(selectedPrint.actual, selectedPrint.expected);
    assert.equal(selectedPrint.subjects, 1);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.locator("#print-chapter-all").click();
    const fullPrint = await page.evaluate(() => ({
      actual: document.querySelectorAll("#chapter-print li").length,
      expected: CH.reduce((sum, c) => sum + Math.max(1, chapterSessions(c.id).length), 0),
      chapters: document.querySelectorAll("#chapter-print h3").length,
      total: CH.length,
    }));
    assert.equal(fullPrint.actual, fullPrint.expected, "Full print must include every chapter's study/revision block or an explicit missing-block warning");
    assert.equal(fullPrint.chapters, fullPrint.total);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#chapter-print").isVisible(), true);
    assert.equal(await page.locator("#v-chapters").isVisible(), false, "Only the checklist should print");
    const checklistPdf = await page.pdf({ format: "A4", margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });
    assert.ok(checklistPdf.length > 10000, "Printable checklist must produce a nonempty PDF");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    assert.equal(await page.locator("#chapter-print").isVisible(), false);
    assert.equal(await page.locator("#v-chapters").isVisible(), true, "App must return after print/cancel");
    const loginListCheck = await page.evaluate(async () => {
      const originalClient=supabaseClient;
      const originalMode=mode;
      const originalMember=currentFamilyMember;
      const originalUser=currentAuthUser;
      try {
        mode='supabase';
        currentFamilyMember={role:'admin'};
        currentAuthUser={id:'admin-account'};
        const records=[
          {id:1,user_id:'account-one',created_at:'2026-10-18T10:00:01Z'},
          {id:2,user_id:'account-two',created_at:'2026-10-18T10:00:02Z'},
        ];
        const members=[
          {user_id:'account-one',display_name:'Same Name',role:'member'},
          {user_id:'account-two',display_name:'Same Name',role:'admin'},
        ];
        supabaseClient={from(table){
          const query={select(){return query},order(){return query},limit(){return query},then(resolve){resolve({data:table==='planner_login_activity'?records:members,error:null})}};
          return query;
        }};
        await updateParentLoginList();
        const text=document.getElementById('parent-login-activity').textContent;
        const status=document.getElementById('parent-login-activity-status').textContent;
        supabaseClient={from(){
          const query={select(){return query},order(){return query},limit(){return query},then(resolve){resolve({data:null,error:{message:'Connection unavailable'}})}};
          return query;
        }};
        await updateParentLoginList();
        return {text,status,error:document.getElementById('parent-login-activity-status').textContent,rows:document.querySelectorAll('#parent-login-activity li').length};
      } finally {
        supabaseClient=originalClient;mode=originalMode;currentFamilyMember=originalMember;currentAuthUser=originalUser;
        loginActivityMembers=[];parentLoginActivity=[];renderParentLoginActivity();
      }
    });
    assert.match(loginListCheck.text, /account-one/);
    assert.match(loginListCheck.text, /account-two/);
    assert.match(loginListCheck.text, /Member/);
    assert.match(loginListCheck.text, /Admin/);
    assert.match(loginListCheck.text, /IST/);
    assert.equal(loginListCheck.rows, 2, "Same-name accounts must remain distinguishable");
    assert.match(loginListCheck.status, /List updated/);
    assert.match(loginListCheck.error, /Connection unavailable/);
    const adminUiCheck = await page.evaluate(async () => {
      const previous={client:supabaseClient,mode,member:currentFamilyMember,user:currentAuthUser};
      const sent=[];
      const name='<b>Same Name</b>';
      const mock={
        functions:{async invoke(functionName,{body}){
          sent.push({functionName,body});
          return {data:{userId:'new-member',loginId:'SAMENAME9876543210',displayName:name},error:null};
        }},
        from(table){
          const query={
            select(){return query},order(){return query},limit(){return query},
            async insert(row){sent.push({table,row});return {error:null}},
            then(resolve){
              const rows={
                planner_family_members:[{user_id:'new-member',display_name:name,role:'member',active:true}],
                planner_family_private:[{user_id:'new-member',phone:'+919876543210'}],
                planner_login_activity:[{id:1,user_id:'new-member',created_at:'2026-10-18T10:00:00Z'}],
                planner_comments:[{id:1,user_id:'new-member',verdict:'not_ok',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-18T10:01:00Z'}],
              };
              resolve({data:rows[table]||[],error:null});
            },
          };
          return query;
        },
      };
      try{
        mode='supabase';currentAuthUser={id:'admin'};currentFamilyMember={role:'admin',display_name:'Admin'};supabaseClient=mock;
        renderUserAccess();
        const adminVisible=!document.getElementById('users-admin-tab').hidden;
        document.getElementById('create-member-name').value='Same Name';
        document.getElementById('create-member-phone').value='9876543210';
        document.getElementById('create-member-password').value='Distinct-Pass42!';
        await document.getElementById('create-member-form').onsubmit({preventDefault(){}});
        const invite=document.getElementById('member-invite-text').value;
        const whatsapp=document.getElementById('member-invite-whatsapp').getAttribute('href');
        const inbox=document.getElementById('users-admin-comments').textContent;
        const rosterTable=document.getElementById('users-admin-roster').closest('table');
        const roster={rows:rosterTable.querySelectorAll('tbody tr').length,cells:rosterTable.querySelectorAll('tbody tr:first-child td').length,text:rosterTable.textContent};
        roster.whatsapp=rosterTable.querySelector('a').href;
        const originalConfirm=window.confirm;
        const revokeButton=document.getElementById('revoke-selected-members');
        await revokeButton.onclick();
        roster.emptySelection=document.getElementById('revoke-members-status').textContent;
        rosterTable.querySelector('[data-revoke-member]').checked=true;
        let revokeCalls=0;
        const createInvoke=mock.functions.invoke;
        mock.functions.invoke=async(functionName,args)=>{
          if(args.body.action!=='delete')return createInvoke(functionName,args);
          revokeCalls++;
          if(functionName!=='create-planner-member'||args.body.memberIds[0]!=='new-member')throw new Error('Wrong delete payload');
          return {data:{deleted:['new-member']},error:null};
        };
        try{
          window.confirm=()=>false;
          await revokeButton.onclick();
          roster.cancelCalls=revokeCalls;
          window.confirm=()=>true;
          await revokeButton.onclick();
          roster.revokeCalls=revokeCalls;
          roster.revokeStatus=document.getElementById('revoke-members-status').textContent;
          loginActivityMembers=[{user_id:'protected-admin',display_name:'Admin',role:'admin',active:true},{user_id:'blocked-member',display_name:'Blocked',role:'member',active:false}];
          renderAdminUsers();
          roster.protectedCheckboxes=document.querySelectorAll('#users-admin-roster [data-revoke-member]').length;
          roster.blockedLinks=document.querySelectorAll('#users-admin-roster a').length;
          roster.blockedText=document.getElementById('users-admin-roster').textContent;
        }finally{window.confirm=originalConfirm}
        const noInjectedElements=document.querySelectorAll('#users-admin-comments img,#users-admin-roster b b').length===0;
        const passwordCleared=document.getElementById('create-member-password').value==='';
        showTab('dash');
        const inviteCleared=document.getElementById('member-invite-text').value==='';
        const whatsappCleared=!document.getElementById('member-invite-whatsapp').hasAttribute('href')&&document.getElementById('member-invite-whatsapp').hidden;
        currentAuthUser={id:'new-member'};currentFamilyMember={role:'member',display_name:'Same Name'};
        renderParentLoginActivity();
        showTab('users');
        const memberBlocked=document.getElementById('users-admin-tab').hidden&&document.getElementById('v-users').hidden&&document.getElementById('users-admin-comments').textContent==='';
        const feedbackVisible=!document.getElementById('member-feedback-card').hidden;
        document.getElementById('member-feedback-verdict').value='ok';
        document.getElementById('member-feedback-body').value='Schedule samajh aa gaya';
        await document.getElementById('member-feedback-form').onsubmit({preventDefault(){}});
        const feedbackStatus=document.getElementById('member-feedback-status').textContent;
        mock.from=()=>({async insert(){return {error:{message:'Network unavailable'}}}});
        document.getElementById('member-feedback-verdict').value='not_ok';
        document.getElementById('member-feedback-body').value='Test ki dikkat';
        await document.getElementById('member-feedback-form').onsubmit({preventDefault(){}});
        const feedbackError=document.getElementById('member-feedback-status').textContent;
        const retainedDraft=document.getElementById('member-feedback-body').value;
        return {adminVisible,invite,whatsapp,whatsappCleared,inbox,roster,noInjectedElements,passwordCleared,inviteCleared,memberBlocked,feedbackVisible,feedbackStatus,feedbackError,retainedDraft,sent};
      }finally{
        supabaseClient=previous.client;mode=previous.mode;currentFamilyMember=previous.member;currentAuthUser=previous.user;
        loginActivityMembers=[];parentLoginActivity=[];renderParentLoginActivity();
      }
    });
    assert.equal(adminUiCheck.adminVisible, true);
    assert.match(adminUiCheck.invite, /SAMENAME9876543210/);
    assert.match(adminUiCheck.invite, /Distinct-Pass42!/);
    assert.match(adminUiCheck.invite, /https:\/\//);
    const whatsappUrl=new URL(adminUiCheck.whatsapp);
    assert.equal(whatsappUrl.hostname, "wa.me");
    assert.equal(whatsappUrl.pathname, "/919876543210");
    assert.match(whatsappUrl.searchParams.get("text"), /SAMENAME9876543210/);
    assert.match(whatsappUrl.searchParams.get("text"), /https:\/\//);
    assert.equal(whatsappUrl.searchParams.get("text").includes("Distinct-Pass42!"), false, "Passwords must not be placed in WhatsApp URLs");
    assert.equal(adminUiCheck.whatsappCleared, true);
    assert.match(adminUiCheck.inbox, /NOT OK/);
    assert.equal(adminUiCheck.roster.rows, 1);
    assert.equal(adminUiCheck.roster.cells, 7);
    assert.match(adminUiCheck.roster.text, /BSAMENAMEB9876543210/);
    assert.match(adminUiCheck.roster.text, /\+919876543210/);
    assert.match(adminUiCheck.roster.text, /new-member/);
    assert.equal(adminUiCheck.roster.text.includes("Distinct-Pass42!"), false);
    assert.equal(new URL(adminUiCheck.roster.whatsapp).pathname, "/919876543210");
    assert.match(adminUiCheck.roster.emptySelection, /checkbox select/);
    assert.equal(adminUiCheck.roster.cancelCalls, 0);
    assert.equal(adminUiCheck.roster.revokeCalls, 1);
    assert.match(adminUiCheck.roster.revokeStatus, /1 member/);
    assert.equal(adminUiCheck.roster.protectedCheckboxes, 1, "Disabled member must also be deletable; Admin must stay protected");
    assert.equal(adminUiCheck.roster.blockedLinks, 0);
    assert.match(adminUiCheck.roster.blockedText, /Access band/);
    assert.match(adminUiCheck.inbox, /<img src=x/);
    assert.equal(adminUiCheck.noInjectedElements, true, "Untrusted names/comments must be escaped");
    assert.equal(adminUiCheck.passwordCleared, true);
    assert.equal(adminUiCheck.inviteCleared, true, "Private invite must clear when leaving Admin tab");
    assert.equal(adminUiCheck.memberBlocked, true, "Member must not see Admin tab or cached inbox");
    assert.equal(adminUiCheck.feedbackVisible, true);
    assert.match(adminUiCheck.feedbackStatus, /Admin ko bhej diya/);
    assert.match(adminUiCheck.feedbackError, /Network unavailable/);
    assert.equal(adminUiCheck.retainedDraft, "Test ki dikkat", "Failed send must retain draft for retry");
    assert.equal(adminUiCheck.sent[0].functionName, "create-planner-member");
    assert.equal(adminUiCheck.sent[0].body.phone, "+919876543210");
    assert.equal(adminUiCheck.sent[1].row.user_id, "new-member");
    assert.equal(adminUiCheck.sent[1].row.verdict, "ok");
    assert.deepEqual(errors, [], "Dashboard JavaScript errors");
  } finally {
    await browser.close();
  }
  console.log(`PASS: ${manifest.weeks.length} weeks, 46 A4 PDFs, ${totalPages} pages, 157 days, 108 tests, matching keys, offline links and Sunday handover.`);
}

verify().catch((error) => { console.error(error); process.exitCode = 1; });
