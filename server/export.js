import {createXlsx} from './xlsx.js';
export async function exportWorkbook(survey,responses,stats){
  const formatTime=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
  const details={name:'答题明细',headers:['提交编号','微信 OpenID','昵称','手机号','问卷版本','提交时间（北京时间）','答题用时（秒）','问卷名称','题目及答案摘要（完整见逐题答案）'],widths:[38,32,20,20,12,25,18,35,100],rows:[]};
  const full={name:'逐题答案',headers:['提交编号','昵称','微信 OpenID','问卷版本','题号','题目','题型','答案'],widths:[38,20,32,12,8,65,12,100],rows:[]};
  for(const original of responses){
    const row={...original,...JSON.parse(original.snapshot).respondent};
    const snapshot=JSON.parse(row.snapshot),answers=JSON.parse(row.answers);
    const content=snapshot.questions.map((q,i)=>{const a=answers[q.id];const text=['text','phone'].includes(q.type)?(a||'未填写'):q.options.filter(o=>Array.isArray(a)?a.includes(o.id):a===o.id).map(o=>o.text).join('；')||'未填写';full.rows.push([String(row.id),String(row.nickname),String(row.openid),row.version,i+1,q.title,({single:'单选',multiple:'多选',text:'文本',phone:'手机号'})[q.type],text]);return `${i+1}. ${q.title}\n${text}`;}).join('\n\n');
    details.rows.push([String(row.id),String(row.openid),String(row.nickname),String(row.phone),row.version,formatTime(row.submitted_at),row.duration_seconds,snapshot.title,content]);
  }
  const summary={name:`选项统计 V${stats.version}`,headers:['题目','选项','人数','占本版本答卷比例'],widths:[65,70,12,22],rows:[],percentColumns:[3]};
  for(const q of stats.questions){if(['text','phone'].includes(q.type))summary.rows.push([q.title,'填写内容见逐题答案',q.answered,stats.total?q.answered/stats.total:0]);else for(const o of q.options)summary.rows.push([q.title,o.text,o.count,stats.total?o.count/stats.total:0]);}
  return createXlsx([details,summary,full]);
}
