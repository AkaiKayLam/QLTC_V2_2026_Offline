const DB_NAME = "personal-finance-local";
const DB_VERSION = 1;
const STORE = "vault";
const BACKUP_FORMAT = "PFLOCAL_BACKUP";
const PBKDF2_ITERATIONS = 310000;
let db;
let cryptoKey = null;
let appData = null;
let messageTimer;

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(n || 0);
const today = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID();

function openDb() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function readVault() {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,"readonly");
    const req = tx.objectStore(STORE).get("main");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function writeVault(value) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(value,"main");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function deriveKey(password,salt) {
  const material = await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptData(data,key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoded);
  return {iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(cipher))};
}
async function decryptData(envelope,key) {
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:base64ToBytes(envelope.iv)},key,base64ToBytes(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function persist() {
  const encrypted = await encryptData(appData,cryptoKey);
  await writeVault({version:1,salt:window.localSalt,iv:encrypted.iv,ciphertext:encrypted.ciphertext,updatedAt:new Date().toISOString()});
}
function showMessage(text) {
  $("message").textContent = text;
  $("message").classList.remove("hidden");
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => $("message").classList.add("hidden"),3000);
}
function showOnly(id) {
  ["setupPanel","unlockPanel","appPanel"].forEach(x => $(x).classList.toggle("hidden",x!==id));
}
function defaultData() {
  return {
    schemaVersion:1,
    currency:"VND",
    accounts:[{id:uid(),name:"Tiền mặt",type:"Tiền mặt",openingBalance:0,active:true}],
    transactions:[],
    categories:{INCOME:["Lương","Thưởng","Thu khác"],EXPENSE:["Ăn uống","Di chuyển","Nhà cửa","Mua sắm","Y tế","Chi khác"]},
    createdAt:new Date().toISOString()
  };
}
async function setup(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  window.localSalt = bytesToBase64(salt);
  cryptoKey = await deriveKey(password,salt);
  appData = defaultData();
  await persist();
  showOnly("appPanel");
  $("lockBtn").classList.remove("hidden");
  render();
}
async function unlock(password) {
  const vault = await readVault();
  if (!vault) throw new Error("Chưa có dữ liệu.");
  window.localSalt = vault.salt;
  cryptoKey = await deriveKey(password,base64ToBytes(vault.salt));
  appData = await decryptData(vault,cryptoKey);
  showOnly("appPanel");
  $("lockBtn").classList.remove("hidden");
  render();
}
function lock() {
  cryptoKey = null;
  appData = null;
  $("lockBtn").classList.add("hidden");
  $("unlockPassword").value = "";
  showOnly("unlockPanel");
}
function render() {
  const income = appData.transactions.filter(t=>t.type==="INCOME").reduce((s,t)=>s+t.amount,0);
  const expense = appData.transactions.filter(t=>t.type==="EXPENSE").reduce((s,t)=>s+t.amount,0);
  const opening = appData.accounts.reduce((s,a)=>s+(a.openingBalance||0),0);
  $("incomeTotal").textContent = money(income);
  $("expenseTotal").textContent = money(expense);
  $("netTotal").textContent = money(opening+income-expense);
  renderAccounts();
  renderTransactions();
  const select = $("txAccount");
  select.innerHTML = appData.accounts.filter(a=>a.active).map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
}
function renderTransactions() {
  const list = $("transactionList");
  const items = [...appData.transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  if (!items.length) { list.innerHTML = '<div class="empty">Chưa có giao dịch. Bấm “Thêm giao dịch” để bắt đầu.</div>'; return; }
  list.innerHTML = items.map(t => {
    const account = appData.accounts.find(a=>a.id===t.accountId);
    const sign = t.type==="INCOME"?"+":"−";
    return `<div class="list-row"><div><div class="item-title">${escapeHtml(t.category)}</div><div class="item-sub">${escapeHtml(t.date)} · ${escapeHtml(account?.name||"Tài khoản đã xóa")}${t.note?" · "+escapeHtml(t.note):""}</div></div><div class="amount ${t.type==="INCOME"?"income":"expense"}">${sign}${money(t.amount)}</div></div>`;
  }).join("");
}
function renderAccounts() {
  const list = $("accountList");
  list.innerHTML = appData.accounts.map(a => {
    const movement = appData.transactions.filter(t=>t.accountId===a.id).reduce((s,t)=>s+(t.type==="INCOME"?t.amount:-t.amount),0);
    return `<div class="list-row"><div><div class="item-title">${escapeHtml(a.name)}</div><div class="item-sub">${escapeHtml(a.type)}</div></div><div class="amount">${money((a.openingBalance||0)+movement)}</div></div>`;
  }).join("") || '<div class="empty">Chưa có tài khoản.</div>';
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  ["transactions","accounts","backup"].forEach(v=>$(`${v}View`).classList.toggle("hidden",v!==tab));
}
function downloadBlob(blob,name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportBackup() {
  const vault = await readVault();
  const payload = {format:BACKUP_FORMAT,formatVersion:1,createdAt:new Date().toISOString(),vault};
  downloadBlob(new Blob([JSON.stringify(payload)],{type:"application/json"}),`TaiChinhCaNhan_${today()}.pfbackup`);
  showMessage("Đã tạo file sao lưu mã hóa.");
}
async function importBackup(file) {
  if (!file) throw new Error("Hãy chọn file sao lưu.");
  const payload = JSON.parse(await file.text());
  if (payload.format!==BACKUP_FORMAT || payload.formatVersion!==1 || !payload.vault?.ciphertext) throw new Error("File sao lưu không đúng định dạng hoặc không được hỗ trợ.");
  const password = prompt("Nhập mật khẩu chính của file sao lưu:");
  if (!password) return;
  const key = await deriveKey(password,base64ToBytes(payload.vault.salt));
  const restored = await decryptData(payload.vault,key); // verify before replacing current data
  if (!restored || restored.schemaVersion!==1 || !Array.isArray(restored.accounts) || !Array.isArray(restored.transactions)) throw new Error("Dữ liệu trong file không hợp lệ.");
  if (!confirm("Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại trên thiết bị này. Tiếp tục?")) return;
  await writeVault(payload.vault);
  cryptoKey = key;
  window.localSalt = payload.vault.salt;
  appData = restored;
  render();
  showMessage("Đã khôi phục dữ liệu thành công.");
}
async function init() {
  if (!window.crypto?.subtle || !window.indexedDB) {
    document.body.innerHTML = "<main><h2>Thiết bị hoặc trình duyệt chưa hỗ trợ các tính năng bảo mật cần thiết.</h2><p>Hãy dùng trình duyệt hiện đại và mở ứng dụng qua HTTPS hoặc localhost.</p></main>";
    return;
  }
  db = await openDb();
  const vault = await readVault();
  showOnly(vault?"unlockPanel":"setupPanel");
  if ("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}
$("setupForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const p=$("setupPassword").value, p2=$("setupPassword2").value;
  if(p.length<10) return showMessage("Mật khẩu cần ít nhất 10 ký tự.");
  if(p!==p2) return showMessage("Hai mật khẩu không khớp.");
  try { await setup(p); showMessage("Đã tạo kho dữ liệu trên thiết bị."); } catch(err) { showMessage("Không thể tạo dữ liệu: "+err.message); }
});
$("unlockForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("unlockError").textContent="";
  try { await unlock($("unlockPassword").value); showMessage("Đã mở khóa."); }
  catch(err) { $("unlockError").textContent="Không mở được dữ liệu. Có thể mật khẩu không đúng hoặc file dữ liệu bị lỗi."; }
});
$("lockBtn").addEventListener("click",lock);
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
$("addTransactionBtn").addEventListener("click",()=>{$("transactionForm").classList.remove("hidden");$("txDate").value=today();});
$("cancelTransactionBtn").addEventListener("click",()=>$("transactionForm").classList.add("hidden"));
$("transactionForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const amount=Number($("txAmount").value);
  if(!Number.isSafeInteger(amount)||amount<=0) return showMessage("Số tiền phải là số nguyên dương.");
  appData.transactions.push({id:uid(),type:$("txType").value,amount,date:$("txDate").value,accountId:$("txAccount").value,category:$("txCategory").value.trim(),note:$("txNote").value.trim(),createdAt:new Date().toISOString()});
  try { await persist(); render(); $("transactionForm").reset(); $("transactionForm").classList.add("hidden"); showMessage("Đã lưu giao dịch."); }
  catch(err) { showMessage("Lỗi lưu dữ liệu: "+err.message); }
});
$("addAccountBtn").addEventListener("click",()=>$("accountForm").classList.remove("hidden"));
$("cancelAccountBtn").addEventListener("click",()=>$("accountForm").classList.add("hidden"));
$("accountForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("accountName").value.trim();
  if(!name) return;
  appData.accounts.push({id:uid(),name,type:$("accountType").value,openingBalance:0,active:true});
  await persist(); render(); $("accountForm").reset(); $("accountForm").classList.add("hidden"); showMessage("Đã thêm tài khoản.");
});
$("exportBackupBtn").addEventListener("click",()=>exportBackup().catch(e=>showMessage("Không thể sao lưu: "+e.message)));
$("importBackupBtn").addEventListener("click",()=>importBackup($("backupFile").files[0]).catch(e=>showMessage("Khôi phục thất bại: "+e.message)));
init().catch(err=>{console.error(err);showMessage("Không thể khởi tạo ứng dụng: "+err.message);});
