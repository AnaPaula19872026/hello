import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
const rows=[['Aluno','Presentes','Ausentes','Atrasos','% Presença'],['Ana Clara',18,1,0,'94,7%'],['Bruno Henrique',17,2,1,'89,4%']];
export async function exportDemoReport(title:string){
 const pdf=new jsPDF(); pdf.setFontSize(16); pdf.text(`hello - Relatório ${title}`,14,18); pdf.setFontSize(10); pdf.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`,14,26); rows.forEach((r,i)=>pdf.text(r.join(' | '),14,40+i*8)); pdf.save(`relatorio-${slug(title)}.pdf`);
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Relatório'); XLSX.writeFile(wb,`relatorio-${slug(title)}.xlsx`);
 const csv=rows.map(r=>r.join(';')).join('\n'); saveAs(new Blob([csv],{type:'text/csv;charset=utf-8'}),`relatorio-${slug(title)}.csv`); saveAs(new Blob([csv],{type:'text/plain;charset=utf-8'}),`relatorio-${slug(title)}.txt`);
 const doc=new Document({sections:[{children:[new Paragraph({text:`hello - Relatório ${title}`,heading:HeadingLevel.HEADING_1}),...rows.map(r=>new Paragraph(r.join(' | ')))]}]}); saveAs(await Packer.toBlob(doc),`relatorio-${slug(title)}.docx`);
}
const slug=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\W+/g,'-');
