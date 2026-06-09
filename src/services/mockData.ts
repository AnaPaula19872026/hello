import type { ClassRoom, School, Student, Subject } from '../types';
export const schools:School[]=[{id:'s1',name:'Escola Municipal Modelo',city:'Centro'},{id:'s2',name:'Colégio Rápido Escolar',city:'Bairro Norte'}];
export const classes:ClassRoom[]=[{id:'c1',name:'5º Ano A',shift:'Matutino',schoolId:'s1',studentsCount:32},{id:'c2',name:'6º Ano B',shift:'Vespertino',schoolId:'s1',studentsCount:28}];
export const subjects:Subject[]=[{id:'sub1',name:'Matemática'},{id:'sub2',name:'Português'},{id:'sub3',name:'Ciências'}];
export const students:Student[]=Array.from({length:36}).map((_,i)=>({id:`a${i+1}`,name:['Ana Clara','Bruno Henrique','Carla Vitória','Daniel Souza','Eduarda Lima','Felipe Santos','Gabriela Alves','Heitor Nunes','Isabela Rocha','João Pedro','Lara Martins','Miguel Araújo'][i%12]+` ${i+1}`,registration:`2026${String(i+1).padStart(3,'0')}`,classId:'c1',active:true,absenceRate:i%9===0?26:i%5===0?14:3}));
