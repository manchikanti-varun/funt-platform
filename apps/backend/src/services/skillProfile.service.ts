
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";
import { SKILL_TAG } from "@funt-platform/constants";

const SKILL_TAGS = Object.values(SKILL_TAG);

export async function calculateSkillProfile(studentId: string) {
  const approved = await AssignmentSubmissionModel.find({
    studentId,
    status: SUBMISSION_REVIEW_STATUS.APPROVED,
  })
    .lean()
    .exec();

  const assignmentIds = [...new Set(approved.map((s) => s.assignmentId))];
  const assignments = await GlobalAssignmentModel.find({ _id: { $in: assignmentIds } })
    .select("skillTags")
    .lean()
    .exec();
  const tagMap = new Map(assignments.map((a) => [String(a._id), (a.skillTags ?? []) as string[]]));

  const counts: Record<string, number> = {};
  for (const tag of SKILL_TAGS) {
    counts[tag] = 0;
  }

  let totalApproved = 0;
  for (const sub of approved) {
    const tags = tagMap.get(sub.assignmentId) ?? [];
    for (const t of tags) {
      if (counts[t] !== undefined) counts[t] += 1;
    }
    totalApproved += 1;
  }

  const maxCount = Math.max(...Object.values(counts), 1);
  const skills = SKILL_TAGS.map((tag) => ({
    tag,
    count: counts[tag] ?? 0,
    score: Math.round(((counts[tag] ?? 0) / maxCount) * 100),
  }));

  return {
    studentId,
    skills,
    totalApprovedAssignments: totalApproved,
    completionMetrics: {
      bySkill: skills,
      overallScore:
        totalApproved > 0 ? Math.round(skills.reduce((s, x) => s + x.score, 0) / skills.length) : 0,
    },
  };
}
