// reports.js — Reports: history, comparison, export

let _rptMonth  = new Date().getMonth() + 1;
let _rptYear   = new Date().getFullYear();
let _cmpMonth1 = new Date().getMonth() + 1;
let _cmpYear1  = new Date().getFullYear();
let _cmpMonth2 = _cmpMonth1 - 1 <= 0 ? 12 : _cmpMonth1 - 1;
let _cmpYear2  = _cmpMonth1 - 1 <= 0 ? _cmpYear1 - 1 : _cmpYear1;
let _rptTab    = 'snapshot';  // 'snapshot' | 'compare'
let _rptData   = [];          // cached for export

// ─ Main entry ─
function initReports() {
  const sec = document.getElementById('sec-reports');
  sec.innerHTML = `
    <div class="sec-hdr">
      <div class="sec-hdr-l">
        <h2>Reports</h2>
        <p>Monthly stock history and comparisons</p>
      </div>
      <div class="sec-hdr-r" id="rpt-hdr-r">
        <button class="btn btn-ghost btn-sm" onclick="exportExcel()">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          Export Excel
        </button>
        <button class="btn btn-ghost btn-sm" onclick="printReport()">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
          Print / PDF
        </button>
      </div>
    </div>

    <!-- Tab switcher -->
    <div style="display:flex;gap:.35rem;margin-bottom:1rem;border-bottom:1px solid var(--bdr);padding-bottom:0">
      <button id="tab-snapshot" class="rpt-tab on" onclick="switchRptTab('snapshot')" style="padding:.5rem 1rem;border:none;background:none;font-size:.8125rem;font-weight:600;cursor:pointer;border-bottom:2px solid var(--pri);color:var(--pri);margin-bottom:-1px">
        📋 Monthly Snapshot
      </button>
      <button id="tab-compare" class="rpt-tab" onclick="switchRptTab('compare')" style="padding:.5rem 1rem;border:none;background:none;font-size:.8125rem;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:var(--mu);margin-bottom:-1px">
        ↔ Compare Months
      </button>
    </div>

    <div id="rpt-body"></div>`;

  renderRptSnapshot();
}

window.switchRptTab = tab => {
  _rptTab = tab;
  document.querySelectorAll('.rpt-tab').forEach(el => {
    const isOn = el.id === `tab-${tab}`;
    el.style.borderBottomColor = isOn ? 'var(--pri)' : 'transparent';
    el.style.color = isOn ? 'var(--pri)' : 'var(--mu)';
    el.style.fontWeight = isOn ? '600' : '500';
  });
  if(tab==='snapshot') renderRptSnapshot();
  else renderRptCompare();
};

