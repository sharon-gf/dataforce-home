'use strict';
const API_BASE='https://dataforce-api-test-911713216717.us-east1.run.app';
const REVIEW_API=window.DATAFORCE_REVIEW_API;
const CLIENT_ID='911713216717-0434lgkd25hk5jf62jam67go19h78vsg.apps.googleusercontent.com';
const $=id=>document.getElementById(id);
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const colors=['#1a56db','#0d9488','#d28412','#9333b8','#db5262','#5f7494','#478020','#784c34'];
const state={email:'',token:'',sources:[],trend:null,comparison:[],hiddenYears:new Set(),hiddenSources:new Set(),trendVersion:0,compareVersion:0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=0)=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const short=v=>Math.abs(v)>=1e6?`${fmt(v/1e6,1)}m`:Math.abs(v)>=1e3?`${fmt(v/1e3,1)}k`:fmt(v,1);
const pct=(a,b)=>a===null||a===undefined||b===null||b===undefined||b===0?null:(a/b-1)*100;
const now=new Date();
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';}
function filters(){return {country:$('country').value,basis:$('basis').value};}
function contextLabel(){return `${$('country').selectedOptions[0]?.textContent||''} · ${$('direction').value} · ${$('basis').selectedOptions[0].textContent}`;}
async function api(path,params={},retry=true){
 const shared=await DataforceAuth.getSessionToken();if(shared)state.token=shared;
 if(!REVIEW_API)throw new Error('The independent review API has not been configured yet.');
 const r=await fetchWithTimeout(`${REVIEW_API}/api/mkt-data-review/${path}?${new URLSearchParams({...params,email:state.email})}`,{headers:{Authorization:`Bearer ${state.token}`}},210000);
 const data=await r.json().catch(()=>({}));
 if(!r.ok){if(r.status===401&&retry){DataforceAuth.removeItem('df_shared_session');const renewed=await DataforceAuth.getSessionToken();if(renewed){state.token=renewed;return api(path,params,false);}}if(r.status===401)showSignIn();throw new Error(typeof data.detail==='string'?data.detail:`Request failed (${r.status})`);}
 return data;
}
function point(data,year,month){return data?.points.find(p=>p.year===Number(year)&&p.month===month);}
function eligible(){
 const fixed={CHI:'CL',BRA:'BR',JPN:'JP',MEX:'MX',USA:'US',PER:'PE',HKG:'HK'},country=$('country').value;
 return state.sources.filter(s=>(!country || (s.region==='SAM'?['CL','BR','AR','PE','CO','EC','PY','UY','BO','VE','CR','PR'].includes(country):s.region==='OCE'?['AU','NZ'].includes(country):s.region==='ASIA'?['CN','HK','TW','JP'].includes(country):!fixed[s.region]||fixed[s.region]===country))&&s.direction===$('direction').value&&($('basis').value==='chargeable'?s.chargeable_column:s.weight_column!=='Mkt_Chw')&&(!country||s.country_column||fixed[s.region]===country));
}
function sourceLabel(s){return `${s.family} · ${s.region}${s.id.includes('Agent')?' · Agent':s.id.includes('Product')?' · Product':''}${s.family==='Isidora'?' · '+s.direction:''}${s.family==='Aduana'?' · all transport modes':''}`;}
function buildChoices(){
 const sources=eligible(),old=$('trendSource').value,oldDup=$('duplicateSource').value;
 const options=sources.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
 $('trendSource').innerHTML=options;$('duplicateSource').innerHTML=options;
 const preferred=sources.find(s=>s.id==='SAM_EXP_WACD_Agent_2024_20XX')||sources[0];
 $('trendSource').value=sources.some(s=>s.id===old)?old:preferred?.id||'';
 $('duplicateSource').value=sources.some(s=>s.id===oldDup)?oldDup:preferred?.id||'';
 const defaults=$('country').value==='CL'&&$('direction').value==='Export'?['SAM_EXP_CASS_CX_2019_20XX','SAM_EXP_WACD_Agent_2024_20XX','CHI_EXP_Isidora_2023_20XX']:sources.slice(0,3).map(s=>s.id);
 $('sourceChoices').innerHTML=sources.map(s=>`<label><input type="checkbox" value="${esc(s.id)}" ${defaults.includes(s.id)?'checked':''}><span>${esc(sourceLabel(s))}<small class="source-note">${esc(s.id)}</small></span></label>`).join('')||'<p>No datasets support these filters.</p>';
}
function draw(target,series,metric){
 const values=series.flatMap(s=>s.values.map(v=>v?.[metric])).filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));
 if(!values.length){$(target).textContent='No data available for this selection.';return;}
 const width=760,height=300,left=68,right=25,top=24,bottom=40,low=Math.min(0,...values),high=Math.max(1,...values),span=high-low;
 const x=i=>left+i*(width-left-right)/11,y=v=>height-bottom-(v-low)/span*(height-top-bottom);
 const grid=Array.from({length:5},(_,i)=>{const n=low+span*i/4;return `<line x1="${left}" y1="${y(n)}" x2="${width-right}" y2="${y(n)}" stroke="#e3eaf2"/><text x="${left-9}" y="${y(n)+4}" text-anchor="end" font-size="11" fill="#64748b">${short(n)}</text>`;}).join('');
 const lines=series.map(s=>{
  let paths=[],segment=[];s.values.forEach((p,i)=>{const v=p?.[metric];if(v===null||v===undefined){if(segment.length)paths.push(segment);segment=[];}else segment.push(`${x(i)},${y(v)}`);});if(segment.length)paths.push(segment);
  return paths.map(p=>`<polyline points="${p.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`).join('')+s.values.map((p,i)=>p?.[metric]===null||p?.[metric]===undefined?'':`<circle class="chart-point" tabindex="0" cx="${x(i)}" cy="${y(p[metric])}" r="4" fill="${s.color}"><title>${esc(s.label)} · ${months[i]}: ${fmt(p[metric],2)} ${metric==='weight_kg'?'kg':'rows'}</title></circle>`).join('');
 }).join('');
 $(target).innerHTML=`<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${grid}${lines}${months.map((m,i)=>`<text x="${x(i)}" y="${height-12}" text-anchor="middle" font-size="11" fill="#64748b">${m}</text>`).join('')}</svg>`;
}
function legend(id,series,hidden){$(id).innerHTML=series.map(s=>`<button type="button" data-series="${esc(s.key)}" class="${hidden.has(s.key)?'off':''}" aria-pressed="${!hidden.has(s.key)}"><span class="swatch" style="background:${s.color}"></span>${esc(s.label)}</button>`).join('');}
function yearSeries(){const d=state.trend;if(!d)return[];return Array.from({length:d.end_year-d.start_year+1},(_,i)=>{const yr=d.start_year+i;return{key:String(yr),label:String(yr),color:colors[i%colors.length],values:months.map((_,m)=>point(d,yr,m+1))};});}
function renderTrend(){
 const d=state.trend;if(!d)return;const all=yearSeries(),visible=all.filter(s=>!state.hiddenYears.has(s.key));legend('yearLegend',all,state.hiddenYears);
 draw('yearWeightChart',visible,'weight_kg');draw('yearRowsChart',visible,'rows');
 $('trendMeta').textContent=`${d.viewLabel} · ${d.source.id} · Field: ${d.weight_column} · Checked ${new Date(d.checked_at).toLocaleString()}`;
 let alerts=[];d.points.forEach(p=>{if(p.year===now.getFullYear()&&p.month===now.getMonth()+1)return;const prior=point(d,p.year-1,p.month);if(!prior)return;const w=pct(p.weight_kg,prior.weight_kg),r=pct(p.rows,prior.rows);if((w!==null&&Math.abs(w)>=40)||(r!==null&&Math.abs(r)>=40))alerts.push(`${months[p.month-1]} ${p.year}: kg ${w===null?'—':fmt(w,0)+'%'}, rows ${r===null?'—':fmt(r,0)+'%'} YoY`);});
 $('trendFlags').innerHTML=alerts.length?'<strong>Review these changes:</strong> '+alerts.map(t=>`<span class="flag-pill">${esc(t)}</span>`).join(''):'No ≥40% year-over-year change flags in available completed months. Duplicates have not been checked.';
 $('yearTable').innerHTML=`<caption>Kilos and row counts by month · ${esc(d.viewLabel)}</caption><thead><tr><th>Month</th>${visible.map(s=>`<th>${s.label} · kg</th><th>${s.label} · rows</th>`).join('')}</tr></thead><tbody>${months.map((m,i)=>`<tr><td>${m}</td>${visible.map(s=>`<td>${fmt(s.values[i]?.weight_kg)}${Number(s.key)===now.getFullYear()&&i===now.getMonth()?' *':''}</td><td>${fmt(s.values[i]?.rows)}</td>`).join('')}</tr>`).join('')}</tbody>`;
 $('export').disabled=false;
}
async function loadTrend(){
 const source=$('trendSource').value;if(!source)return;
 const start=Number($('fromYear').value),end=Number($('toYear').value);if(end<start||end-start>7){notice('Choose a year range of up to 8 years, in chronological order.',true);return;}
 const version=++state.trendVersion,label=contextLabel();state.trend=null;$('yearLegend').innerHTML='';$('yearTable').innerHTML='';$('trendFlags').textContent='';$('trendMeta').textContent=`Loading ${label}…`;$('yearWeightChart').textContent='Loading monthly kilos…';$('yearRowsChart').textContent='Loading row counts…';
 try{const d=await api('series',{source,start_year:start,end_year:end,...filters()});if(version!==state.trendVersion)return;state.trend={...d,viewLabel:label};state.hiddenYears.clear();renderTrend();}
 catch(e){if(version!==state.trendVersion)return;$('trendMeta').textContent=`Could not load this source: ${e.message}`;$('yearWeightChart').textContent='Check failed. No values are shown.';$('yearRowsChart').textContent='';}
}
function comparisonSeries(){return state.comparison.map((d,i)=>({key:d.source.id,label:sourceLabel(d.source),color:colors[i%colors.length],values:months.map((_,m)=>point(d,d.start_year,m+1))}));}
function renderCompare(){
 const all=comparisonSeries(),visible=all.filter(s=>!state.hiddenSources.has(s.key));legend('sourceLegend',all,state.hiddenSources);draw('sourceChart',visible,'weight_kg');
 $('sourceTable').innerHTML=`<caption>Reported market kilos · ${esc(state.comparison[0]?.viewLabel||'')} · ${esc(state.comparison[0]?.start_year||'')}</caption><thead><tr><th>Month</th>${visible.map(s=>`<th>${esc(s.label)} · kg</th>`).join('')}<th>Highest / lowest</th></tr></thead><tbody>${months.map((m,i)=>{const vals=visible.map(s=>s.values[i]?.weight_kg).filter(v=>v!==null&&v!==undefined);const ratio=vals.length>1&&Math.min(...vals)>0?Math.max(...vals)/Math.min(...vals):null;return `<tr><td>${m}${state.comparison[0]?.start_year===now.getFullYear()&&i===now.getMonth()?' *':''}</td>${visible.map(s=>`<td>${fmt(s.values[i]?.weight_kg)}</td>`).join('')}<td class="${ratio>1.5?'gap':''}">${ratio===null?'—':fmt(ratio,2)+'×'}</td></tr>`;}).join('')}</tbody>`;
 $('export').disabled=!state.trend&&!state.comparison.length;
}
async function loadCompare(){
 const selected=[...$('sourceChoices').querySelectorAll('input:checked')].map(n=>n.value);if(!selected.length||selected.length>6){$('compareStatus').textContent='Choose between 1 and 6 sources.';return;}
 const version=++state.compareVersion,year=$('compareYear').value,filter=filters(),label=contextLabel();state.comparison=[];state.hiddenSources.clear();$('sourceLegend').innerHTML='';$('sourceTable').innerHTML='';$('sourceChart').textContent='Loading selected sources…';$('compareStatus').textContent=`${label} · ${year} · Loading…`;
 // Sequential requests leave capacity for the year-over-year query.
 const failures=[];
 for(const source of selected){if(version!==state.compareVersion)return;try{const d=await api('series',{source,start_year:year,end_year:year,...filter});if(version!==state.compareVersion)return;state.comparison.push({...d,viewLabel:label});}catch(e){if(version!==state.compareVersion)return;failures.push(`${source}: ${e.message}`);}renderCompare();$('compareStatus').textContent=`${label} · ${year} · ${state.comparison.length}/${selected.length} loaded${failures.length?' · Failed: '+failures.join('; '):''}`;}
 if(state.comparison.length){$('compareStatus').textContent+=` · Fields: ${state.comparison.map(d=>sourceLabel(d.source)+' → '+d.weight_column).join(' | ')}. Cached up to 10 minutes.`;}
}
async function updateAll(){notice('Loading comparisons. Each source is queried separately.');await Promise.all([loadTrend(),loadCompare()]);notice('Review the charts below. Missing data stays blank; failed sources are identified in their panel.');}
async function duplicates(){const source=$('duplicateSource').value,month=$('duplicateMonth').value;if(!source||!month)return;const label=contextLabel();$('checkDuplicates').disabled=true;$('duplicateResult').textContent=`Checking ${source} · ${month} · ${label}…`;
 try{const d=await api('duplicates',{source,month,country:$('country').value});$('duplicateResult').textContent=`${source} · ${month} · ${label}: ${fmt(d.extra_rows)} extra rows in ${fmt(d.duplicate_groups)} exact groups. Checked ${new Date(d.checked_at).toLocaleString()}. No data changed.`;}
 catch(e){$('duplicateResult').textContent=`Check failed: ${e.message}. This is not a clean result.`;}finally{$('checkDuplicates').disabled=false;}}
