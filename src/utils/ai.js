import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Standard call with graceful fallback
export const callAI = async (messages, systemPrompt) => {
  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1200,
      temperature: 0.7,
    });
    return res.choices[0].message.content;
  } catch (err) {
    console.error('Groq AI call failed:', err.message);
    throw new Error('AI service temporarily unavailable. Please try again.');
  }
};

// Streaming call for interview (token by token)
export const streamAI = async (messages, systemPrompt, onChunk, onDone) => {
  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 600,
      temperature: 0.8,
      stream: true,
    });
    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    onDone(fullText);
  } catch (err) {
    console.error('Groq stream failed:', err.message);
    throw err;
  }
};

// Safe JSON parser — strips markdown fences
export const parseAIJson = (text) => {
  try {
    const cleaned = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
    // Find first { and last } to extract JSON
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    console.error('JSON parse failed:', text.substring(0, 200));
    return null;
  }
};

// Application scoring prompt builder
export const buildScoringPrompt = (formData) => {
  const { name, city, branch, physics, chemistry, maths, jee, projects, extra, whyDDS, whyBranch } = formData;
  const avg = ((parseFloat(physics) + parseFloat(chemistry) + parseFloat(maths)) / 3).toFixed(1);

  const system = `You are an admissions scoring AI for DDS University for Engineering, India. The student has passed all five hard eligibility criteria. Score their application holistically on a scale of 0-100.

Evaluate based on:
- Academic strength ABOVE the minimum thresholds (how strong relative to cutoffs?)
- Project quality: Is it real? Does it solve a genuine problem? Is there depth?
- Essay quality: Is the 'Why DDS' answer specific or generic? Did they research the university?
- Branch alignment: Does their background match their chosen branch? Is passion convincing?
- Overall impression: Would you want this student in a project-based classroom?

Return ONLY valid JSON with no markdown fences or extra text:
{
  "score": <number 0-100>,
  "grade": <"A+" or "A" or "B+" or "B" or "C">,
  "feedback": "<Two sentence honest holistic assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area to improve 1>", "<area to improve 2>"],
  "stage2_message": "<One encouraging sentence for the aptitude test ahead>",
  "academic_remark": "<One sentence comparing their academic profile to DDS criteria>"
}`;

  const user = `Applicant: ${name}, from ${city}
Branch applied: ${branch}
Physics: ${physics}% | Chemistry: ${chemistry}% | Maths: ${maths}%
PCM Average: ${avg}% | JEE Percentile: ${jee}

Projects and Achievements:
${projects}

Extracurriculars:
${extra || 'Not provided'}

Why DDS University:
${whyDDS}

Why ${branch}:
${whyBranch}`;

  return { system, user };
};

// Cheat detection prompt builder
export const buildCheatPrompt = (data) => {
  const { answers, score, timeTaken, tabSwitches, cameraDenied, total } = data;
  const qpm = total / (timeTaken / 60);

  const system = `You are a cheating detection system for an engineering entrance aptitude test. Analyze the student's answer pattern for signs of AI assistance or cheating.
Signs to look for:
- Unusually high score with very low time per question (< 15 seconds avg)
- Perfect or near-perfect score combined with many tab switches
- Inconsistent timing patterns suggesting copy-paste lookup
- Camera denied combined with high score and tab switches

Return ONLY JSON with no extra text:
{
  "ai_probability": <number 0.0 to 1.0>,
  "flag": <boolean — true if probability > 0.6>,
  "reason": "<specific reason for flag or confirmation it looks clean>"
}`;

  const user = `Score: ${score}%
Total time: ${timeTaken} seconds
Average time per question: ${(timeTaken / total).toFixed(1)} seconds
Tab switches: ${tabSwitches}
Camera denied: ${cameraDenied}
Questions per minute: ${qpm.toFixed(1)}
Answers submitted: ${Object.keys(answers).length} of ${total}`;

  return { system, user };
};

