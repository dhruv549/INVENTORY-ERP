// stock.js — Monthly stock entry

let _stockMonth = new Date().getMonth() + 1;
let _stockYear  = new Date().getFullYear();
let _stockEntries = {};   // itemId → entry data
window._unsubStock = null;

// ─ Main entry ─
function initStock() {
  const sec = document.getElementById('sec-stock');
  sec.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh"><div class="spinner"></div></div>`;
  renderStockShell(sec);
}

async function renderStockShell(sec) {
  const months  = lastMonths(12);
  const isLocked = !!(APP_LOCKS[lockKey(_stockMonth, _stockYear)]?.locked);

  sec.innerHTML = `
    <div class="sec-hdr">
      <div class="sec-hdr-l">
        <h2>Stock Entry</h2>
        <p>Monthly inventory count — ${fmtMY(_stockMonth, _stockYear)}</p>
      </div>
      <div class="sec-hdr-r" id="stock-hdr-r"></div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-size:.78rem;font-weight:600;color:var(--mu)">Select Month:</span>
        <div class="month-tabs" id="month-tabs">
          ${months.map(m=>{
            const key  = lockKey(m.month, m.year);
            const lkd  = !!(APP_LOCKS[key]?.locked);
            const on   = m.month===_stockMonth && m.year===_stockYear;
            return `<button class="mtab${on?' on':''}${lkd?' locked':''}"
              onclick="switchStockMonth(${m.month},${m.year})">${esc(m.label)}</button>`;
          }).join('')}
        </div>
      </div>
    </div>

    ${isLocked ? `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1rem;background:#fef9c3;border:1px solid #fde047;border-radius:var(--r);margin-bottom:1rem">
        <span style="font-size:1.25rem">🔒</span>
        <div>
          <div style="font-weight:600;font-size:.875rem">Month Locked</div>
          <div style="font-size:.75rem;color:var(--mu)">${fmtMY(_stockMonth, _stockYear)} is finalized. No edits allowed.</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="unlockMonth(${_stockMonth},${_stockYear})">Unlock</button>
      </div>` : ''}

    <div id="stock-toolbar" class="toolbar">
      <div class="srch-wrap">
        <svg class="srch-ic" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="srch-inp" id="stock-srch" type="text" placeholder="Filter items…" oninput="filterStockTable(this.value)">
      </div>
      <select class="flt-sel" id="stock-cat-flt" onchange="filterStockTable()">
        <option value="All">All Categories</option>
        ${CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <span id="stock-pending-badge" class="badge b-amb" style="margin-left:auto"></span>
    </div>

    <div id="stock-table-wrap"></div>`;

  await loadStockEntries();
  renderStockHeader(isLocked);
}

async function loadStockEntries() {
  // Unsubscribe previous listener
  if(window._unsubStock){ window._unsubStock(); window._unsubStock=null; }
  _stockEntries = {};

  const tableWrap = document.getElementById('stock-table-wrap');
  if(tableWrap) tableWrap.innerHTML = `<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:auto"></div></div>`;

  // Real-time listener for current month entries
  window._unsubStock = db.collection('stockEntries')
    .where('year','==',_stockYear)
    .where('month','==',_stockMonth)
    .onSnapshot(snap=>{
      snap.docs.forEach(d=>{ _stockEntries[d.data().itemId] = {id:d.id,...d.data()}; });
      renderStockTable();
      updateStockPendingBadge();
    }, err=>{
      console.error('Stock entries error:', err);
      toast('Failed to load stock entries','err');
    });
}

