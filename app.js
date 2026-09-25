const DEFAULT={version:2,people:[],lines:[],transactions:[]};
let data=JSON.parse(localStorage.getItem("phoneBillManagerDatabaseV1")||"null")||structuredClone(DEFAULT);
const SUPABASE_URL="https://hvfsgpixzbblpqruapik.supabase.co";
const SUPABASE_KEY="sb_publishable_48cBvLI6JMtH1Haw6Tu0EQ_5dKZL3bv";
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,channel=null,timer=null;
const $=id=>document.getElementById(id);
const money=n=>"$"+Number(n||0).toFixed(2);
const uid=()=>crypto.randomUUID();
function saveLocal(){localStorage.setItem("phoneBillManagerDatabaseV1",JSON.stringify(data));}
function months(){const s=new Set(); data.lines.forEach(l=>Object.keys(l.monthlyAmounts||{}).forEach(m=>s.add(m))); data.transactions.forEach(t=>s.add((t.date||"").slice(0,7))); const now=new Date(); s.add(now.toISOString().slice(0,7)); return [...s].filter(Boolean).sort();}
function amount(line,m){return Number(line.monthlyAmounts?.[m] ?? line.bill ?? 0);}
function targetLines(target){return data.lines.filter(l=>l.personId===target || l.id===target);}
function breakdown(personId){
 let carry=0;
 return months().map(m=>{let billed=data.lines.filter(l=>l.personId===personId).reduce((s,l)=>s+amount(l,m),0);
 let paid=data.transactions.filter(t=>(t.personId===personId||targetLines(personId).some(l=>l.id===t.lineId))&&t.date?.slice(0,7)===m).reduce((s,t)=>s+Number(t.amount),0);
 let available=carry+paid, applied=Math.min(billed,available), bal=Math.max(0,billed-applied); carry=Math.max(0,available-billed);
 return {month:m,billed,paid:applied,balance:bal};});
}
function balance(id){return breakdown(id).reduce((s,x)=>s+x.balance,0)}
function totalDue(){return data.people.reduce((s,p)=>s+balance(p.id),0)+data.lines.filter(l=>!l.personId).reduce((s,l)=>s+months().reduce((z,m)=>z+amount(l,m),0)-data.transactions.filter(t=>t.lineId===l.id).reduce((z,t)=>z+Number(t.amount),0),0)}
function render(){
 $("statLines").textContent=data.lines.length;$("statPeople").textContent=data.people.length;$("statTransactions").textContent=data.transactions.length;$("statDue").textContent=money(totalDue());
 $("peopleList").innerHTML=data.people.length?data.people.map(p=>`<div class="person-item"><div class="person-main"><strong>${esc(p.name)}</strong><small>Due: ${money(balance(p.id))}</small></div><div class="actions"><button class="secondary" onclick="editPerson('${p.id}')">Edit</button><button class="danger" onclick="delPerson('${p.id}')">Delete</button></div></div>`).join(""):'<div class="empty">No people yet.</div>';
 $("linesList").innerHTML=data.lines.length?`<table><thead><tr><th>Line</th><th>Person</th><th>Default</th><th>Due</th><th></th></tr></thead><tbody>${data.lines.map(l=>{let p=data.people.find(x=>x.id===l.personId);return `<tr><td>${esc(l.number)}<br><small>${esc(l.note||"")}</small></td><td>${esc(p?.name||"Unassigned")}</td><td>${money(l.bill)}</td><td class="balance-due">${money(l.personId?balance(l.personId):0)}</td><td><button class="secondary" onclick="editLine('${l.id}')">Edit</button> <button class="danger" onclick="delLine('${l.id}')">Delete</button></td></tr>`}).join("")}</tbody></table>`:'<div class="empty">No phone lines yet.</div>';
 $("balancesList").innerHTML=data.people.length?data.people.map(p=>{let b=breakdown(p.id);return `<div class="balance-card"><div class="balance-head"><div><h3>${esc(p.name)}</h3><div class="muted">Total due: <b class="balance-due">${money(balance(p.id))}</b></div></div></div><div class="month-summary">${b.map(x=>`<div class="month-row"><b>${x.month}</b><span>Billed ${money(x.billed)}</span><span>Paid ${money(x.paid)}</span><span>Due <b class="${x.balance?'balance-due':'balance-paid'}">${money(x.balance)}</b></span></div>`).join("")}</div><div class="tx-list">${data.transactions.filter(t=>t.personId===p.id||targetLines(p.id).some(l=>l.id===t.lineId)).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<div class="tx"><span>${t.date} — ${esc(t.description||"Payment")}</span><b>${money(t.amount)} <button class="danger" onclick="delTx('${t.id}')">×</button></b></div>`).join("")||'<div class="muted">No payments.</div>'}</div></div>`}).join(""):'<div class="empty">Add a person to see balances.</div>';
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function changed(){saveLocal();render();scheduleSave();}
function editPerson(id){const p=data.people.find(x=>x.id===id);$("personId").value=p.id;$("personName").value=p.name;$("personDialogTitle").textContent="Edit Person";$("personDialog").showModal();}
function delPerson(id){if(!confirm("Delete this person? Lines will become unassigned."))return;data.lines.forEach(l=>{if(l.personId===id)delete l.personId});data.people=data.people.filter(p=>p.id!==id);changed();}
$("personForm").onsubmit=e=>{e.preventDefault();const id=$("personId").value,n=$("personName").value.trim();if(id)data.people.find(p=>p.id===id).name=n;else data.people.push({id:uid(),name:n});$("personDialog").close();changed();};
$("addPersonBtn").onclick=()=>{$("personId").value="";$("personName").value="";$("personDialogTitle").textContent="Add Person";$("personDialog").showModal();};
function fillPeople(sel,selected=""){sel.innerHTML='<option value="">Unassigned</option>'+data.people.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("")}
function editLine(id){const l=data.lines.find(x=>x.id===id);$("lineId").value=id;$("lineNumber").value=l.number;$("lineBill").value=l.bill||"";$("lineNote").value=l.note||"";fillPeople($("linePerson"),l.personId);$("monthAmounts").innerHTML=Object.entries(l.monthlyAmounts||{}).map(([m,v])=>row(m,v)).join("");$("lineDialogTitle").textContent="Edit Phone Line";$("lineDialog").showModal();}
function row(m="",v=""){return `<div class="month-amount-row"><input type="month" value="${m}"><input type="number" min="0" step="0.01" value="${v}"><button type="button" class="danger" onclick="this.parentElement.remove()">Remove</button></div>`}
$("addMonthAmountBtn").onclick=()=>{$("monthAmounts").insertAdjacentHTML("beforeend",row(new Date().toISOString().slice(0,7),""));};
$("addLineBtn").onclick=()=>{$("lineId").value="";$("lineNumber").value="";$("lineBill").value="";$("lineNote").value="";fillPeople($("linePerson"));$("monthAmounts").innerHTML="";$("lineDialogTitle").textContent="Add Phone Line";$("lineDialog").showModal();};
$("lineForm").onsubmit=e=>{e.preventDefault();let id=$("lineId").value,l=id?data.lines.find(x=>x.id===id):{id:uid()};l.number=$("lineNumber").value.trim();l.bill=Number($("lineBill").value||0);l.personId=$("linePerson").value||null;l.note=$("lineNote").value.trim();l.monthlyAmounts={};document.querySelectorAll("#monthAmounts .month-amount-row").forEach(r=>{let m=r.children[0].value;if(m)l.monthlyAmounts[m]=Number(r.children[1].value||0)});if(!id)data.lines.push(l);$("lineDialog").close();changed();};
function delLine(id){if(!confirm("Delete this line and its payments?"))return;data.lines=data.lines.filter(l=>l.id!==id);data.transactions=data.transactions.filter(t=>t.lineId!==id);changed();}
function openTx(){fillTxTargets();$("transactionAmount").value="";$("transactionDate").value=new Date().toISOString().slice(0,10);$("transactionDescription").value="";$("transactionDialog").showModal();}
function fillTxTargets(){$("transactionTarget").innerHTML=data.people.map(p=>`<option value="p:${p.id}">${esc(p.name)}</option>`).join("")+data.lines.map(l=>`<option value="l:${l.id}">Line ${esc(l.number)}</option>`).join("");}
$("addTransactionBtn").onclick=openTx;
$("transactionForm").onsubmit=e=>{e.preventDefault();let [kind,id]=$("transactionTarget").value.split(":");data.transactions.push({id:uid(),personId:kind==="p"?id:null,lineId:kind==="l"?id:null,amount:Number($("transactionAmount").value),date:$("transactionDate").value,description:$("transactionDescription").value.trim()});$("transactionDialog").close();changed();};
function delTx(id){if(confirm("Delete this transaction?")){data.transactions=data.transactions.filter(t=>t.id!==id);changed();}}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("resetBtn").onclick=()=>{if(confirm("Reset local data? Cloud data is not deleted.")){data=structuredClone(DEFAULT);changed();}};
$("exportJsonBtn").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="phone-bill-manager.json";a.click();};
$("importJsonBtn").onclick=()=>$("jsonFileInput").click();
$("jsonFileInput").onchange=async e=>{try{data=JSON.parse(await e.target.files[0].text());saveLocal();render();scheduleSave();toast("Imported");}catch(x){alert("Invalid JSON file");}};
$("openDbBtn").onclick=()=>alert("On iPhone, use Import JSON / Export JSON. On desktop, cloud sync is the recommended database.");
$("saveDbBtn").onclick=()=>{saveLocal();scheduleSave();toast(user?"Saved to cloud":"Saved locally");};
$("accountBtn").onclick=()=>{$("authMessage").textContent=user?user.email:"";$("signOutBtn").style.display=user?"block":"none";$("authDialog").showModal();};
$("authForm").onsubmit=async e=>{e.preventDefault();if(!sb)return;const {error}=await sb.auth.signInWithPassword({email:$("authEmail").value,password:$("authPassword").value});$("authMessage").textContent=error?.message||"Signed in.";};
$("signUpBtn").onclick=async()=>{const {error}=await sb.auth.signUp({email:$("authEmail").value,password:$("authPassword").value});$("authMessage").textContent=error?.message||"Account created. Check your email if confirmation is required.";};
$("signOutBtn").onclick=async()=>{await sb.auth.signOut();$("authDialog").close();};
async function loadCloud(){if(!user)return;const {data:r,error}=await sb.from("phone_bill_data").select("data").eq("user_id",user.id).maybeSingle();if(error){$("accountStatus").textContent="Cloud sync: database setup needed";return}if(r?.data){data=r.data;saveLocal();render()}else if(data.people.length||data.lines.length||data.transactions.length)await saveCloud();else await saveCloud();$("accountStatus").textContent="Cloud sync: "+user.email;subscribe();}
async function saveCloud(){if(!user)return;const {error}=await sb.from("phone_bill_data").upsert({user_id:user.id,data,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)console.error(error);}
function scheduleSave(){clearTimeout(timer);if(user)timer=setTimeout(saveCloud,400);}
function subscribe(){if(channel)sb.removeChannel(channel);channel=sb.channel("phone-bill-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"phone_bill_data",filter:"user_id=eq."+user.id},p=>{if(p.new?.data){data=p.new.data;saveLocal();render()}}).subscribe();}
$("syncNowBtn").onclick=async()=>{await saveCloud();$("accountStatus").textContent="Cloud sync: saved";};
sb?.auth.onAuthStateChange(async(_e,s)=>{user=s?.user||null;if(user){$("accountStatus").textContent="Cloud sync: loading…";await loadCloud()}else{$("accountStatus").textContent="Cloud sync: not signed in";if(channel)sb.removeChannel(channel);}});
render();