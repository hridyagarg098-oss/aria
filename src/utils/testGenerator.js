// Seeded PRNG (mulberry32)
function seededRandom(seed) {
  let t = seed + 0x6D2B79F5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a unique test for a student.
 * @param {string} studentId
 * @param {Array} pool - Full question pool from aptitude_tests.question_pool
 * @param {Array} excludeIds - Question IDs to exclude (for retry attempt)
 * @returns {{ questions: Array, questionIds: Array }}
 */
export function generateTestForStudent(studentId, pool, excludeIds = [], attemptNumber = 1) {
  // Use student ID + attempt number as seed — stable per attempt, unique per student
  const seed = hashStr(studentId + ':attempt:' + attemptNumber);
  const rng = seededRandom(seed);

  const excludeSet = new Set(excludeIds);
  const available = pool.filter(q => !excludeSet.has(q.id));

  const subjects = {
    Physics: { needed: 4, minMedium: 1, minHard: 1 },
    Chemistry: { needed: 3, minMedium: 1, minHard: 1 },
    Maths: { needed: 4, minMedium: 1, minHard: 1 },
    English: { needed: 2, minMedium: 1, minHard: 0 },
    Reasoning: { needed: 2, minMedium: 1, minHard: 0 },
  };

  const selected = [];

  for (const [subject, cfg] of Object.entries(subjects)) {
    const subPool = available.filter(q => q.subject === subject);
    const medium = subPool.filter(q => q.difficulty === 'medium');
    const hard = subPool.filter(q => q.difficulty === 'hard');

    const picked = [];

    // Ensure minimums
    const shuffledMed = shuffle(medium, rng);
    const shuffledHard = shuffle(hard, rng);

    for (let i = 0; i < cfg.minHard && i < shuffledHard.length; i++) {
      picked.push(shuffledHard[i]);
    }
    for (let i = 0; i < cfg.minMedium && i < shuffledMed.length; i++) {
      if (!picked.find(p => p.id === shuffledMed[i].id)) {
        picked.push(shuffledMed[i]);
      }
    }

    // Fill remaining
    const remaining = shuffle(
      subPool.filter(q => !picked.find(p => p.id === q.id)),
      rng
    );
    while (picked.length < cfg.needed && remaining.length > 0) {
      picked.push(remaining.shift());
    }

    selected.push(...picked);
  }

  // Shuffle overall order
  const finalQuestions = shuffle(selected, rng);

  // Shuffle options for each question
  const questions = finalQuestions.map(q => {
    const optionIndices = q.options.map((_, i) => i);
    const shuffledIndices = shuffle(optionIndices, rng);
    const newOptions = shuffledIndices.map(i => q.options[i]);
    const newCorrect = shuffledIndices.indexOf(q.correct);

    return {
      ...q,
      options: newOptions,
      correct: newCorrect,
      _originalId: q.id,
    };
  });

  return {
    questions,
    questionIds: finalQuestions.map(q => q.id),
  };
}

export function generateSessionHash(studentId, sessionId) {
  const raw = `${studentId}:${sessionId}:${Date.now()}`;
  return hashStr(raw).toString(36) + hashStr(raw + 'salt').toString(36);
}
