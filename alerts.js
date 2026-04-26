// alerts.js — Smart Alerts: low stock, fast-moving, dead stock

async function initAlerts() {
  const sec = document.getElementById('sec-alerts');
  sec.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh"><div class="spinner"></div></div>`;

  try {
    const items = APP_ITEMS||[];
    if(!items.length){
      sec.innerHTML=`<div class="empty"><div class="eico"><svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div><h3>No items yet</h3><p>Add items in Item Master to see alerts.</p></div>`;
      return;
    }

    // Load last 4 months of entries for all items
    const now   = new Date();
    const months = lastMonths(4); // current + 3 previous
    const allEntries = [];

    const snaps = await Promise.all(
      months.map(m => db.collection('stockEntries').where('year','==',m.year).where('month','==',m.month).get())
    );
    snaps.forEach((snap,idx)=>{
      snap.docs.forEach(d=>{ allEntries.push({...d.data(), _mIdx:idx}); }); // 0=current, 3=oldest
    });

    // Build per-item monthly quantities  [month0=current, month1, month2, month3]
    const itemQtyByMonth = {}; // itemId → [q0, q1, q2, q3]
    items.forEach(i=>{ itemQtyByMonth[i.id]=[null,null,null,null]; });
    allEntries.forEach(e=>{
      if(itemQtyByMonth[e.itemId]) itemQtyByMonth[e.itemId][e._mIdx]=e.quantity;
    });

    // ── Low stock ──
    const lowStock = items.filter(i=>{
      const q0 = itemQtyByMonth[i.id][0]; // current month
      return q0!==null && q0 <= (i.minStock||0) && (i.minStock||0)>0;
    });

    // ── Fast moving (biggest drop current vs previous month) ──
    const fastMoving = items
      .map(i=>{
        const q0=itemQtyByMonth[i.id][0], q1=itemQtyByMonth[i.id][1];
        if(q0===null||q1===null) return null;
        const drop=q1-q0; // positive = stock dropped
        return drop>0 ? {item:i,q0,q1,drop,pct:q1>0?Math.round(drop/q1*100):0} : null;
      })
      .filter(Boolean)
      .sort((a,b)=>b.drop-a.drop)
      .slice(0,10);

    // ── Dead stock (no change across last 3 months) ──
    const deadStock = items.filter(i=>{
      const [q0,q1,q2,q3]=itemQtyByMonth[i.id];
      if(q0===null||q1===null||q2===null) return false; // not enough data
      return q0===q1 && q1===q2; // same for 3 consecutive months
    });

    // ── No entry this month ──
    const noEntry = items.filter(i=>itemQtyByMonth[i.id][0]===null);

    // Update nav badge
    const totalAlerts = lowStock.length + deadStock.length;
    const badge  = document.getElementById('sb-alert-badge');
    const mob    = document.getElementById('mob-badge');
    const dot    = document.getElementById('mob-alert-dot');
    if(totalAlerts>0){
      if(badge){badge.textContent=totalAlerts;badge.style.display='';}
      if(mob){mob.textContent=totalAlerts;mob.style.display='';}
      if(dot) dot.style.display='';
    } else {
      if(badge)badge.style.display='none';
      if(mob)mob.style.display='none';
      if(dot)dot.style.display='none';
    }

    sec.innerHTML = `
      <div class="sec-hdr">
        <div class="sec-hdr-l">
          <h2>Alerts</h2>
          <p>Smart inventory alerts for ${fmtMYS(months[0].month,months[0].year)}</p>
        </div>
        <div class="sec-hdr-r">
          <button class="btn btn-ghost btn-sm" onclick="initAlerts()">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      <!-- Alert summary row -->
      <div class="stats-grid" style="margin-bottom:1.5rem">
        ${aStat('Low Stock',lowStock.length,'red','Items below minimum level')}
        ${aStat('Fast Moving',fastMoving.length,'amb','Biggest drops this month')}
        ${aStat('Dead Stock',deadStock.length,'pur','No change for 3+ months')}
        ${aStat('No Entry',noEntry.length,'grn','Not counted this month')}
      </div>

      <!-- Low stock section -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-size:.9rem;font-weight:700">🔴 Low Stock Items</h3>
          <span class="badge b-red">${lowStock.length} items</span>
        </div>
        ${lowStock.length===0
          ? `<div class="empty" style="padding:1.5rem"><p style="margin:0">All items are above minimum stock level ✓</p></div>`
          : lowStock.map(i=>{
              const q=itemQtyByMonth[i.id][0];
              const pct=i.minStock>0?Math.min(100,Math.round(q/i.minStock*100)):100;
              return `<div class="alert-row danger" style="flex-direction:column;align-items:stretch;gap:.4rem">
                <div style="display:flex;align-items:center;gap:.75rem">
                  ${thumbHtml(i.imageUrl)}
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.8125rem">${esc(i.name)}</div>
                    <div style="font-size:.7rem;color:var(--mu)">${esc(i.code)} · ${catPill(i.category)}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:1.25rem;font-weight:800;color:var(--red)">${q} <span style="font-size:.75rem">${esc(i.unit||'')}</span></div>
                    <div style="font-size:.68rem;color:var(--mu)">Min: ${i.minStock}</div>
                  </div>
                </div>
                <div style="padding:0 .25rem">
                  <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--mu);margin-bottom:.2rem"><span>Stock Level</span><span>${pct}% of minimum</span></div>
                  <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${pct<30?'var(--red)':pct<70?'var(--amb)':'var(--grn)'}"></div></div>
                </div>
              </div>`;
            }).join('')
        }
      </div>

      <!-- Fast moving section -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-size:.9rem;font-weight:700">⚡ Fast Moving Items</h3>
          <span class="badge b-amb">Biggest drops (${fmtMYS(months[1]?.month,months[1]?.year)} → ${fmtMYS(months[0].month,months[0].year)})</span>
        </div>
        ${fastMoving.length===0
          ? `<div class="empty" style="padding:1.5rem"><p style="margin:0">Not enough data yet — need 2 months of entries.</p></div>`
          : `<div class="tbl-wrap"><table>
              <thead><tr><th>Item</th><th>Category</th><th>Previous</th><th>Current</th><th>Drop</th><th>% Change</th></tr></thead>
              <tbody>
                ${fastMoving.map(({item:i,q0,q1,drop,pct})=>`<tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:.5rem">
                      ${thumbHtml(i.imageUrl)}
                      <div>
                        <div style="font-weight:600;font-size:.8rem">${esc(i.name)}</div>
                        <code style="font-size:.68rem;color:var(--mu)">${esc(i.code)}</code>
                      </div>
                    </div>
                  </td>
                  <td>${catPill(i.category)}</td>
                  <td style="font-weight:600">${q1} ${esc(i.unit||'')}</td>
                  <td style="font-weight:600">${q0} ${esc(i.unit||'')}</td>
                  <td class="cmp-dn" style="font-weight:700">−${drop} ${esc(i.unit||'')}</td>
                  <td class="cmp-dn">−${pct}%</td>
                </tr>`).join('')}
              </tbody>
            </table></div>`
        }
      </div>

      <!-- Dead stock section -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-size:.9rem;font-weight:700">💤 Dead Stock</h3>
          <span class="badge b-gray">No movement for 3+ months</span>
        </div>
        ${deadStock.length===0
          ? `<div class="empty" style="padding:1.5rem"><p style="margin:0">No dead stock detected — or not enough data yet.</p></div>`
          : deadStock.map(i=>{
              const q=itemQtyByMonth[i.id][0];
              return `<div class="alert-row info">
                ${thumbHtml(i.imageUrl)}
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:.8125rem">${esc(i.name)}</div>
                  <div style="font-size:.7rem;color:var(--mu)">${esc(i.code)} · ${catPill(i.category)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:1rem;font-weight:700">${q} ${esc(i.unit||'')}</div>
                  <div style="font-size:.65rem;color:var(--mu)">Unchanged 3 months</div>
                </div>
              </div>`;
            }).join('')
        }
      </div>

      <!-- No entry this month -->
      ${noEntry.length>0 ? `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-size:.9rem;font-weight:700">🕐 No Entry This Month</h3>
          <button class="btn btn-pri btn-sm" onclick="navTo('stock')">Enter Stock</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.35rem">
          ${noEntry.map(i=>`<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem .55rem;border:1px solid var(--bdr);border-radius:var(--rsm);font-size:.75rem;background:var(--sur)">
            <span>${i.imageUrl ? `<img src="${esc(i.imageUrl)}" style="width:18px;height:18px;border-radius:3px;object-fit:cover">` : '📦'}</span>
            ${esc(i.name)}
          </div>`).join('')}
        </div>
      </div>` : ''}`;

  } catch(err) {
    console.error('Alerts error:', err);
    sec.innerHTML=`<div class="empty"><h3>Failed to load alerts</h3><p>${esc(err.message)}</p><button class="btn btn-pri" onclick="initAlerts()">Retry</button></div>`;
  }
}

function aStat(label, value, color, sub) {
  const icons={red:`<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>`,amb:`<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>`,pur:`<path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>`,grn:`<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>`};
  return `<div class="stat-card stat-${color}">
    <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">${icons[color]}</svg></div>
    <div><div class="stat-num">${value}</div><div class="stat-lbl">${esc(label)}</div><div class="stat-sub">${esc(sub)}</div></div>
  </div>`;
}
