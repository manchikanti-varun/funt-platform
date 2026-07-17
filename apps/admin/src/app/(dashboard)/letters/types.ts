export interface LetterRow {
  _id?: string;
  letterId: string;
  type: string;
  recipientName: string;
  designation: string;
  department: string;
  employmentType: string;
  status: string;
  approvalStatus?: string;
  linkedLetterId?: string;
  issuedAt: string;
  createdAt?: string;
}
