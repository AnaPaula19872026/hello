import { db } from '../lib/offlineDb';
import { supabase } from '../lib/supabase';
export async function flushSyncQueue(){
 if(!navigator.onLine) return {status:'offline',processed:0};
 const items=await db.syncQueue.orderBy('createdAt').toArray();
 let processed=0;
 for(const item of items){
  try{
   if(item.action==='save_attendance_session'){
    const payload:any=item.payload;
    const {data:session,error}=await supabase.from('attendance_sessions').insert({class_id:payload.classId,lesson_id:payload.subjectId,teacher_id:payload.teacherId,session_date:payload.date}).select('id').single();
    if(error) throw error;
    const records=payload.records.map((r:any)=>({session_id:session.id,student_id:r.studentId,status:r.status,observation:r.note,reviewed:r.reviewed}));
    const {error:recError}=await supabase.from('attendance_records').upsert(records);
    if(recError) throw recError;
   }
   if(item.id) await db.syncQueue.delete(item.id);
   processed++;
  }catch(e){ if(item.id) await db.syncQueue.update(item.id,{tries:item.tries+1}); }
 }
 return {status:'synced',processed};
}
window.addEventListener('online',()=>{void flushSyncQueue()});
