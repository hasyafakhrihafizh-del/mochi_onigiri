/*
  Konfigurasi Supabase:
  1) Buat project Supabase.
  2) Jalankan supabase.sql di SQL Editor.
  3) Buat user admin di Authentication > Users, lalu tambahkan UUID user ke tabel admin_users (lihat README).
  4) Ganti SUPABASE_URL dan SUPABASE_ANON_KEY di bawah.
  Jangan pernah menaruh service_role key di file browser.
*/
const SUPABASE_URL = "https://isgqfyqbayiemmadgnjo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2vX4KDP4mTVWEKuyuMGAJQ_r01d2lcD";
const WHATSAPP_NUMBER = "6281234567890"; // Ganti nomor admin; format 62xxxxxxxxxx

const hasConfig = SUPABASE_URL.includes("YOUR_PROJECT_ID") === false &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY" &&
  window.supabase && window.supabase.createClient;
const db = hasConfig ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (s) => document.querySelector(s);
const rupiah = (n) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
let products = [];
let cart = {};
let currentOrder = null;
let toastTimer;

function toast(message) {
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3000);
}
function productEmoji(p) {
  const id=p.slug || "";
  if(id.includes("kacang")) return "🥜";
  if(id.includes("cokelat")) return "🍫";
  if(id.includes("stroberi")) return "🍓";
  if(id.includes("keju")) return "🧀";
  if(id.includes("susu")) return "🥛";
  if(id.includes("rendang")) return "🍙";
  if(id.includes("geprek")) return "🌶️";
  if(id.includes("mayo")) return "🍗";
  if(id.includes("ceker")) return "🍲";
  return p.category==="Mochi"?"🍡":"🍙";
}
function fallbackProducts() {
  return [
    ["mochi-kacang","Mochi Kacang","Mochi",2500,"Mochi lembut dengan isian kacang.","#f2dfc7","Favorit"],
    ["mochi-cokelat","Mochi Cokelat","Mochi",2500,"Manis cokelat dalam balutan kenyal.","#e9d4c4","Choco"],
    ["mochi-stroberi","Mochi Stroberi","Mochi",2500,"Rasa stroberi yang manis dan segar.","#f6d9df","Fresh"],
    ["mochi-keju","Mochi Keju","Mochi",2500,"Perpaduan mochi lembut dan keju.","#f7e8b9","Creamy"],
    ["mochi-susu","Mochi Susu","Mochi",2500,"Rasa susu yang lembut dan ringan.","#e9e6dc","Classic"],
    ["onigiri-rendang","Onigiri Rendang","Onigiri",10000,"Nasi kepal dengan isian rendang gurih.","#e4e9d9","Gurih"],
    ["onigiri-ayam-geprek","Onigiri Ayam Geprek","Onigiri",10000,"Ayam geprek berbumbu untuk pencinta pedas.","#f6dfd0","Pedas"],
    ["onigiri-chicken-mayo","Onigiri Chicken Mayo","Onigiri",10000,"Ayam dan mayones dalam nasi kepal.","#f1e5ca","Creamy"],
    ["onigiri-ceker","Onigiri Ceker","Onigiri",10000,"Isian ceker berbumbu dengan rasa mantap.","#e8dcd2","Spesial"]
  ].map(([slug,name,category,price,description,color,tag])=>({id:slug,slug,name,category,price,description,color,tag,active:true}));
}
async function loadProducts() {
  if(!db) {
    products=fallbackProducts(); renderProducts();
    toast("Mode demo: isi konfigurasi Supabase di app.js agar pesanan tersimpan online.");
    return;
  }
  const {data,error}=await db.from("products").select("id,slug,name,category,price,description,active").eq("active",true).order("sort_order");
  if(error) {
    products=fallbackProducts(); renderProducts();
    toast("Menu database belum terbaca. Periksa SQL dan konfigurasi Supabase.");
    console.error(error); return;
  }
  products=data.map(p=>({...p,color:p.category==="Mochi"?"#f5dfdf":"#e2eadb",tag:p.category==="Mochi"?"Mochi":"Onigiri"}));
  renderProducts();
}
function renderProducts() {
  const mochi=$("#mochiGrid"), oni=$("#onigiriGrid"); mochi.innerHTML=""; oni.innerHTML="";
  products.forEach(p=>{
    const card=document.createElement("article"); card.className="product-card";
    card.innerHTML=`<div class="product-art" style="background:${p.color}"><span class="tag">${p.tag||p.category}</span><span class="product-emoji">${productEmoji(p)}</span></div>
      <div class="product-info"><h4></h4><p></p><div class="product-bottom"><span class="product-price">${rupiah(Number(p.price))}</span><button class="add-button" data-add="${p.id}" aria-label="Tambah produk">+</button></div></div>`;
    card.querySelector("h4").textContent=p.name;
    card.querySelector("p").textContent=p.description||"Pilihan favorit untuk menemani harimu.";
    (p.category==="Mochi"?mochi:oni).appendChild(card);
  });
}
function cartEntries(){return Object.entries(cart).filter(([,qty])=>qty>0).map(([id,qty])=>({product:products.find(p=>String(p.id)===String(id)),qty})).filter(x=>x.product);}
function cartCount(){return cartEntries().reduce((s,x)=>s+x.qty,0);}
function cartTotal(){return cartEntries().reduce((s,x)=>s+Number(x.product.price)*x.qty,0);}
function renderCart(){
  $("#cartCount").textContent=cartCount();$("#cartTotal").textContent=rupiah(cartTotal());$("#checkoutTotal").textContent=rupiah(cartTotal());
  const el=$("#cartItems");el.innerHTML="";
  const entries=cartEntries();
  if(!entries.length){el.innerHTML='<p class="muted">Keranjang masih kosong. Tambahkan produk dari menu.</p>';return;}
  entries.forEach(({product:p,qty})=>{
    const row=document.createElement("div");row.className="cart-row";
    row.innerHTML=`<div class="cart-emoji" style="background:${p.color}">${productEmoji(p)}</div><div><h4></h4><small>${rupiah(Number(p.price))} / buah</small><div class="qty"><button data-qty="${p.id}" data-delta="-1">−</button><span>${qty}</span><button data-qty="${p.id}" data-delta="1">+</button></div></div><div><div class="line-price">${rupiah(Number(p.price)*qty)}</div><button class="remove" data-remove="${p.id}">Hapus</button></div>`;
    row.querySelector("h4").textContent=p.name;el.appendChild(row);
  });
}
function openCart(){ $("#cartPanel").classList.add("open");$("#shade").classList.add("visible");document.body.classList.add("locked"); }
function closeCart(){ $("#cartPanel").classList.remove("open");$("#shade").classList.remove("visible");document.body.classList.remove("locked"); }
function openModal(id){closeCart();$("#"+id).classList.add("open");document.body.classList.add("locked");}
function closeModal(id){$("#"+id).classList.remove("open");if(!document.querySelector(".modal.open")&&!$("#cartPanel").classList.contains("open"))document.body.classList.remove("locked");}
function waUrl(message){return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;}
function makeWhatsAppMessage(order){
  const lines=order.items.map(i=>`• ${i.name} x${i.quantity} = ${rupiah(i.unit_price*i.quantity)}`).join("\n");
  return `Halo, saya ingin konfirmasi pesanan Mochi & Onigiri.\nNo. pesanan: ${order.order_number}\nNama: ${order.customer_name}\nWhatsApp: ${order.customer_phone}\nAlamat/catatan: ${order.customer_address||"-"}\n\n${lines}\n\nTotal: ${rupiah(order.total)}\nMetode pembayaran: ${order.payment_method}\nMohon konfirmasi pesanan dan instruksi pembayaran. Terima kasih!`;
}
function renderReceipt(order){
  $("#receiptNumber").textContent=order.order_number;$("#receiptDate").textContent=new Date(order.created_at||Date.now()).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});
  $("#receiptCustomer").textContent=order.customer_name;$("#receiptPayment").textContent=order.payment_method;$("#receiptTotal").textContent=rupiah(Number(order.total));
  $("#receiptStatus").textContent="PESANAN TERSIMPAN • MENUNGGU KONFIRMASI";
  $("#receiptItems").innerHTML="";
  order.items.forEach(i=>{const line=document.createElement("div");line.className="receipt-line";line.innerHTML=`<div></div><b>${rupiah(Number(i.unit_price)*Number(i.quantity))}</b>`;const d=line.querySelector("div");d.textContent=`${i.name} × ${i.quantity}`;const small=document.createElement("small");small.textContent=`${i.quantity} × ${rupiah(Number(i.unit_price))}`;d.appendChild(small);$("#receiptItems").appendChild(line);});
  $("#receiptNote").textContent=order.payment_method==="QRIS"?"Silakan minta QRIS resmi dari penjual dan tunggu konfirmasi pembayaran. Struk ini bukan bukti pembayaran lunas.":order.payment_method==="E-Wallet"?"Admin akan mengirim instruksi pembayaran dompet digital. Struk ini bukan bukti pembayaran lunas.":"Pembayaran tunai perlu dikonfirmasi dengan penjual. Struk ini bukan bukti pembayaran lunas.";
}
async function placeOrder(event){
  event.preventDefault();
  if(!db){toast("Supabase belum dikonfigurasi. Ikuti README dan isi URL serta anon key.");return;}
  const name=$("#customerName").value.trim(),phone=$("#customerPhone").value.trim(),address=$("#customerAddress").value.trim();
  const payment=document.querySelector('input[name="payment"]:checked')?.value;
  const items=cartEntries();
  if(!items.length)return toast("Keranjang masih kosong.");
  if(!payment)return toast("Pilih metode pembayaran.");
  const button=$("#placeOrder");button.disabled=true;button.textContent="Menyimpan pesanan...";
  try{
    const payload=items.map(({product,qty})=>({product_id:product.id,quantity:qty}));
    const {data,error}=await db.rpc("create_order",{p_customer_name:name,p_customer_phone:phone,p_customer_address:address||null,p_payment_method:payment,p_items:payload});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||!result.order_id)throw new Error("Respons nomor pesanan tidak ditemukan.");
    const orderItems=items.map(({product,qty})=>({name:product.name,unit_price:Number(product.price),quantity:qty}));
    currentOrder={id:result.order_id,order_number:result.order_number,created_at:result.created_at||new Date().toISOString(),customer_name:name,customer_phone:phone,customer_address:address,payment_method:payment,total:Number(result.total),items:orderItems};
    renderReceipt(currentOrder);cart={};renderCart();closeModal("checkoutModal");openModal("receiptModal");
    $("#whatsappOrder").onclick=()=>window.open(waUrl(makeWhatsAppMessage(currentOrder)),"_blank","noopener,noreferrer");
  }catch(err){console.error(err);toast("Pesanan gagal disimpan: "+(err.message||"periksa konfigurasi database"));}finally{button.disabled=false;button.textContent="Buat pesanan dan simpan";}
}
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]"),qty=e.target.closest("[data-qty]"),remove=e.target.closest("[data-remove]");
  if(add){const id=add.dataset.add;cart[id]=(cart[id]||0)+1;renderCart();toast("Produk ditambahkan ke keranjang.");}
  if(qty){const id=qty.dataset.qty;cart[id]=(cart[id]||0)+Number(qty.dataset.delta);if(cart[id]<=0)delete cart[id];renderCart();}
  if(remove){delete cart[remove.dataset.remove];renderCart();toast("Produk dihapus.");}
});
$("#openCart").addEventListener("click",openCart);$("#closeCart").addEventListener("click",closeCart);$("#shade").addEventListener("click",closeCart);
$("#checkoutBtn").addEventListener("click",()=>{if(!cartCount())return toast("Keranjang masih kosong.");closeCart();openModal("checkoutModal");});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id);}));
$("#checkoutForm").addEventListener("submit",placeOrder);
$("#printReceipt").addEventListener("click",()=>window.print());
$("#year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();document.querySelectorAll(".modal.open").forEach(m=>closeModal(m.id));}});
loadProducts().then(renderCart);

// 1. Munculkan QRIS di Form Checkout saat opsi QRIS diklik
document.querySelectorAll('input[name="payment"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const qrisBox = document.getElementById("qrisBox");
    if (!qrisBox) return;
    qrisBox.style.display = e.target.value === "QRIS" ? "block" : "none";
  });
});