function exportCsv(){const rows=[['view','source','country','traffic','weight_basis','weight_column','year','month','weight_kg','database_rows','missing_weights','negative_weights','checked_at']];for(const [view,sets] of [['years',state.trend?[state.trend]:[]],['sources',state.comparison]])sets.forEach(d=>d.points.forEach(p=>rows.push([view,d.source.id,d.country,d.source.direction,d.basis,d.weight_column,p.year,p.month,p.weight_kg,p.rows,p.missing_weight,p.negative_weight,d.checked_at])));const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='mkt-data-review.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function initializeData(){
 try{const catalog=await api('sources');state.sources=catalog.sources;$('country').innerHTML='<option value="">All countries in source</option>'+catalog.countries.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('');$('country').value='CL';
 for(const id of ['fromYear','toYear','compareYear']){$(id).innerHTML='';for(let y=now.getFullYear();y>=2019;y--)$(id).add(new Option(y,y));}
 $('fromYear').value=String(Math.max(2019,now.getFullYear()-3));$('toYear').value=now.getFullYear();$('compareYear').value=now.getFullYear();$('duplicateMonth').value=`${now.getFullYear()}-${String(now.getMonth()||12).padStart(2,'0')}`;if(now.getMonth()===0)$('duplicateMonth').value=`${now.getFullYear()-1}-12`;
 buildChoices();$('signIn').hidden=true;await updateAll();
 }catch(e){notice(e.message,true);}
}
let googleInitialized=false;
function showSignIn(){
 $('signIn').hidden=false;notice('Sign in with your DATAFORCE Google account to load live comparisons.');
 if(googleInitialized)return;
 if(!window.google?.accounts?.id){setTimeout(showSignIn,500);return;}
 googleInitialized=true;
 google.accounts.id.initialize({client_id:CLIENT_ID,login_hint:state.email,callback:async response=>{DataforceAuth.setItem('df_google_id_token',response.credential);try{state.token=await DataforceAuth.establishSession(response.credential);await initializeData();}catch(error){notice('Please sign in with the same account used for DATAFORCE.',true);}}});
 google.accounts.id.renderButton($('googleButton'),{theme:'outline',size:'large'});
}
async function init(){const user=getDataforceUser();if(!user?.email){location.href='../';return;}state.email=user.email;$('userLabel').textContent=user.name||user.email;state.token=await DataforceAuth.getSessionToken()||'';
 if(!REVIEW_API){notice('The independent review API is being prepared. Live data will be available once it is deployed.',true);return;}
 if(!state.token){showSignIn();return;}await initializeData();}
