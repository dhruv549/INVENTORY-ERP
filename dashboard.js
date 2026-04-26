// dashboard.js — Dashboard section

async function initDashboard() {
  const sec = document.getElementById('sec-dashboard');
  sec.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh"><div class="spinner"></div></div>`;

  try {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const items = window.APP_ITEMS || [];

    // Fetch current month entries
    const snap = await db.collection('stockEntries')
      .where('year','==',year).where('month','==',month).get();
    const entries = snap.docs.map(d=>({id:d.id,...d.data()}));

    // Build lookup: itemId → entry
    const eMap = {};
    entries.forEach(e => { eMap[e.itemId] = e; });

    // Stats
    const cats      = new Set(items.map(i=>i.category)).size;
    const lowStock  = items.filter(i => (eMap[i.id]?.quantity ?? 0) <= (i.minStock||0) && (i.minStock||0) > 0);
    const pending   = items.filter(i => !eMap[i.id]);
    const pct       = items.length ? Math.round(entries.length/items.length*100) : 0;
    const isLocked  = !!(APP_LOCKS[lockKey(month,year)]?.locked);

    sec.innerHTML = `
      <div class="sec-hdr">
        <div class="sec-hdr-l">
          <h2>Dashboard</h2>
          <p>${fmtMY(month,year)} &mdash; ${isLocked ? '🔒 Month Locked' : 'Entry Open'}</p>
        </div>
        <div class="sec-hdr-r">
          <button class="btn btn-ghost btn-sm" onclick="initDashboard()">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
          <button class="btn btn-pri btn-sm" onclick="navTo('stock')">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Enter Stock
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        ${sCard('Total Items', items.length, 'blue', `<path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>`, 'Registered in system')}
        ${sCard('Categories', cats, 'pur', `<path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>`, 'Active categories')}
        ${sCard('Low Stock', lowStock.length, 'red', `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>`, 'Below minimum level')}
        ${sCard('Pending Entry', pending.length, 'amb', `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>`, 'No count this month')}
        ${sCard(`Coverage ${pct}%`, `${entries.length}/${items.length}`, 'grn', `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`, 'Items counted this month')}
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-hdr">
            <h3>Stock Trend — Last 6 Months</h3>
            <select id="trend-sel" class="flt-sel" style="font-size:.75rem" onchange="renderTrend()">
              <option value="">— Select item —</option>
              ${items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}
            </select>
          </div>
          <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
          <p id="trend-hint" style="text-align:center;font-size:.75rem;color:var(--fa);margin-top:.5rem">Select an item above to see its 6-month trend</p>
        </div>
        <div class="chart-card">
          <div class="chart-hdr"><h3>Category Distribution</h3></div>
          <div class="chart-wrap"><canvas id="catChart"></canvas></div>
        </div>
      </div>

      <!-- Low stock + Pending -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
            <h3 style="font-size:.875rem;font-weight:700">⚠️ Low Stock Items</h3>
            <span class="badge b-red">${lowStock.length}</span>
          </div>
          ${lowStock.length === 0
            ? `<p style="font-size:.78rem;color:var(--mu)">All items above minimum ✓</p>`
            : lowStock.slice(0,6).map(i => {
                const q = eMap[i.id]?.quantity ?? 0;
                return `<div class="alert-row danger" style="margin-bottom:.4rem">
                  ${thumbHtml(i.imageUrl)}
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</div>
                    <div style="font-size:.68rem;color:var(--mu)">${esc(i.code)} · ${esc(i.unit)}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:1rem;font-weight:800;color:var(--red)">${q}</div>
                    <div style="font-size:.62rem;color:var(--mu)">Min: ${i.minStock||0}</div>
                  </div>
                </div>`;
              }).join('')
          }
          ${lowStock.length > 6 ? `<div style="text-align:center;margin-top:.5rem"><button class="btn btn-ghost btn-sm" onclick="navTo('alerts')">View all ${lowStock.length}</button></div>` : ''}
        </div>

        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
            <h3 style="font-size:.875rem;font-weight:700">🕐 Pending Entry</h3>
            <span class="badge b-amb">${pending.length}</span>
          </div>
          ${pending.length === 0
            ? `<p style="font-size:.78rem;color:var(--mu)">All items counted this month ✓</p>`
            : pending.slice(0,6).map(i => `
                <div class="alert-row warn" style="margin-bottom:.4rem">
                  ${thumbHtml(i.imageUrl)}
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</div>
                    <div style="font-size:.68rem;color:var(--mu)">${esc(i.category)}</div>
                  </div>
                </div>`).join('')
          }
          ${pending.length > 6 ? `<div style="text-align:center;margin-top:.5rem"><button class="btn btn-ghost btn-sm" onclick="navTo('stock')">Enter stock</button></div>` : ''}
        </div>
      </div>`;

    // Render category doughnut
    renderCatChart(items, entries);

    // Cache last quantities for badge
    items.forEach(i => { i._lastQty = eMap[i.id]?.quantity ?? null; });

  } catch(err) {
    console.error('Dashboard error:', err);
    sec.innerHTML = `<div class="empty"><div class="eico"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><h3>Failed to load</h3><p>${esc(err.message)}</p><button class="btn btn-pri" onclick="initDashboard()">Retry</button></div>`;
  }
}

