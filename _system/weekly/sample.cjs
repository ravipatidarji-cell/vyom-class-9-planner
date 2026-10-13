const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const { ROOT, loadPlan, testContent, studentHtml, parentHtml, monday, addDays, browserExecutable, wrapper } = require("./generate.cjs");

const DATE = "2026-10-13";
const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const checkpoints = {
  S2: "Cell organelles recall aur plant/animal diagrams complete; labels book se check karo.",
  M1: "Homework pehle; phir formulas, examples aur plan ke 4 questions ki working notebook mein.",
  M5: "5.3–5.4 ke circles/chords/angles samjho; doubts note karo.",
  S3: "Connective, muscular aur nervous tissue ke features/functions notebook mein.",
  SK1: "Path 1 ke prashn/abhyas, shabdarth aur anuvad ka likhit kaam; book se check. Block mein na ho to pending note karo.",
};

function timeLabel(task) {
  const match = /^(\d+):(\d+)–(\d+):(\d+)$/.exec(task.t);
  if (!match) throw new Error(`Sample task needs an explicit clock time: ${task.t}`);
  const morning = task.t === "6:45–7:10";
  const convert = (hour, minute) => `${String(morning || Number(hour) === 12 ? Number(hour) : Number(hour) + 12).padStart(2, "0")}:${minute}`;
  return `${task.t} ${morning ? "AM" : "PM"} (${convert(match[1], match[2])}–${convert(match[3], match[4])})`;
}