function renderStockHeader(isLocked) {
  const hdr = document.getElementById('stock-hdr-r');
  if(!hdr) return;
  if(isLocked) {
    hdr.innerHTML = `<span class="badge b-gray" style="font-size:.75rem">🔒 Locked</span>`;
  } else {
    hdr.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="saveAllStock()" id="save-all-btn">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
        Save All
      </button>
      <button class="btn btn-grn btn-sm" onclick="lockMonth(${_stockMonth},${_stockYear})">
        🔒 Lock Month
      </button>`;
  }
}

function renderStockTable() {
  const wrap = document.getElementById('stock-table-wrap');
  if(!wrap) return;

  const isLocked = !!(APP_LOCKS[lockKey(_stockMonth, _stockYear)]?.locked);
  let items = [...(APP_ITEMS||[])];

  // Apply filter
  const srch = document.getElementById('stock-srch')?.value.toLowerCase()||'';
  const catF = document.getElementById('stock-cat-flt')?.value||'All';
  if(srch) items=items.filter(i=>i.name?.toLowerCase().includes(srch)||i.code?.toLowerCase().includes(srch));
  if(catF!=='All') items=items.filter(i=>i.category===catF);

  if(items.length===0){
    wrap.innerHTML=`<div class="empty"><div class="eico"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div><h3>No items</h3><p>Add items in Item Master first.</p></div>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  wrap.innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr>
      <th style="width:42px"></th>
      <th>Item</th>
      <th>Category</th>
      <th>Min Stock</th>
      <th style="text-align:right">Quantity <span style="font-weight:400;text-transform:none;font-size:.68rem">(${APP_ITEMS[0]?.unit||'unit'})</span></th>
      <th>Count Date</th>
      <th>Remarks</th>
      ${!isLocked ? '<th style="width:60px"></th>' : ''}
    </tr></thead>
    <tbody id="stock-tbody">
      ${items.map(item=>{
        const entry   = _stockEntries[item.id];
        const hasEntry = !!entry;
        const qty     = entry?.quantity ?? '';
        const date    = entry?.countDate || today;
        const rem     = entry?.remarks || '';
        const isLow   = hasEntry && qty !== '' && parseFloat(qty) <= (item.minStock||0);
        return `<tr class="stock-row" data-item="${esc(item.id)}">
          <td>${thumbHtml(item.imageUrl)}</td>
          <td>
            <div style="font-weight:600;font-size:.8rem">${esc(item.name)}</div>
            <code style="font-size:.68rem;color:var(--mu)">${esc(item.code)}</code>
          </td>
          <td>${catPill(item.category)}</td>
          <td>${item.minStock||0} <span style="font-size:.68rem;color:var(--mu)">${esc(item.unit||'nos')}</span></td>
          <td style="text-align:right">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem">
              ${isLow ? '<span title="Below minimum" style="color:var(--red);font-size:.875rem">⚠</span>' : ''}
              <input type="number" min="0" step="0.01"
                class="qty-inp"
                id="qty-${esc(item.id)}"
                value="${esc(String(qty))}"
                placeholder="0"
                ${isLocked ? 'disabled' : ''}
                oninput="markRowDirty('${esc(item.id)}')"
                style="${!hasEntry && !isLocked ? 'border-color:var(--amb);background:var(--amb-s)' : ''}">
              <span style="font-size:.72rem;color:var(--mu);min-width:28px">${esc(item.unit||'')}</span>
            </div>
          </td>
          <td>
            <input type="date" class="fc" id="date-${esc(item.id)}" value="${esc(date)}"
              style="width:130px;padding:.35rem .5rem;font-size:.78rem"
              ${isLocked ? 'disabled' : ''}>
          </td>
          <td>
            <input type="text" class="rem-inp" id="rem-${esc(item.id)}" value="${esc(rem)}"
              placeholder="Optional note…" ${isLocked ? 'disabled' : ''}>
          </td>
          ${!isLocked ? `<td>
            <button class="btn-ico" title="Save this row" onclick="saveOneEntry('${esc(item.id)}')">
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            </button>
          </td>` : ''}
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

function updateStockPendingBadge() {
  const items   = APP_ITEMS||[];
  const pending = items.filter(i=>!_stockEntries[i.id]).length;
  const badge   = document.getElementById('stock-pending-badge');
  if(badge) badge.textContent = `${pending} pending`;
}

window.filterStockTable = () => renderStockTable();

window.markRowDirty = id => {
  const inp = document.getElementById(`qty-${id}`);
  if(inp && !inp.disabled) inp.style.borderColor='var(--pri)';
};

// ─ Save one row ─
window.saveOneEntry = async itemId => {
  const item    = APP_ITEMS.find(i=>i.id===itemId);
  if(!item) return;
  const qtyVal  = document.getElementById(`qty-${itemId}`)?.value;
  const dateVal = document.getElementById(`date-${itemId}`)?.value;
  const remVal  = document.getElementById(`rem-${itemId}`)?.value||'';

  if(qtyVal===''||qtyVal===null){ toast('Enter a quantity first','warn'); return; }

  const qty = parseFloat(qtyVal);
  if(isNaN(qty)||qty<0){ toast('Invalid quantity','err'); return; }

  showLoad('Saving…');
  try {
    const payload = {
      itemId, itemCode:item.code, itemName:item.name,
      category:item.category, unit:item.unit||'nos',
      quantity:qty, month:_stockMonth, year:_stockYear,
      countDate:dateVal||new Date().toISOString().split('T')[0],
      remarks:remVal,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    const existing = _stockEntries[itemId];
    if(existing?.id){
      await db.collection('stockEntries').doc(existing.id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('stockEntries').add(payload);
    }
    // Reset input color
    const inp=document.getElementById(`qty-${itemId}`);
    if(inp){ inp.style.borderColor=''; inp.style.background=''; }
    toast(`${item.name} saved`,'ok');
  } catch(err){
    toast(`Error: ${err.message}`,'err');
  } finally {
    hideLoad();
  }
};

// ─ Save all entries at once ─
window.saveAllStock = async () => {
  const items = APP_ITEMS||[];
  const today = new Date().toISOString().split('T')[0];
  const toSave = [];

  items.forEach(item=>{
    const qtyInp = document.getElementById(`qty-${item.id}`);
    if(!qtyInp || qtyInp.value==='') return;
    const qty = parseFloat(qtyInp.value);
    if(isNaN(qty)||qty<0) return;
    toSave.push({item, qty,
      countDate: document.getElementById(`date-${item.id}`)?.value||today,
      remarks:   document.getElementById(`rem-${item.id}`)?.value||''
    });
  });

  if(toSave.length===0){ toast('No quantities entered','warn'); return; }

  showLoad(`Saving ${toSave.length} entries…`);
  try {
    const batch = db.batch();
    toSave.forEach(({item,qty,countDate,remarks})=>{
      const existing = _stockEntries[item.id];
      const payload  = {
        itemId:item.id, itemCode:item.code, itemName:item.name,
        category:item.category, unit:item.unit||'nos',
        quantity:qty, month:_stockMonth, year:_stockYear,
        countDate, remarks,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      if(existing?.id){
        batch.update(db.collection('stockEntries').doc(existing.id), payload);
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        batch.set(db.collection('stockEntries').doc(), payload);
      }
    });
    await batch.commit();
    toast(`${toSave.length} entries saved`,'ok');
  } catch(err){
    toast(`Error: ${err.message}`,'err');
  } finally {
    hideLoad();
  }
};

// ─ Lock / unlock month ─
window.lockMonth = (month, year) => {
  const pending = (APP_ITEMS||[]).filter(i=>!_stockEntries[i.id]).length;
  const msg = pending > 0
    ? `${pending} items have no entry this month. Lock anyway? This prevents further editing.`
    : `Lock ${fmtMY(month,year)}? This will prevent any further edits.`;

  confirmDialog(msg, async ()=>{
    showLoad('Locking…');
    try{
      await db.collection('monthLocks').doc(lockKey(month,year)).set({locked:true,lockedAt:firebase.firestore.FieldValue.serverTimestamp()});
      APP_LOCKS[lockKey(month,year)]={locked:true};
      toast(`${fmtMYS(month,year)} locked`,'ok');
      initStock();
    }catch(err){ toast(`Error: ${err.message}`,'err'); }
    finally{ hideLoad(); }
  });
};

window.unlockMonth = (month, year) => {
  confirmDialog(`Unlock ${fmtMY(month,year)}? Users will be able to edit entries again.`, async ()=>{
    showLoad('Unlocking…');
    try{
      await db.collection('monthLocks').doc(lockKey(month,year)).set({locked:false});
      APP_LOCKS[lockKey(month,year)]={locked:false};
      toast(`${fmtMYS(month,year)} unlocked`,'ok');
      initStock();
    }catch(err){ toast(`Error: ${err.message}`,'err'); }
    finally{ hideLoad(); }
  }, false);
};

// ─ Switch month ─
window.switchStockMonth = (month, year) => {
  _stockMonth=month; _stockYear=year;
  const sec=document.getElementById('sec-stock');
  renderStockShell(sec);
};