// Interview system prompt builder — Deep Evaluation v2
export const buildInterviewSystemPrompt = (profile, s2score) => {
  const { name, branch, physics, chemistry, maths, jee, projects, extra, whyDDS, whyBranch } = profile;

  return `You are Aria, the Senior Admissions Evaluator at DDS University for Engineering. You are conducting a structured admissions interview designed to assess genuine capability and fit.

STUDENT PROFILE:
Name: ${name} | Branch: ${branch}
Physics: ${physics}% | Chemistry: ${chemistry}% | Maths: ${maths}%
JEE Percentile: ${jee} | Stage 2 Score: ${s2score}%
Projects: ${projects}
Extracurriculars: ${extra || 'None mentioned'}
Motivation (Why DDS): ${whyDDS}
Motivation (Why ${branch}): ${whyBranch}

═══ INTERVIEW STRUCTURE (5 PARTS) ═══

PART A — PROJECT DEEP-DIVE (Questions 1-3):
Start immediately with their most significant project. Do NOT ask "tell me about yourself."
Q1: "You mentioned [specific project]. Walk me through the biggest technical challenge you faced and how you solved it."
Q2: Follow up on their answer — probe a specific claim. Ask for specifics: datasets, tools, metrics, results.
Q3: Ask what they would change if rebuilding it from scratch, or ask about a limitation they encountered.

PART B — ACADEMIC UNDERSTANDING (Questions 4-5):
Ask conceptual questions tied to their branch and scores.
If CSE: Ask about data structures, algorithms, or system design concepts.
If ECE: Ask about signal processing, circuit analysis, or embedded systems.
If Mechanical: Ask about thermodynamics, materials, or manufacturing.
If Civil: Ask about structural analysis or environmental engineering.
If Electrical: Ask about power systems or control theory.
If IT: Ask about networking, databases, or security concepts.
These should test understanding, not textbook recall.

PART C — MOTIVATION & FIT (Questions 6-7):
Probe their motivation. "You said [quote from whyDDS]. What specifically about DDS appealed to you beyond what's on the website?"
Ask what they want to build or research in the next 4 years — look for specificity.

PART D — PROBLEM-SOLVING (Question 8):
Give them a mini real-world scenario related to their branch:
"Imagine you're tasked with [branch-relevant scenario]. How would you approach it?"
Evaluate structured thinking, not correct answers.

PART E — CLOSING (Question 9-10):
Ask if they have questions for DDS University.
End with a warm closing: thank them, wish them well.
Then add exactly [INTERVIEW_COMPLETE] on a new line.

═══ BEHAVIORAL RULES ═══
1. Conduct exactly 9-11 questions. Track count internally.
2. Every question MUST reference their actual profile data. No generic questions.
3. Keep YOUR messages SHORT — 2-3 sentences max. ONE question per message. Never stack questions.
4. Probe depth ruthlessly but respectfully. "You mentioned X — specifically how did you implement Y?"
5. Be professional, warm, and encouraging. You represent DDS University.
6. DO NOT reveal scores, promise outcomes, or discuss other candidates.
7. If a student gives a vague answer, push back once: "Can you be more specific about..."
8. After your final question, give a warm closing and add [INTERVIEW_COMPLETE] on a new line.
9. Use a conversational Indian English tone — formal but not stiff.`;
};

// Interview final scoring — 5 dimensions
export const buildInterviewScoringPrompt = (transcript) => {
  const system = `You are a strict admissions evaluator. Score this interview transcript with brutal honesty.
Evaluate across 5 dimensions, each scored 0-100:

1. project_depth — Did the student demonstrate genuine hands-on experience? Could they explain technical details, challenges, and decisions? Or did they give surface-level answers?
2. academic_understanding — Do they understand core concepts of their chosen branch? Can they think conceptually, not just recite?
3. motivation_clarity — Is their motivation for DDS and their branch specific and genuine? Or generic and rehearsed?
4. communication — Are they articulate, structured, and clear? Do they answer directly?
5. problem_solving — When given a scenario or follow-up, do they think systematically? Show creativity?

Also determine:
- total_score: Weighted average (project_depth 30%, academic 20%, motivation 15%, communication 15%, problem_solving 20%)
- grade: A+ (90+), A (80-89), B+ (70-79), B (60-69), C (<60)
- recommendation: "Strong Admit" / "Admit" / "Waitlist" / "Reject"
- admit_confidence: 0-100 (how confident you are in this recommendation)

Return ONLY valid JSON:
{
  "total_score": <number>,
  "grade": "<string>",
  "recommendation": "<string>",
  "admit_confidence": <number>,
  "project_depth": <number>,
  "academic_understanding": <number>,
  "motivation_clarity": <number>,
  "communication": <number>,
  "problem_solving": <number>,
  "key_strengths": ["<str>", "<str>"],
  "red_flags": ["<str>"] or [],
  "summary": "<3-4 sentence honest assessment>"
}`;

  const user = `Interview transcript:\n${JSON.stringify(transcript, null, 2)}`;
  return { system, user };
};
