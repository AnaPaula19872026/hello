import Dexie, { Table } from 'dexie';
import type { AttendanceRecord, ClassRoom, School, Student, Subject } from '../types';
export interface LocalSession { id:string; classId:string; subjectId:string; teacherId:string; date:string; records:AttendanceRecord[]; synced:boolean; updatedAt:string; }
export interface QueueItem { id?:number; action:string; payload:unknown; createdAt:string; tries:number; }
class HelloDb extends Dexie {
  schools!:Table<School,string>;
  classes!:Table<ClassRoom,string>;
  students!:Table<Student,string>;
  subjects!:Table<Subject,string>;
  sessions!:Table<LocalSession,string>;
  syncQueue!:Table<QueueItem,number>;
  constructor(){
    super('hello_chamada_db');
    this.version(1).stores({ students:'id,classId,name,active', sessions:'id,classId,date,synced', syncQueue:'++id,action,createdAt,tries' });
    this.version(2).stores({
      schools:'id,name,city',
      classes:'id,schoolId,name,shift',
      students:'id,classId,name,registration,active',
      subjects:'id,name',
      sessions:'id,classId,date,synced',
      syncQueue:'++id,action,createdAt,tries'
    });
  }
}
export const db = new HelloDb();
export async function enqueueSync(action:string,payload:unknown){ await db.syncQueue.add({action,payload,createdAt:new Date().toISOString(),tries:0}); }
