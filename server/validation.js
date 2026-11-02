import { z } from 'zod';
export const optionSchema = z.object({ id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), text:z.string().trim().min(1).max(500) });
export const questionSchema = z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), title:z.string().trim().min(1).max(1000), type:z.enum(['single','multiple','text','phone']), required:z.boolean(), options:z.array(optionSchema).max(26)
}).superRefine((q, ctx)=>{
  if(['single','multiple'].includes(q.type) && q.options.length < 2) ctx.addIssue({code:'custom',message:'选择题至少需要两个选项'});
  if(new Set(q.options.map(o=>o.id)).size !== q.options.length) ctx.addIssue({code:'custom',message:'选项标识重复'});
});
export const surveySchema = z.object({
  title:z.string().trim().min(1).max(150), description:z.string().max(2000), status:z.enum(['draft','published','closed']),
  questions:z.array(questionSchema).min(1).max(100),
  completion:z.object({heading:z.string().trim().min(1).max(100),welcome:z.string().max(200),venue:z.string().max(200),sessions:z.array(z.object({time:z.string().max(100),title:z.string().max(200)})).max(10)})
}).superRefine((s,ctx)=>{if(new Set(s.questions.map(q=>q.id)).size !== s.questions.length) ctx.addIssue({code:'custom',message:'题目标识重复'});const phones=s.questions.filter(q=>q.type==='phone');if(phones.length!==1 || !phones[0].required)ctx.addIssue({code:'custom',message:'问卷必须包含一道必填手机号题'});});

export function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return '答案格式不正确';
  if (Object.keys(answers).some(id => !questions.some(q => q.id === id))) return '包含未知题目，请刷新问卷';
  for (const [i,q] of questions.entries()) {
    const value = answers[q.id];
    const empty = value === undefined || value === '' || Array.isArray(value) && value.length === 0;
    if (empty) { if (q.required) return `请完成第 ${i+1} 题`; else continue; }
    if(q.type === 'phone') {
      if(typeof value!=='string' || !/^1[3-9]\d{9}$/.test(value)) return '请填写正确的 11 位中国大陆手机号';
    } else if (q.type === 'text') {
      if (typeof value !== 'string' || value.trim().length > 2000 || q.required && !value.trim()) return `第 ${i+1} 题请填写 1–2000 字`;
    } else {
      const selected = q.type === 'single' ? [value] : value;
      if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(v => typeof v !== 'string' || !q.options.some(o=>o.id === v))) return `第 ${i+1} 题选项无效`;
    }
  }
  return null;
}
