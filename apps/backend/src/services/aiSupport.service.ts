/**
 * AI Support Service — answers student questions using platform knowledge.
 *
 * When no agents are online, the AI bot provides instant answers based on
 * the platform's documentation. It responds ONLY to the specific question
 * asked — not dumping all information.
 *
 * Uses OpenAI API (or compatible). Set AI_SUPPORT_API_KEY and optionally
 * AI_SUPPORT_BASE_URL in environment variables.
 *
 * If no API key is configured, falls back to a "no agents available" response.
 */

const PLATFORM_CONTEXT = `You are the FUNT Robotics Academy support assistant. You help students and parents with their questions about the learning platform.

ABOUT FUNT ROBOTICS:
- FUNT Robotics Academy teaches robotics, AI, programming, and electronics to students
- Students access courses via learn.funt.in
- Parents can monitor progress at learn.funt.in/parent
- Admin/staff use admin.funt.in

PLATFORM FEATURES:
- Courses: Students enroll in courses through batches. Each course has chapters (lessons) with video content, text, assignments, and quizzes.
- Progress: Chapters are marked complete after viewing content + watching videos + submitting assignments (if any) + passing quizzes (if any). XP is earned per chapter.
- Assignments: Students submit assignments (file, text, or link). Trainers review and approve/reject.
- Quizzes: Chapter quizzes, milestone quizzes, and course-final exams. Must pass to progress.
- Certificates: Issued upon course completion. Can be downloaded as PDF with QR verification.
- Payments: Students pay via UPI (manual screenshot + UTR) or Razorpay (cards/UPI app). Admin verifies manual payments.
- License Keys: Used for enrollment. Students can enter a key at /enroll-license to get access.
- Shop: Students spend FUNT Coins to buy physical kits and components.
- FUNT Coins: Earned on certificate completion. Have expiry dates. Spent in shop.
- XP & Levels: Earned by completing chapters. Level increases with course certificates.
- Badges: Achievements like "First Assignment Submitted", "7-Day Streak", "First Course Completed".
- Attendance: Tracked per batch session by trainers.
- Support: Students can raise tickets at /support or use live chat.
- Learning Plans: Some courses are milestone-gated — unlock sequentially by completing chapters or paying.
- Referral: Students get a unique referral code. Share it to earn coins and XP.

COMMON STUDENT ISSUES:
- "Can't access course" → Check enrollment status, check if access is blocked, verify payment
- "Video not loading" → Try refreshing, check internet, try different browser
- "Assignment not showing" → Complete previous chapters first, check assignment due date
- "Payment not verified" → Manual UPI payments take time for admin to verify (usually same day)
- "Certificate not generated" → Must complete all chapters + pass final quiz (if any) + have enough coins (if required)
- "Forgot password" → Use /profile/set-password after login, or contact support
- "Quiz failed" → Check if attempts remaining, review material and retry

RULES FOR RESPONDING:
1. Answer ONLY what the student asks. Do not volunteer unrelated information.
2. Keep responses concise and friendly (2-4 sentences max for simple questions).
3. If you don't know or it requires human intervention, say "I'll connect you with a support agent for this. Your ticket has been saved."
4. Never make up information. If unsure, escalate to human.
5. Use simple language. Many students are young (10-18 years old).
6. If asked about technical issues you can't diagnose, suggest common fixes then offer to escalate.`;

export async function getAiResponse(studentMessage: string): Promise<{ reply: string; confident: boolean }> {
  const apiKey = process.env.AI_SUPPORT_API_KEY?.trim();
  const baseUrl = process.env.AI_SUPPORT_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
  const model = process.env.AI_SUPPORT_MODEL?.trim() || "llama-3.3-70b-versatile";

  if (!apiKey) {
    return {
      reply: "I'm unable to answer right now. Your message has been saved as a support ticket — a team member will respond soon.",
      confident: false,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: PLATFORM_CONTEXT },
          { role: "user", content: studentMessage },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("[ai-support] API error:", response.status);
      return {
        reply: "I'm having trouble processing your question right now. Your message has been saved — a support agent will follow up.",
        confident: false,
      };
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return {
        reply: "I couldn't understand that. Could you rephrase your question?",
        confident: false,
      };
    }

    // Check if AI is escalating
    const isEscalating = content.toLowerCase().includes("connect you with") ||
      content.toLowerCase().includes("support agent") ||
      content.toLowerCase().includes("ticket has been saved");

    return { reply: content, confident: !isEscalating };
  } catch (err) {
    console.error("[ai-support] Error:", err);
    return {
      reply: "I'm unable to process your question right now. A support agent will get back to you.",
      confident: false,
    };
  }
}