async function main() {
  const plan = loadPlan();
  const day = plan.days.find((item) => item.d === DATE);
  if (!day) throw new Error(`Date missing from planner: ${DATE}`);
  const tests = plan.tests.filter((item) => item.d === DATE);
  assert.equal(tests.length, 1);
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "question-bank.json"), "utf8"));
  const content = testContent(tests[0], bank);
  assert.deepEqual(content.key, bank.daily["2026-10-12"].key);
  assert.deepEqual(content.sections[0].qs.map(({ m, q }) => [m, q]), bank.daily["2026-10-12"].qs);
  assert.equal(content.sections[0].qs.reduce((sum, question) => sum + question.m, 0), tests[0].max);
  const output = path.join(ROOT, "6_Daily_Share_Sample", DATE);
  fs.mkdirSync(output, { recursive: true });
  const label = "Tuesday, 13 October 2026";
  const paragraphs = [
    `VYOM — ${label}\nLOCAL SAMPLE — approval pending; nothing sent.\nTopic-wise / task-wise schedule · India time\nPlan: ${plan.meta.version}`,
    "06:30 AM — Uthna, fresh hona.\n08:00 AM–02:00 PM — School.\n02:00–02:45 PM — Khana + aaram.\nSchool/tuition travel aur breakfast ka exact time planner mein assigned nahi; parent actual timings confirm karein.",
    ...day.ts.map((task, index) => {
      const checkpoint = task.test
        ? "Test time par parent se student paper lo; book band karke answers likho. Parent ko marks/checking ke liye do."
        : checkpoints[task.c] || "Parent ke saath syllabus/weekly task list check karke zaroori points note karo.";
      return `TASK ${index + 1} | ${timeLabel(task)} | ${task.s === "ALL" ? "Sab subjects" : plan.sub[task.s]}\n${task.x}\nComplete check: ${checkpoint}`;
    }),
    "EVENING ROUTINE\n06:35–07:00 PM — Snack + aaram; swimming ki tayyari/travel.\n07:00–09:00 PM — Swimming.\n09:00–09:30 PM — Wapas aana + fresh hona + dinner.\n09:30–09:45 PM — Bag/uniform aur next-day tayyari.\n09:45–10:00 PM — Relax, screen band; naya study block nahi.\n10:00 PM–06:30 AM — Sleep (8.5 hours). Pending kaam ke liye neend nahi kaatni.",
    `TEST INFORMATION — NO QUESTIONS IN THIS MESSAGE\nID: ${tests[0].id}\n03:30–04:00 PM | ${tests[0].max} marks | ${tests[0].dur} minutes\nTopics: ${tests[0].syl.join(" · ")}\nQuestions parent ko pichhli raat; student ko test time par. Solved key sirf parent ke paas.\nChecking: ${tests[0].check}\nCorrection: ${tests[0].corr}\nPlanned retest: ${tests[0].retest}\nCorrection ka exact slot current plan mein assigned nahi; parent confirm karein, swimming/sleep mein clash na karein.`,
    "NOTES\nQuantities/page/exercise numbers sirf plan mein verified hon to diye hain; extra numbers invent nahi kiye.\nTravel/dinner ka actual time zyada ho to parent timing adjust karein.\nStudent ke liye schedule file hi forward karein; actual test aur key raat ko student group mein nahi.",
  ];
  const text = paragraphs.join("\n\n");
  // Keep paragraphs intact when splitting the copyable message for Telegram.
  const parts = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > 2000) throw new Error("Sample paragraph exceeds message limit");
    if (current && current.length + paragraph.length + 2 > 2000) {
      parts.push(current);
      current = "";
    }
    current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current) parts.push(current);
  const message = parts.map((part, index) => `13 Oct schedule ${index + 1}/${parts.length}\n\n${part}`).join("\n\n====================\n\n");
  fs.writeFileSync(path.join(output, `${DATE}_Schedule_Message.txt`), message);

  const scheduleHtml = wrapper(`Vyom ${DATE} schedule sample`, `
    <div class="head"><span class="tag">STUDENT / FAMILY — SCHEDULE ONLY</span><h1>${label}</h1><p>Local sample · ${escape(plan.meta.version)}</p></div>
    <div class="note">Ye schedule student group mein share kar sakte hain. Questions aur solved answers is PDF mein nahi hain.</div>
    <p><b>06:30 AM</b> Uthna / fresh. <b>08:00 AM–02:00 PM</b> School. <b>02:00–02:45 PM</b> Khana + aaram.</p>
    <p class="small">Breakfast aur school/tuition travel ke exact slots parent confirm karein.</p>
    ${day.ts.map((task, index) => `<div style="break-inside:avoid;margin:4mm 0;border-bottom:1px solid #bbb;padding-bottom:3mm" data-sample-task>
      <h3>Task ${index + 1} · ${escape(timeLabel(task))} · ${escape(task.s === "ALL" ? "Sab" : plan.sub[task.s])}</h3>
      <p>${escape(task.x)}</p><p class="small"><b>Complete check:</b> ${escape(task.test ? "Parent se test time par paper lo; book band karke answers likho aur checking ke liye do." : checkpoints[task.c] || "Parent ke saath weekly syllabus/tasks check karke zaroori points note karo.")}</p></div>`).join("")}
    <div style="break-inside:avoid"><h2>Evening routine</h2><p>${escape(paragraphs.at(-3).replace("EVENING ROUTINE\n", "")).replace(/\n/g, "<br>")}</p></div>
    <div class="note" style="break-inside:avoid">${escape(paragraphs.at(-2)).replace(/\n/g, "<br>")}</div>
    <p class="small">${escape(paragraphs.at(-1)).replace(/\n/g, "<br>")}</p>`);
  const week = { start: monday(DATE), end: addDays(monday(DATE), 6), days: [day], tests };
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  const results = {};
  try {
    const page = await browser.newPage({ viewport: { width: 695, height: 1100 } });
    await page.route("https://**", (route) => route.abort());
    await page.route("http://**", (route) => route.abort());
    for (const [kind, html] of [
      ["Schedule", scheduleHtml],
      ["Student_Test", studentHtml(week, plan, bank)],
      ["Parent_Key", parentHtml(week, plan, bank)],
    ]) {
      const temporary = path.join(output, `${kind}.render.html`);
      fs.writeFileSync(temporary, html);
      try {
        await page.goto(pathToFileURL(temporary).href);
        if (kind !== "Schedule") {
          await page.evaluate((isParent) => {
            const selector = isParent ? ".parent-key" : ".test-paper";
            const sections = [...document.querySelectorAll(selector)];
            if (sections.length !== 1) throw new Error("Expected exactly one daily test/key section");
            document.body.replaceChildren(...sections);
          }, kind === "Parent_Key");
        }
        if (kind === "Student_Test") {
          await page.evaluate(() => {
            document.querySelector(".head").insertAdjacentHTML("afterbegin", '<p class="tag">PARENT COPY — give student at 3:30 PM; no solved answers</p>');
          });
        }
        if (kind === "Parent_Key") {
          await page.evaluate(() => {
            document.querySelector(".head").insertAdjacentHTML("afterbegin", '<p class="tag">PARENT ONLY — SOLVED ANSWERS — do not forward to student</p>');
          });
        }
        if (kind !== "Schedule") {
          await page.evaluate(({ questions, answers, parent }) => {
            const normalized = (text) => text.replace(/\s+/g, " ").trim();
            const plain = (html) => {
              const div = document.createElement("div");
              div.innerHTML = html;
              return normalized(div.textContent);
            };
            const questionNodes = [...document.querySelectorAll(parent ? ".key-question" : "[data-question]")];
            if (questionNodes.length !== questions.length) throw new Error("Question count mismatch");
            questions.forEach((question, index) => {
              if (!normalized(questionNodes[index].textContent).includes(plain(question.q))) {
                throw new Error(`Original question mismatch: ${index + 1}`);
              }
            });
            if (parent) {
              const answerNodes = [...document.querySelectorAll(".key-answer")];
              if (answerNodes.length !== answers.length) throw new Error("Answer count mismatch");
              answers.forEach((answer, index) => {
                if (!normalized(answerNodes[index].textContent).includes(plain(answer))) {
                  throw new Error(`Solved answer mismatch: ${index + 1}`);
                }
              });
            }
          }, { questions: content.sections[0].qs, answers: content.key, parent: kind === "Parent_Key" });
        }
        await page.evaluate(async () => {
          await document.fonts.load("11px Mukta", "व्याकरण");
          await document.fonts.ready;
        });
        const audit = await page.evaluate(() => ({
          tasks: document.querySelectorAll("[data-sample-task]").length,
          questions: document.querySelectorAll("[data-question]").length,
          answers: document.querySelectorAll("[data-answer]").length,
          overflow: document.body.scrollWidth > 696,
        }));
        assert.equal(audit.overflow, false);
        if (kind === "Schedule") {
          assert.equal(audit.tasks, day.ts.length);
          assert.equal(audit.questions + audit.answers, 0);
        } else {
          assert.equal(audit[kind === "Student_Test" ? "questions" : "answers"], content.key.length);
          if (kind === "Student_Test") assert.equal(audit.answers, 0);
        }
        const filename = `${DATE}_${kind}.pdf`;
        const bytes = await page.pdf({
          path: path.join(output, filename), format: "A4", preferCSSPageSize: true, printBackground: true,
          displayHeaderFooter: true, headerTemplate: "<span></span>",
          footerTemplate: `<div style="font-size:8px;width:100%;text-align:center">LOCAL SAMPLE | ${DATE} | ${kind} | <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
        });
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
        let pdfText = "";
        for (let n = 1; n <= pdf.numPages; n++) {
          const pdfPage = await pdf.getPage(n);
          const pageText = (await pdfPage.getTextContent()).items.map((item) => item.str || "").join(" ");
          assert.ok(pageText.trim().length > 40, `Blank PDF page: ${filename} ${n}`);
          pdfText += pageText;
        }
        assert.ok(pdfText.includes(kind === "Schedule" ? "Swimming" : tests[0].id));
        if (kind === "Schedule") assert.ok(pdfText.includes("10:00") && pdfText.includes("6:45"));
        if (kind === "Student_Test") assert.ok(!pdfText.includes("Expected answer / marking points"));
        if (kind === "Parent_Key") assert.ok(pdfText.includes("Expected answer / marking points"));
        results[kind] = { filename, pages: pdf.numPages, ...audit };
        await pdf.destroy();
      } finally {
        fs.unlinkSync(temporary);
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  const preview = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>13 October · Daily sharing sample</title><style>
    body{font:16px/1.55 "Segoe UI",sans-serif;background:#f5f7fb;color:#18213a;max-width:920px;margin:24px auto;padding:0 16px}
    section{background:white;border:1px solid #ddd;border-radius:12px;padding:18px;margin:16px 0}a,button{display:inline-block;padding:10px;margin:4px;border:1px solid #345;border-radius:8px;background:white;color:#234;font:inherit;cursor:pointer}textarea{width:100%;box-sizing:border-box;min-height:520px;font:15px/1.6 "Segoe UI",sans-serif}.warn{background:#fff2d6;padding:12px}h1{font-size:26px}
    dialog{max-width:650px;width:90%;border:1px solid #345;border-radius:12px}dialog::backdrop{background:#0006}dialog textarea{min-height:180px}.primary{background:#203f83;color:white;border-color:#203f83}
    </style></head><body><h1>13 October · Daily sharing SAMPLE</h1><p class="warn">Local sample. Koi automatic message send nahi hota; hosting/automation nahi hai. Main dashboard unchanged.</p>
    <section><button class="primary" id="share-schedule">Share schedule — Telegram / WhatsApp</button><p role="status" id="share-status"></p><p>App/group choose karein, phir app mein final Send. Supported system share mein schedule PDF bhi attach hoga; web fallback mein PDF manually attach karein. Test aur solved key is button se share nahi hote.</p></section>
    <dialog id="share-dialog" aria-labelledby="share-title"><h2 id="share-title">Schedule share karein</h2><p id="share-help">System sharing available nahi hai. WhatsApp mein text ready khulega. Telegram web ke liye text copy hoga: group kholkar Ctrl+V, phir Send.</p>
      <a id="whatsapp-share" target="_blank" rel="noopener noreferrer">WhatsApp — ready message</a>
      <button id="telegram-share">Telegram — copy &amp; open</button>
      <a href="${results.Schedule.filename}" download="${results.Schedule.filename}">Schedule PDF save / attach</a>
      <p>PDF web links se auto-attach nahi hota. Parent test/key alag hi rakhein.</p>
      <p role="status" id="share-fallback-status"></p><textarea id="share-text" readonly aria-label="Full schedule to share">${escape(message)}</textarea>
      <button id="close-share">Close</button>
    </dialog>
    <section><h2>Student / family group</h2><p>Schedule/topics hi raat ko student group mein. Actual questions aur answers nahi.</p><a target="_blank" rel="noopener" href="${results.Schedule.filename}">Schedule PDF · ${results.Schedule.pages} pages</a><a href="${DATE}_Schedule_Message.txt">Message text file</a></section>
    <section><h2>Parent only · raat ko ready rakhein</h2><p>Student test PDF agle din <b>3:30 PM</b> par dena. Solved key parent ke paas alag. Ye separation hai, password protection nahi.</p><a target="_blank" rel="noopener" href="${results.Student_Test.filename}">Student test · ${results.Student_Test.pages} pages</a><a target="_blank" rel="noopener" href="${results.Parent_Key.filename}">Solved parent key · ${results.Parent_Key.pages} page</a></section>
    ${parts.map((part, index) => `<section><h2>Copy message ${index + 1}/${parts.length}</h2><button data-copy="part-${index}">Copy this part</button><p role="status" id="status-${index}"></p><textarea readonly id="part-${index}" aria-label="Schedule message part ${index + 1}">${escape(`13 Oct schedule ${index + 1}/${parts.length}\n\n${part}`)}</textarea></section>`).join("")}
    <script>
    const shareDialog=document.getElementById('share-dialog');
    const shareText=document.getElementById('share-text');
    const shareStatus=document.getElementById('share-status');
    document.getElementById('whatsapp-share').href='https://wa.me/?text='+encodeURIComponent(shareText.value);
    document.getElementById('close-share').addEventListener('click',()=>shareDialog.close());
    document.getElementById('share-schedule').addEventListener('click',async()=>{
      if(!navigator.share){shareStatus.textContent='Web sharing fallback khula; final Send app mein.';shareDialog.showModal();return;}
      let data={title:'Vyom — 13 October schedule',text:shareText.value};
      const bytes=Uint8Array.from(atob('${fs.readFileSync(path.join(output, results.Schedule.filename)).toString("base64")}'),c=>c.charCodeAt(0));
      const file=new File([bytes],'${results.Schedule.filename}',{type:'application/pdf'});
      if(navigator.canShare && navigator.canShare({...data,files:[file]}))data={...data,files:[file]};
      try{
        await navigator.share(data);
        shareStatus.textContent=data.files?'Schedule text/PDF app ko diya; actual Send app mein confirm karein.':'Schedule text app ko diya; PDF manually attach karein. Actual Send app mein confirm karein.';
      }catch(error){
        if(error.name==='AbortError'){shareStatus.textContent='Share cancel hua ya app target unavailable. Dobara Share karein; zaroorat ho to neeche Copy buttons use karein.';return;}
        shareStatus.textContent='System share nahi hua: '+error.message+'. Web fallback use karein.';
        document.getElementById('share-help').textContent='System share failed. WhatsApp ready text khulega; Telegram mein copied text Ctrl+V karein.';
        shareDialog.showModal();
      }
    });
    document.getElementById('telegram-share').addEventListener('click',async()=>{
      const status=document.getElementById('share-fallback-status');
      const opened=window.open('https://web.telegram.org/','_blank');
      if(opened)opened.opener=null;
      const popupNote=opened?'Telegram tab khula. ':'Popup blocked; web.telegram.org manually kholein. ';
      try{
        if(!navigator.clipboard)throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(shareText.value);
        status.textContent=popupNote+'Schedule copied: group choose karke Ctrl+V, phir Send. PDF manually attach karein.';
      }catch(error){
        shareText.focus();shareText.select();
        status.textContent=popupNote+'Copy nahi hua: '+error.message+'. Selected text ko Ctrl+C; Telegram group mein Ctrl+V, phir Send.';
      }
    });
    document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const area=document.getElementById(button.dataset.copy);const status=document.getElementById(button.dataset.copy.replace('part-','status-'));try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(area.value);status.textContent='Copied. Telegram/WhatsApp mein manually paste karein.';}catch(error){area.focus();area.select();status.textContent='Automatic copy nahi hua: '+error.message+'. Selected text ko Ctrl+C se copy karein.';}}));
    </script></body></html>`;
  fs.writeFileSync(path.join(output, "Sample_Preview.html"), preview);
  fs.writeFileSync(path.join(output, "sample-checks.json"), JSON.stringify({ date: DATE, taskCount: day.ts.length, testId: tests[0].id, messageParts: parts.length, results, sent: false }, null, 2));
  console.log(JSON.stringify({ output, tasks: day.ts.length, questions: content.key.length, messageParts: parts.length, results, sent: false }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
