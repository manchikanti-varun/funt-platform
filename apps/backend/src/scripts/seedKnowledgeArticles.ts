/**
 * Seeds the Knowledge Center with DETAILED articles for EVERY feature in FUNT.
 * Run: npx tsx src/scripts/seedKnowledgeArticles.ts
 *
 * Each article contains: Overview, Purpose, Who Uses It, Step-by-Step Guide,
 * Best Practices, Common Mistakes, Troubleshooting, and Related info.
 *
 * Role-based visibility is strictly enforced — each article only shows to relevant roles.
 * Safe to run multiple times — skips articles that already exist (matched by slug).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { KnowledgeArticleModel } from "../models/KnowledgeArticle.model.js";
import { ROLE } from "@funt-platform/constants";

const R = ROLE;
const SUPER_ONLY = [R.SUPER_ADMIN];
const ADMIN_UP = [R.SUPER_ADMIN, R.ADMIN];
const TRAINER_UP = [R.SUPER_ADMIN, R.ADMIN, R.TRAINER];
const STUDENT_UP = [R.SUPER_ADMIN, R.ADMIN, R.TRAINER, R.STUDENT];
const PARENT_UP = [R.SUPER_ADMIN, R.ADMIN, R.PARENT];
const EVERYONE = [R.SUPER_ADMIN, R.ADMIN, R.TRAINER, R.STUDENT, R.PARENT];

interface ArticleSeed {
  title: string;
  category: string;
  subcategory?: string;
  type: "GUIDE" | "FAQ" | "TROUBLESHOOTING" | "RELEASE_NOTE" | "ONBOARDING";
  roles: string[];
  content: string;
  summary: string;
  tags: string[];
  order: number;
  onboardingStep?: number;
  onboardingRole?: string;
}

function makeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL ARTICLES
// ═══════════════════════════════════════════════════════════════════════════════

const ARTICLES: ArticleSeed[] = [

// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 1: PLATFORM OVERVIEW (visible to everyone)
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "What is FUNT Platform — Complete Overview",
  category: "platform-overview", type: "GUIDE", roles: EVERYONE, order: 1,
  summary: "Full overview of FUNT — architecture, roles, capabilities, and how everything connects.",
  tags: ["overview", "platform", "roles", "architecture", "getting-started"],
  content: `<h2>Overview</h2>
<p>FUNT is a purpose-built education technology platform designed for robotics academies and STEM training institutes. It unifies administration, learning delivery, progress tracking, payments, and communication into one ecosystem so that no manual knowledge transfer sessions are needed.</p>

<h2>Purpose</h2>
<p>FUNT exists to eliminate manual overhead. Instead of spreadsheets, WhatsApp groups, and disconnected tools, FUNT provides a single platform where every stakeholder has exactly what they need — from the Super Admin configuring the system to the parent checking their child's progress.</p>

<h2>Platform Architecture</h2>

<h3>1. Admin Panel (admin.funt.in)</h3>
<p>The command center for academy operations. Used by Super Admins, Admins, and Trainers.</p>
<ul>
<li><strong>Content Management</strong> — Create chapters, assignments, courses, and organise them into batches</li>
<li><strong>Student Operations</strong> — Enrollments, attendance, progress monitoring, certificates</li>
<li><strong>Financial Operations</strong> — Payment approvals, invoices, revenue tracking, shop management</li>
<li><strong>Team Operations</strong> — Staff accounts, leave management, performance insights</li>
<li><strong>System Administration</strong> — Analytics, audit logs, configuration (Super Admin only)</li>
</ul>

<h3>2. LMS — Student Portal (learn.funt.in)</h3>
<p>Where students access their learning:</p>
<ul>
<li><strong>Learn</strong> — Courses, chapters, videos, assignments</li>
<li><strong>Growth</strong> — XP, levels, skills, achievements, certificates, shop</li>
<li><strong>Account</strong> — Payments, invoices, profile, support, FAQ</li>
</ul>

<h3>3. Parent Portal (learn.funt.in/parent)</h3>
<p>Read-only view for parents:</p>
<ul>
<li>Course progress with chapter-level breakdown</li>
<li>Attendance records and percentages</li>
<li>Certificate status</li>
<li>Learning plan milestone tracking</li>
</ul>

<h2>Role Hierarchy</h2>
<table>
<thead><tr><th>Role</th><th>Portal</th><th>Access Level</th></tr></thead>
<tbody>
<tr><td><strong>Super Admin</strong></td><td>Admin Panel</td><td>Everything — system config, analytics, audit, coupons, content protection, knowledge center management</td></tr>
<tr><td><strong>Admin</strong></td><td>Admin Panel</td><td>Team, content, operations, payments, enrollments — all except system-level settings</td></tr>
<tr><td><strong>Trainer</strong></td><td>Admin Panel</td><td>Content creation (chapters, assignments, courses, batches), attendance, own leaves, assigned tickets</td></tr>
<tr><td><strong>Student</strong></td><td>LMS</td><td>Courses, assignments, progress, certificates, payments, shop, support</td></tr>
<tr><td><strong>Parent</strong></td><td>Parent Portal</td><td>Read-only view of linked child's progress, attendance, certificates</td></tr>
</tbody>
</table>

<h2>Security Architecture</h2>
<ul>
<li><strong>Authentication</strong> — JWT with httpOnly cookie sessions, portal-aware (separate admin vs LMS sessions)</li>
<li><strong>Idle Timeout</strong> — Auto-logout after configurable inactivity period per portal</li>
<li><strong>Single-Device Enforcement</strong> — Token versioning ensures only one active session per user</li>
<li><strong>Role-Based Access Control</strong> — Every API endpoint enforces role checks server-side</li>
<li><strong>Rate Limiting</strong> — Redis-backed rate limiters on auth and API endpoints</li>
<li><strong>Input Validation</strong> — Zod schemas validate all incoming data</li>
</ul>

<h2>Key Principles</h2>
<ul>
<li><strong>Role-Based Access</strong> — Every user sees only what they need. No data leakage.</li>
<li><strong>Audit Trail</strong> — All significant actions are logged.</li>
<li><strong>Mobile-First</strong> — Fully responsive on phones and tablets.</li>
<li><strong>Self-Service</strong> — Knowledge Center eliminates dependency on live KT sessions.</li>
</ul>`,
},

// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 2: SUPER ADMIN ONLY FEATURES
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "Analytics Dashboard — Platform-Wide Insights",
  category: "analytics", type: "GUIDE", roles: SUPER_ONLY, order: 1,
  summary: "How to use the Analytics Dashboard for enrollment trends, revenue metrics, course performance, and engagement data.",
  tags: ["analytics", "reports", "super-admin", "metrics", "revenue", "enrollment"],
  content: `<h2>Overview</h2>
<p>The Analytics Dashboard provides platform-wide insights that help Super Admins make data-driven decisions about courses, pricing, staffing, and growth strategy.</p>

<h2>Purpose</h2>
<p>Without analytics, you are flying blind. This dashboard answers critical business questions: How many students are active? Which courses have the best completion rates? Where is revenue trending? Which trainers have the highest engagement? Where are students dropping off?</p>

<h2>Who Uses It</h2>
<p><strong>Super Admin only.</strong> This contains sensitive business data (revenue, performance metrics) that should not be visible to other roles.</p>

<h2>Access</h2>
<p>Navigate to <code>System &rarr; Analytics</code> in the sidebar. This section appears only for Super Admins.</p>

<h2>Key Reports Available</h2>
<ul>
<li><strong>Enrollment Trends</strong> — Monthly new enrollments, active vs. completed vs. dropped. Shows growth trajectory and seasonality patterns.</li>
<li><strong>Revenue Metrics</strong> — Total collections, revenue by course, by batch, month-over-month growth. Helps identify your most profitable programmes.</li>
<li><strong>Course Performance</strong> — Completion rates per course, average time to complete, drop-off points (which chapters lose students).</li>
<li><strong>Student Engagement</strong> — Active students per week, assignment submission rates, average attendance. Identifies engagement problems early.</li>
<li><strong>Trainer Metrics</strong> — Batches managed, attendance marking consistency, assignment review speed. Helps assess trainer workload and performance.</li>
</ul>

<h2>Step-by-Step Usage</h2>
<ol>
<li>Open <strong>System &rarr; Analytics</strong></li>
<li>Select the date range you want to analyse (defaults to last 30 days)</li>
<li>Review each metric section — enrollment, revenue, performance</li>
<li>Click into any chart for drill-down details</li>
<li>Use the data to inform decisions: pricing changes, content improvements, staffing</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Review analytics weekly to spot trends early</li>
<li>Compare month-over-month to identify seasonality</li>
<li>Use completion rate data to identify courses needing content improvement</li>
<li>Monitor drop-off points to understand where students lose interest</li>
<li>Track revenue per student to optimize pricing</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Looking only at total numbers without considering per-student metrics</li>
<li>Ignoring drop-off data — it tells you where your content needs work</li>
<li>Not comparing across time periods — a "good" month might still be declining</li>
</ul>`,
},
{
  title: "Audit Hub — Complete Activity Tracking",
  category: "analytics", subcategory: "Audit", type: "GUIDE", roles: SUPER_ONLY, order: 2,
  summary: "How to use the Audit Hub to track all platform actions, investigate issues, and maintain team accountability.",
  tags: ["audit", "logs", "tracking", "super-admin", "security", "accountability"],
  content: `<h2>Overview</h2>
<p>The Audit Hub is the platform's complete activity log. Every significant action — user creation, payment approval, course edit, login event, enrollment change, attendance correction — is recorded with who did it, when, and what changed.</p>

<h2>Purpose</h2>
<p>Audit logs provide accountability, help investigate discrepancies, and give you confidence that your team is operating correctly. If a payment disappears, a student claims wrongful marking, or you suspect unauthorized changes — the audit log has definitive answers.</p>

<h2>Who Uses It</h2>
<p><strong>Super Admin only.</strong> Contains sensitive operational data about all team actions.</p>

<h2>Access</h2>
<p><code>System &rarr; Audit Hub</code></p>

<h2>Step-by-Step: Investigating an Issue</h2>
<ol>
<li>Open <strong>System &rarr; Audit Hub</strong></li>
<li><strong>Filter by Action Type</strong> — Payment approvals, user creation, course edits, login events, enrollment changes, attendance corrections</li>
<li><strong>Filter by User</strong> — See all actions performed by a specific admin or trainer</li>
<li><strong>Filter by Date Range</strong> — Narrow to the relevant timeframe</li>
<li><strong>View Details</strong> — Click any log entry to see full before/after values</li>
</ol>

<h2>Common Investigation Scenarios</h2>
<ul>
<li><strong>"Who approved this payment?"</strong> — Filter: payment approvals + date range</li>
<li><strong>"When was this student's enrollment changed?"</strong> — Filter: enrollment actions + student name</li>
<li><strong>"Is this trainer marking attendance on time?"</strong> — Filter: attendance actions + trainer + date</li>
<li><strong>"Who deleted this course?"</strong> — Filter: course deletions + date range</li>
<li><strong>"Was there unauthorized access?"</strong> — Filter: login events + unusual hours</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Check audit logs before asking team members about discrepancies — the log is factual</li>
<li>Periodically review for unusual patterns (bulk actions at odd hours, repeated failed logins)</li>
<li>Use audit data in team performance reviews</li>
<li>Set up a weekly 5-minute audit review habit</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>Cannot find a specific action</strong> — Try broader date range or different action type filter</li>
<li><strong>Log shows "SYSTEM" as user</strong> — Automated actions (cron jobs, auto-enrollment) use SYSTEM</li>
</ul>`,
},
{
  title: "Content Protection Configuration",
  category: "content-protection", type: "GUIDE", roles: SUPER_ONLY, order: 1,
  summary: "How to configure DRM and content protection to prevent unauthorized copying of course materials.",
  tags: ["content-protection", "drm", "security", "super-admin", "config", "watermark"],
  content: `<h2>Overview</h2>
<p>Content Protection adds technical restrictions to prevent students from easily copying, screenshotting, or downloading proprietary course materials displayed in the LMS.</p>

<h2>Purpose</h2>
<p>Your course content (videos, documents, lesson text) is intellectual property. While no DRM is 100% unbreakable, content protection significantly raises the barrier for casual copying — deterring the vast majority of unauthorized reproduction attempts.</p>

<h2>Who Uses It</h2>
<p><strong>Super Admin only.</strong> This is a system-level configuration that affects all students.</p>

<h2>Access</h2>
<p><code>Config &rarr; Content Protection</code></p>

<h2>Available Protection Layers</h2>
<ul>
<li><strong>Right-click Disable</strong> — Prevents "Save Image As", "Copy", and "View Source" context menus on content pages</li>
<li><strong>Screenshot Deterrence</strong> — Adds visual overlays that disrupt common screenshot and screen-capture tools</li>
<li><strong>Watermarking</strong> — Overlays the student's username semi-transparently on content, making leaked material traceable</li>
<li><strong>Video Protection</strong> — Prevents direct download of hosted video files; streaming only</li>
<li><strong>DevTools Warning</strong> — Detects browser developer tools and shows a warning</li>
</ul>

<h2>Step-by-Step Configuration</h2>
<ol>
<li>Navigate to <code>Config &rarr; Content Protection</code></li>
<li>Toggle the <strong>Master Switch</strong> to enable/disable all protection globally</li>
<li>Configure individual protection layers based on your needs</li>
<li>Click <strong>Save</strong></li>
<li>Changes apply immediately to all student content views</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Enable watermarking as a minimum — it deters sharing even if other protections are bypassed</li>
<li>Test on multiple devices after enabling (phone, tablet, laptop) to ensure content remains accessible</li>
<li>Balance security vs. usability — overly aggressive protection can frustrate legitimate students</li>
</ul>

<h2>Important Notes</h2>
<ul>
<li>Content protection is a <strong>deterrent</strong>, not foolproof. External screen recorders and phone cameras can always bypass it.</li>
<li>Focus on making your content valuable enough that students want to stay enrolled rather than pirate it.</li>
</ul>`,
},
{
  title: "Coupons Management",
  category: "shop", subcategory: "Coupons", type: "GUIDE", roles: SUPER_ONLY, order: 2,
  summary: "How to create, manage, and track discount coupons for shop purchases and course enrollments.",
  tags: ["coupons", "discount", "super-admin", "shop", "promotions", "codes"],
  content: `<h2>Overview</h2>
<p>Coupons allow you to offer discounts on shop purchases or course enrollment fees. Students enter a coupon code during checkout to receive the discount.</p>

<h2>Purpose</h2>
<p>Coupons drive enrollment during slow periods, reward loyal students, enable partnerships (school-specific codes), and support promotional campaigns.</p>

<h2>Who Uses It</h2>
<p><strong>Super Admin only.</strong> Creating discounts affects revenue and must be controlled at the highest level.</p>

<h2>Access</h2>
<p><code>Payments &amp; Commerce &rarr; Coupons</code></p>

<h2>Step-by-Step: Creating a Coupon</h2>
<ol>
<li>Go to <strong>Coupons</strong> in the sidebar</li>
<li>Click <strong>Create Coupon</strong></li>
<li>Configure:
  <ul>
  <li><strong>Coupon Code</strong> — What students type (e.g., SUMMER25, SCHOOL50OFF)</li>
  <li><strong>Discount Type</strong> — Percentage (e.g., 20% off) or Fixed Amount (e.g., Rs 500 off)</li>
  <li><strong>Discount Value</strong> — The percentage or rupee amount</li>
  <li><strong>Usage Limit</strong> — Maximum total redemptions (e.g., 100 uses)</li>
  <li><strong>Per-User Limit</strong> — How many times one student can use it (usually 1)</li>
  <li><strong>Expiry Date</strong> — When the coupon becomes invalid</li>
  <li><strong>Minimum Order</strong> — Optional minimum purchase amount to apply discount</li>
  </ul>
</li>
<li>Save — the coupon is immediately active</li>
</ol>

<h2>Monitoring Usage</h2>
<ul>
<li>View all coupon usage in the Coupon Audit section</li>
<li>See who redeemed which code, when, and for what amount</li>
<li>Track remaining uses vs. limit</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Use memorable, uppercase codes: WELCOME20, DIWALI500, SCHOOL-ABC</li>
<li>Set reasonable expiry dates — urgency drives usage</li>
<li>Limit per-user to 1 to prevent abuse</li>
<li>Create separate codes for different campaigns to track effectiveness</li>
<li>Audit coupon usage monthly to check for patterns of abuse</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li><strong>No expiry date</strong> — Coupons circulate forever. Always set an expiry.</li>
<li><strong>No usage limit</strong> — Viral sharing can cost you significant revenue</li>
<li><strong>Confusing codes</strong> — Avoid codes with 0/O or 1/l ambiguity</li>
</ul>`,
},
{
  title: "Knowledge Center Management",
  category: "platform-overview", subcategory: "Knowledge Center", type: "GUIDE", roles: SUPER_ONLY, order: 10,
  summary: "How to create, edit, publish, and manage Knowledge Center articles as Super Admin.",
  tags: ["knowledge-center", "articles", "manage", "super-admin", "documentation"],
  content: `<h2>Overview</h2>
<p>The Knowledge Center is the official operating manual of FUNT. As a Super Admin, you can create, edit, publish, and delete articles that help all users learn the platform independently.</p>

<h2>Purpose</h2>
<p>Eliminate dependency on live knowledge transfer sessions. Every new Admin, Trainer, Student, or Parent should be able to learn FUNT independently by reading Knowledge Center articles.</p>

<h2>Who Uses It</h2>
<p><strong>Super Admin</strong> — Creates and manages articles (CRUD access)</p>
<p><strong>All other roles</strong> — Read articles filtered to their role (no management access)</p>

<h2>Access</h2>
<p><code>Knowledge Center &rarr; Manage Articles</code> (the Manage button only appears for Super Admins)</p>

<h2>Creating an Article</h2>
<ol>
<li>Go to <strong>Knowledge Center &rarr; Manage Articles</strong></li>
<li>Click <strong>New Article</strong></li>
<li>Fill in:
  <ul>
  <li><strong>Title</strong> — Clear, descriptive title (max 300 characters)</li>
  <li><strong>Category</strong> — Which feature area it belongs to</li>
  <li><strong>Type</strong> — GUIDE, FAQ, TROUBLESHOOTING, RELEASE_NOTE, or ONBOARDING</li>
  <li><strong>Roles</strong> — Which roles can see this article (critical for security)</li>
  <li><strong>Content</strong> — Full article body (HTML supported)</li>
  <li><strong>Summary</strong> — Brief description shown in search results</li>
  <li><strong>Tags</strong> — Keywords for search discoverability</li>
  </ul>
</li>
<li>Toggle Published status</li>
<li>Save</li>
</ol>

<h2>Role Visibility Rules</h2>
<table>
<thead><tr><th>Article For</th><th>Set Roles To</th></tr></thead>
<tbody>
<tr><td>Super Admin documentation</td><td>SUPER_ADMIN only</td></tr>
<tr><td>Admin guides</td><td>SUPER_ADMIN + ADMIN</td></tr>
<tr><td>Trainer guides</td><td>SUPER_ADMIN + ADMIN + TRAINER</td></tr>
<tr><td>Student help</td><td>SUPER_ADMIN + ADMIN + TRAINER + STUDENT</td></tr>
<tr><td>Parent help</td><td>SUPER_ADMIN + ADMIN + PARENT</td></tr>
<tr><td>Universal (platform overview)</td><td>All roles</td></tr>
</tbody>
</table>

<h2>Best Practices</h2>
<ul>
<li>Every article should follow the standard: Overview &rarr; Purpose &rarr; Who Uses It &rarr; Step-by-Step &rarr; Best Practices &rarr; Common Mistakes &rarr; Troubleshooting</li>
<li>Keep titles searchable — students will search "how do I pay" not "payment workflow documentation"</li>
<li>Use FAQ type for short Q&A format articles</li>
<li>Use TROUBLESHOOTING type for problem-resolution articles</li>
<li>Review and update articles when features change</li>
</ul>`,
},

// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 3: ADMIN + SUPER ADMIN FEATURES
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "Team Management — Creating and Managing Staff Accounts",
  category: "trainers", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "Complete guide to creating admin/trainer accounts, managing roles, suspending users, and team operations.",
  tags: ["team", "management", "admin", "trainers", "add-user", "staff", "accounts"],
  content: `<h2>Overview</h2>
<p>Team Management is where you create and manage all staff accounts that access the Admin Panel — both Admins and Trainers.</p>

<h2>Purpose</h2>
<p>Centralised staff management ensures proper access control, easy onboarding of new team members, and quick deactivation when someone leaves.</p>

<h2>Who Uses It</h2>
<p><strong>Admin and Super Admin.</strong> Trainers cannot create or manage other accounts.</p>

<h2>Step-by-Step: Adding a Team Member</h2>
<ol>
<li>Go to <code>Team &rarr; Team Management</code></li>
<li>Click <strong>Add Member</strong></li>
<li>Fill in required fields:
  <ul>
  <li><strong>Name</strong> — Full name as it should appear in the system</li>
  <li><strong>Username</strong> — Unique login ID (e.g., firstname.lastname)</li>
  <li><strong>Mobile</strong> — Contact number (required)</li>
  <li><strong>Email</strong> — Optional but recommended</li>
  </ul>
</li>
<li>Assign role(s):
  <ul>
  <li><strong>Trainer</strong> — Content creation, batch operations, attendance</li>
  <li><strong>Admin</strong> — Full operational access (team, payments, enrollments)</li>
  <li>A user can have both roles simultaneously</li>
  </ul>
</li>
<li>Set initial password or use auto-generated credentials</li>
<li>Save — they can immediately log into the Admin Panel</li>
</ol>

<h2>Managing Existing Members</h2>
<ul>
<li><strong>Edit</strong> — Update name, contact details, or roles</li>
<li><strong>Suspend</strong> — Temporarily disable access (preserves all data)</li>
<li><strong>Activate</strong> — Re-enable a suspended account</li>
<li><strong>Reset Password</strong> — Generate new credentials if they are locked out</li>
</ul>

<h2>People Insights</h2>
<p>View performance and activity data: <code>Team &rarr; People Insights</code></p>
<ul>
<li>Login frequency and last active timestamp</li>
<li>Number of batches managed per trainer</li>
<li>Attendance marking consistency (how often they mark on time)</li>
<li>Assignment review speed (average time from submission to review)</li>
</ul>

<h2>Badges</h2>
<p>Recognise team achievements: <code>Team &rarr; Badges</code></p>
<ul>
<li>Create custom badges (e.g., "100 Assignments Reviewed", "Perfect Attendance Marking Streak")</li>
<li>Award badges to specific team members</li>
<li>Badges are visible on team profiles</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Use <strong>Trainer</strong> role for staff who only need content and batch access</li>
<li>Use <strong>Admin</strong> role only for staff who need payment, team, and enrollment management</li>
<li>Always <strong>suspend</strong> (not delete) when someone leaves — preserves audit history</li>
<li>Review People Insights monthly to identify training needs or burnout</li>
<li>Use consistent username conventions across the team</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Giving Admin role to everyone — increases risk. Use minimum necessary role.</li>
<li>Not suspending accounts when staff leave — security risk</li>
<li>Sharing login credentials between team members — creates audit confusion</li>
</ul>`,
},
{
  title: "Courses — Creating and Managing Learning Programmes",
  category: "courses", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "How to create courses from global chapters, manage versions, duplicate, archive, and publish.",
  tags: ["courses", "create", "chapters", "content", "publish", "version", "archive"],
  content: `<h2>Overview</h2>
<p>A Course is an ordered collection of Global Chapters that defines a complete learning path. Courses are assigned to Batches, and students access them through their batch enrollment.</p>

<h2>Purpose</h2>
<p>Courses let you package reusable chapter content into structured programmes. The same chapters can appear in multiple courses with different orderings — serving different skill levels from the same content library.</p>

<h2>Who Uses It</h2>
<ul>
<li><strong>Admin/Super Admin</strong> — Full CRUD: create, edit, archive, delete, duplicate</li>
<li><strong>Trainer</strong> — View-only access to understand what students are learning</li>
</ul>

<h2>Step-by-Step: Creating a Course</h2>
<ol>
<li>Navigate to <code>Content &rarr; Courses</code></li>
<li>Click <strong>New Course</strong></li>
<li>Enter a clear title (e.g., "Robotics Fundamentals Level 1")</li>
<li>Add an optional description explaining what students will learn</li>
<li>Add chapters from the Global Chapters library — drag to reorder</li>
<li>Set status: Active (default), Launching Soon, or Archived</li>
<li>Save — course is created at version 1</li>
</ol>

<h2>Course Operations</h2>
<ul>
<li><strong>Edit</strong> — Modify title, description, chapter order. Increments version number.</li>
<li><strong>Duplicate</strong> — Creates a copy for variants (shorter version, different level)</li>
<li><strong>Archive</strong> — Hides from new batch assignments. Existing batches continue working.</li>
<li><strong>Unarchive</strong> — Bring back to Active status</li>
<li><strong>Delete</strong> — Permanent removal (Super Admin only). Blocked if any batch references it.</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Naming: <code>[Subject]-[Level]-[Version]</code> (e.g., "Arduino-Beginner-v2")</li>
<li>Order chapters foundational &rarr; advanced</li>
<li>Keep descriptions under 2 sentences — shows on student course cards</li>
<li>Review chapter XP values before assigning to a batch</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Empty courses (no chapters) — useless. Always add content before assigning to a batch.</li>
<li>Wrong chapter order — confuses students. Preview the learning flow.</li>
<li>Archiving courses with active batches — check first.</li>
<li>Duplicate/vague titles — students cannot tell courses apart.</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>Cannot delete course</strong> — A batch still references it. Unlink or archive the batch first.</li>
<li><strong>Student cannot see chapters</strong> — Verify their enrollment is ACTIVE and the batch has this course assigned.</li>
<li><strong>Version confusion</strong> — Editing a course updates it for ALL batches using it. Plan edits carefully.</li>
</ul>`,
},
{
  title: "Batches — Creating Cohorts and Managing Enrollments",
  category: "batches", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "Complete guide to batch creation, trainer assignment, scheduling, pricing, enrollment management, and lifecycle.",
  tags: ["batches", "create", "enrollment", "trainers", "schedule", "pricing", "cohorts"],
  content: `<h2>Overview</h2>
<p>A Batch groups students into a cohort studying the same course(s) together, under assigned trainers, on a defined schedule, with specific pricing. It is the operational unit of FUNT.</p>

<h2>Purpose</h2>
<p>Run the same course as multiple parallel batches — Monday morning batch, Saturday intensive, online-only batch — each with different trainers, schedules, and pricing, all from the same course content.</p>

<h2>Who Uses It</h2>
<ul>
<li><strong>Admin/Super Admin</strong> — Creates batches, configures pricing, manages enrollments</li>
<li><strong>Trainer</strong> — Operates within assigned batches (attendance, assignments)</li>
</ul>

<h2>Step-by-Step: Creating a Batch</h2>
<ol>
<li>Go to <code>Content &rarr; Batches</code>, click <strong>Create Batch</strong></li>
<li><strong>Name</strong> — Use format: <code>[Course]-[Month]-[Year]-[Timing]</code></li>
<li><strong>Select Course(s)</strong> — The curriculum this batch delivers</li>
<li><strong>Assign Trainer(s)</strong> — Who will mark attendance and review work</li>
<li><strong>Schedule</strong> — Days and times (e.g., Mon/Wed/Fri 10:00-11:30)</li>
<li><strong>Pricing</strong> — Enrollment fee per student. Can be per-course if multiple courses.</li>
<li><strong>Capacity</strong> — Optional max student count</li>
<li>Save</li>
</ol>

<h2>Enrollment Management</h2>
<p>Students join through:</p>
<ul>
<li><strong>Manual</strong> — Admin adds students directly</li>
<li><strong>Payment-based</strong> — Auto-enrolled on payment approval</li>
<li><strong>License Key</strong> — Instant access via pre-paid key</li>
</ul>
<p>Statuses: PENDING, ACTIVE, COMPLETED, SUSPENDED, DROPPED</p>

<h2>Best Practices</h2>
<ul>
<li>Assign trainers BEFORE enrolling students</li>
<li>Set pricing BEFORE opening enrollments</li>
<li>Archive completed batches to keep lists clean</li>
<li>Use batch names with timing for easy identification</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>No course assigned — empty curriculum</li>
<li>No trainer — nobody can operate the batch</li>
<li>Price = 0 unintentionally — free enrollment</li>
<li>Archiving while students are active — they lose access</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>Student cannot see course</strong> — Check: enrollment ACTIVE + batch has course</li>
<li><strong>Trainer cannot mark attendance</strong> — Must be assigned to the batch</li>
<li><strong>Cannot archive</strong> — Active enrollments exist. Complete or suspend them first.</li>
</ul>`,
},
{
  title: "Payment Approvals — Verifying and Processing Payments",
  category: "payments", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "Complete workflow for reviewing, verifying, approving, and rejecting student payments with UPI/bank transfer.",
  tags: ["payments", "approval", "upi", "verification", "workflow", "bank-transfer"],
  content: `<h2>Overview</h2>
<p>When students pay for courses or shop items via UPI or bank transfer, the payment requires manual verification by an admin before course access is granted.</p>

<h2>Purpose</h2>
<p>UPI and bank transfers do not have automatic webhooks like international payment gateways. Admins must verify the transaction reference (UTR) against bank records before unlocking access.</p>

<h2>Who Uses It</h2>
<p><strong>Admin and Super Admin only.</strong></p>

<h2>Step-by-Step: Processing a Payment</h2>
<ol>
<li>Go to <code>Payments &amp; Commerce &rarr; Payment Approvals</code></li>
<li>Review the queue of pending payments</li>
<li>For each payment, verify:
  <ul>
  <li>UTR number matches your bank/UPI transaction history</li>
  <li>Amount matches the course fee exactly</li>
  <li>Student name matches the sender</li>
  <li>Course/batch is correct</li>
  </ul>
</li>
<li><strong>Approve</strong> — Student is auto-enrolled and gains access immediately</li>
<li><strong>Reject</strong> — Add clear reason (e.g., "Amount mismatch: received 4000, fee is 5000")</li>
</ol>

<h2>UPI QR Center</h2>
<p>Configure payment QR codes: <code>Payments &amp; Commerce &rarr; UPI QR Center</code></p>
<ul>
<li>Upload QR code images for your UPI IDs</li>
<li>Set which QR is currently active</li>
<li>Students see this QR during checkout</li>
</ul>

<h2>Finance Dashboard</h2>
<p>Track revenue: <code>Payments &amp; Commerce &rarr; Finance Dashboard</code></p>
<ul>
<li>Total revenue, pending amounts, monthly collections</li>
<li>Revenue breakdown by course and batch</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Process payments within 24 hours</li>
<li>ALWAYS verify UTR — never approve on amount alone</li>
<li>Check for duplicates from same student before approving</li>
<li>Use consistent rejection message format</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Approving without UTR verification — fraud risk</li>
<li>Approving wrong student — double-check username</li>
<li>Delayed processing — students lose trust</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>No entry in queue but student claims paid</strong> — Ask for date, time, UTR, amount. May be wrong UPI ID.</li>
<li><strong>Approved but still locked</strong> — Check if enrollment was created successfully</li>
<li><strong>Duplicate payment</strong> — Approve one, reject other with "Duplicate — refund processing"</li>
</ul>`,
},
{
  title: "Invoices — Generation and Management",
  category: "payments", subcategory: "Invoices", type: "GUIDE", roles: ADMIN_UP, order: 2,
  summary: "How invoices are generated, viewed, downloaded as PDFs, and managed.",
  tags: ["invoices", "payments", "pdf", "billing", "receipts"],
  content: `<h2>Overview</h2>
<p>Invoices are official payment records auto-generated for student enrollments. Both admins and students can view and download them as PDFs.</p>

<h2>Purpose</h2>
<p>Provide formal billing documentation for payments — useful for tax purposes, institutional reimbursements, and payment proof.</p>

<h2>Who Uses It</h2>
<ul><li><strong>Admin/Super Admin</strong> — View all invoices, manage status</li><li><strong>Student</strong> — View and download their own invoices</li></ul>

<h2>How It Works</h2>
<ul>
<li>Invoices are auto-generated when a payment is successfully approved</li>
<li>Each invoice has a unique number: FUNT-INV-[DATE]-[SEQUENCE]</li>
<li>Contains: student details, course/batch, amount, payment date, status</li>
<li>Downloadable as PDF with proper formatting</li>
</ul>

<h2>Admin Operations</h2>
<ol>
<li>Go to <code>Payments &amp; Commerce &rarr; Invoices</code></li>
<li>View all invoices with filters (status, date, student)</li>
<li>Click any invoice for full details and PDF download</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Ensure student contact details are correct before payment (they appear on invoice)</li>
<li>Verify pricing on batches before enrollments begin</li>
</ul>`,
},
{
  title: "License Keys — Generation, Distribution, and Tracking",
  category: "license-keys", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "Complete guide to generating license keys, distributing them, and tracking redemption status.",
  tags: ["license-keys", "generate", "redeem", "enrollment", "access", "bulk"],
  content: `<h2>Overview</h2>
<p>License Keys are single-use codes that grant instant course/batch access without going through the payment approval flow.</p>

<h2>Purpose</h2>
<p>Ideal for: pre-paid institutional purchases (school buys 50 seats), sponsored enrollments, partnerships, and offline payment scenarios where you want instant digital access.</p>

<h2>Who Uses It</h2>
<ul><li><strong>Admin/Super Admin</strong> — Generate and track keys</li><li><strong>Student</strong> — Redeem keys for instant access</li></ul>

<h2>Generating Keys</h2>
<ol>
<li>Navigate to License Keys management</li>
<li>Select the target course/batch</li>
<li>Specify quantity to generate</li>
<li>Generate — each key is unique, single-use</li>
<li>Export the key list for distribution</li>
</ol>

<h2>Student Redemption Flow</h2>
<ol>
<li>Student opens <code>License Key</code> in their LMS sidebar</li>
<li>Pastes the key (format: FUNT-XXXX-XXXX-XXXX)</li>
<li>Submits — course unlocks immediately</li>
<li>Key is marked "used" and cannot be reused</li>
</ol>

<h2>Tracking</h2>
<ul>
<li>View all keys: unused, used, expired</li>
<li>See which student redeemed which key</li>
<li>Export for reconciliation with partners</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>"Already used"</strong> — Keys are single-use. Generate a new one.</li>
<li><strong>"Expired"</strong> — Past validity window. Generate fresh.</li>
<li><strong>Wrong course unlocked</strong> — Key was for a different batch. Verify generation.</li>
<li><strong>Typo in key</strong> — Ask student to copy-paste carefully. Case and space sensitive.</li>
</ul>`,
},
{
  title: "Learning Plans — Milestones and Progressive Unlock",
  category: "learning-plans", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "How to configure learning plans with sequential milestones, payment gates, and milestone certificates.",
  tags: ["learning-plans", "milestones", "progression", "structured", "payment-gates"],
  content: `<h2>Overview</h2>
<p>Learning Plans add structured progression to courses by breaking them into milestones. Students unlock milestones sequentially, with each potentially gated by payment or completion.</p>

<h2>Purpose</h2>
<p>Not all courses should be fully available from day one. Learning Plans enable: progressive unlock, staggered payments (pay per milestone), and milestone certificates (proof of partial completion).</p>

<h2>Who Uses It</h2>
<ul><li><strong>Admin/Super Admin</strong> — Configure learning plans</li><li><strong>Student</strong> — Progress through milestones</li><li><strong>Parent</strong> — View milestone status</li></ul>

<h2>Configuration</h2>
<ol>
<li>Open a course detail page &rarr; Learning Plan tab</li>
<li>Add milestones sequentially (Milestone 1, 2, 3...)</li>
<li>For each milestone configure:
  <ul>
  <li><strong>Chapters included</strong> — Which chapters unlock at this stage</li>
  <li><strong>Payment required</strong> — Optional fee to unlock this milestone</li>
  <li><strong>Certificate on completion</strong> — Issue milestone-specific certificate</li>
  </ul>
</li>
<li>Save</li>
</ol>

<h2>Student Experience</h2>
<ul>
<li>Current milestone is highlighted</li>
<li>Next milestone shows as locked until requirements are met</li>
<li>Progress reflects milestone-level, not just chapter count</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Balance milestone sizes — roughly equal effort per milestone</li>
<li>Communicate full pricing upfront if using payment gates</li>
<li>Use milestone certificates for long programmes to maintain motivation</li>
</ul>`,
},
{
  title: "Data Import and Export",
  category: "import-export", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "How to bulk-import students via CSV and export platform data for reporting.",
  tags: ["import", "export", "bulk", "csv", "data", "students", "reporting"],
  content: `<h2>Overview</h2>
<p>Import/Export enables bulk operations — adding many students at once or extracting data for external reporting and migration.</p>

<h2>Who Uses It</h2>
<p><strong>Admin and Super Admin only.</strong></p>

<h2>Importing Students</h2>
<ol>
<li>Prepare CSV/Excel with columns: Name, Username, Mobile, Email, Grade, School</li>
<li>Navigate to Import section</li>
<li>Upload file &rarr; Map columns to FUNT fields</li>
<li>Preview data and fix errors (duplicates, missing fields)</li>
<li>Confirm — students are created with default passwords</li>
</ol>

<h2>Exporting Data</h2>
<p>Export as CSV/Excel:</p>
<ul>
<li>Student lists with enrollment details</li>
<li>Attendance records (by batch, date range)</li>
<li>Payment history</li>
<li>Certificate issuance records</li>
<li>Progress reports per course</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Preview before confirming import — errors are harder to fix after</li>
<li>Use consistent username format across imports</li>
<li>Communicate credentials securely to students/parents</li>
</ul>`,
},
{
  title: "Enrollment Requests and Management",
  category: "students", type: "GUIDE", roles: ADMIN_UP, order: 2,
  summary: "How to process enrollment requests, manage enrollment statuses, and handle student lifecycle.",
  tags: ["enrollment", "requests", "activate", "suspend", "drop", "student-lifecycle"],
  content: `<h2>Overview</h2>
<p>Enrollment management controls which students have access to which batches. Admins process requests, activate enrollments, and manage the full student lifecycle.</p>

<h2>Enrollment Statuses</h2>
<ul>
<li><strong>PENDING</strong> — Request submitted, awaiting admin action or payment</li>
<li><strong>ACTIVE</strong> — Student has full access to batch courses</li>
<li><strong>COMPLETED</strong> — Student finished all requirements</li>
<li><strong>SUSPENDED</strong> — Temporarily disabled (fee issues, disciplinary)</li>
<li><strong>DROPPED</strong> — Permanently removed from batch</li>
</ul>

<h2>Processing Enrollment Requests</h2>
<ol>
<li>Go to Enrollment Requests page</li>
<li>Review pending requests — student details, batch, payment status</li>
<li>Approve (activate) or reject with reason</li>
</ol>

<h2>Managing Active Enrollments</h2>
<ul>
<li><strong>Suspend</strong> — Temporarily revoke access (e.g., pending fee payment)</li>
<li><strong>Reactivate</strong> — Restore access after issue resolution</li>
<li><strong>Drop</strong> — Permanently remove from batch (cannot be undone easily)</li>
<li><strong>Complete</strong> — Mark as successfully finished</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Process requests within 24 hours</li>
<li>Use Suspend (not Drop) for temporary issues — preserves student data</li>
<li>Communicate status changes to students promptly</li>
</ul>`,
},
{
  title: "Profile Search — Finding Any User",
  category: "students", subcategory: "Search", type: "GUIDE", roles: ADMIN_UP, order: 3,
  summary: "How to search for any student, trainer, or admin across the platform.",
  tags: ["search", "profile", "find-user", "lookup"],
  content: `<h2>Overview</h2>
<p>Profile Search lets admins find any user in the system by name, username, mobile, or email. Useful for support queries, enrollment management, and quick lookups.</p>

<h2>How to Use</h2>
<ol>
<li>Navigate to Profile Search</li>
<li>Enter search term (name, username, mobile, or email)</li>
<li>Results show matching users with role, status, and key details</li>
<li>Click any result to view full profile</li>
</ol>

<h2>Use Cases</h2>
<ul>
<li>Student calls asking about their account — search by mobile</li>
<li>Need to find a specific trainer — search by name</li>
<li>Verify if a username exists before creating — search by username</li>
</ul>`,
},

// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 4: TRAINER + ADMIN FEATURES
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "Global Chapters — Creating Learning Content",
  category: "courses", subcategory: "Chapters", type: "GUIDE", roles: TRAINER_UP, order: 3,
  summary: "How to create, edit, and manage global chapters — the building blocks of all courses.",
  tags: ["chapters", "global-modules", "content", "create", "lessons", "media"],
  content: `<h2>Overview</h2>
<p>Global Chapters are reusable learning modules (lessons, videos, readings, activities) that form the building blocks of courses. One chapter can appear in multiple courses.</p>

<h2>Purpose</h2>
<p>Create content once, reuse everywhere. A chapter on "Introduction to Arduino" can be used in beginner, intermediate, and advanced courses without duplication.</p>

<h2>Who Uses It</h2>
<ul><li><strong>Trainer</strong> — Creates and edits chapters</li><li><strong>Admin/Super Admin</strong> — Same access plus archiving</li></ul>

<h2>Creating a Chapter</h2>
<ol>
<li>Go to <code>Content &rarr; Chapters</code></li>
<li>Click <strong>New Chapter</strong></li>
<li>Fill in:
  <ul>
  <li><strong>Title</strong> — Clear topic name</li>
  <li><strong>Description</strong> — Brief overview of what this chapter covers</li>
  <li><strong>Content</strong> — Rich text body with the actual lesson material</li>
  <li><strong>Media</strong> — Upload videos, documents, images to enhance learning</li>
  <li><strong>XP Value</strong> — Points students earn on completion (motivational)</li>
  </ul>
</li>
<li>Save</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>One chapter = one focused topic. Do not cram multiple concepts.</li>
<li>Set XP proportional to effort — longer/harder chapters get more XP</li>
<li>Use rich text formatting: headings, bullet points, code blocks</li>
<li>Include media (video, diagrams) for complex topics</li>
<li>Write for the student level — avoid jargon without explanation</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Chapters that are too long — students lose focus. Split into multiple.</li>
<li>No XP set — students have no completion incentive</li>
<li>Archiving a chapter used in active courses — check course dependencies first</li>
</ul>`,
},
{
  title: "Assignments — Creation and Review Workflow",
  category: "assignments", type: "GUIDE", roles: TRAINER_UP, order: 1,
  summary: "Complete guide to creating assignments, configuring submission types, and reviewing student work.",
  tags: ["assignments", "create", "review", "submissions", "trainer", "feedback"],
  content: `<h2>Overview</h2>
<p>Assignments are tasks given to students to practise skills and demonstrate understanding. Trainers create them and review student submissions with approval/rejection and feedback.</p>

<h2>Purpose</h2>
<p>Assignments close the loop between learning (reading/watching) and doing (practising). They give trainers visibility into student understanding and give students structured practice goals.</p>

<h2>Who Uses It</h2>
<ul>
<li><strong>Trainer</strong> — Creates assignments, reviews submissions</li>
<li><strong>Admin/Super Admin</strong> — Same access</li>
<li><strong>Student</strong> — Views assignments, submits work, sees feedback</li>
</ul>

<h2>Creating an Assignment</h2>
<ol>
<li>Go to <code>Content &rarr; Assignments</code></li>
<li>Click <strong>New Assignment</strong></li>
<li>Configure:
  <ul>
  <li><strong>Title</strong> — Clear task name</li>
  <li><strong>Instructions</strong> — Detailed description of what to submit</li>
  <li><strong>Submission Type</strong> — File upload, text entry, link, or combination</li>
  <li><strong>Due Date</strong> — Optional deadline</li>
  </ul>
</li>
<li>Save</li>
</ol>

<h2>Review Process</h2>
<ol>
<li>Students submit work through their LMS</li>
<li>Submissions appear in the trainer's review queue</li>
<li>Open each submission to review the content</li>
<li><strong>Approve</strong> — Student gets completion credit and any associated XP</li>
<li><strong>Reject</strong> — Provide specific feedback on what needs improvement</li>
<li>Student can resubmit if allowed by configuration</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Write crystal-clear instructions — ambiguity leads to wrong submissions</li>
<li>Provide constructive feedback on rejections — not just "wrong"</li>
<li>Review submissions within 48 hours to maintain student engagement</li>
<li>Set realistic deadlines considering student workload</li>
</ul>

<h2>Common Mistakes</h2>
<ul>
<li>Vague instructions — "Do a project" vs "Build a line-following robot and submit a 2-minute video demo"</li>
<li>Not reviewing for weeks — students disengage</li>
<li>Rejecting without feedback — students do not know what to fix</li>
</ul>`,
},
{
  title: "Attendance — Marking and Corrections",
  category: "attendance", type: "GUIDE", roles: TRAINER_UP, order: 1,
  summary: "How to mark attendance for batch sessions, make corrections, and view reports.",
  tags: ["attendance", "mark", "batch", "trainer", "corrections", "reports"],
  content: `<h2>Overview</h2>
<p>Attendance tracks student presence at scheduled batch sessions. Trainers mark attendance; students and parents can view their records.</p>

<h2>Purpose</h2>
<p>Accurate attendance is essential for: engagement tracking, at-risk student identification, certificate eligibility (some require minimum attendance), and parent reporting.</p>

<h2>Who Uses It</h2>
<ul>
<li><strong>Trainer</strong> — Marks attendance for assigned batches</li>
<li><strong>Admin/Super Admin</strong> — Views all, can make corrections</li>
<li><strong>Student</strong> — Views own attendance history</li>
<li><strong>Parent</strong> — Views child's attendance</li>
</ul>

<h2>Marking Attendance</h2>
<ol>
<li>Go to Attendance section (sidebar or batch page)</li>
<li>Select your batch</li>
<li>Select session date (defaults to today)</li>
<li>Toggle Present/Absent for each student</li>
<li>Save — immediately visible to students and parents</li>
</ol>

<h2>Corrections</h2>
<ul>
<li>Navigate to same batch + date</li>
<li>Edit the entries</li>
<li>Save — correction is logged in audit trail</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Mark at the START of each session</li>
<li>Late students: still mark Present (late policy is separate)</li>
<li>Double-check before saving — corrections create audit entries</li>
<li>Review weekly attendance to spot disengaged students early</li>
</ul>

<h2>Troubleshooting</h2>
<ul>
<li><strong>Batch not showing</strong> — Not assigned as trainer for that batch</li>
<li><strong>Student missing from list</strong> — Enrollment may be inactive</li>
</ul>`,
},
{
  title: "Leave Management — Applying and Tracking",
  category: "leave-management", type: "GUIDE", roles: TRAINER_UP, order: 1,
  summary: "How trainers apply for leave and how admins approve or reject requests.",
  tags: ["leave", "apply", "approve", "trainer", "time-off"],
  content: `<h2>Overview</h2>
<p>Leave Management handles time-off requests. Trainers apply; Admins approve or reject based on batch coverage.</p>

<h2>For Trainers — Applying</h2>
<ol>
<li>Go to <code>Operations &rarr; My Leaves</code></li>
<li>Click <strong>Apply Leave</strong></li>
<li>Select date range and reason</li>
<li>Submit — goes to admin for review</li>
</ol>

<h2>For Admins — Managing</h2>
<ol>
<li>Go to <code>Operations &rarr; Leave Management</code></li>
<li>View pending requests with dates, reason, batch assignments</li>
<li>Check if coverage exists for affected batches</li>
<li>Approve or reject with a note</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Apply at least 3 days in advance when possible</li>
<li>Admins: verify batch coverage before approving</li>
<li>Communicate approved leaves to affected students</li>
</ul>`,
},
{
  title: "Support Desk — Handling Student Tickets",
  category: "tickets", type: "GUIDE", roles: TRAINER_UP, order: 1,
  summary: "How to view, respond to, assign, and resolve support tickets from students.",
  tags: ["tickets", "support", "resolve", "assign", "student-issues", "helpdesk"],
  content: `<h2>Overview</h2>
<p>The Support Desk centralizes student help requests. Students create tickets from their LMS; staff manage them from the Admin Panel.</p>

<h2>Who Uses It</h2>
<ul>
<li><strong>Trainer</strong> — Responds to assigned tickets</li>
<li><strong>Admin/Super Admin</strong> — Full management: assign, resolve, view all</li>
<li><strong>Student</strong> — Creates tickets, tracks responses</li>
</ul>

<h2>Managing Tickets</h2>
<ol>
<li>Go to <code>Operations &rarr; Support Desk</code></li>
<li>Filter by status (Open, In Progress, Resolved), priority, assignee</li>
<li>Click ticket for full details and conversation</li>
<li>Respond, assign to appropriate team member, or resolve</li>
</ol>

<h2>Best Practices</h2>
<ul>
<li>Respond within 24 hours — even if just acknowledging receipt</li>
<li>Assign to the person best equipped to help</li>
<li>Close with clear resolution note</li>
<li>Track recurring issues to identify systemic problems</li>
</ul>`,
},
{
  title: "Shop Management — Products and Orders",
  category: "shop", type: "GUIDE", roles: ADMIN_UP, order: 1,
  summary: "How to add products, manage inventory, process orders, and handle the FUNT Shop.",
  tags: ["shop", "products", "orders", "kits", "inventory", "fulfillment"],
  content: `<h2>Overview</h2>
<p>The FUNT Shop sells physical products (robotics kits, components, merchandise) and digital items directly to students through the platform.</p>

<h2>Who Uses It</h2>
<ul><li><strong>Admin/Super Admin</strong> — Manage products and orders</li><li><strong>Student</strong> — Browse and purchase items</li></ul>

<h2>Managing Products</h2>
<ol>
<li>Go to <code>Payments &amp; Commerce &rarr; Shop</code></li>
<li>Add products: title, description, price, images, stock</li>
<li>Set availability (active/hidden)</li>
<li>Save — visible to students immediately</li>
</ol>

<h2>Processing Orders</h2>
<ul>
<li>View incoming orders with student details and payment status</li>
<li>Mark as Shipped or Delivered once fulfilled</li>
<li>Track order history</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Clear product descriptions — students should know what they are buying</li>
<li>Update stock counts to prevent overselling</li>
<li>Process orders promptly to maintain trust</li>
</ul>`,
},

// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 5: STUDENT-VISIBLE ARTICLES
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "Student Dashboard — Your Learning Overview",
  category: "students", type: "GUIDE", roles: STUDENT_UP, order: 1,
  summary: "How to use the student dashboard — active courses, XP, level, pending items, and quick actions.",
  tags: ["dashboard", "student", "overview", "xp", "level"],
  content: `<h2>Overview</h2>
<p>The Dashboard is your landing page after login. It shows a snapshot of your learning: active courses, current XP and level, pending assignments, and quick navigation to continue studying.</p>

<h2>What You See</h2>
<ul>
<li><strong>Active Courses</strong> — Cards for each enrolled course with progress percentage</li>
<li><strong>Continue Learning</strong> — Quick link to resume where you left off</li>
<li><strong>XP &amp; Level</strong> — Your current experience points and level</li>
<li><strong>Pending Items</strong> — Assignments due, payments pending</li>
</ul>

<h2>Quick Actions</h2>
<ul>
<li>Click any course card to jump into learning</li>
<li>Check the top bar for your XP and level at a glance</li>
<li>Use the sidebar to navigate to specific sections</li>
</ul>`,
},
{
  title: "Courses — Accessing and Completing Your Learning",
  category: "courses", subcategory: "Student", type: "GUIDE", roles: STUDENT_UP, order: 5,
  summary: "How to access enrolled courses, navigate chapters, track progress, and complete programmes.",
  tags: ["courses", "student", "learn", "chapters", "progress"],
  content: `<h2>Overview</h2>
<p>Your enrolled courses appear under the Courses section. Each course contains chapters (lessons, videos, readings) arranged in a learning sequence.</p>

<h2>Accessing a Course</h2>
<ol>
<li>Go to <strong>Courses</strong> from the sidebar</li>
<li>Click on your enrolled course card</li>
<li>You will see the chapter list with completion status</li>
<li>Click any chapter to open and study the content</li>
<li>Mark chapters as complete after you finish them</li>
</ol>

<h2>Tracking Progress</h2>
<ul>
<li>Progress bar on each course card shows overall completion</li>
<li>The <strong>Progress</strong> page gives detailed chapter-by-chapter status</li>
<li>XP is awarded when you complete chapters</li>
</ul>

<h2>If Your Course is Locked</h2>
<ul>
<li>Payment may be pending — check <strong>Payment</strong> page</li>
<li>Enrollment may be inactive — contact your centre</li>
<li>License key may be needed — check with your coordinator</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Study chapters in order — they build on each other</li>
<li>Only mark complete after genuinely finishing the content</li>
<li>Pair chapter study with assignment submission for best results</li>
</ul>`,
},
{
  title: "Assignments — Submitting Your Work",
  category: "assignments", subcategory: "Student", type: "GUIDE", roles: STUDENT_UP, order: 5,
  summary: "How to view, complete, and submit assignments — plus handling rejections and resubmissions.",
  tags: ["assignments", "submit", "student", "feedback", "resubmit"],
  content: `<h2>Overview</h2>
<p>Assignments are tasks from your trainers to practise what you have learned. You submit your work, and the trainer reviews it with feedback.</p>

<h2>Submitting an Assignment</h2>
<ol>
<li>Go to <strong>Assignments</strong> from the sidebar</li>
<li>Find the assignment (filter by course if needed)</li>
<li>Read the instructions carefully</li>
<li>Prepare your submission:
  <ul>
  <li><strong>File Upload</strong> — PDF, image, ZIP, or video file</li>
  <li><strong>Text</strong> — Type your answer directly</li>
  <li><strong>Link</strong> — Paste a URL (Google Drive, GitHub, etc.)</li>
  </ul>
</li>
<li>Click <strong>Submit</strong></li>
</ol>

<h2>After Submission</h2>
<ul>
<li>Status changes to "Submitted" or "Under Review"</li>
<li>Your trainer will review and either Approve or Reject</li>
<li><strong>Approved</strong> — You get completion credit + XP</li>
<li><strong>Rejected</strong> — Read the feedback, improve, and resubmit</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li>Submit only your own work</li>
<li>Read instructions fully before starting</li>
<li>Submit before the deadline</li>
<li>If rejected, read feedback carefully before resubmitting</li>
</ul>`,
},
{
  title: "XP, Levels, and FUNT Coins",
  category: "gamification", type: "GUIDE", roles: STUDENT_UP, order: 1,
  summary: "How XP, levels, and FUNT Coins work — earning, tracking, spending, and expiry rules.",
  tags: ["xp", "levels", "coins", "gamification", "rewards", "shop"],
  content: `<h2>XP (Experience Points)</h2>
<p>You earn XP by completing chapters and getting assignments approved. Each chapter has an XP value set by your academy. XP accumulates over time and contributes to your Level.</p>

<h2>Levels</h2>
<p>Levels are milestones based on accumulated XP. As you earn more XP, you level up. Levels provide a visual indicator of your overall progress and consistency across all courses.</p>

<h2>FUNT Coins</h2>
<p>Coins are an in-platform currency your academy may grant for:</p>
<ul>
<li>Completing a course or milestone</li>
<li>Bonus rewards for achievements</li>
<li>Special events or competitions</li>
</ul>
<p><strong>Spending:</strong> Use coins in the Shop to purchase kits, components, or digital items.</p>
<p><strong>Expiry:</strong> Each coin grant has a 30-day validity from the date credited. Check <strong>Shop &rarr; Coin Credits</strong> to see your balance, granted amounts, and expiry dates. Expired coins are automatically removed from your spendable balance.</p>

<h2>Where to Check</h2>
<ul>
<li><strong>XP &amp; Level</strong> — Top bar on desktop, profile section on mobile</li>
<li><strong>Coin Balance</strong> — Shop page or Coin Credits section</li>
<li><strong>Progress</strong> — Detailed XP breakdown per course</li>
</ul>`,
},
{
  title: "Certificates — Downloading and Verification",
  category: "certificates", subcategory: "Student", type: "GUIDE", roles: STUDENT_UP, order: 3,
  summary: "How to check certificate status, download PDFs, and share for verification.",
  tags: ["certificates", "download", "student", "verify", "pdf", "proof"],
  content: `<h2>Overview</h2>
<p>Certificates are official documents proving you completed a programme. They are issued when you meet all course requirements.</p>

<h2>Requirements for Certificate Issuance</h2>
<ul>
<li>All required chapters marked as completed</li>
<li>All required assignments approved by trainer</li>
<li>Course fee fully paid (no outstanding balance)</li>
<li>Minimum attendance met (if configured for your batch)</li>
</ul>

<h2>Downloading Your Certificate</h2>
<ol>
<li>Go to <strong>Certificates</strong> in the sidebar</li>
<li>Find the course — status shows "Issued" or "Pending"</li>
<li>If <strong>Issued</strong>: click Download for the PDF</li>
<li>If <strong>Pending</strong>: check Progress to see remaining requirements</li>
</ol>

<h2>Verification</h2>
<p>Each certificate has a unique ID. Anyone can verify it on the public <code>/verify</code> page — useful for school applications, competitions, and job applications.</p>

<h2>Troubleshooting</h2>
<ul>
<li><strong>Still "Pending" after completing everything</strong> — Check if payment is fully approved</li>
<li><strong>Cannot download</strong> — Try refreshing. If persistent, create a support ticket.</li>
</ul>`,
},
{
  title: "Payment — Paying for Courses",
  category: "payments", subcategory: "Student", type: "GUIDE", roles: STUDENT_UP, order: 5,
  summary: "How to pay for course enrollments, view payment status, and troubleshoot payment issues.",
  tags: ["payment", "student", "upi", "checkout", "course-access", "fees"],
  content: `<h2>Overview</h2>
<p>Some courses require payment before you can access the content. The Payment page shows your fee status and provides checkout options.</p>

<h2>Making a Payment</h2>
<ol>
<li>Go to <strong>Payment</strong> from the sidebar (or from a locked course card)</li>
<li>Select the course/fee item</li>
<li>Follow the payment method shown (UPI QR, bank transfer, or online)</li>
<li>Complete payment and <strong>save your receipt/UTR number</strong></li>
<li>Your status changes to "Pending Verification"</li>
<li>An admin will verify and approve your payment</li>
<li>Once approved, your course access is unlocked automatically</li>
</ol>

<h2>If Access is Not Granted Within 24 Hours</h2>
<ol>
<li>Go to <strong>Support</strong> and create a ticket</li>
<li>Include: username, course name, exact amount, payment proof (UTR/screenshot)</li>
</ol>

<h2>Safety Rules</h2>
<ul>
<li><strong>NEVER</strong> pay to a personal account shared via WhatsApp/SMS</li>
<li>Only use payment methods shown inside your FUNT Learn portal</li>
<li>Always save your payment receipt until access is confirmed</li>
</ul>`,
},
// ┌─────────────────────────────────────────────────────────────────────────────
// │ SECTION 6: PARENT-VISIBLE ARTICLES
// └─────────────────────────────────────────────────────────────────────────────
{
  title: "Parent Portal — Complete Guide",
  category: "parents", type: "GUIDE", roles: PARENT_UP, order: 1,
  summary: "Everything parents need to know — linking accounts, viewing progress, attendance, certificates, and getting support.",
  tags: ["parent", "portal", "progress", "attendance", "certificates", "monitoring"],
  content: `<h2>Overview</h2>
<p>The Parent Portal gives you a focused, read-only view of your child's learning journey. You can see their courses, progress, attendance, and certificates without needing their login credentials.</p>

<h2>Getting Started</h2>
<ol>
<li>Your child's centre links your parent account to your child's student account</li>
<li>Log in using your parent credentials at the parent login page</li>
<li>You see the <strong>Profiles</strong> page listing all linked students</li>
<li>Select your child's name to view their dashboard</li>
</ol>

<h2>What You Can Monitor</h2>
<ul>
<li><strong>Course Progress</strong> — Which courses are in progress, completed, or yet to start. Chapter-level breakdown showing exactly where they are in each course.</li>
<li><strong>Attendance</strong> — Overall attendance percentage and per-session history</li>
<li><strong>Certificates</strong> — Status of each certificate (issued or pending)</li>
<li><strong>Learning Plan Milestones</strong> — Which milestone they are on, what is next</li>
</ul>

<h2>Multiple Children</h2>
<p>If multiple students are linked to your account, all appear on the Profiles page. Switch between them anytime.</p>

<h2>Getting Help</h2>
<ul>
<li><strong>Support</strong> — Create tickets about your child's account</li>
<li><strong>FAQ</strong> — Quick answers to common questions</li>
<li>Always include your child's FUNT username and course name when contacting support</li>
</ul>

<h2>Important Notes</h2>
<ul>
<li>The portal is <strong>read-only</strong> — you cannot modify your child's account, submit work, or make payments</li>
<li>If your child's profile does not appear, contact the centre</li>
<li>Data refreshes in real-time</li>
</ul>`,
},
];


// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateArticleId(): Promise<string> {
  const { CounterModel } = await import("../models/Counter.model.js");
  const year = new Date().getFullYear().toString().slice(-2);
  const counter = await CounterModel.findByIdAndUpdate(
    `kb_${year}`,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).exec();
  return `KB-${year}-${String(counter!.seq).padStart(6, "0")}`;
}

async function main() {
  const { mongoUri } = getEnv();
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  console.log(`Seeding ${ARTICLES.length} Knowledge Center articles...\n`);

  let created = 0;
  let skipped = 0;

  for (const article of ARTICLES) {
    const articleSlug = makeSlug(article.title);

    // Skip if already exists
    const existing = await KnowledgeArticleModel.findOne({ slug: articleSlug }).lean().exec();
    if (existing) {
      console.log(`  SKIP: ${article.title}`);
      skipped++;
      continue;
    }

    const articleId = await generateArticleId();
    await KnowledgeArticleModel.create({
      articleId,
      slug: articleSlug,
      title: article.title,
      category: article.category,
      subcategory: article.subcategory ?? "",
      type: article.type,
      roles: article.roles,
      content: article.content,
      summary: article.summary,
      tags: article.tags,
      relatedArticleIds: [],
      order: article.order,
      onboardingStep: article.onboardingStep,
      onboardingRole: article.onboardingRole,
      isPublished: true,
      createdBy: "SYSTEM_SEED",
      version: 1,
    });

    console.log(`  OK: ${article.title} [${article.type}] -> [${article.roles.join(", ")}]`);
    created++;
  }

  console.log(`\n========================================`);
  console.log(`DONE. Created: ${created} | Skipped: ${skipped} | Total: ${ARTICLES.length}`);
  console.log(`========================================`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
