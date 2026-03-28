export type ViewState = 'map' | 'login-admin' | 'login-manager' | 'login-engineer' | 'dashboard' | 'manager-portal' | 'engineer-portal';
export type UserRole = 'admin' | 'manager' | 'engineer';

export interface StateData {
  id: number; name: string; color: string; path: string; load: number;
  centerX: number; centerY: number; minLat: number; maxLat: number; minLon: number; maxLon: number;
}
export interface LogEntry { id: string; timestamp: Date; message: string; type: 'info' | 'warning' | 'critical' | 'success'; }
export interface Substation {
  id: string; name: string; lat: number; lon: number; location: string;
  currentLoadMW: number; maxCapacityMW: number; status: 'stable' | 'warning' | 'critical'; voltage: number; logs: LogEntry[];
}
export interface EngineerTask { id: string; location: string; description: string; severity: 'low' | 'medium' | 'critical'; status: 'pending' | 'completed'; timestamp: Date; }
export interface LeaveRequest { id: string; engineerName: string; startDate: string; endDate: string; reason: string; status: 'pending' | 'approved' | 'rejected'; submittedAt: Date; }
export interface AppAlert { id: string; message: string; type: 'critical' | 'success' | 'info'; }
export interface SmartMeter { id: string; houseAddress: string; voltage: number; status: 'normal' | 'high' | 'low'; lastUpdated: Date; }