const ewalletData = {
  GoPay: {
    nomor: "0812-3456-7890 (a.n. Mochi & Onigiri)",
    link: "gojek://gopay/merchanttransfer"
  },
  DANA: {
    nomor: "0812-3456-7890 (a.n. Mochi & Onigiri)",
    link: "https://dana.id"
  },
  OVO: {
    nomor: "0812-3456-7890 (a.n. Mochi & Onigiri)",
    link: "ovo://transfer"
  },
  ShopeePay: {
    nomor: "0812-3456-7890 (a.n. Mochi & Onigiri)",
    link: "shopeeid://shopeepay"
  }
};

// Munculkan kotak QRIS atau E-Wallet saat metode dipilih
document.querySelectorAll('input[name="payment"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const qrisBox = document.getElementById("qrisBox");
    const ewalletBox = document.getElementById("ewalletBox");
    if (qrisBox) qrisBox.style.display = e.target.value === "QRIS" ? "block" : "none";
    if (ewalletBox) ewalletBox.style.display = e.target.value === "E-Wallet" ? "block" : "none";
  });
});

// Tampilkan detail nomor & tombol buka aplikasi saat jenis E-Wallet diklik
document.querySelectorAll('input[name="ewalletProvider"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const detailBox = document.getElementById("ewalletDetail");
    const info = ewalletData[e.target.value];
    if (detailBox && info) {
      detailBox.style.display = "block";
      detailBox.innerHTML = `
        <p style="margin-bottom: 6px;">Tujuan transfer <b>${e.target.value}</b>:<br>
        <span style="font-size: 14px; font-weight: 700; color: #633b2b;">${info.nomor}</span></p>
        <a href="${info.link}" target="_blank" style="display: inline-block; margin-top: 4px; padding: 7px 14px; background: #633b2b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 12px;">Buka Aplikasi ${e.target.value} ↗</a>
      `;
    }
  });
});