// ─ Month Snapshot ─
async function renderRptSnapshot() {
  const body = document.getElementById('rpt-body');
  if(!body) return;

  const months = lastMonths(24);
  body.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <span style="font-size:.78rem;font-weight:600;color:var(--mu)">Month:</span>
        <div class="month-tabs">
          ${months.map(m=>{
            const on=m.month===_rptMonth&&m.year===_rptYear;
            return `<button class="mtab${on?' on':''}" onclick="setRptMonth(${m.month},${m.year})">${esc(m.label)}</button>`;
          }).join('')}
        </div>
      </div>
    </div>
    <div id="snapshot-table"><div style="text-align:center;padding:2rem"><div class="spinner" style="margin:auto"></div></div></div>`;

  await loadSnapshot(_rptMonth, _rptYear);
}

window.setRptMonth = async (m, y) => {
  _rptMonth=m; _rptYear=y;
  // Update tabs
  document.querySelectorAll('.month-tabs .mtab').forEach(btn=>{
    btn.classList.remove('on');
  });
  event?.target?.classList.add('on');
  await loadSnapshot(m, y);
};

async function loadSnapshot(month, year) {
  const wrap = document.getElementById('snapshot-table');
  if(!wrap) return;
  wrap.innerHTML=`<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:auto"></div></div>`;

  try {
    const snap = await db.collection('stockEntries')
      .where('year','==',year).where('month','==',month).get();
    const entries = snap.docs.map(d=>({id:d.id,...d.data()}));
    const eMap    = {};
    entries.forEach(e=>{ eMap[e.itemId]=e; });

    const items = APP_ITEMS||[];
    _rptData = items.map(i=>({
      name:     i.name,
      code:     i.code,
      category: i.category,
      unit:     i.unit||'nos',
      minStock: i.minStock||0,
      quantity: eMap[i.id]?.quantity ?? null,
      countDate:eMap[i.id]?.countDate || '—',
      remarks:  eMap[i.id]?.remarks   || '',
      isLow:    eMap[i.id] && (eMap[i.id].quantity <= (i.minStock||0)) && (i.minStock||0)>0
    }));

    const counted  = _rptData.filter(r=>r.quantity!==null).length;
    const lowCount = _rptData.filter(r=>r.isLow).length;
    const isLocked = !!(APP_LOCKS[lockKey(month,year)]?.locked);

    wrap.innerHTML = `
      <div style="display:flex;gap:.75rem;margin-bottom:.875rem;flex-wrap:wrap">
        <span class="badge b-blue">${fmtMY(month,year)}</span>
        <span class="badge b-grn">${counted} / ${items.length} counted</span>
        ${lowCount ? `<span class="badge b-red">${lowCount} low stock</span>` : ''}
        ${isLocked ? `<span class="badge b-gray">🔒 Locked</span>` : ''}
      </div>
      ${_rptData.length===0 ? `<div class="empty"><div class="eico"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg></div><h3>No data</h3><p>No stock entries found for ${fmtMY(month,year)}</p></div>` :
      `<div class="tbl-wrap"><table>
        <thead><tr>
          <th>Item Name</th><th>Code</th><th>Category</th>
          <th>Unit</th><th>Min Stock</th><th style="text-align:right">Quantity</th>
          <th>Count Date</th><th>Status</th><th>Remarks</th>
        </tr></thead>
        <tbody>
          ${_rptData.map(r=>`<tr>
            <td style="font-weight:600">${esc(r.name)}</td>
            <td><code style="font-size:.72rem">${esc(r.code)}</code></td>
            <td>${catPill(r.category)}</td>
            <td>${esc(r.unit)}</td>
            <td>${r.minStock}</td>
            <td style="text-align:right;font-weight:700;${r.isLow?'color:var(--red)':''}">${r.quantity!==null ? r.quantity : '<span style="color:var(--fa)">—</span>'}</td>
            <td style="font-size:.75rem">${esc(r.countDate)}</td>
            <td>${r.quantity===null ? '<span class="badge b-amb">Pending</span>' : r.isLow ? '<span class="badge b-red">⚠ Low</span>' : '<span class="badge b-grn">OK</span>'}</td>
            <td style="font-size:.75rem;color:var(--mu)">${esc(r.remarks)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`}`;
  } catch(err) {
    wrap.innerHTML=`<div class="empty"><h3>Error</h3><p>${esc(err.message)}</p></div>`;
  }
}

// ─ Compare Months ─
async function renderRptCompare() {
  const body = document.getElementById('rpt-body');
  if(!body) return;

  const months = lastMonths(24);
  const mkOpts = (selM,selY) => months.map(m=>`<option value="${m.year}-${m.month}" ${m.month===selM&&m.year===selY?'selected':''}>${esc(m.label)}</option>`).join('');

  body.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-size:.78rem;font-weight:600">Month A:</span>
          <select class="flt-sel" id="cmp-m1" onchange="runComparison()">
            ${mkOpts(_cmpMonth1,_cmpYear1)}
          </select>
        </div>
        <span style="color:var(--mu)">↔</span>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-size:.78rem;font-weight:600">Month B:</span>
          <select class="flt-sel" id="cmp-m2" onchange="runComparison()">
            ${mkOpts(_cmpMonth2,_cmpYear2)}
          </select>
        </div>
        <button class="btn btn-pri btn-sm" onclick="runComparison()">Compare</button>
      </div>
    </div>
    <div id="cmp-table"></div>`;

  await runComparison();
}

window.runComparison = async () => {
  const sel1 = document.getElementById('cmp-m1')?.value?.split('-');
  const sel2 = document.getElementById('cmp-m2')?.value?.split('-');
  if(!sel1||!sel2) return;

  const [y1,m1]=[parseInt(sel1[0]),parseInt(sel1[1])];
  const [y2,m2]=[parseInt(sel2[0]),parseInt(sel2[1])];
  _cmpMonth1=m1; _cmpYear1=y1; _cmpMonth2=m2; _cmpYear2=y2;

  const wrap = document.getElementById('cmp-table');
  if(!wrap) return;
  wrap.innerHTML=`<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:auto"></div></div>`;

  try {
    const [snap1,snap2] = await Promise.all([
      db.collection('stockEntries').where('year','==',y1).where('month','==',m1).get(),
      db.collection('stockEntries').where('year','==',y2).where('month','==',m2).get()
    ]);

    const map1={},map2={};
    snap1.docs.forEach(d=>{const e=d.data();map1[e.itemId]=e.quantity;});
    snap2.docs.forEach(d=>{const e=d.data();map2[e.itemId]=e.quantity;});

    const items = APP_ITEMS||[];
    const rows = items.map(i=>{
      const q1=map1[i.id]??null, q2=map2[i.id]??null;
      let diff=null, pct=null, dir='eq';
      if(q1!==null&&q2!==null){
        diff=q1-q2; // Month A - Month B
        pct=q2!==0?Math.round(diff/q2*100):null;
        dir=diff>0?'up':diff<0?'dn':'eq';
      }
      return {item:i,q1,q2,diff,pct,dir};
    });

    _rptData = rows.map(r=>({
      name:r.item.name, code:r.item.code, category:r.item.category, unit:r.item.unit,
      [`${fmtMYS(m1,y1)}`]:r.q1, [`${fmtMYS(m2,y2)}`]:r.q2,
      change:r.diff, changePct:r.pct
    }));

    const increased = rows.filter(r=>r.dir==='up').length;
    const decreased = rows.filter(r=>r.dir==='dn').length;

    wrap.innerHTML = `
      <div style="display:flex;gap:.75rem;margin-bottom:.875rem;flex-wrap:wrap">
        <span class="badge b-blue">Comparing: ${fmtMYS(m1,y1)} vs ${fmtMYS(m2,y2)}</span>
        <span class="badge b-grn">↑ ${increased} increased</span>
        <span class="badge b-red">↓ ${decreased} decreased</span>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>Item</th><th>Category</th><th>Unit</th>
          <th style="text-align:right">${esc(fmtMYS(m1,y1))} (A)</th>
          <th style="text-align:right">${esc(fmtMYS(m2,y2))} (B)</th>
          <th style="text-align:right">Change (A−B)</th>
          <th>Trend</th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>{
            const q1d = r.q1!==null ? r.q1 : '—';
            const q2d = r.q2!==null ? r.q2 : '—';
            const chg = r.diff!==null ? (r.diff>0?`+${r.diff}`:r.diff) : '—';
            const pctStr = r.pct!==null ? ` (${r.pct>0?'+':''}${r.pct}%)` : '';
            const cls   = r.dir==='up'?'cmp-up':r.dir==='dn'?'cmp-dn':'cmp-eq';
            const arrow = r.dir==='up'?'↑':r.dir==='dn'?'↓':'→';
            const rowBg = r.dir==='up'?'background:rgba(34,197,94,.04)':r.dir==='dn'?'background:rgba(239,68,68,.04)':'';
            return `<tr style="${rowBg}">
              <td>
                <div style="font-weight:600;font-size:.8rem">${esc(r.item.name)}</div>
                <code style="font-size:.68rem;color:var(--mu)">${esc(r.item.code)}</code>
              </td>
              <td>${catPill(r.item.category)}</td>
              <td>${esc(r.item.unit||'nos')}</td>
              <td style="text-align:right;font-weight:600">${q1d}</td>
              <td style="text-align:right;font-weight:600">${q2d}</td>
              <td style="text-align:right" class="${cls}">${chg}${pctStr}</td>
              <td><span class="${cls}" style="font-size:1.1rem">${arrow}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  } catch(err){
    wrap.innerHTML=`<div class="empty"><h3>Error</h3><p>${esc(err.message)}</p></div>`;
  }
};

// ─ Export Excel ─
window.exportExcel = () => {
  if(!_rptData.length){ toast('No data to export — load a report first','warn'); return; }
  try {
    const ws   = XLSX.utils.json_to_sheet(_rptData);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Report');
    const name = _rptTab==='snapshot'
      ? `inventory_${_rptYear}_${String(_rptMonth).padStart(2,'0')}.xlsx`
      : `inventory_comparison_${_cmpYear1}${_cmpMonth1}_vs_${_cmpYear2}${_cmpMonth2}.xlsx`;
    XLSX.writeFile(wb, name);
    toast('Excel file downloaded','ok');
  } catch(err){
    toast(`Export failed: ${err.message}`,'err');
  }
};

// ─ Print / PDF ─
window.printReport = () => {
  window.print();
};
