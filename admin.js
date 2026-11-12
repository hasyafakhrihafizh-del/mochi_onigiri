// Isi dengan Project URL dan anon/public key Supabase yang sama dengan app.js.
const SUPABASE_URL = "https://isgqfyqbayiemmadgnjo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZ3FmeXFiYXlpZW1tYWRnbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTUsImV4cCI6MjEwODE3MjM5NX0.G444gVM-AoL2X7mz-lZtdc61HGBMvkQxJdXnoRsIXEo";
const configured = !SUPABASE_URL.includes("YOUR_PROJECT_ID") && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY" && window.supabase;
const db = configured ? window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY) : null;
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
let allOrders=[];
let toastTimer;
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function message(msg,type=""){const el=$("#adminMessage");el.textContent=msg;el.className="message "+type;}
function showLogin(){ $("#loginPanel").classList.remove("hidden");$("#dashboard").classList.add("hidden");$("#logoutBtn").classList.add("hidden");}
function showDashboard(){ $("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");$("#logoutBtn").classList.remove("hidden");}
async function checkSession(){
  if(!db){$("#configWarning").classList.remove("hidden");$("#loginBtn").disabled=true;$("#loginMessage").textContent="Konfigurasi Supabase belum diisi. Edit admin.js terlebih dahulu.";return;}
  const {data,error}=await db.auth.getSession();
  if(error){showLogin();return;}
  if(data.session){const ok=await verifyAdmin();if(ok){showDashboard();await loadOrders();}else{await db.auth.signOut();showLogin();$("#loginMessage").textContent="Akun ini tidak terdaftar sebagai admin."}}
  else showLogin();
}
async function verifyAdmin(){
  const {data,error}=await db.rpc("is_current_user_admin");
  return !error && data===true;
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!db)return;
  const button=$("#loginBtn");button.disabled=true;button.textContent="Memeriksa...";
  $("#loginMessage").textContent="";
  const {error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
  if(error){$("#loginMessage").textContent="Login gagal: "+error.message;$("#loginMessage").className="message error";}
  else if(await verifyAdmin()){showDashboard();await loadOrders();}
  else{await db.auth.signOut();$("#loginMessage").textContent="Login berhasil, tetapi akun ini belum diberi akses admin.";$("#loginMessage").className="message error";}
  button.disabled=false;button.textContent="Masuk ke dashboard";
});
$("#logoutBtn").addEventListener("click",async()=>{if(db)await db.auth.signOut();showLogin();});
$("#refreshBtn").addEventListener("click",loadOrders);
$("#searchOrders").addEventListener("input",renderOrders);
$("#statusFilter").addEventListener("change",renderOrders);
$("#paymentFilter").addEventListener("change",renderOrders);
async function loadOrders(){
  if(!db)return;
  message("Memuat pesanan...");
  const {data,error}=await db.from("orders").select("id,order_number,customer_name,customer_phone,customer_address,payment_method,payment_status,order_status,total,created_at,order_items(id,product_name,unit_price,quantity)").order("created_at",{ascending:false}).limit(500);
  if(error){message("Gagal memuat data: "+error.message,"error");return;}
  allOrders=data||[];updateStats();renderOrders();message(`${allOrders.length} pesanan berhasil dimuat.`,"success");
}
function updateStats(){
  $("#statOrders").textContent=allOrders.length;
  $("#statPending").textContent=allOrders.filter(o=>["Menunggu","Diproses"].includes(o.order_status)).length;
  $("#statPaid").textContent=allOrders.filter(o=>o.payment_status==="Lunas").length;
  $("#statRevenue").textContent=money(allOrders.filter(o=>o.payment_status==="Lunas").reduce((s,o)=>s+Number(o.total),0));
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderOrders(){
  const query=$("#searchOrders").value.trim().toLowerCase(),status=$("#statusFilter").value,pay=$("#paymentFilter").value;
  const orders=allOrders.filter(o=>(!status||o.order_status===status)&&(!pay||o.payment_status===pay)&&[o.order_number,o.customer_name,o.customer_phone].some(v=>String(v||"").toLowerCase().includes(query)));
  const body=$("#ordersBody");body.innerHTML="";
  if(!orders.length){body.innerHTML='<tr><td colspan="7">Tidak ada pesanan yang cocok.</td></tr>';return;}
  orders.forEach(o=>{
    const tr=document.createElement("tr");
    const summary=(o.order_items||[]).map(i=>`${i.product_name} × ${i.quantity}`).join(", ");
    tr.innerHTML=`<td><span class="order-number">${esc(o.order_number)}</span><small>${new Date(o.created_at).toLocaleString("id-ID")}</small></td>
      <td><strong>${esc(o.customer_name)}</strong><small>${esc(o.customer_phone)}</small><small>${esc(o.customer_address||"Tanpa catatan")}</small></td>
      <td>${esc(summary||"-")}</td><td><strong>${money(o.total)}</strong></td>
      <td><span class="pill ${o.payment_status==="Lunas"?"paid":o.payment_status==="Gagal"?"failed":""}">${esc(o.payment_status)}</span><small>${esc(o.payment_method)}</small></td>
      <td><span class="pill ${o.order_status==="Selesai"?"selesai":o.order_status==="Dibatalkan"?"cancel":""}">${esc(o.order_status)}</span></td>
      <td><div class="action-stack"><select data-order-status="${o.id}" aria-label="Status pesanan"><option ${o.order_status==="Menunggu"?"selected":""}>Menunggu</option><option ${o.order_status==="Diproses"?"selected":""}>Diproses</option><option ${o.order_status==="Siap diambil"?"selected":""}>Siap diambil</option><option ${o.order_status==="Selesai"?"selected":""}>Selesai</option><option ${o.order_status==="Dibatalkan"?"selected":""}>Dibatalkan</option></select>
      <select data-payment-status="${o.id}" aria-label="Status pembayaran"><option ${o.payment_status==="Menunggu"?"selected":""}>Menunggu</option><option ${o.payment_status==="Lunas"?"selected":""}>Lunas</option><option ${o.payment_status==="Gagal"?"selected":""}>Gagal</option></select>
      <button data-save="${o.id}">Simpan status</button><button class="detail-btn" data-detail="${o.id}">Detail / struk</button></div></td>`;
    body.appendChild(tr);
  });
}
$("#ordersBody").addEventListener("click",async e=>{
  const save=e.target.closest("[data-save]"),detail=e.target.closest("[data-detail]");
  if(save){
    const id=save.dataset.save,status=$(`[data-order-status="${id}"]`).value,payment=$(`[data-payment-status="${id}"]`).value;
    save.disabled=true;save.textContent="Menyimpan...";
    const {error}=await db.from("orders").update({order_status:status,payment_status:payment}).eq("id",id);
    if(error){toast("Gagal menyimpan: "+error.message);save.disabled=false;save.textContent="Simpan status";return;}
    toast("Status pesanan berhasil diperbarui.");await loadOrders();
  }
  if(detail){const order=allOrders.find(o=>o.id===detail.dataset.detail);if(order)showDetail(order);}
});
function showDetail(o){
  const items=(o.order_items||[]).map(i=>`<p><span>${esc(i.product_name)} × ${i.quantity}<br><small>${money(i.unit_price)} / buah</small></span><b>${money(i.unit_price*i.quantity)}</b></p>`).join("");
  $("#detailContent").innerHTML=`<div class="detail-row"><span>No. pesanan</span><b>${esc(o.order_number)}</b></div><div class="detail-row"><span>Tanggal</span><b>${new Date(o.created_at).toLocaleString("id-ID")}</b></div><div class="detail-row"><span>Nama pelanggan</span><b>${esc(o.customer_name)}</b></div><div class="detail-row"><span>WhatsApp</span><b>${esc(o.customer_phone)}</b></div><div class="detail-row"><span>Alamat/catatan</span><b>${esc(o.customer_address||"-")}</b></div><div class="detail-row"><span>Metode pembayaran</span><b>${esc(o.payment_method)}</b></div><div class="detail-row"><span>Status pembayaran</span><b>${esc(o.payment_status)}</b></div><div class="detail-row"><span>Status pesanan</span><b>${esc(o.order_status)}</b></div><div class="detail-items">${items}</div><div class="detail-row detail-total"><span>Total pesanan</span><b>${money(o.total)}</b></div><p class="footnote">Struk ini merupakan rincian pesanan. Pembayaran dinyatakan lunas hanya setelah diverifikasi admin.</p>`;
  $("#detailModal").classList.add("open");$("#printAdminReceipt").onclick=()=>window.print();
}
$("#closeDetail").addEventListener("click",()=>$("#detailModal").classList.remove("open"));
$("#detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")$("#detailModal").classList.remove("open");});
checkSession();
