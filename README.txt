VYOM - CLASS 9 PLANNER (NDPS 2026-27)

UPDATED PLAN: 12 October 2026 se 17 March 2027.
Annual exams 1-17 March par fixed hain. Kickoff setup ko dated evening
slots mein spread kiya hai; December review merge karke preparation ko
annual exams se pehle fit kiya hai.

1_Planner\Vyom_Planner_offline_copy.html
  Updated planner. Chrome mein Ctrl+O dabakar ye HTML file select karein.
  Ticks isi computer ke browser mein save hote hain.
  VS Code ka integrated browser Google Chrome se alag hai.
  Claude Artifact is local update se automatically update nahi hota.

WEEK-WISE PRINT PACKS
  Dashboard par "Week-wise print PDFs" mein current week aur next week
  ke buttons hain. Sunday ko next Monday-Sunday ka student pack pehle
  dikhta hai. "Saare 23 hafton ke PDFs" se koi bhi hafta khol sakte hain.
  Hafta aur Parent tabs mein selected week ke print links bhi hain.
  PDFs Chrome ke native viewer mein khulti hain, bina internet ke:
  Ctrl+P = print; Ctrl+S / download icon = save.

5_Weekly_Packs
  23 student PDFs: weekly overview, har din ke poore tasks + tick boxes,
  matching daily/weekly/mock test questions, answer likhne ke liye ruled
  space, extra answer sheet, graph/diagram sheet aur week-end review.
  Parent_Answer_Keys: 23 alag parent PDFs. Har key me matching original
  question ke neeche uska solved answer aur marking points hain. Student
  pack ke saath ye keys share/print na dein.
  Parent links collapsed "Parent only" section mein hain; password lock
  nahi hai. Tests mein diya Test ID questions/key ko match karta hai.
  Student PDF ka page count dashboard par diya hai; double-sided print
  kiya ja sakta hai. Parent key ko screen par dekhna bhi kaafi hai.
  Last week 15-21 Mar ka pack sirf 15-17 Mar ke tasks rakhta hai.
  School ki official exam date sheet/subject order abhi confirm hona hai;
  school papers ki solved keys in packs mein invent nahi ki gayi hain.

EVENING TIMINGS (12 Oct correction)
  Aaj tab aur har daily print page mein 6:20 PM ke baad ka routine hai:
  6:20-7:00 snack/aaram + swimming tayyari/travel;
  7:00-9:00 swimming; 9:00-9:30 wapas/fresh/dinner;
  9:30-9:45 bag/uniform/next-day tayyari; 9:45-10:00 relax;
  10:00 PM-6:30 AM sleep. Travel/dinner zyada time le to parent adjust karein.
  Kickoff ke 195-minute untimed setup ko 13 school-plan days par
  15-minute dated slots mein spread kiya hai (12-30 Oct).
  Un dinon 6:20-6:35 setup aur 6:35-7:00 snack/tayyari/travel hai.
  Regular study, Sanskrit, test dates, swimming aur sleep nahi hataye.
  Routine study-task ticks se alag hai. Purane moved setup ticks archive
  mein preserve hote hain, naye setup task ko galti se complete nahi maante.

COURSE COVERAGE
  Planner ke Chapters tab me Old course, New course aur mixed chapters ko
  alag filter karein. Har chapter ke "Topic-by-topic planned blocks" kholkar
  dates, study/revision tasks aur Aaj tab ke completion ticks dekhein.
  Syllabus status ko school ki confirmed chapter list se update karein.
  Sanskrit ke 11 Path aur Parishisht pages 1–37 ke 5 tracked ranges shamil
  hain. Annual exam inclusion school se confirm hone tak Pending hai.

2_Books
  Saari subject books bachakar rakhi hain.

First Term Retest Date Sheet 9-12.pdf
  School ki date sheet bachakar rakhi hai.

OLD PROGRAMME REMOVED
  Purani daily tally, test papers, daily sheets, answer keys aur
  complete-system PDFs user ki confirmation par hata di gayi hain.
  3_Test_Papers aur 4_Daily_Sheets abhi khaali hain.
  Updated planner mein purani deleted PDFs ke links nahi hain.
  Naye dated weekly packs 5_Weekly_Packs mein generate ho chuke hain.

_system\planner_generator_backup.zip
  Source backup aur updated plan bachakar rakha hai.

_system\weekly
  Weekly PDF generator, reusable source question bank aur verification.
  Existing 81 daily tests aur 29 papers ko updated dates se match kiya hai.
  PowerShell mein dobara generate karne ke liye:
    Set-Location -LiteralPath 'E:\Vyom Class 9 Planner\_system\weekly'
    npm.cmd run build
    npm.cmd run verify
  Dependencies missing hon to pehle npm.cmd ci chalayein.
  Chrome/Edge installed hona chahiye. Optional VYOM_BROWSER_PATH se
  alternate installed browser executable select kar sakte hain.
  Build updated HTML planner ko source maanta hai; source zip ke purane
  gen.py se plan regenerate na karein, warna rescheduling revert hogi.
  Original question bank badle to export_bank.py se JSON dobara export
  karein, phir build aur verify karein (Python 3.12+, no extra packages).

TELEGRAM
  Purane schedule ka automatic send paused hai, taaki galat dates
  ya deleted PDFs na bheje jaayen. Abhi approved workflow local dashboard
  se manual copy/forward hai; auto-send dobara enable nahi kiya gaya.
  Telegram setup aur connection-test options abhi available hain.

DAILY SHARING WORKFLOW (Dashboard & Aaj Tab)
  Main offline planner dashboard aur Aaj tab par "Share schedule" button
  sabhi 157 dinon ke liye integrated hai:
  - Dashboard tab: "Share schedule (WhatsApp / Telegram)" button se aaj ka
    ya kal ka schedule turant share kar sakte hain.
  - Aaj tab: Har din ke date picker ke saath "Share schedule" button hai,
    jisse kisi bhi din ka complete schedule khul jata hai.
  - Quick Toggles: "Aaj" aur "Kal" buttons se shaam ko agle din ka plan
    ek click mein taiyar ho jata hai. Date picker se kisi bhi specific date
    ka schedule select kar sakte hain.
  - Safe Sharing: Student message mein sirf date, timetable, har task ka
    time slot (AM/PM), descriptions, parent checkpoints aur evening routine
    hoti hai. Actual test questions aur solved keys is message mein nahi hoti.
  - Parent Links: Dialog ke andar collapsed section mein us hafte ka
    Weekly Student Pack aur Parent Answer Key ka offline link diya hai.
  - Native & Web Sharing:
    • Phone/Supported OS: "Share via App" se native WhatsApp/Telegram picker
      khulta hai.
    • WhatsApp: Click karte hi WhatsApp Web / App mein pre-filled schedule text
      khulta hai; sirf Vyom/family group select karke Send dabayein.
    • Telegram: 1 click mein full text clipboard par copy hota hai aur
      Telegram Web khulta hai; group mein Ctrl+V karke Send karein.
    • Copy Text: Pure message ko clipboard par copy karta hai.

MANUAL DAILY SHARING SAMPLE
  6_Daily_Share_Sample\2026-10-13\Sample_Preview.html mein 13 October ka
  detailed local preview reference aur test artifacts uplabdh hain:
  - 2026-10-13_Schedule_Message.txt & 2026-10-13_Schedule.pdf (student copy)
  - 2026-10-13_Student_Test.pdf (ruled answer space, test time par student ko dein)
  - 2026-10-13_Parent_Key.pdf (solved answer key, sirf parent ke liye)
