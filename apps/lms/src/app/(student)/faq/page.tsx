"use client";

import Link from "next/link";
import { AppPageShell, PageSection } from "@/components/ui";
import {
  IconAssignment,
  IconCertificates,
  IconCourses,
  IconOverview,
  IconProgress,
  IconUser,
} from "@/components/icons/NavIcons";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportWhatsAppHref } from "@/lib/support";

type FaqItem = {
  question: string;
  intro?: string;
  details: string[];
  steps?: string[];
  actions?: Array<{ label: string; href: string; external?: boolean }>;
};

type FaqGroup = {
  id: string;
  title: string;
  subtitle: string;
  Icon: typeof IconOverview;
  items: FaqItem[];
};

const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "start",
    title: "Welcome & navigation",
    subtitle: "What FUNT Learn is and how to move around after you sign in.",
    Icon: IconOverview,
    items: [
      {
        question: "What is FUNT Learn and what can I do here?",
        intro:
          "FUNT Learn is your personal learning hub for FUNT Robotics Academy programmes—everything tied to your student account lives in one place.",
        details: [
          "From the left sidebar you can open Dashboard (overview), Courses (your batches and lessons), Assignments, Attendance, License key (if you were given a key), Progress, Skills, Certificates, Shop, and Account / security settings.",
          "Your username and profile are unique to you. Progress, XP, payments, and certificates are recorded against this account, so always sign in with the same credentials your centre gave you.",
        ],
        steps: [
          "After login, land on Dashboard for a quick snapshot of where to continue.",
          "Use Courses whenever you want to study or jump back into a specific programme.",
          "Use Payment or Certificates when something is blocked or you need proof of completion.",
        ],
        actions: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Courses", href: "/courses" },
        ],
      },
      {
        question: "How is my day-to-day study flow organised?",
        intro: "A typical week on FUNT Learn follows a simple loop: learn → practise → submit → track.",
        details: [
          "Your institute places you in a batch and assigns courses. Each course has modules (lessons, videos, readings) and often assignments that trainers review.",
          "Attendance may be marked by your batch—check Attendance so you know you are marked present for live or lab sessions.",
          "If something looks missing (no course card, wrong batch), note your exact course name and tell support or your centre coordinator so they can align your enrollment.",
        ],
        steps: [
          "Open Courses and pick the course you are actively studying.",
          "Work through modules in order when your trainer recommends it, or jump to assigned topics if your batch allows.",
          "Submit assignments before deadlines where shown; late submissions depend on your centre’s rules.",
          "Glance at Progress or Dashboard to see what is still pending.",
        ],
        actions: [
          { label: "Courses", href: "/courses" },
          { label: "Assignments", href: "/assignments" },
          { label: "Attendance", href: "/attendance" },
        ],
      },
    ],
  },
  {
    id: "learn",
    title: "Courses, lessons & assignments",
    subtitle: "How to start, resume, and complete work inside your courses.",
    Icon: IconCourses,
    items: [
      {
        question: "How do I start or continue a course?",
        intro: "Your enrolled courses appear under Courses. Each card usually shows the course title, batch, and how far you have progressed.",
        details: [
          "Tap a course to open its detail page. From there you can open the learning view, see payment or access notices, and continue modules.",
          "If you see “Continue learning” or similar on Dashboard, it shortcuts you to the last place you studied—useful when you have several active courses.",
          "Progress bars update as you finish lessons or approved activities. If a bar does not move after you finished a lesson, refresh once; if it still fails, contact support with the course name and module title.",
        ],
        steps: [
          "Go to Courses from the sidebar.",
          "Select the course card for your current batch.",
          "Open Learn (or the primary action shown) and pick the next module or lesson.",
          "Mark lessons complete only after you have actually finished the content, so your record matches your real effort.",
        ],
        actions: [
          { label: "Courses", href: "/courses" },
          { label: "Dashboard", href: "/dashboard" },
        ],
      },
      {
        question: "Why is my course locked or not opening fully?",
        intro: "Usually access is tied to enrollment, payment verification, or a batch rule set by your centre.",
        details: [
          "If payment is pending manual review, the course may stay read-only or locked until the amount is matched to your account.",
          "If you used a license key, the wrong key or an already-used key will not unlock the intended course.",
          "Sometimes access is temporarily restricted for compliance (for example fee follow-up). The Payment page and any message on the course card are the first places to check.",
        ],
        steps: [
          "Open Payment and read the status for that course or batch.",
          "If you already paid, keep your UTR, receipt, or app screenshot ready.",
          "Message support with: your FUNT username, course name, batch (if you know it), and proof of payment.",
        ],
        actions: [
          { label: "Payment", href: "/payment" },
          { label: "License key", href: "/enroll-license" },
          { label: "WhatsApp help", href: supportWhatsAppHref("Hi, my FUNT Learn course is locked. Username: "), external: true },
        ],
      },
      {
        question: "How do assignments work?",
        intro: "Assignments let you practise and show understanding. Trainers may grade them and leave feedback.",
        details: [
          "Open Assignments from the sidebar to see what is due, in progress, or returned.",
          "Read each task carefully: some ask for uploads, links, or text. Submit only your own work unless a project explicitly allows pairing.",
          "If an assignment is rejected or needs revision, read the feedback, fix your submission, and resubmit if the platform allows another attempt.",
        ],
        actions: [{ label: "Assignments", href: "/assignments" }],
      },
      {
        question: "What should I know about attendance?",
        intro: "Attendance records whether you were present for scheduled sessions your batch tracks on FUNT Learn.",
        details: [
          "Open Attendance to see your history. If you believe a session was marked wrong, speak to your batch trainer or coordinator first—they can correct records according to institute policy.",
          "Repeated absences may affect batch standing or eligibility for certain events; your centre’s rules apply.",
        ],
        actions: [{ label: "Attendance", href: "/attendance" }],
      },
    ],
  },
  {
    id: "growth",
    title: "Progress, XP, skills & shop",
    subtitle: "How growth is shown and how the shop relates to your account.",
    Icon: IconProgress,
    items: [
      {
        question: "What are XP, level, and the Progress page?",
        intro: "FUNT Learn surfaces motivation metrics so you can see consistency, not just a single score.",
        details: [
          "How much XP you earn per module is decided by your academy when they set up the course (each module can have its own XP). Staff can update those course snapshots later if your centre adjusts the programme.",
          "XP generally increases when you fully complete a module or when assignments are approved—exact behaviour follows your batch and course rules.",
          "Level is a simple milestone built on top of XP so you can celebrate streaks of learning.",
          "The Progress page summarises how you are doing across courses so you can spot what needs attention before deadlines pile up.",
        ],
        steps: [
          "Check the top bar on desktop for a compact XP / level readout.",
          "Open Progress for charts or lists that compare course completion.",
          "Pair Progress with Assignments so you never miss graded work.",
        ],
        actions: [
          { label: "Progress", href: "/progress" },
          { label: "Skills", href: "/skills" },
        ],
      },
      {
        question: "What is the Skills section for?",
        intro: "Skills highlights competencies or tags your centre maps to your learning path.",
        details: [
          "Use it to understand strengths and gaps your trainers want you to focus on next.",
          "It complements certificates: certificates prove completion of a programme; skills views describe abilities across modules.",
        ],
        actions: [{ label: "Skills", href: "/skills" }],
      },
      {
        question: "How does the Shop work for students?",
        intro: "Shop lets you browse kits or components your academy lists for purchase through FUNT Learn.",
        details: [
          "Add items carefully and follow the checkout or payment steps shown. Some purchases may require manual confirmation like course fees.",
          "Keep receipts until your order or access is confirmed on your account.",
        ],
        actions: [{ label: "Shop", href: "/shop" }, { label: "Payment", href: "/payment" }],
      },
      {
        question: "What are FUNT coins, and when do they expire?",
        intro: "Coins are the in-platform balance your academy may use for the shop or rewards. Amounts and rules are configured by your centre.",
        details: [
          "Completion or bonus coins (for example after you finish a programme) are set per course inside your batch by your academy—next to the course fee—when they configure that cohort.",
          "Each coin grant has its own expiry date. FUNT Learn uses a 30-day validity from the date a grant is credited—use Shop → “Coin credits” to see granted amount, what is left, and the expiry date.",
          "Spend or plan purchases before tranches expire; expired amounts are removed from your spendable balance according to platform rules.",
        ],
        actions: [{ label: "Shop & coin history", href: "/shop" }],
      },
    ],
  },
  {
    id: "account",
    title: "Account, profile & security",
    subtitle: "Keeping your student profile accurate and your login safe.",
    Icon: IconUser,
    items: [
      {
        question: "Where do I update my profile and password?",
        intro: "Account holds your basic profile; Profile / security holds login safety options depending on what your build exposes.",
        details: [
          "Keep your mobile and email up to date so payment and support teams can reach you.",
          "Choose a strong password (mix of letters, numbers, symbols) and never reuse your school email password on other sites.",
        ],
        steps: [
          "Open Account to review name, contact, and academic fields you are allowed to edit.",
          "Open Profile (security & activity) for password change, session awareness, or related tools.",
        ],
        actions: [
          { label: "Account", href: "/account" },
          { label: "Profile & security", href: "/profile" },
        ],
      },
      {
        question: "I forgot my username or cannot sign in. What should I do?",
        intro: "Do not create a second student account without guidance—that splits your progress.",
        details: [
          "Use Forgot username on the sign-in flow if you remember email but not username.",
          "If you are locked out after too many tries, wait for the cool-off or ask support to reset login attempts from the institute side.",
          "When you contact support, always include: full name, registered mobile, and any email on file.",
        ],
        actions: [
          { label: "Forgot username", href: "/forgot-username" },
          { label: "Email support", href: `mailto:${SUPPORT_EMAIL}?subject=FUNT%20Learn%20login%20help`, external: true },
        ],
      },
      {
        question: "How do I stay safe online while using FUNT Learn?",
        intro: "Treat FUNT Learn like banking: your account controls access to paid learning and certificates.",
        details: [
          "Sign out on shared computers or school labs.",
          "Never share OTPs, passwords, or license keys in public group chats.",
          "If someone asks for your “FUNT password” on Instagram or WhatsApp, assume it is a scam and report to a trusted adult and support.",
        ],
        actions: [{ label: "Profile & security", href: "/profile" }],
      },
    ],
  },
  {
    id: "pay-cert",
    title: "Payments, license keys & certificates",
    subtitle: "Money flows, keys, and official proof of learning.",
    Icon: IconCertificates,
    items: [
      {
        question: "How do I pay for a course or fee shown in FUNT Learn?",
        intro: "Payment pages collect what your institute requires—UPI, QR, or online checkout depending on configuration.",
        details: [
          "Always pay the exact amount shown and keep the bank or UPI reference (UTR) until your status shows success or verified.",
          "If manual verification is required, expect a short delay while staff matches your payment to your student ID.",
          "Never pay a random personal account someone messages you; only use links and UPI IDs shown inside your official FUNT Learn payment screen.",
        ],
        steps: [
          "Open Payment from the sidebar or from the course card if it links you there.",
          "Choose the correct course or fee line item.",
          "Complete payment and save the receipt screenshot.",
          "Return later to confirm status moved to paid or verified.",
        ],
        actions: [{ label: "Payment", href: "/payment" }],
      },
      {
        question: "How do I redeem a FUNT license key?",
        intro: "Some programmes issue a one-time key instead of or in addition to manual payment.",
        details: [
          "Keys usually look like FUNT- followed by characters. Type carefully—extra spaces break redemption.",
          "Each key is normally tied to one student and one course bundle. Do not post your key publicly.",
        ],
        steps: [
          "Open License key in the sidebar.",
          "Paste the full key and submit.",
          "On success, refresh Courses and confirm the new access appears.",
        ],
        actions: [
          { label: "License key", href: "/enroll-license" },
          { label: "WhatsApp help", href: supportWhatsAppHref("Hi, my FUNT license key failed. Username: "), external: true },
        ],
      },
      {
        question: "When and how do I get certificates?",
        intro: "Certificates are official documents issued when you meet the completion rules for that programme.",
        details: [
          "Typical requirements include finishing required modules, passing assignments, and settling fees—your centre defines the exact checklist.",
          "Once issued, certificates appear under Certificates with download options where enabled.",
          "Anyone can verify authenticity using the public Verify page with your certificate ID—useful for schools or competitions.",
        ],
        steps: [
          "Finish all mandatory learning items shown in your course.",
          "Check Certificates for status: pending, issued, or similar.",
          "Download PDF when available and store a backup copy.",
          "Share certificate ID only when an organisation needs to verify you.",
        ],
        actions: [
          { label: "Certificates", href: "/certificates" },
          { label: "Verify certificate", href: "/verify" },
        ],
      },
    ],
  },
  {
    id: "help",
    title: "Still stuck?",
    subtitle: "Reach the team with the right information so they can help in one go.",
    Icon: IconAssignment,
    items: [
      {
        question: "What information should I send when I contact support?",
        intro: "Good details save days of email ping-pong.",
        details: [
          "Always include your FUNT username (the one you type at login, often like name.surname).",
          "Mention the course title, batch name or code if you know it, and whether the issue is payment, access, assignment, or certificate.",
          "Attach screenshots of error messages, payment receipts, or license key screens (blur unrelated personal data if needed).",
        ],
        actions: [
          { label: "WhatsApp", href: supportWhatsAppHref("Hi FUNT support, I need help with FUNT Learn.\nMy username:\nIssue:"), external: true },
          { label: "Email", href: `mailto:${SUPPORT_EMAIL}?subject=FUNT%20Learn%20student%20help`, external: true },
        ],
      },
    ],
  },
];

