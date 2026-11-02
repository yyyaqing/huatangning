import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createXlsx} from '../server/xlsx.js';
test('Excel 中以等号开头及 XML 特殊字符的答案始终为纯文本',async()=>{
  const bytes=createXlsx([{name:'验证',headers:['用户文本','比例'],widths:[50,20],rows:[['=HYPERLINK("https://example.com")',0.5],['<标签> & "引号"\n中文',1]],percentColumns:[1]}]);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes));const s=workbook.worksheets[0];assert.equal(s.getCell('A2').type,ExcelJS.ValueType.String);assert.equal(s.getCell('A2').value,'=HYPERLINK("https://example.com")');assert.equal(s.getCell('A3').value,'<标签> & "引号"\n中文');assert.equal(s.getCell('B2').value,.5);assert.equal(s.getCell('B2').numFmt,'0.00%');
});
