const DB_NAME="personal-finance-local",STORE="vault",BACKUP_FORMAT="PFLOCAL_BACKUP",ITER=310000;
let db,cryptoKey=null,appData=null,messageTimer;
let txDisplayLimit=50;
const $=id=>document.getElementById(id), uid=()=>crypto.randomUUID(), today=()=>new Date().toISOString().slice(0,10);
const money=n=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(n||0)+" ₫";
const fmt=n=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(n||0);
const digits=s=>String(s||"").replace(/\D/g,"");

function openDb(){return new Promise((res,rej)=>{let r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function readVault(){return new Promise((res,rej)=>{let r=db.transaction(STORE).objectStore(STORE).get("main");r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
function writeVault(v){return new Promise((res,rej)=>{let t=db.transaction(STORE,"readwrite");t.objectStore(STORE).put(v,"main");t.oncomplete=res;t.onerror=()=>rej(t.error)})}
function b64(b){return btoa(String.fromCharCode(...new Uint8Array(b)))}
function un64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function derive(p,s){let m=await crypto.subtle.importKey("raw",new TextEncoder().encode(p),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt:s,iterations:ITER,hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function enc(d,k){let iv=crypto.getRandomValues(new Uint8Array(12)),c=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(JSON.stringify(d)));return{iv:b64(iv),ciphertext:b64(new Uint8Array(c))}}
async function dec(v,k){return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:un64(v.iv)},k,un64(v.ciphertext))))}
async function persist(){let e=await enc(appData,cryptoKey);await writeVault({version:1,salt:window.localSalt,iv:e.iv,ciphertext:e.ciphertext,updatedAt:new Date().toISOString()})}
function msg(s){$("message").textContent=s;$("message").classList.remove("hidden");clearTimeout(messageTimer);messageTimer=setTimeout(()=>$("message").classList.add("hidden"),3500)}
function showOnly(id){["setupPanel","unlockPanel","appPanel"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}

function defaults(){
  return{
    schemaVersion:3,
    accounts:[
      {id:uid(),name:"Tiền mặt",type:"Tiền mặt",openingBalance:0,active:true},
      {id:uid(),name:"Ngân hàng",type:"Ngân hàng",openingBalance:0,active:true},
      {id:uid(),name:"Ví điện tử",type:"Ví điện tử",openingBalance:0,active:true}
    ],
    transactions:[],
    categories:{
      INCOME:["Lương","Thưởng","Thu khác","Thu nợ","Vay nợ"],
      EXPENSE:["Ăn uống","Di chuyển","Nhà cửa","Hóa đơn","Mua sắm","Y tế","Giải trí","Giáo dục","Chi khác","Cho vay","Trả nợ"]
    },
    budgets:[],
    debts:[],
    createdAt:new Date().toISOString()
  };
}
function normalize(d){
  let x=defaults();
  return{
    ...x,...d,
    schemaVersion:3,
    accounts:d.accounts||x.accounts,
    transactions:d.transactions||[],
    categories:{
      INCOME:d.categories?.INCOME||x.categories.INCOME,
      EXPENSE:d.categories?.EXPENSE||x.categories.EXPENSE
    },
    budgets:d.budgets||[],
    debts:d.debts||[]
  };
}

async function setup(p){
  let s=crypto.getRandomValues(new Uint8Array(16));
  window.localSalt=b64(s);
  cryptoKey=await derive(p,s);
  appData=defaults();
  await persist();
  showOnly("appPanel");
  $("lockBtn").classList.remove("hidden");
  render();
}
async function unlock(p){
  let v=await readVault();
  window.localSalt=v.salt;
  cryptoKey=await derive(p,un64(v.salt));
  appData=normalize(await dec(v,cryptoKey));
  await persist();
  showOnly("appPanel");
  $("lockBtn").classList.remove("hidden");
  render();
}
function lock(){
  cryptoKey=appData=null;
  $("lockBtn").classList.add("hidden");
  $("unlockPassword").value="";
  showOnly("unlockPanel");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function txTotal(type){
  return appData.transactions.filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0);
}

function accountBalance(accId){
  let a=appData.accounts.find(x=>x.id===accId);
  if(!a) return 0;
  let bal=a.openingBalance||0;
  for(let t of appData.transactions){
    if(t.type==="TRANSFER"){
      if(t.accountId===accId) bal-=t.amount;
      if(t.toAccountId===accId) bal+=t.amount;
    }else if(t.accountId===accId){
      bal+= (t.type==="INCOME" ? t.amount : -t.amount);
    }
  }
  return bal;
}

function render(){
  let inc=txTotal("INCOME"), out=txTotal("EXPENSE");
  let opening=appData.accounts.reduce((s,a)=>s+(a.openingBalance||0),0);
  $("incomeTotal").textContent=money(inc);
  $("expenseTotal").textContent=money(out);
  $("netTotal").textContent=money(opening+inc-out);
  renderAccounts();
  renderTransactions();
  renderCategories();
  renderBudgetOptions();
  renderBudgets();
  renderDebts();
  fillAccountOptions();
  fillCategoryOptions();
  fillTransferOptions();
  fillDebtAccountOptions();
}

function sortedTransactions(){
  return [...appData.transactions].sort((a,b)=>b.date.localeCompare(a.date)|| (b.createdAt||"").localeCompare(a.createdAt||""));
}

function renderTransactions(){
  let rows=sortedTransactions();
  let show=rows.slice(0,txDisplayLimit);
  let html="";
  if(!show.length){
    html='<div class="empty">Chưa có giao dịch.</div>';
  }else{
    html=show.map(t=>{
      let a=appData.accounts.find(x=>x.id===t.accountId);
      if(t.type==="TRANSFER"){
        let toA=appData.accounts.find(x=>x.id===t.toAccountId);
        return `<div class="list-row">
          <div class="grow"><b>Chuyển khoản <span class="transfer-tag">Chuyển</span></b>
          <small>${esc(t.date)} · ${esc(a?.name||"?")} → ${esc(toA?.name||"?")}${t.note?" · "+esc(t.note):""}</small></div>
          <strong class="amount">${money(t.amount)}</strong>
          <div class="actions"><button data-del-tx="${t.id}" class="tiny danger">Xóa</button></div>
        </div>`;
      }
      let tag="";
      if(t.debtId) tag=` <span class="debt-tag ${t.type==="INCOME"?"lend":"borrow"}">Vay nợ</span>`;
      return `<div class="list-row">
        <div class="grow"><b>${esc(t.category)}${tag}</b>
        <small>${esc(t.date)} · ${esc(a?.name||"Tài khoản đã xóa")}${t.note?" · "+esc(t.note):""}</small></div>
        <strong class="amount ${t.type==="INCOME"?"income":"expense"}">${t.type==="INCOME"?"+":"−"}${money(t.amount)}</strong>
        <div class="actions">
          <button data-edit-tx="${t.id}" class="tiny">Sửa</button>
          <button data-del-tx="${t.id}" class="tiny danger">Xóa</button>
        </div>
      </div>`;
    }).join("");
  }
  $("transactionList").innerHTML=html;
  let remain=rows.length - show.length;
  if(remain>0){
    $("loadMoreWrap").classList.remove("hidden");
    $("loadMoreBtn").textContent=`Hiển thị thêm (còn ${remain})`;
  }else{
    $("loadMoreWrap").classList.add("hidden");
  }
}

function renderAccounts(){
  let q=($("accountSearch")?.value||"").toLowerCase();
  let arr=appData.accounts.filter(a=>a.name.toLowerCase().includes(q));
  $("accountList").innerHTML=arr.map(a=>{
    let bal=accountBalance(a.id);
    return `<div class="list-row">
      <div class="grow"><b>${esc(a.name)}</b><small>${esc(a.type)}</small></div>
      <strong>${money(bal)}</strong>
      <div class="actions">
        <button class="tiny" data-edit-account="${a.id}">Sửa</button>
        <button class="tiny danger" data-del-account="${a.id}">Xóa</button>
      </div>
    </div>`;
  }).join("")||'<div class="empty">Không tìm thấy tài khoản.</div>';
}

function renderCategories(){
  let out=[];
  for(let type of ["EXPENSE","INCOME"])
    for(let name of appData.categories[type])
      out.push(`<div class="list-row"><div class="grow"><b>${esc(name)}</b><small>${type==="EXPENSE"?"Chi tiêu":"Thu nhập"}</small></div>
        <button class="tiny danger" data-del-category="${type}|${encodeURIComponent(name)}">Xóa</button></div>`);
  $("categoryList").innerHTML=out.join("")||'<div class="empty">Chưa có danh mục.</div>';
}

function fillAccountOptions(){
  let s=$("txAccount"),old=s.value;
  s.innerHTML=appData.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  if([...s.options].some(o=>o.value===old)) s.value=old;
}
function fillCategoryOptions(){
  let type=$("txType").value,s=$("txCategory"),old=s.value;
  s.innerHTML=(appData.categories[type]||[]).map(c=>`<option>${esc(c)}</option>`).join("");
  if([...s.options].some(o=>o.value===old)) s.value=old;
}
function fillTransferOptions(){
  let opts=appData.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  let f=$("tfFrom"),t=$("tfTo");
  let of=f.value,ot=t.value;
  f.innerHTML=opts; t.innerHTML=opts;
  if([...f.options].some(o=>o.value===of)) f.value=of;
  if([...t.options].some(o=>o.value===ot)) t.value=ot;
}
function fillDebtAccountOptions(){
  let opts=appData.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  let d=$("debtAccount"),r=$("repayAccount");
  let od=d.value,or=r.value;
  d.innerHTML=opts; r.innerHTML=opts;
  if([...d.options].some(o=>o.value===od)) d.value=od;
  if([...r.options].some(o=>o.value===or)) r.value=or;
}

function renderBudgetOptions(){
  let s=$("budgetCategory"),old=s.value;
  s.innerHTML=appData.categories.EXPENSE.map(c=>`<option>${esc(c)}</option>`).join("");
  if([...s.options].some(o=>o.value===old)) s.value=old;
}
function monthNow(){return today().slice(0,7)}
function renderBudgets(){
  let m=monthNow();
  $("budgetList").innerHTML=appData.budgets.map(b=>{
    let spent=appData.transactions.filter(t=>t.type==="EXPENSE"&&t.category===b.category&&t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0);
    let pct=b.amount?spent/b.amount*100:0;
    let warning=pct>=100?"Đã vượt hạn mức":pct>=80?"Sắp chạm hạn mức":"Trong hạn mức";
    return `<div class="budget-item">
      <div class="row-between"><b>${esc(b.category)}</b>
        <button class="tiny danger" data-del-budget="${encodeURIComponent(b.category)}">Xóa</button></div>
      <div>${money(spent)} / ${money(b.amount)}</div>
      <div class="progress"><i style="width:${Math.min(100,pct)}%"></i></div>
      <small class="${pct>=80?"warning":""}">${warning} · ${Math.round(pct)}%</small>
    </div>`;
  }).join("")||'<div class="empty">Chưa đặt hạn mức nào.</div>';
}

function debtRemaining(d){
  let paid=appData.transactions
    .filter(t=>t.debtId===d.id && (t.category==="Thu nợ"||t.category==="Trả nợ"))
    .reduce((s,t)=>s+t.amount,0);
  return Math.max(0, (d.amount||0) - paid);
}

function renderDebts(){
  let openLend=0, openBorrow=0;
  let list=appData.debts.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  let html=list.map(d=>{
    let rem=debtRemaining(d);
    if(rem>0){
      if(d.type==="CHO_VAY") openLend+=rem;
      else openBorrow+=rem;
    }
    let typeLabel=d.type==="CHO_VAY"?"Cho vay":"Vay nợ";
    let tagClass=d.type==="CHO_VAY"?"lend":"borrow";
    let status=rem<=0?'<span style="color:#166534;font-weight:700">Đã tất toán</span>':`<span class="warning">Còn ${money(rem)}</span>`;
    return `<div class="list-row" style="flex-wrap:wrap">
      <div class="grow">
        <b>${esc(d.person)} <span class="debt-tag ${tagClass}">${typeLabel}</span></b>
        <small>${esc(d.date)} · Gốc ${money(d.amount)}${d.note?" · "+esc(d.note):""}</small>
      </div>
      <div style="text-align:right">
        <div>${status}</div>
        <div class="actions" style="margin-top:6px;justify-content:flex-end">
          ${rem>0?`<button class="tiny" data-repay="${d.id}">${d.type==="CHO_VAY"?"Thu nợ":"Trả nợ"}</button>`:""}
          <button class="tiny danger" data-del-debt="${d.id}">Xóa</button>
        </div>
      </div>
    </div>`;
  }).join("")||'<div class="empty">Chưa có khoản vay / cho vay nào.</div>';
  $("debtList").innerHTML=html;
  $("lendTotal").textContent=money(openLend);
  $("borrowTotal").textContent=money(openBorrow);
}

function switchTab(t){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
  ["transactions","accounts","categories","debts","budgets","backup"].forEach(v=>{
    let el=$(`${v}View`);
    if(el) el.classList.toggle("hidden",v!==t);
  });
}

function showTxForm(t){
  $("transferForm").classList.add("hidden");
  $("transactionForm").classList.remove("hidden");
  $("txFormTitle").textContent=t?"Sửa giao dịch":"Thêm giao dịch";
  $("txId").value=t?.id||"";
  $("txType").value=t?.type||"EXPENSE";
  fillCategoryOptions();
  $("txAmount").value=t?fmt(t.amount):"";
  $("txDate").value=t?.date||today();
  fillAccountOptions();
  $("txAccount").value=t?.accountId||appData.accounts[0]?.id||"";
  $("txCategory").value=t?.category||$("txCategory").value;
  $("txNote").value=t?.note||"";
  $("transactionForm").scrollIntoView({behavior:"smooth",block:"start"});
}

function showTransferForm(){
  $("transactionForm").classList.add("hidden");
  $("transferForm").classList.remove("hidden");
  fillTransferOptions();
  $("tfDate").value=today();
  $("tfAmount").value="";
  $("tfNote").value="";
  $("transferForm").scrollIntoView({behavior:"smooth",block:"start"});
}

function moneyInput(el){
  let n=digits(el.value);
  el.value=n?fmt(Number(n)):"";
}

function download(blob,name){
  let u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}

function exportCsv(){
  let rows=sortedTransactions();
  let header=["Ngày","Loại","Danh mục","Số tiền","Tài khoản","Tài khoản nhận","Ghi chú","ID"];
  let lines=[header.join(",")];
  for(let t of rows){
    let typeLabel=t.type==="INCOME"?"Thu nhập":t.type==="EXPENSE"?"Chi tiêu":"Chuyển khoản";
    let acc=appData.accounts.find(x=>x.id===t.accountId)?.name||"";
    let toAcc=t.toAccountId?(appData.accounts.find(x=>x.id===t.toAccountId)?.name||""):"";
    let cells=[
      t.date,
      typeLabel,
      t.category||(t.type==="TRANSFER"?"Chuyển khoản":""),
      t.amount,
      `"${(acc||"").replace(/"/g,'""')}"`,
      `"${(toAcc||"").replace(/"/g,'""')}"`,
      `"${(t.note||"").replace(/"/g,'""')}"`,
      t.id
    ];
    lines.push(cells.join(","));
  }
  let bom="\uFEFF";
  let blob=new Blob([bom+lines.join("\n")],{type:"text/csv;charset=utf-8"});
  download(blob,`GiaoDich_${today()}.csv`);
  msg("Đã xuất file CSV. Mở bằng Excel hoặc Google Sheets.");
}

function copyTransactionsTable(){
  let rows=sortedTransactions();
  if(!rows.length){msg("Chưa có giao dịch để sao chép.");return}
  let header=["Ngày","Loại","Danh mục","Số tiền","Tài khoản","Ghi chú"];
  let tsv=[header.join("\t")];
  for(let t of rows){
    let typeLabel=t.type==="INCOME"?"Thu nhập":t.type==="EXPENSE"?"Chi tiêu":"Chuyển khoản";
    let acc=appData.accounts.find(x=>x.id===t.accountId)?.name||"";
    if(t.type==="TRANSFER"){
      let to=appData.accounts.find(x=>x.id===t.toAccountId)?.name||"";
      acc=`${acc} → ${to}`;
    }
    tsv.push([t.date,typeLabel,t.category||"",t.amount,acc,t.note||""].join("\t"));
  }
  navigator.clipboard.writeText(tsv.join("\n")).then(()=>msg("Đã sao chép bảng giao dịch. Dán vào Excel (Ctrl+V)."))
    .catch(()=>msg("Không sao chép được. Hãy dùng nút Xuất CSV."));
}

async function exportBackup(){
  let v=await readVault();
  download(new Blob([JSON.stringify({format:BACKUP_FORMAT,formatVersion:1,createdAt:new Date().toISOString(),vault:v})],{type:"application/json"}),`TaiChinhCaNhan_${today()}.pfbackup`);
  msg("Đã tạo file sao lưu mã hóa.");
}
async function importBackup(file){
  if(!file) throw Error("Hãy chọn file sao lưu.");
  let p=JSON.parse(await file.text());
  if(p.format!==BACKUP_FORMAT||!p.vault?.ciphertext) throw Error("File sao lưu không hợp lệ.");
  let pin=prompt("Nhập PIN/mật khẩu của file sao lưu:");
  if(!pin) return;
  let k=await derive(pin,un64(p.vault.salt));
  let d=normalize(await dec(p.vault,k));
  if(!confirm("Khôi phục sẽ thay thế dữ liệu hiện tại. Tiếp tục?")) return;
  await writeVault(p.vault);
  cryptoKey=k;
  window.localSalt=p.vault.salt;
  appData=d;
  txDisplayLimit=50;
  render();
  msg("Đã khôi phục dữ liệu.");
}

$("setupForm").onsubmit=async e=>{
  e.preventDefault();
  let p=$("setupPassword").value,p2=$("setupPassword2").value;
  if(!/^\d{4,}$/.test(p)) return msg("PIN phải gồm ít nhất 4 chữ số.");
  if(p!==p2) return msg("Hai PIN không khớp.");
  try{await setup(p);msg("Đã tạo kho dữ liệu.")}catch(x){msg(x.message)}
};
$("unlockForm").onsubmit=async e=>{
  e.preventDefault();
  try{await unlock($("unlockPassword").value);msg("Đã mở khóa.")}
  catch(x){$("unlockError").textContent="Không mở được dữ liệu. Kiểm tra lại PIN/mật khẩu."}
};
document.querySelectorAll(".peek").forEach(b=>b.onclick=()=>{
  let x=$(b.dataset.target);
  x.type=x.type==="password"?"text":"password";
  b.textContent=x.type==="password"?"Hiện":"Ẩn";
});
document.querySelectorAll(".clear").forEach(b=>b.onclick=()=>{
  $(b.dataset.target).value="";
  $(b.dataset.target).focus();
});
$("lockBtn").onclick=lock;
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

$("addTransactionBtn").onclick=()=>showTxForm();
$("cancelTransactionBtn").onclick=()=>$("transactionForm").classList.add("hidden");
$("txType").onchange=fillCategoryOptions;
$("txAmount").oninput=()=>moneyInput($("txAmount"));
$("transactionForm").onsubmit=async e=>{
  e.preventDefault();
  let id=$("txId").value;
  let amount=Number(digits($("txAmount").value));
  if(!Number.isSafeInteger(amount)||amount<=0) return msg("Số tiền phải lớn hơn 0.");
  let item={
    id:id||uid(),
    type:$("txType").value,
    amount,
    date:$("txDate").value,
    accountId:$("txAccount").value,
    category:$("txCategory").value,
    note:$("txNote").value.trim(),
    createdAt:new Date().toISOString()
  };
  if(id) appData.transactions=appData.transactions.map(t=>t.id===id?{...t,...item}:t);
  else appData.transactions.push(item);
  await persist();
  render();
  $("transactionForm").classList.add("hidden");
  msg(id?"Đã cập nhật giao dịch.":"Đã lưu giao dịch.");
};
$("transactionList").onclick=async e=>{
  let ed=e.target.dataset.editTx, del=e.target.dataset.delTx;
  if(ed){
    let t=appData.transactions.find(x=>x.id===ed);
    if(t && t.type!=="TRANSFER") showTxForm(t);
    return;
  }
  if(del && confirm("Xóa giao dịch này?")){
    appData.transactions=appData.transactions.filter(t=>t.id!==del);
    await persist();
    render();
    msg("Đã xóa giao dịch.");
  }
};
$("loadMoreBtn").onclick=()=>{
  txDisplayLimit+=50;
  renderTransactions();
};

$("addTransferBtn").onclick=showTransferForm;
$("cancelTransferBtn").onclick=()=>$("transferForm").classList.add("hidden");
$("tfAmount").oninput=()=>moneyInput($("tfAmount"));
$("transferForm").onsubmit=async e=>{
  e.preventDefault();
  let from=$("tfFrom").value, to=$("tfTo").value;
  let amount=Number(digits($("tfAmount").value));
  if(from===to) return msg("Hai tài khoản phải khác nhau.");
  if(!Number.isSafeInteger(amount)||amount<=0) return msg("Số tiền phải lớn hơn 0.");
  let item={
    id:uid(),
    type:"TRANSFER",
    amount,
    date:$("tfDate").value,
    accountId:from,
    toAccountId:to,
    category:"Chuyển khoản",
    note:$("tfNote").value.trim(),
    createdAt:new Date().toISOString()
  };
  appData.transactions.push(item);
  await persist();
  render();
  $("transferForm").classList.add("hidden");
  msg("Đã chuyển khoản thành công.");
};

$("addAccountBtn").onclick=()=>{
  $("accountForm").reset();
  $("accountId").value="";
  $("accountFormTitle").textContent="Thêm tài khoản";
  $("accountForm").classList.remove("hidden");
};
$("cancelAccountBtn").onclick=()=>$("accountForm").classList.add("hidden");
$("accountSearch").oninput=renderAccounts;
$("accountForm").onsubmit=async e=>{
  e.preventDefault();
  let id=$("accountId").value, name=$("accountName").value.trim();
  if(id){
    let a=appData.accounts.find(a=>a.id===id);
    a.name=name; a.type=$("accountType").value;
  }else{
    appData.accounts.push({id:uid(),name,type:$("accountType").value,openingBalance:0,active:true});
  }
  await persist();
  render();
  $("accountForm").classList.add("hidden");
  msg("Đã lưu tài khoản.");
};
$("accountList").onclick=async e=>{
  let ed=e.target.dataset.editAccount, del=e.target.dataset.delAccount;
  if(ed){
    let a=appData.accounts.find(a=>a.id===ed);
    $("accountId").value=a.id;
    $("accountName").value=a.name;
    $("accountType").value=a.type;
    $("accountFormTitle").textContent="Sửa tài khoản";
    $("accountForm").classList.remove("hidden");
    return;
  }
  if(del){
    if(appData.transactions.some(t=>t.accountId===del||t.toAccountId===del))
      return alert("Tài khoản đang có giao dịch. Hãy sửa/xóa các giao dịch liên quan trước.");
    if(confirm("Xóa tài khoản này?")){
      appData.accounts=appData.accounts.filter(a=>a.id!==del);
      await persist();
      render();
    }
  }
};

$("addCategoryBtn").onclick=()=>$("categoryForm").classList.remove("hidden");
$("cancelCategoryBtn").onclick=()=>$("categoryForm").classList.add("hidden");
$("categoryForm").onsubmit=async e=>{
  e.preventDefault();
  let n=$("categoryName").value.trim(), t=$("categoryType").value;
  if(!n) return;
  if(appData.categories[t].some(x=>x.toLowerCase()===n.toLowerCase())) return msg("Danh mục đã tồn tại.");
  appData.categories[t].push(n);
  await persist();
  render();
  $("categoryForm").reset();
  $("categoryForm").classList.add("hidden");
  msg("Đã thêm danh mục.");
};
$("categoryList").onclick=async e=>{
  let v=e.target.dataset.delCategory;
  if(!v) return;
  let [t,encoded]=v.split("|"), n=decodeURIComponent(encoded);
  if(appData.transactions.some(x=>x.type===t&&x.category===n))
    return alert("Danh mục đã được dùng trong giao dịch, không thể xóa.");
  if(confirm(`Xóa danh mục "${n}"?`)){
    appData.categories[t]=appData.categories[t].filter(x=>x!==n);
    await persist();
    render();
  }
};

$("budgetAmount").oninput=()=>moneyInput($("budgetAmount"));
$("budgetForm").onsubmit=async e=>{
  e.preventDefault();
  let c=$("budgetCategory").value, a=Number(digits($("budgetAmount").value));
  if(!c||!a) return msg("Nhập hạn mức hợp lệ.");
  let old=appData.budgets.find(x=>x.category===c);
  if(old) old.amount=a;
  else appData.budgets.push({category:c,amount:a});
  await persist();
  render();
  $("budgetAmount").value="";
  msg("Đã lưu hạn mức.");
};
$("budgetList").onclick=async e=>{
  let c=e.target.dataset.delBudget;
  if(!c) return;
  c=decodeURIComponent(c);
  appData.budgets=appData.budgets.filter(x=>x.category!==c);
  await persist();
  render();
};

$("addDebtBtn").onclick=()=>{
  $("repayForm").classList.add("hidden");
  $("debtForm").reset();
  $("debtId").value="";
  $("debtFormTitle").textContent="Thêm khoản vay / cho vay";
  $("debtDate").value=today();
  fillDebtAccountOptions();
  $("debtForm").classList.remove("hidden");
  $("debtForm").scrollIntoView({behavior:"smooth",block:"start"});
};
$("cancelDebtBtn").onclick=()=>$("debtForm").classList.add("hidden");
$("debtAmount").oninput=()=>moneyInput($("debtAmount"));
$("debtForm").onsubmit=async e=>{
  e.preventDefault();
  let type=$("debtType").value;
  let person=$("debtPerson").value.trim();
  let amount=Number(digits($("debtAmount").value));
  let accountId=$("debtAccount").value;
  let date=$("debtDate").value;
  let note=$("debtNote").value.trim();
  if(!person||!amount||amount<=0) return msg("Nhập đầy đủ thông tin hợp lệ.");
  let debtId=uid();
  appData.debts.push({
    id:debtId,
    type,
    person,
    amount,
    date,
    note,
    createdAt:new Date().toISOString()
  });
  let txType= type==="CHO_VAY" ? "EXPENSE" : "INCOME";
  let category= type==="CHO_VAY" ? "Cho vay" : "Vay nợ";
  appData.transactions.push({
    id:uid(),
    type:txType,
    amount,
    date,
    accountId,
    category,
    note: note || `${type==="CHO_VAY"?"Cho":"Vay"} ${person}`,
    debtId,
    createdAt:new Date().toISOString()
  });
  if(!appData.categories.EXPENSE.includes("Cho vay")) appData.categories.EXPENSE.push("Cho vay");
  if(!appData.categories.EXPENSE.includes("Trả nợ")) appData.categories.EXPENSE.push("Trả nợ");
  if(!appData.categories.INCOME.includes("Thu nợ")) appData.categories.INCOME.push("Thu nợ");
  if(!appData.categories.INCOME.includes("Vay nợ")) appData.categories.INCOME.push("Vay nợ");
  await persist();
  render();
  $("debtForm").classList.add("hidden");
  msg("Đã thêm khoản " + (type==="CHO_VAY"?"cho vay":"vay nợ") + ".");
};

$("debtList").onclick=async e=>{
  let repayId=e.target.dataset.repay;
  let delId=e.target.dataset.delDebt;
  if(repayId){
    let d=appData.debts.find(x=>x.id===repayId);
    if(!d) return;
    let rem=debtRemaining(d);
    $("debtForm").classList.add("hidden");
    $("repayDebtId").value=d.id;
    $("repayInfo").textContent=`${d.type==="CHO_VAY"?"Thu nợ từ":"Trả nợ cho"} ${d.person} · Còn lại ${money(rem)}`;
    $("repayAmount").value=fmt(rem);
    $("repayDate").value=today();
    $("repayNote").value="";
    fillDebtAccountOptions();
    $("repayForm").classList.remove("hidden");
    $("repayForm").scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  if(delId){
    if(!confirm("Xóa khoản này? Các giao dịch liên quan vẫn giữ nguyên.")) return;
    appData.debts=appData.debts.filter(x=>x.id!==delId);
    await persist();
    render();
    msg("Đã xóa khoản vay/nợ.");
  }
};

$("cancelRepayBtn").onclick=()=>$("repayForm").classList.add("hidden");
$("repayAmount").oninput=()=>moneyInput($("repayAmount"));
$("repayForm").onsubmit=async e=>{
  e.preventDefault();
  let debtId=$("repayDebtId").value;
  let d=appData.debts.find(x=>x.id===debtId);
  if(!d) return msg("Không tìm thấy khoản.");
  let amount=Number(digits($("repayAmount").value));
  let rem=debtRemaining(d);
  if(!amount||amount<=0) return msg("Số tiền không hợp lệ.");
  if(amount>rem) return msg(`Số tiền vượt quá số còn lại (${money(rem)}).`);
  let accountId=$("repayAccount").value;
  let date=$("repayDate").value;
  let note=$("repayNote").value.trim();
  let txType= d.type==="CHO_VAY" ? "INCOME" : "EXPENSE";
  let category= d.type==="CHO_VAY" ? "Thu nợ" : "Trả nợ";
  appData.transactions.push({
    id:uid(),
    type:txType,
    amount,
    date,
    accountId,
    category,
    note: note || `${category} - ${d.person}`,
    debtId,
    createdAt:new Date().toISOString()
  });
  await persist();
  render();
  $("repayForm").classList.add("hidden");
  msg("Đã ghi nhận " + (d.type==="CHO_VAY"?"thu nợ":"trả nợ") + ".");
};

$("exportBackupBtn").onclick=()=>exportBackup().catch(e=>msg(e.message));
$("importBackupBtn").onclick=()=>importBackup($("backupFile").files[0]).catch(e=>msg("Khôi phục thất bại: "+e.message));
$("exportCsvBtn").onclick=()=>exportCsv();
$("copyTxBtn").onclick=()=>copyTransactionsTable();

async function init(){
  if(!crypto?.subtle||!indexedDB){
    document.body.innerHTML="<p>Trình duyệt không hỗ trợ lưu trữ/mã hóa cần thiết.</p>";
    return;
  }
  db=await openDb();
  showOnly(await readVault()?"unlockPanel":"setupPanel");
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
init().catch(e=>msg("Không thể khởi tạo: "+e.message));
