const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..", "..");
const PLANNER = path.join(ROOT, "1_Planner", "Vyom_Planner_offline_copy.html");
const OUTPUT = path.join(ROOT, "5_Weekly_Packs");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KIND = { old: "Old revision", new: "Naya topic", rev: "Revision", test: "Test", recall: "Recall", fix: "Correction", plan: "Planning" };
const SANSKRIT_UNITS = [
  { id: "SK1", name: "Path 1 · अहं नमामि", file: "01 Path 1.pdf", kind: "lesson" },
  { id: "SK2", name: "Path 2 · मातृभूमिः", file: "02 Path 2.pdf", kind: "lesson" },
  { id: "SK3", name: "Path 3 · नद्यः", file: "03 Path 3.pdf", kind: "lesson" },
  { id: "SK4", name: "Path 4 · नीतिवचनानि", file: "04 Path 4.pdf", kind: "lesson" },
  { id: "SK5", name: "Path 5 · दानवीरः कर्णः", file: "05 Path 5.pdf", kind: "lesson" },
  { id: "SK6", name: "Path 6", file: "06 Path 6.pdf", kind: "lesson" },
  { id: "SK7", name: "Path 7 · विद्याभूमिम्", file: "07 Path 7.pdf", kind: "lesson" },
  { id: "SK8", name: "Path 8 · विलस्य वाणी न कदापि मे श्रुता", file: "08 Path 8.pdf", kind: "lesson" },
  { id: "SK9", name: "Path 9", file: "09 Path 9.pdf", kind: "lesson" },
  { id: "SK10", name: "Path 10 · सहजः स्वास्थ्यलाभः", file: "10 Path 10.pdf", kind: "lesson" },
  { id: "SK11", name: "Path 11 · आर्यभटः", file: "11 Path 11.pdf", kind: "lesson" },
  { id: "SKA1", name: "परिशिष्ट · Pages 1–10", file: "12 Parishisht (Appendix) pages 1-10.pdf", kind: "appendix" },
  { id: "SKA2", name: "परिशिष्ट · Pages 11–20", file: "12 Parishisht (Appendix) pages 11-20.pdf", kind: "appendix" },
  { id: "SKA3", name: "परिशिष्ट · Pages 21–28", file: "12 Parishisht (Appendix) pages 21-28.pdf", kind: "appendix" },
  { id: "SKA4", name: "परिशिष्ट · Pages 29–32", file: "12 Parishisht (Appendix) pages 29-32.pdf", kind: "appendix" },
  { id: "SKA5", name: "परिशिष्ट · Pages 33–37", file: "12 Parishisht (Appendix) pages 33-37.pdf", kind: "appendix" },
];

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function addDays(iso, count) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function monday(iso) {
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}
function dateLabel(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function shortDate(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
function originalDate(iso) {
  if (iso === "2026-10-12") return "2026-10-10";
  return iso >= "2026-10-13" && iso <= "2026-12-20" ? addDays(iso, -1) : iso;
}
function loadPlan(html = fs.readFileSync(PLANNER, "utf8")) {
  const match = /<script id="plan" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("Planner JSON not found");
  const plan = JSON.parse(match[1]);
  if (!plan.sub.SK) addSanskritCoverage(plan);
  return addEveningRoutine(plan);
}
function addEveningRoutine(plan) {
  if (plan.meta.eveningRevision === 1) return plan;
  const first = plan.days[0];
  const setup = first.ts.slice(6);
  if (first.d !== "2026-10-12" || setup.length !== 5 ||
      setup.map((task) => task.t).join(",") !== "45 min,45 min,30 min,45 min,30 min") {
    throw new Error("Kickoff setup changed; check the schedule before rescheduling it.");
  }
  const parts = [
    [0, "Mistakes notebook banao; har subject ke liye 2 page rakho."],
    [4, "19 October ke pehle Maths weekly test ka syllabus aur student pack dekho."],
    [4, "Agle week ke tasks aur test ki tayyari parent ke saath check karo."],
    [0, "Formula / keywords notebook banao; subjects ke sections taiyar karo."],
    [0, "Dono notebooks ke index aur chapter headings poore karo."],
    [3, "Rewards tab mein Stage 1 ka target parent ke saath dekho."],
    [3, "Stage 1 ke gifts aur conditions parent ke saath final karo."],
    [3, "Agreed rewards aur conditions notebook mein likho."],
    [1, "Formula notebook: Maths Ch 1, 2, 3 ke formulas/identities likho."],
    [1, "Formula notebook: Maths Ch 4 aur 6 ke formulas/identities likho."],
    [1, "Formula notebook: Maths Ch 7 aur 8; pehle likhe formulas check karo."],
    [2, "Aaj ka chhoota kaam: sabse zaroori 1 task ka 15-minute correction."],
    [2, "Aaj ka chhoota kaam: agla zaroori task; baaki backlog parent review mein rakho."],
  ];
  const days = plan.days.filter((day) => day.ty === "school").slice(0, parts.length);
  if (days.length !== parts.length) throw new Error("Not enough days for kickoff setup slots");
  plan.meta.kickoffStateMigration = { date: first.d, keepTaskCount: 6 };
  first.ts = first.ts.slice(0, 6);
  first.lb = "Kickoff Monday";
  parts.forEach(([source, description], index) => {
    days[index].ts.push({
      ...setup[source], t: "6:20–6:35", x: description,
      setup: true, setupPart: index + 1,
    });
  });
  plan.eveningRoutine = [
    { t: "6:20–7:00", x: "Snack + aaram; swimming ki tayyari aur travel. Setup wale din 6:20–6:35 ka task, phir 6:35–7:00 snack/tayyari/travel." },
    { t: "7:00–9:00", x: "Swimming" },
    { t: "9:00–9:30", x: "Wapas aana + fresh hona + dinner" },
    { t: "9:30–9:45", x: "School bag, uniform aur agle din ki tayyari" },
    { t: "9:45–10:00", x: "Relax; screen band, sone ki tayyari. Naya study block nahi." },
    { t: "10:00 PM", x: "Sleep; 6:30 AM uthna (8.5 ghante). Pending kaam ke liye neend mat kaato." },
  ];
  plan.meta.eveningRevision = 1;
  return plan;
}
function addSanskritCoverage(plan) {
  if (plan.sub.SK) return plan;
  const slots = plan.days.flatMap((day) => day.ts.map((task, index) => ({ day, index, task })))
    .filter(({ day, task }) => day.d < "2027-03-01" && task.s === "ALL" && task.k === "recall" &&
      ["6:00–6:20", "5:00–5:20", "30 min", "6:45–7:10"].includes(task.t))
    .sort((a, b) => a.day.d.localeCompare(b.day.d) || a.index - b.index);
  const used = new Set();
  function takeSlot(after, includeMorning = false) {
    const slot = slots.find((candidate) => candidate.day.d >= after &&
      (includeMorning || candidate.task.t !== "6:45–7:10") &&
      !used.has(`${candidate.day.d}:${candidate.index}`));
    if (!slot) throw new Error(`No available recall block for Sanskrit on/after ${after}`);
    used.add(`${slot.day.d}:${slot.index}`);
    return slot;
  }
  function assign(slot, subject, kind, description, chapter) {
    const previous = slot.task;
    slot.day.ts[slot.index] = { ...previous, s: subject, k: kind, x: description, c: chapter || null };
  }
  function studyDescription(unit, exercise = false) {
    const reference = `Source: 2_Books/Sanskrit/${unit.file}`;
    if (unit.kind === "appendix") {
      return exercise
        ? `${unit.name} — poore diye gaye niyam, udaharan aur abhyas hal karo; book se jaanch kar galti sudharo. ${reference}`
        : `${unit.name} — har page padho; sabhi vyakaran vishay, roop, udaharan aur shabdon ko notebook me likho. ${reference}`;
    }
    return exercise
      ? `${unit.name} — poore path ke prashn/abhyas, shabdarth, anuvad aur path me diye vyakaran ka likhit abhyas; book se check. ${reference}`
      : `${unit.name} — poora path padho; har anuchhed/shlok, kathin shabdarth, anuvad aur mukhya bhav ko book se samjho. ${reference}`;
  }
  plan.sub.SK = "Sanskrit";
  plan.meta.pending = plan.meta.pending || [];
  plan.meta.pending.push("Sanskrit ke 11 paths aur Parishisht pages 1–37 annual syllabus me shamil hain ya nahi — school se confirm karein");
  plan.meta.version = "v4 · 2026-10-12 · Sanskrit coverage";
  const study = [];
  let nextStudy = plan.meta.start;
  for (const unit of SANSKRIT_UNITS) {
    const first = takeSlot(nextStudy);
    assign(first, "SK", "new", studyDescription(unit), unit.id);
    let second = first;
    if (unit.kind === "lesson") {
      second = takeSlot(addDays(first.day.d, 1));
      assign(second, "SK", "new", studyDescription(unit, true), unit.id);
    }
    nextStudy = addDays(first.day.d, 3);
    study.push({ unit, first, second });
  }
  for (const item of study) {
    const spaced = [takeSlot(addDays(item.second.day.d, 7)), takeSlot(addDays(item.second.day.d, 21))];
    spaced.forEach((slot, index) => assign(
      slot, "SK", "rev",
      `${item.unit.name} — ${index ? "21-day delayed recheck" : "7-day spaced revision"}: book band karke shabdarth, roop/niyam, anuvad aur prashn yaad se karo; phir source PDF se check. Source: 2_Books/Sanskrit/${item.unit.file}`,
      item.unit.id,
    ));
    item.spaced = spaced;
  }
  const fullRevisionDates = ["2027-01-18", "2027-01-25", "2027-02-01", "2027-02-08", "2027-02-15", "2027-02-22"];
  for (let index = 0; index < SANSKRIT_UNITS.length; index += 3) {
    const group = SANSKRIT_UNITS.slice(index, index + 3);
    const slot = takeSlot(fullRevisionDates[Math.floor(index / 3)], true);
    const names = group.map((unit) => unit.name);
    assign(
      slot, "SK", "rev",
      `Sanskrit full-course revision — ${names.join(" · ")}: har topic ka book-band oral + written recall, ek mixed exercise, phir source PDFs se check.`,
      null,
    );
    for (const item of study.filter(({ unit }) => group.includes(unit))) item.fullRevision = slot;
  }
  for (const { unit, first, second, spaced, fullRevision } of study) {
    plan.ch.push({
      id: unit.id, s: "SK", name: unit.name, st: "new",
      d1: first.day.d, d2: second.day.d, dn: unit.kind === "lesson" ? 4 : 3,
      dr: fullRevision.day.d, dl: spaced.map((slot) => slot.day.d), plan: second.day.d,
    });
  }
  return plan;
}
function buildWeeks(plan) {
  const groups = new Map();
  for (const day of plan.days) {
    const start = monday(day.d);
    if (!groups.has(start)) groups.set(start, { start, end: addDays(start, 6), days: [], tests: [] });
    groups.get(start).days.push(day);
  }
  for (const test of plan.tests) {
    const week = groups.get(monday(test.d));
    if (!week) throw new Error(`Test is outside the plan: ${test.id}`);
    week.tests.push(test);
  }
  return [...groups.values()];
}
function testContent(test, bank) {
  const date = originalDate(test.d);
  if (test.kind === "Daily test") {
    const daily = bank.daily[date];
    if (!daily) throw new Error(`Daily test bank missing: ${test.id} (source ${date})`);
    if (daily.topics !== test.syl.join(" · ")) throw new Error(`Daily topics mismatch: ${test.id}`);
    return {
      title: "Daily Test",
      topics: daily.topics,
      instructions: ["Book band. Har answer mein steps/reason likho. Calculator allowed nahi hai."],
      sections: [{ name: "Daily questions", qs: daily.qs.map(([m, q]) => ({ m, q })) }],
      key: daily.key,
    };
  }
  const paper = bank.papers[date];
  if (!paper) throw new Error(`Test paper missing: ${test.id} (source ${date})`);
  if (paper.marks !== test.max) throw new Error(`Paper marks mismatch: ${test.id}`);
  return { title: paper.title, topics: paper.sub, instructions: paper.ins, sections: paper.sections, key: paper.key };
}
function fontFace(family, file, weight, range = "") {
  const url = pathToFileURL(path.join(__dirname, "node_modules", "@fontsource", file)).href;
  return `@font-face{font-family:${family};src:url("${url}");font-weight:${weight};${range ? `unicode-range:${range};` : ""}}`;
}
function styles() {
  return [400, 700].map((weight) =>
    fontFace("Mukta", `mukta/files/mukta-latin-${weight}-normal.woff2`, weight) +
    fontFace("Mukta", `mukta/files/mukta-devanagari-${weight}-normal.woff2`, weight, "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20B9,U+25CC") +
    fontFace("Baloo", `baloo-2/files/baloo-2-latin-${weight}-normal.woff2`, weight) +
    fontFace("Baloo", `baloo-2/files/baloo-2-devanagari-${weight}-normal.woff2`, weight, "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20B9,U+25CC")
  ).join("") + `
    @page{size:A4;margin:13mm 13mm 16mm}
    *{box-sizing:border-box}
    body{font-family:Mukta,"Segoe UI",sans-serif;color:#161616;font-size:11pt;line-height:1.35;margin:0}
    h1,h2,h3{font-family:Baloo,Mukta,sans-serif;line-height:1.25;margin:0 0 5mm}
    h1{font-size:23pt}h2{font-size:17pt}h3{font-size:12pt;break-after:avoid}
    p{margin:2mm 0}.small{font-size:9pt;color:#454545}.tag{font-size:9pt;border:1px solid #777;padding:1mm 3mm;display:inline-block}
    .section{break-before:page}.section:first-child{break-before:auto}
    .head{border-bottom:1.5px solid #222;padding-bottom:3mm;margin-bottom:4mm}
    .summary,.tasks{width:100%;border-collapse:collapse;margin-top:4mm}
    th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ccc;padding:2mm 1.5mm}
    th{background:#eee;font-size:10pt}.summary td{font-size:10pt}
    .tasks td{font-size:10pt}.tasks .time{width:23mm;font-size:9pt}.tasks .subject{width:19mm;font-weight:700}
    .tick{display:inline-block;width:3.6mm;height:3.6mm;border:1.2px solid #333;vertical-align:middle}
    .tasks tr{break-inside:avoid}.tasks .check{width:6mm}.tasks .kind{font-size:8.5pt;color:#444}
    .fields{display:flex;gap:5mm;margin:4mm 0;font-size:10pt}.fields span{flex:1}
    .note{border:1px solid #666;padding:3mm;margin:4mm 0}
    .lines{margin-top:2mm}.ruled-line{height:7mm;border-bottom:.4pt solid #aaa}
    .question{break-inside:avoid;margin:0 0 4mm}.qheading{display:grid;grid-template-columns:8mm 1fr 11mm;gap:2mm}
    .long-question{break-inside:auto}.long-question .qheading{display:block}.long-question .qnum{float:left;margin-right:3mm}.long-question .marks{display:block;text-align:left}
    .answer-box{break-inside:avoid}
    .qnum{font-weight:700}.marks{text-align:right;font-weight:700;font-size:10pt}
    .options{display:grid;grid-template-columns:1fr 1fr;gap:1mm 3mm;margin-top:2mm;font-size:10pt}.options.one{grid-template-columns:1fr}
    .or{text-align:center;font-weight:700;margin:2mm}.passage{border-left:2px solid #555;background:#f5f5f5;padding:2mm 3mm;margin:2mm 0}
    table.t{border-collapse:collapse;margin:2mm 0}table.t td,table.t th{border:1px solid #555;padding:1mm 2mm}
    .key{break-inside:avoid;margin-bottom:3mm;display:grid;grid-template-columns:11mm 1fr;gap:2mm}
    .key-question{border-bottom:1px solid #bbb;padding-bottom:2mm;margin-bottom:2mm}
    .key-answer{padding-bottom:1mm}
    .review td{height:10mm}.graph{height:110mm;width:180mm;max-width:100%;border:1px solid #777;margin:3mm 0}.graph svg{width:100%;height:100%;display:block}
    sup,sub{line-height:0}
  `;
}
function wrapper(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${styles()}</style></head><body>${body}</body></html>`;
}
function header(week, title, parent = false) {
  return `<div class="head"><span class="tag">${parent ? "PARENT ONLY — SOLVED ANSWER KEY" : "STUDENT COPY — NO SOLVED ANSWERS"}</span><h1 style="margin-top:4mm">${escape(title)}</h1><p><b>${shortDate(week.start)} – ${shortDate(week.end)} ${week.end.slice(0, 4)}</b> · Monday–Sunday · NDPS Class 9</p></div>`;
}
function answerLines(count) {
  return `<div class="lines">${'<div class="ruled-line"></div>'.repeat(count)}</div>`;
}
function graphPaper() {
  let lines = "";
  for (let x = 5; x < 180; x += 5) lines += `<line x1="${x}" y1="0" x2="${x}" y2="110"/>`;
  for (let y = 5; y < 110; y += 5) lines += `<line x1="0" y1="${y}" x2="180" y2="${y}"/>`;
  return `<div class="graph"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110" preserveAspectRatio="none"><g stroke="#aaa" stroke-width="0.15">${lines}</g></svg></div>`;
}
function studentHtml(week, plan, bank) {
  const subject = (id) => id === "ALL" ? "Sab" : plan.sub[id];
  const count = week.days.reduce((n, day) => n + day.ts.length, 0);
  let html = `<section class="section">${header(week, "Vyom · Is hafte ka print pack")}
    <p>Naam: Vyom &nbsp; | &nbsp; Week tasks: ${count} &nbsp; | &nbsp; Scheduled tests: ${week.tests.length}</p>
    <div class="note"><b>Sunday print handover:</b> ${dateLabel(addDays(week.start, -1))}. Agle Monday se is pack ke daily pages follow karo.
    Roz tasks tick karo; tests par naam/date aur answers likho. Answer key parent ke paas rahegi.</div>
    <table class="summary"><thead><tr><th>Din / date</th><th>Kaam</th><th>Tests / focus</th></tr></thead><tbody>
    ${week.days.map((day) => {
      const tests = week.tests.filter((test) => test.d === day.d);
      return `<tr><td>${dateLabel(day.d)}</td><td>${day.ts.length} tasks</td><td>${tests.length ? tests.map((test) => `${escape(subject(test.s))} ${escape(test.kind)} (${test.max} marks)`).join("<br>") : escape(day.ph)}</td></tr>`;
    }).join("")}</tbody></table>
    <p class="small">Schedule ${escape(plan.meta.version)}. Daily blocks original shifted routine ke mutabik hain; asli weekday date har page par di hai.</p>
    ${week.days.length < 7 ? '<p class="note">Partial week: sirf planner mein maujood dates ke tasks hain; baaki din ka kaam invent nahi kiya gaya.</p>' : ""}
    <p class="small">School ki subject-wise exam date sheet/paper pattern abhi confirm karna baaki hai. Exam-period sample-section tasks ko official school papers mat samjhein.</p></section>`;
  for (const day of week.days) {
    html += `<section class="section day-plan" data-day="${day.d}"><div class="head"><h2>${dateLabel(day.d)}</h2><p>${escape(day.ph)}${day.lb ? ` · ${escape(day.lb)}` : ""}</p></div>
      <table class="tasks"><thead><tr><th></th><th>Samay</th><th>Subject</th><th>Aaj kya karna hai</th></tr></thead><tbody>
      ${day.ts.map((task) => `<tr data-task><td class="check"><span class="tick"></span></td><td class="time">${escape(task.t)}</td><td class="subject">${escape(subject(task.s))}</td><td><span class="kind">${escape(KIND[task.k] || task.k)}</span><br>${escape(task.x)}</td></tr>`).join("")}
      </tbody></table><div class="fields"><span>Ho gaye: ____ / ${day.ts.length}</span><span>Homework: ____ min</span><span>Parent sign: __________</span></div>
      <h3 style="margin:4mm 0 1mm">6:20 PM ke baad · evening routine</h3>
      <table class="summary"><tbody>${plan.eveningRoutine.map((slot, index) => {
        const setupDay = day.ts.some((task) => task.setup);
        const time = index === 0 && setupDay ? "6:35–7:00 PM" : `${slot.t}${slot.t.includes("PM") ? "" : " PM"}`;
        const text = index === 0 ? "Snack + aaram; swimming ki tayyari aur travel" : slot.x;
        return `<tr><td>${escape(time)}</td><td>${escape(text)}</td></tr>`;
      }).join("")}</tbody></table>
      <p class="small">Ye routine study-task ticks se alag hai. Agar travel/dinner ka actual time zyada ho, parent routine adjust karein; swimming aur sleep ke beech extra study nahi.</p>
      <p>Aaj kya mushkil laga / chhoota kaam:</p>${answerLines(2)}</section>`;
    for (const test of week.tests.filter((item) => item.d === day.d)) {
      const content = testContent(test, bank);
      let number = 0;
      html += `<section class="section test-paper" data-test="${test.id}"><div class="head"><h2>${escape(content.title)} · ${shortDate(test.d)}</h2><p>${escape(content.topics)}</p><p class="small">Test ID: ${test.id} · ${dateLabel(test.d)}</p></div>
        <div class="fields"><span>Naam: __________</span><span>Samay: ${test.dur} min</span><span>Marks: ____ / ${test.max}</span></div>
        <p><b>Slot:</b> ${escape(test.slot || "Parent se time confirm karein")}</p>
        <div class="note">${content.instructions.map(escape).join("<br>")}${test.kind.startsWith("Mock") ? "<br><b>2-hour section practice:</b> Section A se shuru; bacha hissa agle din untimed. Ye full 3-hour simulation nahi hai." : ""}</div>`;
      for (const section of content.sections) {
        html += `<h3>${escape(section.name)}${section.note ? ` · ${escape(section.note)}` : ""}</h3>`;
        for (const q of section.qs) {
          number++;
          html += `<div class="question${q.m > 5 || q.q.length + (q.or || "").length > 1300 ? " long-question" : ""}" data-question="${test.id}-${number}"><div class="qheading"><span class="qnum">${number}.</span><div>${q.q}
            ${q.opts ? `<div class="options ${q.one ? "one" : ""}">${q.opts.map((option, i) => `<div>(${String.fromCharCode(97 + i)}) ${option}</div>`).join("")}</div>` : ""}
            ${q.or ? `<div class="or">ATHVA / OR</div>${q.or}` : ""}</div><span class="marks">[${q.m}]</span></div>
            <div class="answer-box"><p class="small">Answer space · ${test.id} · Q${number}</p>${answerLines(q.opts ? 1 : Math.max(2, q.m * 2))}</div></div>`;
        }
      }
      html += `<p class="small">Teacher/parent: marks answer key ke mutabik; galti C concept / R recall / K careless / T time.</p></section>`;
    }
  }
  html += `<section class="section"><h2>Extra answer sheet · ${shortDate(week.start)} – ${shortDate(week.end)}</h2><p>Naam: __________ &nbsp; Date: __________ &nbsp; Subject: __________</p><p>Test ID / question number: __________________________</p>${answerLines(24)}</section>
    <section class="section"><h2>Diagram / graph aur Sunday review</h2><p>Test ID / question number: __________________________</p>${graphPaper()}
    <p><b>Is hafte ki 3 galtiyan aur sudhaar:</b></p>${answerLines(6)}<div class="fields"><span>Week tasks: ____ / ${count}</span><span>Parent sign: __________</span></div>
    <p>Agla hafta: sabse zaroori weak topic / pending kaam:</p>${answerLines(3)}</section>`;
  return wrapper(`Vyom Student Week ${week.start}`, html);
}
function parentHtml(week, plan, bank) {
  let html = `<section class="section">${header(week, "Vyom · Parent answer key", true)}
    <div class="note"><b>Vyom ko test se pehle ye PDF mat dena.</b> Student pack mein sirf questions aur blank answer space hai. Is alag parent PDF mein har original question ke saath uska matching solved answer, working aur marking points diye hain; Test ID se student paper match karein.</div>
    <p>Checking: same evening. C = concept, R = recall, K = careless, T = time.</p>
    <p>90%+: short revision. 75–89%: weak-topic practice + retest. Below 75%: topic dobara samjhao; mistakes notebook mein likho.</p>
    <p class="small">Answer keys existing source question banks se li gayi hain; school pattern abhi unconfirmed hai. Alternate valid answers ko marking guidance ke mutabik accept karein.</p>
    <h3>Week score register</h3><table class="summary review"><thead><tr><th>Date / test ID</th><th>Test</th><th>Marks</th><th>Galti / retest</th></tr></thead><tbody>
    ${week.tests.map((test) => `<tr><td>${shortDate(test.d)}<br>${test.id}</td><td>${escape(test.s === "ALL" ? "Daily mixed" : plan.sub[test.s])}<br>${escape(test.kind)}</td><td>____ / ${test.max}</td><td>${test.retest ? `Retest: ${shortDate(test.retest)}` : ""}</td></tr>`).join("")}
    </tbody></table>${!week.tests.length ? '<p class="note">Is week koi scheduled question-bank test nahi hai. School papers / self-chosen sample-section answers is key mein nahi hain. Actual textbook/teacher key se check karein.</p>' : ""}</section>`;
  for (const test of week.tests) {
    const content = testContent(test, bank);
    const questions = content.sections.flatMap((section) => section.qs);
    html += `<section class="section parent-key" data-key="${test.id}"><div class="head"><h2>${escape(content.title)} · Answer key</h2><p>${dateLabel(test.d)} · ${test.max} marks</p><p class="small">Test ID: ${test.id}</p><p>${escape(content.topics)}</p></div>`;
    content.key.forEach((answer, i) => {
      const question = questions[i];
      html += `<div class="key" data-answer="${test.id}-${i + 1}"><b>Q${i + 1}<br>[${question.m}]</b><div>
        <div class="key-question"><b>Question:</b> ${question.q}
        ${question.opts ? `<div class="options ${question.one ? "one" : ""}">${question.opts.map((option, optionIndex) => `<div>(${String.fromCharCode(97 + optionIndex)}) ${option}</div>`).join("")}</div>` : ""}
        ${question.or ? `<div class="or">ATHVA / OR</div>${question.or}` : ""}</div>
        <div class="key-answer"><b>Expected answer / marking points:</b> ${answer}</div></div></div>`;
    });
    html += `<div class="fields"><span>Score: ____ / ${test.max}</span><span>Checked by: __________</span></div><p>Weak topic aur correction:</p>${answerLines(3)}</section>`;
  }
  html += `<section class="section"><h2>Parent Sunday handover checklist</h2><p><span class="tick"></span> Agle Monday–Sunday ka student pack print karke diya.</p>
    <p><span class="tick"></span> Parent solved key alag rakhi; student copy ke saath share nahi ki.</p>
    <p><span class="tick"></span> Pichhle week ka pending kaam aur 3 weak topics review kiye.</p>
    <p><span class="tick"></span> School exam date sheet aur tuition timings se schedule match kiya.</p>
    <p>Agli priority / teacher se poochhna:</p>${answerLines(12)}</section>`;
  return wrapper(`Vyom Parent Keys Week ${week.start}`, html);
}
function browserExecutable() {
  const candidates = [
    process.env.VYOM_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  const executable = candidates.find((file) => fs.existsSync(file));
  if (!executable) throw new Error("Chrome/Edge not found. Set VYOM_BROWSER_PATH to the browser executable.");
  return executable;
}
async function generate() {
  const plan = loadPlan();
  const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "question-bank.json"), "utf8"));
  const weeks = buildWeeks(plan);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Validate every paper before creating files or changing dashboard metadata.
  for (const test of plan.tests) testContent(test, bank);
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.mkdirSync(path.join(OUTPUT, "Parent_Answer_Keys"), { recursive: true });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "vyom-weekly-render-"));
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  const manifest = [];
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 695, height: 1100 });
    await page.route("http://**", (route) => route.abort());
    await page.route("https://**", (route) => route.abort());
    for (const [index, week] of weeks.entries()) {
      const prefix = `${String(index + 1).padStart(2, "0")}_${week.start}_to_${week.end}`;
      const student = `${prefix}_Student.pdf`;
      const parent = `Parent_Answer_Keys\\${prefix}_Parent_Key.pdf`;
      const audit = {};
      for (const [kind, html, file] of [
        ["student", studentHtml(week, plan, bank), student],
        ["parent", parentHtml(week, plan, bank), parent],
      ]) {
        const input = path.join(temporary, `${kind}.html`);
        fs.writeFileSync(input, html);
        await page.goto(pathToFileURL(input).href, { waitUntil: "load" });
        await page.evaluate(async () => {
          await document.fonts.load('11px Mukta', 'व्याकरण');
          await document.fonts.ready;
        });
        const layout = await page.evaluate(() => {
          const max = 260 * 96 / 25.4;
          const blocks = [...document.querySelectorAll(".question:not(.long-question),.answer-box,.key,.tasks tr")];
          return {
            tasks: document.querySelectorAll("[data-task]").length,
            questions: document.querySelectorAll("[data-question]").length,
            answers: document.querySelectorAll("[data-answer]").length,
            tests: [...document.querySelectorAll("[data-test]")].map((item) => item.dataset.test),
            keys: [...document.querySelectorAll("[data-key]")].map((item) => item.dataset.key),
            oversizedBlocks: blocks.filter((item) => item.getBoundingClientRect().height > max).length,
            horizontalOverflow: document.body.scrollWidth > Math.ceil(184 * 96 / 25.4),
            hindiFontLoaded: document.fonts.check('11px Mukta', 'व्याकरण'),
          };
        });
        if (layout.oversizedBlocks || layout.horizontalOverflow || !layout.hindiFontLoaded) throw new Error(`Print layout/font problem: ${week.start} ${kind}: ${JSON.stringify(layout)}`);
        audit[kind] = layout;
        const destination = path.join(OUTPUT, file);
        const staged = `${destination}.new`;
        const bytes = await page.pdf({
          path: staged, format: "A4", preferCSSPageSize: true, printBackground: true,
          displayHeaderFooter: true, headerTemplate: "<span></span>",
          footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#444">${week.start} - ${week.end} | ${kind === "parent" ? "PARENT KEY - keep separate" : "VYOM STUDENT COPY"} | Page <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
        });
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
        layout.pages = pdf.numPages;
        await pdf.destroy();
        fs.renameSync(staged, destination);
      }
      manifest.push({
        start: week.start, end: week.end, firstDay: week.days[0].d, lastDay: week.days.at(-1).d,
        days: week.days.length, tasks: audit.student.tasks, testIds: week.tests.map((test) => test.id),
        questions: audit.student.questions, answers: audit.parent.answers,
        studentPages: audit.student.pages, parentPages: audit.parent.pages,
        student: fileUrl(student), parent: fileUrl(parent), audit,
      });
      console.log(`Week ${index + 1}/${weeks.length}: ${week.start} — ${week.end}; ${audit.student.tasks} tasks, ${week.tests.length} tests.`);
    }
    await page.close();
  } finally {
    await browser.close();
    for (const name of ["student.html", "parent.html"]) {
      const file = path.join(temporary, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(temporary);
  }
  const manifestPath = path.join(OUTPUT, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ version: plan.meta.version, start: plan.meta.start, end: plan.meta.end, weeks: manifest }, null, 2));
  let html = fs.readFileSync(PLANNER, "utf8");
  const data = `<script id="weekly-packs" type="application/json">${JSON.stringify(manifest).replace(/<\//g, "<\\/")}</script>`;
  const old = /<script id="weekly-packs" type="application\/json">[\s\S]*?<\/script>/;
  html = old.test(html) ? html.replace(old, data) : html.replace('<script id="plan"', `${data}\n<script id="plan"`);
  const planData = `<script id="plan" type="application/json">${JSON.stringify(plan).replace(/<\//g, "<\\/")}</script>`;
  const planTag = /<script id="plan" type="application\/json">[\s\S]*?<\/script>/;
  if (!planTag.test(html)) throw new Error("Planner JSON could not be updated");
  html = html.replace(planTag, planData);
  fs.writeFileSync(PLANNER, html);
  console.log(`Generated ${weeks.length * 2} PDFs. Weekly manifest saved and embedded in the offline planner.`);
}
function fileUrl(file) {
  return `../5_Weekly_Packs/${file.replace(/\\/g, "/")}`;
}

module.exports = { ROOT, PLANNER, OUTPUT, loadPlan, buildWeeks, originalDate, testContent, studentHtml, parentHtml, monday, addDays, browserExecutable, SANSKRIT_UNITS, wrapper };
if (require.main === module) generate().catch((error) => { console.error(error); process.exitCode = 1; });
