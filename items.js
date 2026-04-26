// items.js — Item Master: list, add, edit, delete

let _itemFilter = { search:'', cat:'All', status:'All' };
let _editImgData = null; // base64 or null (new), or existing URL (unchanged)
let _editImgChanged = false;

// ─ Main entry ─
async function initItems() {
  const sec = document.getElementById('sec-items');
  renderItemsShell(sec);
  applyItemsFilter();
}

function renderItemsShell(sec) {
  sec.innerHTML = `
    <div class="sec-hdr">
      <div class="sec-hdr-l">
        <h2>Item Master</h2>
        <p>Manage all inventory items</p>
      </div>
      <div class="sec-hdr-r">
        <button class="btn btn-pri" onclick="openItemModal()">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Add Item
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="srch-wrap">
        <svg class="srch-ic" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="srch-inp" id="item-srch" type="text" placeholder="Search name or code…"
          oninput="itemSearch(this.value)" value="${esc(_itemFilter.search)}">
      </div>
      <select class="flt-sel" id="item-cat-flt" onchange="itemCatFlt(this.value)">
        <option value="All">All Categories</option>
        ${CATS.map(c=>`<option value="${esc(c)}" ${_itemFilter.cat===c?'selected':''}>${esc(c)}</option>`).join('')}
      </select>
      <select class="flt-sel" id="item-sort" onchange="applyItemsFilter()">
        <option value="name">Sort: Name</option>
        <option value="cat">Sort: Category</option>
        <option value="stock">Sort: Stock ↓</option>
      </select>
      <span id="item-count" class="badge b-gray" style="margin-left:auto"></span>
    </div>

    <div id="items-table-wrap"></div>`;
}

