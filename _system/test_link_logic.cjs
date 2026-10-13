const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync('1_Planner/Vyom_Planner_offline_copy.html', 'utf8');
const pMatch = raw.match(/<script id="plan" type="application\/json">([\s\S]*?)<\/script>/);
const plan = JSON.parse(pMatch[1]);

console.log('Days in plan:', plan.days.length);

const subFolders = {
  M: 'Maths',
  S: 'Science',
  SS: 'SST',
  E: 'English',
  H: 'Hindi',
  SK: 'Sanskrit',
  AI: 'AI'
};

const bookFiles = {
  M: fs.readdirSync('2_Books/Maths').filter(f => f.endsWith('.pdf')),
  S: fs.readdirSync('2_Books/Science').filter(f => f.endsWith('.pdf')),
  SS: fs.readdirSync('2_Books/SST').filter(f => f.endsWith('.pdf')),
  E: fs.readdirSync('2_Books/English').filter(f => f.endsWith('.pdf')),
  H: fs.readdirSync('2_Books/Hindi').filter(f => f.endsWith('.pdf')),
  SK: fs.readdirSync('2_Books/Sanskrit').filter(f => f.endsWith('.pdf')),
  AI: []
};

function getBookLink(chId, s) {
  if (!chId) return null;
  const subFolders = { M: 'Maths', S: 'Science', SS: 'SST', E: 'English', H: 'Hindi', SK: 'Sanskrit' };
  if (!subFolders[s]) return null;
  const files = {
    M: {
      M1: '01 Ch 1 - Orienting Yourself The Use of Coordinates.pdf',
      M2: '02 Ch 2 - Introduction to Linear Polynomials.pdf',
      M3: '03 Ch 3 - The World of Numbers.pdf',
      M4: '04 Ch 4 - Exploring Algebraic Identities.pdf',
      M5: '05 Ch 5 - Im Up and Down, and Round and Round (Circles).pdf',
      M6: '06 Ch 6 - Measuring Space Perimeter and Area.pdf',
      M7: '07 Ch 7 - The Mathematics of Maybe Probability.pdf',
      M8: '08 Ch 8 - Predicting What Comes Next Sequences & Progressions.pdf',
      M9: '09 Ch 9 - Propositions and their Converses.pdf',
      M10: '10 Ch 10 - How Quantities Combine Understanding Data.pdf',
      M11: '11 Ch 11 - The World of Algorithms.pdf',
      M12: '12 Ch 12 - Quadrilaterals.pdf',
      M13: '13 Ch 13 - Two Variables, One Line.pdf',
      M14: '14 Ch 14 - Math of Space Surface Area and Volume.pdf'
    },
    S: {
      S1: '01 Ch 1 - Exploration Entering the World of Secondary Science.pdf',
      S2: '02 Ch 2 - Cell The Building Block of Life.pdf',
      S3: '03 Ch 3 - Tissues in Action.pdf',
      S4: '04 Ch 4 - Describing Motion Around Us.pdf',
      S5: '05 Ch 5 - Exploring Mixtures and their Separation.pdf',
      S6: '06 Ch 6 - How Forces Affect Motion.pdf',
      S7: '07 Ch 7 - Work, Energy, and Simple Machines.pdf',
      S8: '08 Ch 8 - Journey Inside the Atom.pdf',
      S9: '09 Ch 9 - Atomic Foundations of Matter.pdf',
      S10: '10 Ch 10 - Sound Waves Characteristics and Applications.pdf',
      S11: '11 Ch 11 - Reproduction How Life Continues.pdf',
      S12: '12 Ch 12 - Patterns in Life Diversity and Classification.pdf',
      S13: '13 Ch 13 - Earth as a System Energy, Matter, and Life.pdf'
    },
    SS: {
      SS1: '01 Part 1 Ch 1 - Understanding Social Science.pdf',
      SS2: '02 Part 1 Ch 2 - Shaping of the Earths Surface.pdf',
      SS3: '03 Part 1 Ch 3 - Atmosphere and Climate.pdf',
      SS4: '04 Part 1 Ch 4 - Early Humans and Beginning of Civilisation.pdf',
      SS5: '05 Part 1 Ch 5 - State and Society up to 1000 CE.pdf',
      SS6: '06 Part 1 Ch 6 - Democracy.pdf',
      SS7: '07 Part 1 Ch 7 - Elections.pdf',
      SS8: '08 Part 1 Ch 8 - Building Blocks in Economics The Problem of Choice.pdf',
      SS9: '09 Part 1 Ch 9 - The Price Puzzle What Drives the Market.pdf',
      SP1: 'SST Part 2 - Understanding Society (pages 001-077).pdf',
      SP2: 'SST Part 2 - Understanding Society (pages 001-077).pdf',
      SP3: 'SST Part 2 - Understanding Society (pages 001-077).pdf',
      SP4: 'SST Part 2 - Understanding Society (pages 078-154).pdf',
      SP5: 'SST Part 2 - Understanding Society (pages 078-154).pdf',
      SP6: 'SST Part 2 - Understanding Society (pages 078-154).pdf'
    },
    E: {
      E1: '01 Unit 1 - How I Taught My Grandmother to Read.pdf',
      E2: '02 Unit 2 - The Pot Maker.pdf',
      E3: '03 Unit 3 - Winds of Change.pdf',
      E4: '04 Unit 4 - Vitamin-M.pdf',
      E5: '05 Unit 5 - The World of Limitless Possibilities.pdf',
      E6: '06 Unit 6 - Twin Melodies.pdf',
      E7: '07 Unit 7 - Carrier of Words.pdf',
      E8: '08 Unit 8 - Follow That Dream.pdf'
    },
    H: {
      H1: '01 पाठ 1 - दो बैलों की कथा.pdf',
      H2: '02 पाठ 2 - क्या लिखूँ.pdf',
      H3: '03 पाठ 3 - संवादहीन.pdf',
      H4: '04 पाठ 4 - ऐसी भी बातें होती हैं.pdf',
      H5: '05 पाठ 5 - आखिरी चट्टान तक.pdf',
      H6: '06 पाठ 6 - रीढ़ की हड्डी.pdf',
      H7: '07 पाठ 7 - मैं और मेरा देश.pdf',
      H8: '08 पाठ 8 - पद (रैदास).pdf',
      H9: '09 पाठ 9 - राम–लक्ष्मण–परशुराम संवाद.pdf',
      H10: '10 पाठ 10 - भारति जय विजय करें.pdf',
      H11: '11 पाठ 11 - झाँसी की रानी.pdf',
      H12: '12 पाठ 12 - घर की याद.pdf'
    },
    SK: {
      SK1: '01 Path 1.pdf',
      SK2: '02 Path 2.pdf',
      SK3: '03 Path 3.pdf',
      SK4: '04 Path 4.pdf',
      SK5: '05 Path 5.pdf',
      SK6: '06 Path 6.pdf',
      SK7: '07 Path 7.pdf',
      SK8: '08 Path 8.pdf',
      SK9: '09 Path 9.pdf',
      SK10: '10 Path 10.pdf',
      SK11: '11 Path 11.pdf',
      SKA1: '12 Parishisht (Appendix) pages 1-10.pdf',
      SKA2: '12 Parishisht (Appendix) pages 11-20.pdf',
      SKA3: '12 Parishisht (Appendix) pages 21-28.pdf',
      SKA4: '12 Parishisht (Appendix) pages 29-32.pdf',
      SKA5: '12 Parishisht (Appendix) pages 33-37.pdf'
    }
  };
  const f = files[s] && files[s][chId];
  return f ? `../2_Books/${subFolders[s]}/${f}` : null;
}

// Verify coverage across all chapters in plan
let verified = 0;
plan.ch.forEach(c => {
  const b = getBookLink(c.id, c.s);
  if (b) {
    const fullP = path.join('1_Planner', b);
    if (!fs.existsSync(fullP)) {
      console.error('Missing file:', fullP);
    } else {
      verified++;
    }
  }
});
console.log(`Verified book files exist: ${verified} / 78 expected`);

