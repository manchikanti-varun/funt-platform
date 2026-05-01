import "dotenv/config";
import { ROLE, CERTIFICATE_STATUS } from "@funt-platform/constants";
import { validateEnv, getEnv } from "../config/env.js";
import { connectDb, disconnectDb } from "../config/db.js";
import { CertificateModel } from "../models/Certificate.model.js";
import { UserModel } from "../models/User.model.js";
import { reissueCertificateWithoutEligibilityDev } from "../services/certificate.service.js";
import { DEV_LOCAL_STUDENT_USERNAME } from "./devLocalAccounts.js";

/**
 * Deletes one issued certificate and issues a new one for the same student+batch
 * (new certificateId, same enrollment). Uses dev-only reissue path so module
 * progress does not need to be re-completed. Use only on local/dev DB.
 *
 * Usage:
 *   REGEN_TEST_CERT_CONFIRM=1 npx tsx src/scripts/regenerateTestCertificate.ts [CERTIFICATE_ID]
 *
 * If CERTIFICATE_ID is omitted, uses the latest issued certificate for dev.student.
 */
async function main(): Promise<void> {
  if (process.env.REGEN_TEST_CERT_CONFIRM !== "1") {
    console.error(
      "Refusing to run: set REGEN_TEST_CERT_CONFIRM=1 to confirm you intend to delete and re-issue a certificate on this MongoDB."
    );
    process.exit(1);
  }

  validateEnv();
  await connectDb(getEnv().mongoUri);

  const argCertId = process.argv[2]?.trim();
  let cert = argCertId
    ? await CertificateModel.findOne({ certificateId: argCertId }).exec()
    : null;

  if (!cert && !argCertId) {
    const student = await UserModel.findOne({
      username: DEV_LOCAL_STUDENT_USERNAME,
      roles: ROLE.STUDENT,
    }).exec();
    if (!student) {
      console.error(`No user with username "${DEV_LOCAL_STUDENT_USERNAME}" (student).`);
      process.exit(1);
    }
    cert = await CertificateModel.findOne({
      studentId: String(student._id),
      status: CERTIFICATE_STATUS.ISSUED,
    })
      .sort({ issuedAt: -1 })
      .exec();
  }

  if (!cert) {
    console.error(argCertId ? `No certificate with id "${argCertId}".` : "No issued certificate found for dev.student.");
    process.exit(1);
  }

  if (cert.status !== CERTIFICATE_STATUS.ISSUED) {
    console.error("Only ISSUED certificates can be regenerated with this script.");
    process.exit(1);
  }

  const superAdmin = await UserModel.findOne({ roles: ROLE.SUPER_ADMIN }).select("_id").lean().exec();
  const issuedBy = superAdmin?._id != null ? String(superAdmin._id) : cert.issuedBy;

  const removedCertificateId = cert.certificateId;
  const studentId = cert.studentId;
  const batchId = cert.batchId;
  const coinReward = cert.coinReward ?? 0;

  const backup = cert.toObject() as Record<string, unknown>;
  delete backup._id;
  delete backup.__v;

  await CertificateModel.deleteOne({ _id: cert._id });
  await UserModel.updateOne({ _id: studentId, studentLevel: { $gt: 0 } }, { $inc: { studentLevel: -1 } }).exec();

  try {
    const created = await reissueCertificateWithoutEligibilityDev(studentId, batchId, issuedBy, { coinReward });
    console.log(
      JSON.stringify(
        {
          removedCertificateId,
          newCertificateId: created.certificateId,
          studentId,
          batchId,
          verifyUrl: `${getEnv().frontendLmsUrl}/verify?id=${encodeURIComponent(created.certificateId)}`,
        },
        null,
        2
      )
    );
  } catch (err) {
    await CertificateModel.create(backup);
    await UserModel.updateOne({ _id: studentId }, { $inc: { studentLevel: 1 } }).exec();
    console.error("Re-issue failed; restored previous certificate row.");
    throw err;
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