function FaqAccordion({ item, groupKey }: { item: FaqItem; groupKey: string }) {
  return (
    <details className="group rounded-2xl border border-[#e8dcc4] bg-white/90 shadow-sm transition hover:border-[#d4bc7a] open:border-[#c9a84a] open:bg-gradient-to-b open:from-[#fffdf8] open:to-[#fffaf0] open:shadow-md">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-2xl px-4 py-4 pr-3 marker:content-none sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-left text-sm font-semibold leading-snug text-funt-ink sm:text-[0.95rem]">{item.question}</span>
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-[#a67c14] transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-[#f0e6cc] px-4 pb-5 pt-1 sm:px-5">
        {item.intro ? <p className="mt-3 text-sm font-medium leading-relaxed text-black/80">{item.intro}</p> : null}
        <div className="mt-3 space-y-2.5">
          {item.details.map((line, i) => (
            <p key={`${groupKey}-${item.question}-d-${i}`} className="text-sm leading-relaxed text-black/70">
              {line}
            </p>
          ))}
        </div>
        {item.steps && item.steps.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[#eee0bc] bg-[#fffbf0] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8f7318]">Step-by-step</p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-black/75">
              {item.steps.map((s, i) => (
                <li key={`${groupKey}-${item.question}-s-${i}`}>{s}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {item.actions && item.actions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.actions.map((action) =>
              action.external ? (
                <a
                  key={`${item.question}-${action.label}`}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d9c27a] bg-gradient-to-r from-[#f3e4b2] to-[#e8d48c] px-3.5 py-2 text-xs font-bold text-black shadow-sm transition hover:brightness-105"
                >
                  {action.label}
                  <span aria-hidden>↗</span>
                </a>
              ) : (
                <Link
                  key={`${item.question}-${action.label}`}
                  href={action.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e5d8b3] bg-white px-3.5 py-2 text-xs font-bold text-funt-ink shadow-sm transition hover:bg-[#fff8e8]"
                >
                  {action.label}
                  <span aria-hidden className="text-[#b8942a]">→</span>
                </Link>
              )
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function StudentFaqPage() {
  return (
    <AppPageShell className="relative gap-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 10% -10%, rgba(212, 175, 55, 0.22), transparent 55%), radial-gradient(700px 380px at 100% 20%, rgba(180, 150, 80, 0.12), transparent 50%)",
        }}
      />

      <PageSection className="relative border-[#e3d4a8] bg-gradient-to-br from-[#fff9e8] via-[#fffdf6] to-white shadow-[0_12px_40px_rgba(150,120,40,0.12)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#e8d9a8] bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8a6f12]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Student help centre
            </p>
            <h1 className="mt-3 font-brand-learn text-3xl font-black tracking-tight text-black sm:text-[2rem]">
              FAQ & detailed guide
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-black/70 sm:text-base">
              Everything below is written for <strong>students</strong> using FUNT Learn: navigation, studying, payments,
              license keys, certificates, and how to get support with the right details.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#e2c35f] to-[#c9a030] px-5 py-2.5 text-sm font-bold text-black shadow-md ring-1 ring-[#b8931f]/40 transition hover:brightness-105"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </PageSection>

      <div className="grid gap-6 lg:gap-8">
        {FAQ_GROUPS.map((group) => {
          const GIcon = group.Icon;
          return (
            <section
              key={group.id}
              className="rounded-3xl border border-[#ead9b4] bg-gradient-to-b from-white to-[#fffdf9] p-5 shadow-[0_10px_36px_rgba(120,90,30,0.08)] sm:p-6"
            >
              <div className="flex flex-wrap items-start gap-4 border-b border-[#f2e6cc] pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff3cc] to-[#e8d49a] text-black shadow-inner ring-1 ring-[#dcc48a]/60">
                  <GIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-funt-ink sm:text-xl">{group.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-black/60">{group.subtitle}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <FaqAccordion key={`${group.id}-${item.question}`} item={item} groupKey={group.id} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-3xl border-2 border-[#d4bc7a] bg-gradient-to-br from-[#fff6dc] via-[#fffef8] to-[#fff9e6] p-5 shadow-[0_14px_40px_rgba(100,75,20,0.15)] sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a5f0c]">Contact</p>
            <h2 className="mt-1 text-xl font-bold text-black">Quick support links</h2>
            <p className="mt-2 max-w-xl text-sm text-black/65">
              Use these when FAQ is not enough. Have your <strong>username</strong> and <strong>course name</strong> ready.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/payment"
            className="group flex flex-col rounded-2xl border border-[#e0cf9e] bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-[#9b7a13]">Fees</span>
            <span className="mt-1 font-semibold text-funt-ink">Payment</span>
            <span className="mt-1 text-xs text-black/55">Check status, receipts, course checkout</span>
          </Link>
          <Link
            href="/certificates"
            className="group flex flex-col rounded-2xl border border-[#e0cf9e] bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-[#9b7a13]">Proof</span>
            <span className="mt-1 font-semibold text-funt-ink">Certificates</span>
            <span className="mt-1 text-xs text-black/55">Download and track issued certificates</span>
          </Link>
          <Link
            href="/forgot-username"
            className="group flex flex-col rounded-2xl border border-[#e0cf9e] bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-[#9b7a13]">Login</span>
            <span className="mt-1 font-semibold text-funt-ink">Forgot username</span>
            <span className="mt-1 text-xs text-black/55">Recover sign-in details safely</span>
          </Link>
          <a
            href={supportWhatsAppHref("Hi FUNT support, I need help with FUNT Learn.\nMy username:\nIssue:")}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col rounded-2xl border border-emerald-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">Chat</span>
            <span className="mt-1 font-semibold text-funt-ink">WhatsApp</span>
            <span className="mt-1 text-xs text-black/55">{SUPPORT_WHATSAPP_DISPLAY}</span>
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=FUNT%20Learn%20student%20support`}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:col-span-2 lg:col-span-1"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Email</span>
            <span className="mt-1 font-semibold text-funt-ink">Write to us</span>
            <span className="mt-1 text-xs text-black/55">{SUPPORT_EMAIL}</span>
          </a>
        </div>
      </section>
    </AppPageShell>
  );
}
