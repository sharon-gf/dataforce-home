const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../dataforce-auth.js'),'utf8');
function storage(){const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
function tab(local=storage()){
 const session=storage();let calls=0;
 const ctx={window:{location:{hostname:'dataforce.gsaforce.com'}},localStorage:local,sessionStorage:session,AbortSignal,Date,JSON,console,
 fetch:async()=>{calls++;return{ok:true,json:async()=>({token:'signed-session',email:'sharon@gsaforce.com',expires_at:Math.floor(Date.now()/1000)+86400})}}};
 vm.runInNewContext(code,ctx);return{auth:ctx.window.DataforceAuth,local,session,calls:()=>calls};
}
test('remembered validated login is reused by another tab without Google or an API exchange',async()=>{
 const a=tab();a.auth.setUser({email:'sharon@gsaforce.com'},true);await a.auth.establishSession('google-credential',true);
 const b=tab(a.local);assert.equal(await b.auth.getSessionToken(),'signed-session');assert.equal(b.calls(),0);
});
test('non-remembered sessions stay in session storage and logout clears credentials',async()=>{
 const a=tab();a.auth.setUser({email:'sharon@gsaforce.com'},false);a.auth.setItem('df_google_id_token','credential',false);
 await a.auth.establishSession('credential',false);assert.equal(a.local.getItem('df_shared_session'),null);
 a.auth.clear();assert.equal(await a.auth.getSessionToken(),null);assert.equal(a.session.getItem('df_google_id_token'),null);
});
test('session for a different account or an expired session cannot be reused',async()=>{
 const a=tab();a.auth.setUser({email:'other@gsaforce.com'},true);
 a.auth.setItem('df_shared_session',JSON.stringify({email:'sharon@gsaforce.com',token:'wrong',expires_at:Date.now()/1000+1000}));
 assert.equal(await a.auth.getSessionToken(),null);
 a.auth.setItem('df_shared_session',JSON.stringify({email:'other@gsaforce.com',token:'expired',expires_at:1}));
 assert.equal(await a.auth.getSessionToken(),null);
});
test('concurrent first requests exchange the saved Google credential only once',async()=>{
 const a=tab();a.auth.setUser({email:'sharon@gsaforce.com'},true);a.auth.setItem('df_google_id_token','google');
 const values=await Promise.all([a.auth.getSessionToken(),a.auth.getSessionToken()]);assert.deepEqual(values,['signed-session','signed-session']);assert.equal(a.calls(),1);
});
