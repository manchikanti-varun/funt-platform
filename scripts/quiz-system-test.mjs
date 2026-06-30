/**
 * FUNT Platform — Quiz & Assessment System Integration Test
 * Tests the complete MCQ system end-to-end against the running backend.
 *
 * Prerequisites:
 *   - Backend running on port 38472
 *   - Dev seed data loaded (devsuperadmin@funt exists)
 *   - At least one course and batch in the system
 *
 * Run: node scripts/quiz-system-test.mjs
 */
const API = 'http://localhost:38472';
let passed = 0, failed = 0, skipped = 0;
const results = [];

function assert(cond, label) {
  if (cond) { passed++; results.push(`  ✓ ${label}`); }
  else { failed++; results.push(`  ✗ ${label}`); }
}
function skip(label) { skipped++; results.push(`  ⊘ SKIP: ${label}`); }
function section(name) { results.push(`\n━━━ ${name} ━━━`); }

async function json(r) { return r.json().catch(() => ({})); }
function cookieStr(res) {
  return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

// ─── Shared state ────────────────────────────────────────────────────────────
let adminCookies = '';
let studentCookies = '';
const TS = Date.now().toString(36);
const STUDENT_USER = `quizstu_${TS}`;
let studentId = '';
let batchId = '';
let courseId = '';
let quizId = '';
let attemptId = '';

// ═══════════════════════════════════════════════════════════════════════════════
// 0. SETUP — Login admin & create student
// ═══════════════════════════════════════════════════════════════════════════════
section('0. Setup');

{
  // Admin login
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ username: 'devsuperadmin@funt', password: 'FuntLocalDev2026!', portal: 'admin' }),
  });
  adminCookies = cookieStr(r);
  assert(r.status === 200, 'Admin login OK');

  // Student signup
  const rs = await fetch(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001' },
    body: JSON.stringify({
      username: STUDENT_USER, name: 'Quiz Test Student', email: `${STUDENT_USER}@test.com`,
      mobile: '+919888800001', password: 'QuizTest@2026', age: 14,
      address: '123 Quiz Lane', class: '10', schoolName: 'Quiz School', city: 'QuizCity',
    }),
  });
  const js = await json(rs);
  studentId = js.data?.user?.id ?? '';
  assert(rs.status === 201, `Student signup OK (got ${rs.status})`);

  // Student login
  const rl = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001' },
    body: JSON.stringify({ username: STUDENT_USER, password: 'QuizTest@2026', portal: 'lms' }),
  });
  studentCookies = cookieStr(rl);
  assert(rl.status === 200, 'Student login OK');

  // Get a batch/course for enrollment
  const rb = await fetch(`${API}/api/batches`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  const jb = await json(rb);
  const batches = Array.isArray(jb.data) ? jb.data : [];
  if (batches.length > 0) {
    batchId = batches[0].id;
    const snapshots = batches[0].courseSnapshots ?? (batches[0].courseSnapshot ? [batches[0].courseSnapshot] : []);
    courseId = snapshots[0]?.courseId ?? '';
  }
  assert(!!batchId, `Have batchId: ${batchId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. QUIZ ACCESS CONTROL — No auth should fail
// ═══════════════════════════════════════════════════════════════════════════════
section('1. Quiz Access Control');

{
  // No auth → quiz student routes
  const r1 = await fetch(`${API}/api/student/quizzes/fake-id`);
  assert(r1.status === 401, 'GET quiz without auth returns 401');

  const r2 = await fetch(`${API}/api/student/quizzes/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId: 'x', batchId: 'x', courseId: 'x' }),
  });
  assert(r2.status === 401, 'POST attempt without auth returns 401');

  const r3 = await fetch(`${API}/api/student/quizzes/attempt/fake-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: 'x', selectedOptionId: 'x' }),
  });
  assert(r3.status === 401, 'PATCH answer without auth returns 401');

  const r4 = await fetch(`${API}/api/student/quizzes/attempt/fake-id/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(r4.status === 401, 'POST submit without auth returns 401');

  // Admin auth → student routes should fail (wrong role or wrong cookie)
  const r5 = await fetch(`${API}/api/student/quizzes/fake-id`, {
    headers: { Origin: 'http://localhost:3001', Cookie: adminCookies },
  });
  assert(r5.status === 401 || r5.status === 403, 'Admin cannot access student quiz routes (auth/role check)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN — Create Quiz (Chapter type)
// ═══════════════════════════════════════════════════════════════════════════════
section('2. Admin — Create Chapter Quiz');

{
  const quizData = {
    title: `E2E Chapter Quiz ${TS}`,
    description: 'Test quiz for automated testing',
    type: 'CHAPTER',
    status: 'ACTIVE',
    passingScore: 60,
    maxAttempts: 0,
    timeLimitMinutes: 0,
    shuffleQuestions: false,
    shuffleOptions: false,
    questionsPerAttempt: 0,
    requiredForCertificate: false,
    questions: [
      {
        questionId: 'q1', type: 'SINGLE_SELECT', text: 'What is 2+2?', marks: 1, order: 0,
        options: [
          { optionId: 'a', text: '3', isCorrect: false },
          { optionId: 'b', text: '4', isCorrect: true },
          { optionId: 'c', text: '5', isCorrect: false },
        ],
        explanation: '2+2 equals 4',
      },
      {
        questionId: 'q2', type: 'SINGLE_SELECT', text: 'What color is the sky?', marks: 1, order: 1,
        options: [
          { optionId: 'a', text: 'Green', isCorrect: false },
          { optionId: 'b', text: 'Blue', isCorrect: true },
          { optionId: 'c', text: 'Red', isCorrect: false },
        ],
        explanation: 'The sky appears blue due to Rayleigh scattering',
      },
      {
        questionId: 'q3', type: 'SINGLE_SELECT', text: 'Capital of France?', marks: 1, order: 2,
        options: [
          { optionId: 'a', text: 'London', isCorrect: false },
          { optionId: 'b', text: 'Berlin', isCorrect: false },
          { optionId: 'c', text: 'Paris', isCorrect: true },
        ],
        explanation: 'Paris is the capital of France',
      },
    ],
  };

  const r = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify(quizData),
  });
  const j = await json(r);
  assert(r.status === 201, `Create quiz returns 201 (got ${r.status})`);
  assert(j.data?.quizId, 'Quiz has generated quizId');
  assert(j.data?.title === quizData.title, 'Quiz title matches');
  assert(j.data?.questions?.length === 3, 'Quiz has 3 questions');
  quizId = j.data?.quizId ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN — List & Get Quiz
// ═══════════════════════════════════════════════════════════════════════════════
section('3. Admin — List & Get Quiz');

{
  // List all
  const r1 = await fetch(`${API}/api/quizzes`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  const j1 = await json(r1);
  assert(r1.status === 200, 'List quizzes returns 200');
  assert(Array.isArray(j1.data) && j1.data.length > 0, 'Has quizzes in list');

  // Filter by type
  const r2 = await fetch(`${API}/api/quizzes?type=CHAPTER`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  const j2 = await json(r2);
  assert(r2.status === 200, 'Filter by type works');
  assert(j2.data?.every(q => q.type === 'CHAPTER'), 'All results are CHAPTER type');

  // Get by ID (admin view — includes correct answers)
  const r3 = await fetch(`${API}/api/quizzes/${quizId}`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  const j3 = await json(r3);
  assert(r3.status === 200, 'Get quiz by ID returns 200');
  assert(j3.data?.quizId === quizId, 'Correct quiz returned');
  assert(j3.data?.questions?.[0]?.options?.some(o => o.isCorrect === true), 'Admin view includes isCorrect');

  // For-linking endpoint
  const r4 = await fetch(`${API}/api/quizzes/for-linking?type=CHAPTER`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  const j4 = await json(r4);
  assert(r4.status === 200, 'For-linking endpoint works');
  assert(j4.data?.some(q => q.quizId === quizId), 'Created quiz appears in linking list');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN — Update Quiz
// ═══════════════════════════════════════════════════════════════════════════════
section('4. Admin — Update Quiz');

{
  const r = await fetch(`${API}/api/quizzes/${quizId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({ passingScore: 50, description: 'Updated description' }),
  });
  const j = await json(r);
  assert(r.status === 200, 'Update quiz returns 200');
  assert(j.data?.passingScore === 50, 'Passing score updated to 50');
  assert(j.data?.description === 'Updated description', 'Description updated');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN — Validation errors
// ═══════════════════════════════════════════════════════════════════════════════
section('5. Admin — Quiz Validation');

{
  // Missing title
  const r1 = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({ type: 'CHAPTER', questions: [] }),
  });
  assert(r1.status === 400, 'Missing title returns 400');

  // Invalid type
  const r2 = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({ title: 'X', type: 'INVALID_TYPE', questions: [] }),
  });
  assert(r2.status === 400, 'Invalid type returns 400');

  // Non-existent quiz
  const r3 = await fetch(`${API}/api/quizzes/NONEXISTENT`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(r3.status === 404, 'Non-existent quiz returns 404');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STUDENT — Get Quiz Info (no correct answers exposed)
// ═══════════════════════════════════════════════════════════════════════════════
section('6. Student — Get Quiz Info');

{
  const r = await fetch(`${API}/api/student/quizzes/${quizId}`, {
    headers: { Origin: 'http://localhost:3001', Cookie: studentCookies },
  });
  const j = await json(r);
  assert(r.status === 200, 'Student can fetch quiz info');
  assert(j.data?.quizId === quizId, 'Correct quiz returned');
  assert(j.data?.questionCount === 3, 'Question count is 3');
  assert(j.data?.passingScore === 50, 'Passing score is 50 (after update)');
  // Should NOT have questions with answers
  assert(!j.data?.questions, 'No questions array exposed in info endpoint');

  // Non-existent quiz
  const r2 = await fetch(`${API}/api/student/quizzes/NONEXISTENT`, {
    headers: { Origin: 'http://localhost:3001', Cookie: studentCookies },
  });
  assert(r2.status === 404, 'Non-existent quiz returns 404 for student');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. STUDENT — Start Attempt
// ═══════════════════════════════════════════════════════════════════════════════
section('7. Student — Start Quiz Attempt');

{
  if (!batchId || !courseId) {
    skip('No batch/course for attempt test');
  } else {
    const r = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId, batchId, courseId, chapterOrder: 0 }),
    });
    const j = await json(r);
    assert(r.status === 201, `Start attempt returns 201 (got ${r.status})`);
    assert(j.data?.attemptId, 'Attempt has ID');
    assert(j.data?.status === 'IN_PROGRESS', 'Status is IN_PROGRESS');
    assert(j.data?.questions?.length === 3, 'All 3 questions presented');
    assert(j.data?.totalQuestions === 3, 'totalQuestions = 3');
    attemptId = j.data?.attemptId ?? '';

    // Questions should NOT have isCorrect
    const firstQ = j.data?.questions?.[0];
    assert(firstQ?.options?.every(o => o.isCorrect === undefined), 'Options do NOT expose isCorrect');
    assert(firstQ?.questionId, 'Question has questionId');
    assert(firstQ?.text, 'Question has text');

    // Starting again should return same attempt (resume)
    const r2 = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId, batchId, courseId, chapterOrder: 0 }),
    });
    const j2 = await json(r2);
    assert(j2.data?.attemptId === attemptId, 'Resume returns same attempt (not duplicate)');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. STUDENT — Save Answer (auto-save)
// ═══════════════════════════════════════════════════════════════════════════════
section('8. Student — Save Answers');

{
  if (!attemptId) {
    skip('No attempt to save answers');
  } else {
    // Save answer for Q1 — correct answer is 'b' (4)
    const r1 = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ questionId: 'q1', selectedOptionId: 'b' }),
    });
    const j1 = await json(r1);
    assert(r1.status === 200, 'Save answer Q1 returns 200');
    assert(j1.data?.saved === true, 'Answer saved');

    // Save answer for Q2 — correct answer is 'b' (Blue)
    const r2 = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ questionId: 'q2', selectedOptionId: 'b' }),
    });
    assert(r2.status === 200, 'Save answer Q2 OK');

    // Save answer for Q3 — WRONG answer 'a' (London)
    const r3 = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ questionId: 'q3', selectedOptionId: 'a' }),
    });
    assert(r3.status === 200, 'Save answer Q3 OK');

    // Invalid question ID
    const r4 = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ questionId: 'nonexistent', selectedOptionId: 'x' }),
    });
    assert(r4.status === 400, 'Invalid questionId returns 400');

    // Wrong attemptId
    const r5 = await fetch(`${API}/api/student/quizzes/attempt/FAKE_ATTEMPT`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ questionId: 'q1', selectedOptionId: 'a' }),
    });
    assert(r5.status === 404, 'Fake attemptId returns 404');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. STUDENT — Submit Attempt (auto-grade)
// ═══════════════════════════════════════════════════════════════════════════════
section('9. Student — Submit & Auto-Grade');

{
  if (!attemptId) {
    skip('No attempt to submit');
  } else {
    const r = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({}),
    });
    const j = await json(r);
    assert(r.status === 200, `Submit returns 200 (got ${r.status})`);
    assert(j.data?.status === 'COMPLETED', 'Status is COMPLETED');
    assert(j.data?.totalMarks === 3, 'Total marks = 3');
    assert(j.data?.scoredMarks === 2, 'Scored marks = 2 (2 correct, 1 wrong)');
    assert(j.data?.scorePercent === 67, `Score percent = 67 (got ${j.data?.scorePercent})`);
    assert(j.data?.passed === true, 'Passed (67% >= 50% passing score)');
    assert(j.data?.passingScore === 50, 'Passing score returned');
    assert(j.data?.timeTakenSeconds >= 0, 'Time taken recorded');
    assert(j.data?.attemptNumber === 1, 'Attempt number = 1');

    // Check question details in result
    const questions = j.data?.questions ?? [];
    assert(questions.length === 3, 'All 3 questions in result');

    const q1 = questions.find(q => q.questionId === 'q1');
    assert(q1?.isCorrect === true, 'Q1 graded correct');
    assert(q1?.studentAnswer === 'b', 'Q1 student answer = b');
    assert(q1?.correctAnswer === 'b', 'Q1 correct answer exposed');
    assert(q1?.explanation === '2+2 equals 4', 'Q1 explanation shown');
    assert(q1?.marksAwarded === 1, 'Q1 marks awarded = 1');

    const q3 = questions.find(q => q.questionId === 'q3');
    assert(q3?.isCorrect === false, 'Q3 graded incorrect');
    assert(q3?.studentAnswer === 'a', 'Q3 student answer = a (London)');
    assert(q3?.correctAnswer === 'c', 'Q3 correct answer = c (Paris)');
    assert(q3?.marksAwarded === 0, 'Q3 marks awarded = 0');

    // Try to submit again — should fail (already completed)
    const r2 = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({}),
    });
    assert(r2.status === 404, 'Cannot re-submit completed attempt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. STUDENT — Attempt History
// ═══════════════════════════════════════════════════════════════════════════════
section('10. Student — Attempt History');

{
  if (!quizId || !batchId || !courseId) {
    skip('Missing IDs for history test');
  } else {
    const r = await fetch(
      `${API}/api/student/quizzes/${quizId}/attempts?batchId=${batchId}&courseId=${courseId}`,
      { headers: { Origin: 'http://localhost:3001', Cookie: studentCookies } }
    );
    const j = await json(r);
    assert(r.status === 200, 'Attempt history returns 200');
    assert(Array.isArray(j.data) && j.data.length === 1, 'Has 1 completed attempt');
    assert(j.data[0]?.passed === true, 'First attempt shows passed');
    assert(j.data[0]?.scorePercent === 67, 'History shows correct score');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. STUDENT — Attempt Detail (review with explanations)
// ═══════════════════════════════════════════════════════════════════════════════
section('11. Student — Attempt Detail');

{
  if (!attemptId) {
    skip('No attempt for detail test');
  } else {
    const r = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}/detail`, {
      headers: { Origin: 'http://localhost:3001', Cookie: studentCookies },
    });
    const j = await json(r);
    assert(r.status === 200, 'Attempt detail returns 200');
    assert(j.data?.attemptId === attemptId, 'Correct attempt returned');
    assert(j.data?.questions?.length === 3, 'All questions in detail');
    assert(j.data?.questions?.[0]?.explanation, 'Explanations included');
    assert(j.data?.questions?.[0]?.options?.some(o => o.isCorrect === true), 'Correct answers shown in review');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. STUDENT — Retake (unlimited attempts)
// ═══════════════════════════════════════════════════════════════════════════════
section('12. Student — Retake Quiz');

{
  if (!quizId || !batchId || !courseId) {
    skip('Missing IDs for retake test');
  } else {
    // Start a new attempt (should work since maxAttempts = 0 = unlimited)
    const r1 = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId, batchId, courseId, chapterOrder: 0 }),
    });
    const j1 = await json(r1);
    assert(r1.status === 201, 'New attempt started for retake');
    assert(j1.data?.attemptNumber === 2, 'Attempt number = 2');
    const retakeAttemptId = j1.data?.attemptId;

    // Submit with all correct
    const r2 = await fetch(`${API}/api/student/quizzes/attempt/${retakeAttemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({
        answers: [
          { questionId: 'q1', selectedOptionId: 'b' },
          { questionId: 'q2', selectedOptionId: 'b' },
          { questionId: 'q3', selectedOptionId: 'c' },
        ],
      }),
    });
    const j2 = await json(r2);
    assert(r2.status === 200, 'Retake submit OK');
    assert(j2.data?.scorePercent === 100, 'Perfect score on retake');
    assert(j2.data?.passed === true, 'Retake passed');
    assert(j2.data?.attemptNumber === 2, 'Correct attempt number');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. MAX ATTEMPTS ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════
section('13. Max Attempts Enforcement');

{
  // Create a quiz with maxAttempts = 1
  const createR = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({
      title: `Limited Quiz ${TS}`,
      type: 'CHAPTER',
      status: 'ACTIVE',
      passingScore: 50,
      maxAttempts: 1,
      questions: [
        {
          questionId: 'lq1', type: 'SINGLE_SELECT', text: 'Test Q', marks: 1, order: 0,
          options: [
            { optionId: 'a', text: 'Wrong', isCorrect: false },
            { optionId: 'b', text: 'Right', isCorrect: true },
          ],
        },
      ],
    }),
  });
  const createJ = await json(createR);
  const limitedQuizId = createJ.data?.quizId;
  assert(createR.status === 201, 'Limited quiz created');

  if (limitedQuizId && batchId && courseId) {
    // First attempt
    const r1 = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId: limitedQuizId, batchId, courseId, chapterOrder: 1 }),
    });
    const j1 = await json(r1);
    const limitedAttemptId = j1.data?.attemptId;

    // Submit it
    await fetch(`${API}/api/student/quizzes/attempt/${limitedAttemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ answers: [{ questionId: 'lq1', selectedOptionId: 'b' }] }),
    });

    // Second attempt — should be blocked
    const r2 = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId: limitedQuizId, batchId, courseId, chapterOrder: 1 }),
    });
    assert(r2.status === 400, 'Max attempts enforced (second attempt blocked)');
    const j2 = await json(r2);
    assert(j2.message?.includes('Maximum attempts'), 'Error message mentions max attempts');
  } else {
    skip('Could not create limited quiz');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 14. FAILING QUIZ (score below passing)
// ═══════════════════════════════════════════════════════════════════════════════
section('14. Failing Quiz');

{
  // Create a quiz with high passing score
  const createR = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({
      title: `Hard Quiz ${TS}`,
      type: 'CHAPTER',
      status: 'ACTIVE',
      passingScore: 100,
      maxAttempts: 0,
      questions: [
        {
          questionId: 'hq1', type: 'SINGLE_SELECT', text: 'Q1', marks: 1, order: 0,
          options: [{ optionId: 'a', text: 'Wrong', isCorrect: false }, { optionId: 'b', text: 'Right', isCorrect: true }],
        },
        {
          questionId: 'hq2', type: 'SINGLE_SELECT', text: 'Q2', marks: 1, order: 1,
          options: [{ optionId: 'a', text: 'Wrong', isCorrect: false }, { optionId: 'b', text: 'Right', isCorrect: true }],
        },
      ],
    }),
  });
  const hardQuizId = (await json(createR)).data?.quizId;

  if (hardQuizId && batchId && courseId) {
    // Start and submit with 1 wrong answer
    const startR = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId: hardQuizId, batchId, courseId, chapterOrder: 2 }),
    });
    const startJ = await json(startR);
    const hardAttemptId = startJ.data?.attemptId;

    const submitR = await fetch(`${API}/api/student/quizzes/attempt/${hardAttemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ answers: [{ questionId: 'hq1', selectedOptionId: 'b' }, { questionId: 'hq2', selectedOptionId: 'a' }] }),
    });
    const submitJ = await json(submitR);
    assert(submitR.status === 200, 'Fail attempt submits OK');
    assert(submitJ.data?.passed === false, 'Quiz correctly marked as FAILED');
    assert(submitJ.data?.scorePercent === 50, 'Score is 50% (1/2)');
  } else {
    skip('Could not create hard quiz');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 15. COURSE FINAL QUIZ (with question pool)
// ═══════════════════════════════════════════════════════════════════════════════
section('15. Course Final Quiz (Question Pool)');

{
  // Create quiz with 5 questions, 3 per attempt
  const questions = [];
  for (let i = 1; i <= 5; i++) {
    questions.push({
      questionId: `fp${i}`, type: 'SINGLE_SELECT', text: `Pool Q${i}`, marks: 1, order: i - 1,
      options: [
        { optionId: 'a', text: 'Wrong', isCorrect: false },
        { optionId: 'b', text: 'Correct', isCorrect: true },
      ],
    });
  }

  const createR = await fetch(`${API}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: adminCookies },
    body: JSON.stringify({
      title: `Final Quiz Pool ${TS}`,
      type: 'COURSE_FINAL',
      status: 'ACTIVE',
      passingScore: 60,
      maxAttempts: 0,
      questionsPerAttempt: 3,
      shuffleQuestions: true,
      questions,
    }),
  });
  const finalQuizId = (await json(createR)).data?.quizId;
  assert(createR.status === 201, 'Final quiz with pool created');

  if (finalQuizId && batchId && courseId) {
    const startR = await fetch(`${API}/api/student/quizzes/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: studentCookies },
      body: JSON.stringify({ quizId: finalQuizId, batchId, courseId }),
    });
    const startJ = await json(startR);
    assert(startR.status === 201, 'Pool quiz attempt started');
    assert(startJ.data?.totalQuestions === 3, 'Only 3 questions selected from pool of 5');
    assert(startJ.data?.questions?.length === 3, 'Exactly 3 questions presented');

    // All question IDs should be from our pool
    const presentedIds = startJ.data?.questions?.map(q => q.questionId) ?? [];
    assert(presentedIds.every(id => id.startsWith('fp')), 'All questions from pool');
    assert(new Set(presentedIds).size === 3, 'No duplicate questions');
  } else {
    skip('Could not create final quiz');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 16. ADMIN — Archive Quiz
// ═══════════════════════════════════════════════════════════════════════════════
section('16. Admin — Archive Quiz');

{
  if (!quizId) {
    skip('No quiz to archive');
  } else {
    const r = await fetch(`${API}/api/quizzes/${quizId}/archive`, {
      method: 'PATCH',
      headers: { Origin: 'http://localhost:3000', Cookie: adminCookies },
    });
    const j = await json(r);
    assert(r.status === 200, 'Archive quiz returns 200');
    assert(j.data?.status === 'ARCHIVED', 'Quiz status is ARCHIVED');

    // Student should not be able to access archived quiz
    const r2 = await fetch(`${API}/api/student/quizzes/${quizId}`, {
      headers: { Origin: 'http://localhost:3001', Cookie: studentCookies },
    });
    assert(r2.status === 404, 'Archived quiz returns 404 for student');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 17. CROSS-STUDENT ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════
section('17. Cross-Student Isolation');

{
  if (!attemptId) {
    skip('No attempt for isolation test');
  } else {
    // Create a second student
    const TS2 = Date.now().toString(36) + 'b';
    const rs = await fetch(`${API}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001' },
      body: JSON.stringify({
        username: `quizstu2_${TS2}`, name: 'Student 2', email: `stu2_${TS2}@test.com`,
        mobile: '+919888800099', password: 'QuizTest@2026', age: 15,
        address: '456 Other St', class: '11', schoolName: 'Other School', city: 'OtherCity',
      }),
    });
    const student2Cookies = cookieStr(rs);

    // Student 2 should NOT see Student 1's attempt detail
    const r = await fetch(`${API}/api/student/quizzes/attempt/${attemptId}/detail`, {
      headers: { Origin: 'http://localhost:3001', Cookie: student2Cookies },
    });
    assert(r.status === 404, 'Other student cannot access attempt detail (isolation works)');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 18. WHOLE APP — Verify existing features still work
