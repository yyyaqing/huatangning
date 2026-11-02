export const seedSurvey = {
  title: '华堂宁® (多格列艾汀)知多少',
  description: '欢迎参与华堂宁问卷调查，请根据您的了解填写。',
  status: 'published',
  questions: [
    { id: 'q1', type: 'single', title: '华堂宁®（多格列艾汀）的作用靶点是？', required: true, options: ['二肽基肽酶-4（DPP-4）', '葡萄糖激酶（GK）', '钠-葡萄糖协同转运蛋白2（SGLT-2）', 'α-葡萄糖苷酶'].map((text,i)=>({id:`o${i+1}`,text})) },
    { id: 'q2', type: 'single', title: '关于华堂宁® 改善血糖稳态的作用机制，以下哪项描述正确？', required: true, options: ['主要通过增加尿糖排泄调节血糖', '主要通过延缓肠道碳水化合物吸收调节血糖', '通过修复GK功能，改善葡萄糖感知，促进胰岛、肝脏和肠道协同调节血糖稳态', '不依赖葡萄糖浓度，持续刺激胰岛素分泌'].map((text,i)=>({id:`o${i+1}`,text})) },
    { id: 'q3', type: 'single', title: '在DAWN研究中，二甲双胍单药治疗血糖控制不佳的2型糖尿病患者加用多格列艾汀治疗24周后，餐后2小时血糖较基线降低多少？', required: true, options: ['1.45 mmol/L', '2.45 mmol/L', '3.45 mmol/L', '5.45 mmol/L'].map((text,i)=>({id:`o${i+1}`,text})) },
    { id: 'q4', type: 'multiple', title: '根据说明书，以下哪些属于华堂宁® 的获批使用方式？', required: true, options: ['配合饮食控制和运动，单药改善成人2型糖尿病患者的血糖控制', '单用盐酸二甲双胍血糖控制不佳时，与其联合使用，并配合饮食和运动', '用于治疗1型糖尿病', '用于治疗糖尿病酮症酸中毒'].map((text,i)=>({id:`o${i+1}`,text})) },
    { id: 'q5', type: 'single', title: '成人2型糖尿病患者合并肾功能不全（未进行透析）时，使用华堂宁® 的剂量调整原则是？', required: true, options: ['轻度肾功能不全即需减量', '需根据肾功能下降程度逐级减量', '无需因肾功能不全调整剂量', '肾功能不全患者均不推荐使用'].map((text,i)=>({id:`o${i+1}`,text})) },
    { id:'phone', type:'phone', title:'手机号', required:true, options:[] }
  ],
  completion: {
    heading: '感谢您的参与！', welcome: '欢迎您参加【血糖稳态】专题会', venue: '会场6 - 多功能厅B4（2层）',
    sessions: [
      { time: '11月19日 12:30–13:30', title: '血糖稳态调控的理论基础与靶点机制' },
      { time: '11月19日 13:30–14:30', title: '2型糖尿病的血糖稳态管理 — 从机制到临床实践专题会' }
    ]
  }
};
