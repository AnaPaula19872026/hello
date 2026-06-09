import { create } from 'zustand';
import type { AttendanceRecord, AttendanceStatus, Student } from '../types';
interface AttendanceState { students:Student[]; records:Record<string,AttendanceRecord>; setStudents:(s:Student[])=>void; toggle:(id:string)=>void; mark:(id:string,status:AttendanceStatus)=>void; repeatPrevious:(records:AttendanceRecord[])=>void; reset:()=>void; }
const now=()=>new Date().toISOString();
export const useAttendanceStore = create<AttendanceState>((set,get)=>({ students:[], records:{},
 setStudents:(students)=>set({students,records:Object.fromEntries(students.map(s=>[s.id,{studentId:s.id,status:'present',reviewed:false,updatedAt:now()}]))}),
 toggle:(id)=>set({records:{...get().records,[id]:{...get().records[id],status:get().records[id]?.status==='absent'?'present':'absent',reviewed:true,updatedAt:now()}}}),
 mark:(id,status)=>set({records:{...get().records,[id]:{...get().records[id],studentId:id,status,reviewed:true,updatedAt:now()}}}),
 repeatPrevious:(records)=>set({records:Object.fromEntries(records.map(r=>[r.studentId,{...r,reviewed:true,updatedAt:now()}]))}),
 reset:()=>set({students:[],records:{}})
}));
