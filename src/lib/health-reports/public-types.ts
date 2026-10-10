import type { HealthReportSnapshot, SnapshotComponent, SnapshotRecommendation } from './types';

/** Private snapshots remain unchanged; public contracts never require private fields. */
export type PublicComponent = Omit<SnapshotComponent, 'scheduleId' | 'rulesFired'>;
export type PublicRecommendation = Omit<SnapshotRecommendation, 'scheduleId'>;
export type PublicHealthReportSnapshot = Partial<Omit<HealthReportSnapshot,
  'owner' | 'issuedBy' | 'dataSources' | 'tilVersion' | 'ruleVersion' | 'motorcycle' | 'overall' | 'components' | 'recommendations' | 'history'
>> & {
  motorcycle?: Omit<HealthReportSnapshot['motorcycle'], 'id' | 'nickname' | 'mainPhotoUrl'>;
  overall?: Omit<HealthReportSnapshot['overall'], 'grade' | 'gradeLabel' | 'conservationIndex'>;
  components?: PublicComponent[];
  recommendations?: PublicRecommendation[];
  history?: {
    lastMaintenances: Array<{ date: string; type: string }>;
    lastInspections: Array<{ date: string; decision: string }>;
    incidents: Array<{ date: string }>;
    totalEvents: number;
  };
};