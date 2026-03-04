/**
 * Audit log entity – action trail for governance.
 */

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetEntity: string;
  targetId: string;
  timestamp: Date;
}
