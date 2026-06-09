export type Role = 'super_admin'|'school_admin'|'coordinator'|'teacher'|'secretary'|'auditor';
export type AttendanceStatus = 'present'|'absent'|'late'|'justified';
export type SyncStatus = 'online'|'offline'|'syncing'|'synced';
export interface Student { id:string; name:string; registration:string; classId:string; guardian?:string; phone?:string; active:boolean; absenceRate:number; }
export interface AttendanceRecord { studentId:string; status:AttendanceStatus; note?:string; reviewed:boolean; updatedAt:string; }
export interface ClassRoom { id:string; name:string; shift:string; schoolId:string; studentsCount:number; }
export interface School { id:string; name:string; city?:string; logoUrl?:string; }
export interface Subject { id:string; name:string; teacherId?:string; }
