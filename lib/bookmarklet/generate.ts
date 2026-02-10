/**
 * Generates a personalized JavaScript bookmarklet that auto-fills
 * Skatteverket's flyttanmälan form with embedded user data.
 *
 * The bookmarklet:
 * 1. On skatteverket.se — tries to find form fields by label/name heuristics and fills them
 * 2. Always shows a floating overlay panel with all data + copy buttons as fallback
 */

export interface BookmarkletData {
  name: string | null;
  personalNumber: string | null;
  toStreet: string | null;
  toPostal: string | null;
  toCity: string | null;
  moveDate: string | null;
  email: string | null;
  phone: string | null;
}

function esc(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e");
}

function htmlEsc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateBookmarklet(data: BookmarkletData): string {
  const d = {
    name: esc(data.name),
    pnr: esc(data.personalNumber),
    street: esc(data.toStreet),
    postal: esc(data.toPostal),
    city: esc(data.toCity),
    date: esc(data.moveDate),
    email: esc(data.email),
    phone: esc(data.phone),
  };

  // Build the row data for the overlay panel (only non-empty)
  const rows: { label: string; value: string }[] = [];
  if (d.street) rows.push({ label: "Ny gatuadress", value: d.street });
  if (d.postal) rows.push({ label: "Postnummer", value: d.postal });
  if (d.city) rows.push({ label: "Ort", value: d.city });
  if (d.date) rows.push({ label: "Flyttdatum", value: d.date });
  if (d.name) rows.push({ label: "Namn", value: d.name });
  if (d.email) rows.push({ label: "E-post", value: d.email });
  if (d.phone) rows.push({ label: "Telefon", value: d.phone });

  const rowsJson = JSON.stringify(
    rows.map((r) => ({ l: htmlEsc(r.label), v: htmlEsc(r.value) }))
  );

  // The bookmarklet JS (ES5 compatible, single IIFE)
  const code = `void(function(){
var D={street:'${d.street}',postal:'${d.postal}',city:'${d.city}',date:'${d.date}',name:'${d.name}',email:'${d.email}',phone:'${d.phone}'};
var R=${rowsJson};
var isSKV=location.hostname.indexOf('skatteverket.se')!==-1;
var filled=0;
function setV(el,v){
var s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
if(s&&s.set){s.set.call(el,v)}else{el.value=v}
el.dispatchEvent(new Event('input',{bubbles:true}));
el.dispatchEvent(new Event('change',{bubbles:true}));
el.dispatchEvent(new Event('blur',{bubbles:true}));
}
function tryFill(patterns,val){
if(!val)return;
var labels=document.querySelectorAll('label');
for(var i=0;i<labels.length;i++){
var t=(labels[i].textContent||'').toLowerCase();
for(var j=0;j<patterns.length;j++){
if(t.indexOf(patterns[j])!==-1){
var fid=labels[i].getAttribute('for');
var inp=fid?document.getElementById(fid):labels[i].querySelector('input,textarea,select');
if(inp&&!inp.value){setV(inp,val);filled++;return}
}}}
var inps=document.querySelectorAll('input,textarea,select');
for(var k=0;k<inps.length;k++){
var a=[(inps[k].name||''),(inps[k].id||''),(inps[k].placeholder||''),(inps[k].getAttribute('aria-label')||'')].join(' ').toLowerCase();
for(var m=0;m<patterns.length;m++){
if(a.indexOf(patterns[m])!==-1&&!inps[k].value){setV(inps[k],val);filled++;return}
}}}
if(isSKV){
tryFill(['gatuadress','gata','street','adress'],D.street);
tryFill(['postnummer','postkod','postal'],D.postal);
tryFill(['postort','ort','stad','city'],D.city);
tryFill(['flyttdatum','inflyttning','datum','date'],D.date);
}
var old=document.getElementById('flytt-io-p');if(old)old.remove();
var p=document.createElement('div');p.id='flytt-io-p';
p.style.cssText='position:fixed;bottom:16px;right:16px;z-index:2147483647;width:340px;max-height:80vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;color:#1a1a2e;border:2px solid #0047ab';
var hdr='<div style="background:linear-gradient(135deg,#002e6d,#0047ab);color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between"><div><b>Flytt.io</b> <span style="font-size:12px;opacity:.8">Dina uppgifter</span></div><button id="flytt-io-x" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">&times;</button></div>';
var st=filled>0?'<div style="background:#e8f5e9;color:#2e7d32;padding:8px 16px;font-size:13px">&#10004; '+filled+' f\\xe4lt ifyllda automatiskt</div>':(isSKV?'<div style="background:#fff3e0;color:#e65100;padding:8px 16px;font-size:13px">Kunde inte hitta f\\xe4lt. Kopiera manuellt nedan.</div>':'<div style="background:#e3f2fd;color:#1565c0;padding:8px 16px;font-size:13px">\\xd6ppna Skatteverkets flyttanm\\xe4lan f\\xf6rst.</div>');
var bd='<div style="padding:10px 16px">';
for(var n=0;n<R.length;n++){
bd+='<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;'+(n>0?'border-top:1px solid #eee;':'')+'"><div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px">'+R[n].l+'</div><div style="font-weight:600;margin-top:1px">'+R[n].v+'</div></div><button data-c="'+R[n].v+'" style="background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer">Kopiera</button></div>'
}
bd+='</div>';
p.innerHTML=hdr+st+bd;document.body.appendChild(p);
document.getElementById('flytt-io-x').onclick=function(){p.remove()};
p.querySelectorAll('[data-c]').forEach(function(b){
b.onclick=function(){
navigator.clipboard.writeText(b.getAttribute('data-c')).then(function(){
b.textContent='Kopierad!';b.style.background='#e8f5e9';b.style.color='#2e7d32';
setTimeout(function(){b.textContent='Kopiera';b.style.background='#f5f5f5';b.style.color='#1a1a2e'},2000)
})}})
})()`;

  return "javascript:" + code.replace(/\n/g, "");
}
