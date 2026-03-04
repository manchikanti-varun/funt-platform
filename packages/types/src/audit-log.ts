
export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetEntity: string;
  targetId: string;
  timestamp: Date;
}