function applyItemsFilter() {
  let items = [...(APP_ITEMS||[])];

  if(_itemFilter.search) {
    const q = _itemFilter.search.toLowerCase();
    items = items.filter(i => i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q));
  }
  if(_itemFilter.cat !== 'All') {
    items = items.filter(i => i.category === _itemFilter.cat);
  }

  const sort = document.getElementById('item-sort')?.value || 'name';
  if(sort==='name') items.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  else if(sort==='cat') items.sort((a,b)=>(a.category||'').localeCompare(b.category||''));

  const cntEl = document.getElementById('item-count');
  if(cntEl) cntEl.textContent = `${items.length} item${items.length!==1?'s':''}`;

  const wrap = document.getElementById('items-table-wrap');
  if(!wrap) return;

  if(items.length===0) {
    wrap.innerHTML = `<div class="empty"><div class="eico"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div><h3>No items found</h3><p>${_itemFilter.search||_itemFilter.cat!=='All' ? 'Try adjusting your search or filter.' : 'Add your first item to get started.'}</p>${!_itemFilter.search && _itemFilter.cat==='All' ? '<button class="btn btn-pri" onclick="openItemModal()">Add First Item</button>' : ''}</div>`;
    return;
  }

  wrap.innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Image</th><th>Item Name</th><th>Code</th><th>Category</th>
      <th>Unit</th><th>Min Stock</th><th>Actions</th>
    </tr></thead>
    <tbody>${items.map(i => itemRow(i)).join('')}</tbody>
  </table></div>`;
}

function itemRow(i) {
  return `<tr>
    <td>${thumbHtml(i.imageUrl)}</td>
    <td><div style="font-weight:600;font-size:.8125rem">${esc(i.name)}</div></td>
    <td><code style="font-size:.75rem;background:var(--sur2);padding:.1rem .35rem;border-radius:4px;border:1px solid var(--bdr)">${esc(i.code)}</code></td>
    <td>${catPill(i.category)}</td>
    <td><span class="badge b-gray">${esc(i.unit||'nos')}</span></td>
    <td><span style="font-weight:600">${i.minStock||0}</span></td>
    <td style="white-space:nowrap">
      <button class="btn-ico" title="Edit" onclick="openItemModal('${esc(i.id)}')">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
      </button>
      <button class="btn-ico" title="Delete" style="margin-left:.35rem;color:var(--red);border-color:#fecaca" onclick="deleteItem('${esc(i.id)}','${esc(i.name)}','${esc(i.imageUrl||'')}')">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </td>
  </tr>`;
}

// ─ Filter helpers ─
window.itemSearch = v => { _itemFilter.search = v.trim(); applyItemsFilter(); };
window.itemCatFlt = v => { _itemFilter.cat = v; applyItemsFilter(); };

// ─ Add / Edit Modal ─
window.openItemModal = (id=null) => {
  const item = id ? APP_ITEMS.find(i=>i.id===id) : null;
  _editImgData    = item?.imageUrl || null;
  _editImgChanged = false;

  const catOpts = CATS.map(c=>`<option value="${esc(c)}" ${item?.category===c?'selected':''}>${esc(c)}</option>`).join('');
  const unitOpts = UNITS.map(u=>`<option value="${esc(u)}" ${(item?.unit||'nos')===u?'selected':''}>${esc(u)}</option>`).join('');

  showModal(`
    <div class="mhdr">
      <div>
        <h3>${item ? 'Edit Item' : 'Add New Item'}</h3>
        <p>${item ? 'Update item details' : 'Fill in the details to register a new item'}</p>
      </div>
      <button class="mcls" onclick="hideModal()"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </div>
    <div class="mbdy">
      <div class="fg">
        <label class="fl">Item Image</label>
        <div class="img-up" onclick="document.getElementById('item-img-file').click()">
          <div class="img-up-empty" id="img-up-empty" ${_editImgData?'style="display:none"':''}>
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5a1.5 1.5 0 001.5 1.5z"/></svg>
            <span class="ul">Click to upload image</span>
            <span class="uh">PNG, JPG — auto-resized</span>
          </div>
          <div class="img-prev" id="img-prev-wrap" ${_editImgData?'style="display:block"':''}>
            <img id="img-prev-tag" src="${esc(_editImgData||'')}" alt="Preview">
            <div class="img-prev-ov"><span>📷 Change image</span></div>
            <button class="img-rm" onclick="removeItemImg(event)"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
        </div>
        <input id="item-img-file" type="file" accept="image/*" style="display:none" onchange="handleItemImg(this)">
      </div>

      <div class="frow">
        <div class="fg">
          <label class="fl" for="f-iname">Item Name <span class="req">*</span></label>
          <input id="f-iname" class="fc" type="text" placeholder="e.g. Steel Rod" value="${esc(item?.name||'')}" oninput="clrFerr('f-iname-e')">
          <span id="f-iname-e" class="ferr"></span>
        </div>
        <div class="fg">
          <label class="fl" for="f-icode">Item Code <span class="req">*</span></label>
          <input id="f-icode" class="fc" type="text" placeholder="e.g. RM-001" value="${esc(item?.code||'')}" style="font-family:monospace" oninput="clrFerr('f-icode-e')">
          <span id="f-icode-e" class="ferr"></span>
        </div>
      </div>

      <div class="frow">
        <div class="fg">
          <label class="fl" for="f-icat">Category</label>
          <select id="f-icat" class="fc">${catOpts}</select>
        </div>
        <div class="fg">
          <label class="fl" for="f-iunit">Unit</label>
          <select id="f-iunit" class="fc">${unitOpts}</select>
        </div>
      </div>

      <div class="fg">
        <label class="fl" for="f-imin">Minimum Stock Level</label>
        <input id="f-imin" class="fc" type="number" min="0" step="0.01" value="${item?.minStock||0}" placeholder="0">
        <div class="form-hint">Alert will trigger when stock falls at or below this value</div>
      </div>
    </div>
    <div class="mftr">
      <button class="btn btn-ghost" onclick="hideModal()">Cancel</button>
      <button class="btn btn-pri" onclick="saveItem('${esc(id||'')}')">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        ${item ? 'Update Item' : 'Add Item'}
      </button>
    </div>`);
};

// ─ Image handling ─
window.handleItemImg = inp => {
  const file = inp.files[0]; if(!file) return;
  if(file.size > 8*1024*1024){ toast('Image too large (max 8 MB)','err'); return; }
  compressItemImg(file, 480, 360, .75).then(b64=>{
    _editImgData    = b64;
    _editImgChanged = true;
    const el = document.getElementById('img-prev-tag');
    const pr = document.getElementById('img-prev-wrap');
    const em = document.getElementById('img-up-empty');
    if(el) el.src = b64;
    if(pr) pr.style.display='block';
    if(em) em.style.display='none';
  });
  inp.value='';
};
window.removeItemImg = e => {
  e.stopPropagation();
  _editImgData=null; _editImgChanged=true;
  const pr=document.getElementById('img-prev-wrap');
  const em=document.getElementById('img-up-empty');
  if(pr) pr.style.display='none';
  if(em) em.style.display='flex';
};
function compressItemImg(file, maxW, maxH, q) {
  return new Promise(res=>{
    const r=new FileReader(); r.onload=ev=>{
      const img=new Image(); img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxW||h>maxH){const ratio=Math.min(maxW/w,maxH/h);w=Math.round(w*ratio);h=Math.round(h*ratio)}
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        res(c.toDataURL('image/jpeg',q));
      }; img.src=ev.target.result;
    }; r.readAsDataURL(file);
  });
}
window.clrFerr = id => { const e=document.getElementById(id); if(e){e.textContent='';e.classList.remove('on');} };

// ─ Save item ─
window.saveItem = async (editId='') => {
  const name  = document.getElementById('f-iname').value.trim();
  const code  = document.getElementById('f-icode').value.trim();
  const cat   = document.getElementById('f-icat').value;
  const unit  = document.getElementById('f-iunit').value;
  const mins  = parseFloat(document.getElementById('f-imin').value)||0;

  let valid=true;
  if(!name){ showFerr('f-iname-e','Name is required'); valid=false; }
  if(!code){ showFerr('f-icode-e','Code is required'); valid=false; }

  // Check code uniqueness
  const dupCode = APP_ITEMS.find(i=>i.code?.toLowerCase()===code.toLowerCase() && i.id!==editId);
  if(dupCode){ showFerr('f-icode-e','This code is already used'); valid=false; }
  if(!valid) return;

  showLoad(editId ? 'Updating item…' : 'Adding item…');
  hideModal();

  try {
    let imageUrl = editId ? (APP_ITEMS.find(i=>i.id===editId)?.imageUrl||null) : null;

    // Store image as base64 directly in Firestore
    if(_editImgChanged) {
      imageUrl = (_editImgData && _editImgData.startsWith('data:')) ? _editImgData : null;
    }

    const payload = { name, code, category:cat, unit, minStock:mins, imageUrl:imageUrl||null, updatedAt:firebase.firestore.FieldValue.serverTimestamp() };

    if(editId) {
      await db.collection('items').doc(editId).update(payload);
      toast('Item updated successfully','ok');
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('items').add(payload);
      toast('Item added successfully','ok');
    }
    // APP_ITEMS will update via real-time listener
  } catch(err) {
    console.error('Save item error:', err);
    toast(`Error: ${err.message}`,'err');
  } finally {
    hideLoad();
    _editImgData=null; _editImgChanged=false;
  }
};

function showFerr(id, msg) {
  const e=document.getElementById(id);
  if(e){e.textContent=msg;e.classList.add('on');}
  const inp=document.getElementById(id.replace('-e',''));
  if(inp) inp.classList.add('err');
}

// ─ Delete item ─
window.deleteItem = (id, name, imageUrl) => {
  confirmDialog(
    `Delete "${name}"? This will remove all associated data. This cannot be undone.`,
    async () => {
      showLoad('Deleting…');
      try {
        // Delete stock entries for this item
        const snap = await db.collection('stockEntries').where('itemId','==',id).get();
        const batch = db.batch();
        snap.docs.forEach(d=>batch.delete(d.ref));
        await batch.commit();
        // Delete item
        await db.collection('items').doc(id).delete();
        toast('Item deleted','ok');
      } catch(err) {
        toast(`Error: ${err.message}`,'err');
      } finally {
        hideLoad();
      }
    }
  );
};

// ─ Re-render table when APP_ITEMS updates ─
const _origNavTo = window.navTo;
// Hook: when on items section, re-render on data update
const _itemsObserver = new MutationObserver(()=>{
  if(window.currentSec==='items') applyItemsFilter();
});
// Watch APP_ITEMS changes via listener in index.html (already calls initDashboard/initAlerts)
// Items section uses applyItemsFilter() which reads APP_ITEMS directly
// Trigger re-render when items change and section is active
db.collection('items').onSnapshot(()=>{
  if(window.currentSec==='items') {
    setTimeout(applyItemsFilter, 50);
  }
});
