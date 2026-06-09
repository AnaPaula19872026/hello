import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
const headers=['Nome completo do aluno','Matrícula','CPF ou documento','Data de nascimento','Escola','Turma','Turno','Nome do responsável','Telefone do responsável','E-mail do responsável','Situação do aluno','Observações'];
export function createStudentTemplate(){
 const wb=XLSX.utils.book_new();
 const instrucoes=[['PLANILHA PADRÃO - CADASTRO DE ALUNOS'],['Preencha a aba Alunos. Campos obrigatórios: Nome, Matrícula, Escola, Turma, Turno e Situação.'],['Turnos aceitos: Matutino, Vespertino, Noturno, Integral.'],['Situação aceita: Ativo, Inativo, Transferido.']];
 const exemplo=[headers,['Maria Eduarda Santos','2026001','000.000.000-00','2014-04-10','Escola Municipal Modelo','5º Ano A','Matutino','Joana Santos','(00) 90000-0000','responsavel@email.com','Ativo','Sem observações']];
 const alunos=[headers, ...Array.from({length:40}).map(()=>Array(headers.length).fill('')), [], ['Total de alunos','=COUNTA(A2:A41)'],['Ativos','=COUNTIF(K2:K41,"Ativo")'],['Inativos','=COUNTIF(K2:K41,"Inativo")']];
 const wsI=XLSX.utils.aoa_to_sheet(instrucoes); const wsE=XLSX.utils.aoa_to_sheet(exemplo); const wsA=XLSX.utils.aoa_to_sheet(alunos);
 wsA['!cols']=headers.map(h=>({wch:Math.max(18,h.length+2)})); wsA['!autofilter']={ref:'A1:L41'}; wsA['!freeze']={xSplit:0,ySplit:1};
 XLSX.utils.book_append_sheet(wb,wsI,'Instruções'); XLSX.utils.book_append_sheet(wb,wsE,'Exemplo'); XLSX.utils.book_append_sheet(wb,wsA,'Alunos');
 const out=XLSX.write(wb,{bookType:'xlsx',type:'array'}); saveAs(new Blob([out],{type:'application/octet-stream'}),'modelo-cadastro-alunos-hello.xlsx');
}