$('filters').addEventListener('submit',e=>{e.preventDefault();updateAll();});
['country','direction','basis'].forEach(id=>$(id).addEventListener('change',()=>{state.trendVersion++;state.compareVersion++;state.trend=null;state.comparison=[];buildChoices();$('trendMeta').textContent='Filters changed. Click Update charts.';$('yearWeightChart').textContent='Update charts to apply the new filters.';$('yearRowsChart').textContent='';$('yearTable').innerHTML='';$('yearLegend').innerHTML='';$('trendFlags').textContent='';$('sourceLegend').innerHTML='';$('sourceChart').textContent='Update charts to apply the new filters.';$('sourceTable').innerHTML='';$('compareStatus').textContent='';$('export').disabled=true;$('duplicateResult').textContent='Not checked for these filters.';}));
$('loadTrend').addEventListener('click',loadTrend);$('loadCompare').addEventListener('click',loadCompare);$('checkDuplicates').addEventListener('click',duplicates);$('export').addEventListener('click',exportCsv);
$('yearLegend').addEventListener('click',e=>{const key=e.target.closest('[data-series]')?.dataset.series;if(!key)return;state.hiddenYears.has(key)?state.hiddenYears.delete(key):state.hiddenYears.add(key);renderTrend();});
$('sourceLegend').addEventListener('click',e=>{const key=e.target.closest('[data-series]')?.dataset.series;if(!key)return;state.hiddenSources.has(key)?state.hiddenSources.delete(key):state.hiddenSources.add(key);renderCompare();});
init();