// ═══════════════════════════════════════════════════════════════════════════════
section('18. Whole App — Regression Check');

{
  // Health
  const rh = await fetch(`${API}/health`);
  assert(rh.status === 200, 'Health endpoint still works');

  // Courses
  const rc = await fetch(`${API}/api/courses`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(rc.status === 200, 'Courses endpoint still works');

  // Batches
  const rb = await fetch(`${API}/api/batches`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(rb.status === 200, 'Batches endpoint still works');

  // Global modules
  const rm = await fetch(`${API}/api/global-modules`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(rm.status === 200, 'Global modules endpoint still works');

  // Global assignments
  const ra = await fetch(`${API}/api/global-assignments`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(ra.status === 200, 'Global assignments endpoint still works');

  // Student courses
  const rsc = await fetch(`${API}/api/student/courses`, { headers: { Origin: 'http://localhost:3001', Cookie: studentCookies } });
  assert(rsc.status === 200, 'Student courses endpoint still works');

  // Explore courses (public)
  const re = await fetch(`${API}/api/student/courses/explore`);
  assert(re.status === 200, 'Public explore endpoint still works');

  // Admin audit
  const rau = await fetch(`${API}/api/audit?page=1&limit=5`, { headers: { Origin: 'http://localhost:3000', Cookie: adminCookies } });
  assert(rau.status === 200, 'Audit endpoint still works');

  // Certificates
  const rcer = await fetch(`${API}/api/student/certificates`, { headers: { Origin: 'http://localhost:3001', Cookie: studentCookies } });
  assert(rcer.status === 200, 'Certificates endpoint still works');

  // Learning plan milestones
  if (courseId) {
    const rlp = await fetch(`${API}/api/student/courses/${courseId}/milestones?batchId=${batchId}`, {
      headers: { Origin: 'http://localhost:3001', Cookie: studentCookies },
    });
    assert(rlp.status === 200 || rlp.status === 404, 'Milestones endpoint responds (no regression)');
  }

  // 404 catch-all
  const r404 = await fetch(`${API}/api/nonexistent/path`);
  assert(r404.status === 404, '404 catch-all still works');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(' FUNT PLATFORM — QUIZ SYSTEM TEST RESULTS');
console.log('═'.repeat(60));
results.forEach(l => console.log(l));
console.log('\n' + '─'.repeat(60));
console.log(`  PASSED: ${passed}  |  FAILED: ${failed}  |  SKIPPED: ${skipped}`);
console.log('─'.repeat(60));
if (failed > 0) {
  console.log('\n  ⚠️  SOME TESTS FAILED — see ✗ items above');
  process.exit(1);
} else {
  console.log('\n  ✅ ALL TESTS PASSED');
  process.exit(0);
}
