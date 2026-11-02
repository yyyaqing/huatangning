export async function api(path,options={}) {
  const headers={...(options.body && !(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers};
  const response=await fetch(`/api${path}`,{...options,headers,credentials:'same-origin',body:options.body && !(options.body instanceof FormData)?JSON.stringify(options.body):options.body});
  const data=await response.json();
  if(!response.ok) throw Object.assign(new Error(data.details?.length?data.details.map(d=>d.message).join('；'):data.error || '请求失败'),{status:response.status,details:data.details});
  return data;
}