// ─ Stat card HTML ─
function sCard(label, value, color, iconPath, sub='') {
  return `<div class="stat-card stat-${color}">
    <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">${iconPath}</svg></div>
    <div>
      <div class="stat-num">${esc(String(value))}</div>
      <div class="stat-lbl">${esc(label)}</div>
      ${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}
    </div>
  </div>`;
}

// ─ Category doughnut ─
function renderCatChart(items, entries) {
  const canvas = document.getElementById('catChart');
  if(!canvas) return;
  destroyChart('cat');

  const counts = {};
  CATS.forEach(c => counts[c] = 0);
  items.forEach(i => { if(counts[i.category]!==undefined) counts[i.category]++; });

  const labels = CATS.filter(c=>counts[c]>0);
  const data   = labels.map(c=>counts[c]);
  const colors = labels.map(c=>CAT_COLORS[c]||'#64748b');

  _charts.cat = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets:[{ data, backgroundColor: colors.map(c=>c+'cc'), borderColor: colors, borderWidth:2 }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ position:'bottom', labels:{ boxWidth:10, padding:10, font:{size:10} } } }
    }
  });
}

// ─ Trend chart ─
window.renderTrend = async () => {
  const sel = document.getElementById('trend-sel');
  const hint = document.getElementById('trend-hint');
  if(!sel || !sel.value) return;

  const itemId = sel.value;
  const item   = APP_ITEMS.find(i=>i.id===itemId);
  if(!item) return;

  if(hint) hint.style.display='none';
  destroyChart('trend');
  const canvas = document.getElementById('trendChart');
  if(!canvas) return;

  try {
    const months = lastMonths(6).reverse(); // oldest → newest
    const labels = months.map(m=>m.label);
    const data   = Array(6).fill(null);

    // Fetch all entries for this item in last 6 months
    const snap = await db.collection('stockEntries')
      .where('itemId','==',itemId).get();

    const entryMap = {};
    snap.docs.forEach(d=>{
      const e=d.data();
      entryMap[`${e.year}-${e.month}`]=e.quantity;
    });

    months.forEach((m,i) => {
      const key=`${m.year}-${m.month}`;
      if(entryMap[key]!==undefined) data[i]=entryMap[key];
    });

    const color = CAT_COLORS[item.category]||'#2563eb';

    _charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets:[{
          label: item.name,
          data,
          borderColor: color,
          backgroundColor: color+'22',
          tension: .35,
          fill: true,
          pointBackgroundColor: color,
          pointRadius: 4,
          spanGaps: true
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx=>`${ctx.parsed.y} ${item.unit||''}` } } },
        scales:{
          y:{ beginAtZero:true, grid:{color:'#f1f5f9'}, ticks:{font:{size:10}} },
          x:{ grid:{display:false}, ticks:{font:{size:10}} }
        }
      }
    });

    // Draw min stock line
    if((item.minStock||0) > 0 && _charts.trend) {
      _charts.trend.options.plugins.annotation = {
        annotations: {
          minLine: { type:'line', yMin:item.minStock, yMax:item.minStock, borderColor:'#ef4444', borderWidth:1.5, borderDash:[4,4], label:{ display:true, content:`Min: ${item.minStock}`, position:'end', font:{size:9} } }
        }
      };
    }
  } catch(err) {
    console.error('Trend error:', err);
    toast('Failed to load trend data','err');
  }
};
