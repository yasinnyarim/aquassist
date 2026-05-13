// ═══════════════════════════════════════════════════════════════
//  AquAssist — Single-Page App Controller
//  All view switching, API calls, and DOM rendering live here.
// ═══════════════════════════════════════════════════════════════

const API = 'http://localhost:8000';

// ── App State ───────────────────────────────────────────────────
const STATE = {
    tanks: [],           // full list from /tanks/
    selectedTank: null,  // the Tank object the user clicked
    chart: null,         // Chart.js instance for Water Analysis
    miniChart: null,     // sparkline on Dashboard
    activeParam: 'ph',   // which water-quality param tab is active
    fishFilter: 'all',   // category filter
    plantSpecies: [],
    dashboardEvents: {},
};

// ── Water-quality demo data (backend has no time-series yet) ────
const WATER_DATA = {
    ph:  { label: 'Acidity PH',   color: '#1a73e8', min: 5, max: 9,
           labels: ['Dec 21','Dec 23','Dec 28','Dec 31','Jan 1','Jan 3','May 30','Jun 2'],
           data:   [7.2, 6.5, 8.1, 6.1, 5.8, 6.7, 6.8, 7.1] },
    nh3: { label: 'Ammonia NH3',  color: '#ea4335', min: 0, max: 0.5,
           labels: ['Dec 21','Dec 23','Dec 28','Dec 31','Jan 1','Jan 3','May 30','Jun 2'],
           data:   [0.25, 0.30, 0.22, 0.35, 0.18, 0.12, 0.09, 0.08] },
    nh4: { label: 'Ammonium NH4', color: '#f59e0b', min: 0, max: 1.0,
           labels: ['Dec 21','Dec 23','Dec 28','Dec 31','Jan 1','Jan 3','May 30','Jun 2'],
           data:   [0.55, 0.62, 0.58, 0.71, 0.48, 0.52, 0.49, 0.47] },
};

const FISH_CATEGORY_LABELS = {
    freshwater: 'Freshwater',
    saltwater:  'Saltwater',
    monster:    'Monster',
    peaceful:   'Peaceful',
    unknown:    'Uncategorized'
};

function normalizeFishCategory(species) {
    if (!species) return 'unknown';
    const category = (species.category || '').toLowerCase();
    const tags = (species.compatibility_tags || '').toLowerCase();

    if (category.includes('salt') || tags.includes('saltwater')) {
        return 'saltwater';
    }

    if (category.includes('monster') || category === 'predator' || category === 'betta' || tags.includes('predator') || tags.includes('aggressive')) {
        return 'monster';
    }

    if (tags.includes('peaceful')) {
        return 'peaceful';
    }

    if (category.includes('livebear') || category.includes('tetra') || category.includes('danio') || category.includes('pleco') || category.includes('corydoras') || category.includes('cichlid') || tags.includes('schooling') || tags.includes('community')) {
        return 'freshwater';
    }

    // Default to freshwater for standard aquarium species.
    return 'freshwater';
}

function getFishDisplayCategory(species) {
    const cat = normalizeFishCategory(species);
    return FISH_CATEGORY_LABELS[cat] || FISH_CATEGORY_LABELS.unknown;
}

// ══════════════════════════════════════════════════════════════
//  BOOT — single DOMContentLoaded, everything wired here
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    wireSidebar();
    wireModals();
    wireWaterTabs();
    preloadSpecies();
    preloadPlants();
    loadDashboardEvents();
    renderAquariumList();          // load tanks immediately
    showView('aquariums');         // start on aquarium list
    
    // Wire chat button
    document.getElementById('chat-toggle-btn').addEventListener('click', () => {
        document.getElementById('chat-widget').classList.toggle('hidden');
    });
    document.getElementById('chat-send-btn').addEventListener('click', handleChatSend);
});

// ══════════════════════════════════════════════════════════════
//  VIEW MANAGER
// ══════════════════════════════════════════════════════════════

/**
 * showView(name) — the ONLY function that switches views.
 * name must match the suffix of the view DIV id: "view-{name}"
 * and the data-view attribute on header .cat-link buttons.
 */
function showView(name) {
    // 1. Hide all view panels
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });

    // 2. Show the target panel
    const target = document.getElementById('view-' + name);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    } else {
        console.error('[showView] No element with id="view-' + name + '"');
        return;
    }

    // 3. Highlight sidebar button
    document.querySelectorAll('.cat-link[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === name);
    });

    STATE.currentView = name;

    // 4. Side effects per view
    if (name === 'water-analysis') renderWaterAnalysis();
    if (name === 'ai-report')      renderAIReport();
    if (name === 'dashboard' && STATE.selectedTank) renderDashboard(STATE.selectedTank.id);
    if (name === 'fish' && STATE.selectedTank) renderFishTracking();
    if (name === 'plants' && STATE.selectedTank) renderPlants();
}

// ══════════════════════════════════════════════════════════════
//  SIDEBAR WIRING
// ══════════════════════════════════════════════════════════════
function wireSidebar() {
    document.querySelectorAll('.cat-link[data-view]').forEach(btn => {
        // Remove the `disabled` attribute — we handle "no tank" via empty states instead
        btn.removeAttribute('disabled');

        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (!view) return;

            // Guard views that need a selected tank
            if ((view === 'dashboard' || view === 'ai-report' || view === 'fish' || view === 'plants') && !STATE.selectedTank) {
                showNoTankMessage(view);
                return;
            }

            showView(view);
        });
    });
}

function showNoTankMessage(view) {
    // Temporarily show the view with an "empty state" prompt
    showView('aquariums');
    showInlineMsg(
        'aquariums-grid',
        '⬆️ Please click on an aquarium card above to open this section.',
        'info'
    );
}

// ══════════════════════════════════════════════════════════════
//  MODAL WIRING
// ══════════════════════════════════════════════════════════════
function wireModals() {
    // Create Tank
    document.getElementById('btn-show-create')
        .addEventListener('click', () => showModal('create-modal'));
    document.getElementById('btn-hero-create')
        .addEventListener('click', () => showModal('create-modal'));
    document.getElementById('btn-hero-explore')
        .addEventListener('click', () => document.getElementById('aquariums-grid')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('btn-close-create')
        .addEventListener('click', () => hideModal('create-modal'));
    document.getElementById('form-create-tank')
        .addEventListener('submit', handleCreateTank);

    // Add Fish
    document.getElementById('btn-add-fish')
        .addEventListener('click', () => {
            if (!STATE.selectedTank) {
                alert('Select an aquarium first.');
                return;
            }
            // Ensure species list is fresh when the modal opens
            preloadSpecies().then(() => showModal('add-fish-modal'));
        });
    document.getElementById('btn-close-fish')
        .addEventListener('click', () => hideModal('add-fish-modal'));
    document.getElementById('form-add-fish')
        .addEventListener('submit', handleAddFish);
        
    // Define Species
    document.getElementById('form-define-species')?.addEventListener('submit', handleDefineSpecies);
    
    // Add Plant
    document.getElementById('btn-add-plant')?.addEventListener('click', () => {
        if (!STATE.selectedTank) {
            alert('Select an aquarium first.');
            return;
        }
        preloadPlants().then(() => showModal('add-plant-modal'));
    });
    document.getElementById('form-add-plant')?.addEventListener('submit', handleAddPlant);

    // Delete Tank
    document.getElementById('btn-delete-tank')?.addEventListener('click', () => {
        if (!STATE.selectedTank) return;
        showModal('delete-tank-modal');
    });
    document.getElementById('btn-confirm-delete')?.addEventListener('click', handleDeleteTankConfirmed);

    document.getElementById('btn-add-event')?.addEventListener('click', () => {
        const form = document.getElementById('event-form');
        if (!form) return;
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) {
            document.getElementById('event-date').valueAsDate = new Date();
            document.getElementById('event-desc').value = '';
        }
    });
    document.getElementById('btn-cancel-event')?.addEventListener('click', () => {
        document.getElementById('event-form')?.classList.add('hidden');
    });
    document.getElementById('event-form')?.addEventListener('submit', handleAddEvent);

    // Fish Filters
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            STATE.fishFilter = tab.dataset.group;
            renderFishTracking();
        });
    });
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

// ══════════════════════════════════════════════════════════════
//  RENDER: AQUARIUM LIST
// ══════════════════════════════════════════════════════════════
async function renderAquariumList() {
    const grid = document.getElementById('aquariums-grid');
    grid.innerHTML = '<p class="empty-state">Loading aquariums…</p>';

    try {
        const res = await fetch(`${API}/tanks/`);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        STATE.tanks = await res.json();

        if (STATE.tanks.length === 0) {
            grid.innerHTML = '<p class="empty-state">No aquariums yet — create your first one!</p>';
            return;
        }

        grid.innerHTML = '';
        STATE.tanks.forEach(tank => {
            const card = document.createElement('div');
            card.className = 'aqua-card';
            card.innerHTML = `
                <div class="aqua-img"></div>
                <div class="aqua-info">
                    <h3>${escHtml(tank.name)}</h3>
                    <div class="aqua-stats">
                        <span><i class="fas fa-tint"></i> ${tank.size_liters} L</span>
                        <span><i class="fas fa-thermometer-half"></i> ${tank.temperature ?? '—'} °C</span>
                        <span><i class="fas fa-filter"></i> ${tank.has_filter ? 'Filtered' : 'No filter'}</span>
                        <span><i class="fas fa-leaf"></i> ${tank.is_planted ? 'Planted' : 'No plants'}</span>
                    </div>
                </div>
                <div class="aqua-arrow"><i class="fas fa-chevron-right"></i></div>
            `;
            // ← event delegation not needed; we add listener per card right here
            card.addEventListener('click', () => selectTank(tank));
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = `<p class="empty-state error-state">⚠️ Cannot reach backend: ${err.message}</p>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  SELECT TANK → open Dashboard
// ══════════════════════════════════════════════════════════════
function selectTank(tank) {
    STATE.selectedTank = tank;
    document.getElementById('chat-toggle-btn').classList.remove('hidden');
    document.getElementById('chat-tank-label').textContent = tank.name;
    showView('dashboard');
}

function loadDashboardEvents() {
    try {
        const raw = localStorage.getItem('aquassist-dashboard-events');
        STATE.dashboardEvents = raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.warn('Failed to load dashboard events from storage', err);
        STATE.dashboardEvents = {};
    }
}

function saveDashboardEvents() {
    try {
        localStorage.setItem('aquassist-dashboard-events', JSON.stringify(STATE.dashboardEvents));
    } catch (err) {
        console.warn('Failed to save dashboard events to storage', err);
    }
}

function getDashboardEvents(tankId) {
    return STATE.dashboardEvents[tankId] || [];
}

function setDashboardEvents(tankId, events) {
    STATE.dashboardEvents[tankId] = events;
    saveDashboardEvents();
}

function renderDashboardEvents(tankId) {
    const list = document.getElementById('dash-events-list');
    if (!list) return;
    const events = getDashboardEvents(tankId);
    if (!events.length) {
        list.innerHTML = '<p class="empty-state">No event entries yet. Click "Add Event" to record maintenance or observations.</p>';
        return;
    }

    list.innerHTML = events.map(ev => `
        <div class="event-item">
            <span class="evt-date">${escHtml(ev.date)}</span>
            <span class="evt-name">${escHtml(ev.description)}</span>
        </div>
    `).join('');
}

async function handleAddEvent(e) {
    e.preventDefault();
    if (!STATE.selectedTank) return;

    const dateInput = document.getElementById('event-date');
    const descInput = document.getElementById('event-desc');
    const date = dateInput?.value;
    const description = descInput?.value.trim();
    if (!date || !description) {
        alert('Please enter both date and event description.');
        return;
    }

    const events = getDashboardEvents(STATE.selectedTank.id);
    events.unshift({ date, description });
    setDashboardEvents(STATE.selectedTank.id, events);
    renderDashboardEvents(STATE.selectedTank.id);

    document.getElementById('event-form')?.classList.add('hidden');
}

// ══════════════════════════════════════════════════════════════
//  RENDER: DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderDashboard(tankId) {
    const tank = STATE.selectedTank;

    // -- Static fields from the tank object -----------------
    document.getElementById('dash-tank-title').textContent = tank.name;
    document.getElementById('ds-volume').textContent       = `${tank.size_liters} L`;
    document.getElementById('ds-plants').textContent       = tank.is_planted ? 'Yes' : 'No';
    document.getElementById('dash-filter').textContent     = tank.has_filter  ? 'Active' : 'None';

    // -- Reset dynamic fields to loading state --------------
    document.getElementById('dash-health').textContent     = '…';
    document.getElementById('dash-status').textContent     = 'Loading';
    document.getElementById('dash-bioload').textContent    = '…';
    document.getElementById('ds-fish-count').textContent   = '…';
    document.getElementById('dash-issues').classList.add('hidden');
    document.getElementById('dash-recs').classList.add('hidden');
    document.getElementById('event-form')?.classList.add('hidden');
    renderDashboardEvents(tankId);

    // -- Fetch fish count -----------------------------------
    try {
        const fRes = await fetch(`${API}/tanks/${tankId}/fish`);
        if (fRes.ok) {
            const fishes = await fRes.json();
            const total  = fishes.reduce((s, f) => s + (f.quantity || 0), 0);
            document.getElementById('ds-fish-count').textContent = total;
        }
    } catch (_) { document.getElementById('ds-fish-count').textContent = '?'; }

    // -- Fetch analysis -------------------------------------
    try {
        const aRes = await fetch(`${API}/tanks/${tankId}/analyze`);
        if (!aRes.ok) {
            const err = await aRes.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${aRes.status}`);
        }
        const d = await aRes.json();

        document.getElementById('dash-health').textContent  = `${d.health_score.toFixed(0)}/100`;
        document.getElementById('dash-bioload').textContent = `${d.bioload_percent.toFixed(0)}%`;

        const statusEl = document.getElementById('dash-status');
        statusEl.textContent = d.status.toUpperCase();
        statusEl.className = 'metric-sub status-' + d.status;   // status-good / status-warning / status-danger

        // issues
        if (d.compatibility_issues && d.compatibility_issues.length > 0) {
            document.getElementById('dash-issues-list').innerHTML =
                d.compatibility_issues.map(i => `<li>${escHtml(i)}</li>`).join('');
            document.getElementById('dash-issues').classList.remove('hidden');
        }

        // recommendations
        if (d.recommendations && d.recommendations.length > 0) {
            document.getElementById('dash-recs-list').innerHTML =
                d.recommendations.map(r => `<li>${escHtml(r)}</li>`).join('');
            document.getElementById('dash-recs').classList.remove('hidden');
        }

        // mini sparkline
        renderMiniChart();

    } catch (err) {
        console.error('Dashboard analysis error:', err);
        showInlineMsg('dash-right-col', `⚠️ Analysis failed: ${err.message}`, 'error');
    }
}

// ══════════════════════════════════════════════════════════════
//  RENDER: MINI SPARKLINE (Dashboard)
// ══════════════════════════════════════════════════════════════
function renderMiniChart() {
    const canvas = document.getElementById('dashMiniChart');
    if (!canvas) return;
    if (STATE.miniChart) { STATE.miniChart.destroy(); STATE.miniChart = null; }

    STATE.miniChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            datasets: [{
                data: [7.2, 7.0, 7.1, 6.9, 7.1, 7.0, 7.2],
                borderColor: '#1a73e8',
                backgroundColor: 'rgba(26,115,232,0.10)',
                tension: 0.4, fill: true, pointRadius: 0, borderWidth: 2,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
        },
    });
}

// ══════════════════════════════════════════════════════════════
//  RENDER: WATER ANALYSIS
// ══════════════════════════════════════════════════════════════
function renderWaterAnalysis() {
    const canvas = document.getElementById('waterChart');
    if (!canvas) return;
    if (STATE.chart) { STATE.chart.destroy(); STATE.chart = null; }

    const ds = WATER_DATA[STATE.activeParam];
    STATE.chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ds.labels,
            datasets: [{
                label: ds.label,
                data: ds.data,
                borderColor: ds.color,
                backgroundColor: ds.color + '22',
                tension: 0.4, fill: true,
                pointRadius: 5, pointHoverRadius: 7, borderWidth: 2,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { min: ds.min, max: ds.max, grid: { color: '#e2e8f0' } } },
        },
    });
}

function wireWaterTabs() {
    // Wire the parameter tabs inside #view-water-analysis
    document.querySelectorAll('#view-water-analysis .chart-tabs .tab[data-param]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#view-water-analysis .chart-tabs .tab')
                .forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            STATE.activeParam = tab.dataset.param;
            renderWaterAnalysis();
        });
    });
}

// ══════════════════════════════════════════════════════════════
//  RENDER: AI REPORT
// ══════════════════════════════════════════════════════════════
async function renderAIReport() {
    const content = document.getElementById('ai-report-content');

    if (!STATE.selectedTank) {
        content.innerHTML = '<div class="empty-state">Select an aquarium from "My Aquariums" to generate a report.</div>';
        return;
    }

    content.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Generating insights…</div>';

    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/report`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Format the multi-line plain text into styled HTML
        const lines = data.report.split('\n');
        let html = '';
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (/^[📋🎯⚠️💡📅=]/.test(trimmed) && trimmed.length < 80)
                html += `<h3 class="ai-section-title">${escHtml(trimmed)}</h3>`;
            else if (trimmed.startsWith('-'))
                html += `<div class="ai-bullet">${escHtml(trimmed.slice(1).trim())}</div>`;
            else if (trimmed.startsWith('='))
                html += `<hr class="ai-hr">`;
            else
                html += `<p class="ai-para">${escHtml(trimmed)}</p>`;
        });
        content.innerHTML = html || '<p class="ai-para">No report data returned.</p>';
    } catch (err) {
        content.innerHTML = `<div class="empty-state error-state">⚠️ Report failed: ${err.message}</div>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  CREATE TANK
// ══════════════════════════════════════════════════════════════
async function handleCreateTank(e) {
    e.preventDefault();
    const payload = {
        name:        document.getElementById('tank-name').value.trim(),
        size_liters: parseFloat(document.getElementById('tank-size').value),
        temperature: parseFloat(document.getElementById('tank-temp').value) || null,
        has_filter:  document.getElementById('tank-filter').checked,
        is_planted:  document.getElementById('tank-planted').checked,
    };
    if (!payload.name || !payload.size_liters) {
        alert('Please fill in Name and Volume.');
        return;
    }
    try {
        const res = await fetch(`${API}/tanks/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        hideModal('create-modal');
        document.getElementById('form-create-tank').reset();
        await renderAquariumList();
    } catch (err) {
        alert(`Failed to create tank: ${err.message}`);
    }
}

// ══════════════════════════════════════════════════════════════
//  ADD FISH
// ══════════════════════════════════════════════════════════════
async function preloadSpecies() {
    try {
        const res     = await fetch(`${API}/fish-species/`);
        if (!res.ok) return;
        const species = await res.json();
        const sel     = document.getElementById('fish-species-select');
        if (!sel) return; // modal might not be in DOM yet

        const categories = {
            freshwater: 'Freshwater',
            saltwater:  'Saltwater',
            monster:    'Monster',
            peaceful:   'Peaceful',
            unknown:    'Uncategorized'
        };

        const grouped = species.reduce((acc, sp) => {
            const category = normalizeFishCategory(sp);
            acc[category] = acc[category] || [];
            acc[category].push(sp);
            return acc;
        }, {});

        sel.innerHTML = '<option value="">— Select species —</option>';
        Object.keys(FISH_CATEGORY_LABELS).forEach(category => {
            const group = grouped[category] || [];
            if (!group.length) return;
            const optgroup = document.createElement('optgroup');
            optgroup.label = FISH_CATEGORY_LABELS[category];
            group.forEach(sp => {
                const opt       = document.createElement('option');
                opt.value       = sp.id;
                opt.textContent = sp.name;
                optgroup.appendChild(opt);
            });
            sel.appendChild(optgroup);
        });
    } catch (_) {}
}

async function handleAddFish(e) {
    e.preventDefault();
    if (!STATE.selectedTank) { alert('No tank selected.'); return; }

    const speciesId = document.getElementById('fish-species-select').value;
    const qty       = parseInt(document.getElementById('fish-quantity').value);
    const sizeCm    = parseFloat(document.getElementById('fish-size').value);
    if (!speciesId) { alert('Please select a species.'); return; }
    if (!sizeCm || sizeCm <= 0) { alert('Please enter a valid fish size in cm.'); return; }

    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/fish`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ species_id: parseInt(speciesId), quantity: qty, size_cm: sizeCm }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        hideModal('add-fish-modal');
        document.getElementById('fish-quantity').value = 1;
        document.getElementById('fish-size').value = '';
        await renderDashboard(STATE.selectedTank.id);   // refresh stats
        if (STATE.currentView === 'fish') renderFishTracking();
    } catch (err) {
        alert(`Failed to add fish: ${err.message}`);
    }
}

async function handleDefineSpecies(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('df-name').value,
        category: document.getElementById('df-category').value,
        aggression_level: "low",
        min_temp: 22, max_temp: 28, adult_size_cm: 5, bioload_factor: 0.5,
        compatibility_tags: document.getElementById('df-category').value
    };
    try {
        const res = await fetch(`${API}/fish-species/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error("Failed Server Response");
        hideModal('define-species-modal');
        document.getElementById('form-define-species').reset();
        await preloadSpecies();
        alert("Species defined successfully!");
    } catch (err) { alert(err.message); }
}

async function preloadPlants() {
    try {
        const res = await fetch(`${API}/plant-species/`);
        if (!res.ok) return;
        STATE.plantSpecies = await res.json();
        const sel = document.getElementById('plant-select');
        if (!sel) return; // Modal might not be in DOM yet
        sel.innerHTML = '<option value="">— Select plant —</option>';
        STATE.plantSpecies.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            sel.appendChild(opt);
        });
    } catch (_) {}
}

async function handleAddPlant(e) {
    e.preventDefault();
    if (!STATE.selectedTank) return;
    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/plants`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plant_id: parseInt(document.getElementById('plant-select').value), quantity: parseInt(document.getElementById('plant-qty').value) })
        });
        if (!res.ok) throw new Error("Server error");
        hideModal('add-plant-modal');
        renderPlants();
        renderDashboard(STATE.selectedTank.id);
    } catch (err) { alert(err.message); }
}

async function renderFishTracking() {
    if (!STATE.selectedTank) return;
    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/fish`);
        const items = await res.json();
        const grid = document.getElementById('fish-grid');
        if (!grid) return;

        const activeFilter = STATE.fishFilter || 'all';
        const filteredItems = activeFilter === 'all'
            ? items
            : items.filter(f => normalizeFishCategory(f.species) === activeFilter);

        if (filteredItems.length === 0) {
            grid.innerHTML = activeFilter === 'all'
                ? '<p class="empty-state">No fish have been added to this aquarium yet.</p>'
                : '<p class="empty-state">No fish found in this category.</p>';
            return;
        }

        const grouped = filteredItems.reduce((acc, f) => {
            const category = normalizeFishCategory(f.species);
            acc[category] = acc[category] || [];
            acc[category].push(f);
            return acc;
        }, {});

        const orderedCategories = ['freshwater', 'saltwater', 'peaceful', 'monster', 'unknown'];
        let html = '';

        if (activeFilter === 'all') {
            orderedCategories.forEach(category => {
                const fishes = grouped[category] || [];
                if (!fishes.length) return;
                html += `
                    <section class="fish-category-section">
                        <div class="fish-category-header">
                            <h2>${FISH_CATEGORY_LABELS[category] || category}</h2>
                            <span class="badge">${fishes.length} item${fishes.length === 1 ? '' : 's'}</span>
                        </div>
                        <div class="cards-grid fish-category-grid">
                            ${fishes.map(renderFishCard).join('')}
                        </div>
                    </section>`;
            });
        } else {
            const fishes = grouped[activeFilter] || [];
            html = `
                <section class="fish-category-section">
                    <div class="fish-category-header">
                        <h2>${FISH_CATEGORY_LABELS[activeFilter] || activeFilter}</h2>
                        <span class="badge">${fishes.length} item${fishes.length === 1 ? '' : 's'}</span>
                    </div>
                    <div class="cards-grid fish-category-grid">
                        ${fishes.map(renderFishCard).join('')}
                    </div>
                </section>`;
        }

        grid.innerHTML = html;
    } catch (e) {
        console.error('Failed to render fish tracking', e);
    }
}

function renderFishCard(f) {
    const speciesName = f.species?.name || 'Unknown species';
    const displayCategory = getFishDisplayCategory(f.species);
    const addedDate = f.added_at ? new Date(f.added_at).toLocaleDateString() : 'Unknown date';
    const size = f.size_cm ? `${f.size_cm.toFixed(1)} cm` : `${f.species?.adult_size_cm ?? '—'} cm`;

    return `
        <div class="card fish-card">
            <div class="fish-card-head">
                <h3>${speciesName}</h3>
                <span class="fish-card-badge">${displayCategory}</span>
            </div>
            <p><strong>Quantity:</strong> ${f.quantity}</p>
            <p><strong>Size:</strong> ${escHtml(size)}</p>
            <small>Added: ${addedDate}</small>
        </div>`;
}

async function renderPlants() {
    if (!STATE.selectedTank) return;
    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/plants`);
        const plants = await res.json();
        const grid = document.getElementById('plants-grid');
        grid.innerHTML = plants.map(p => `
            <div style="border-bottom: 1px solid #ccc; padding: 10px 0;">
                <h4 style="margin:0">${p.plant.name} <span style="background:#10b981; color:white; padding:2px 8px; border-radius:12px; font-size:12px">x${p.quantity}</span></h4>
                <p style="margin:5px 0 0; color:#666">${p.plant.benefits}</p>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function handleDeleteTankConfirmed() {
    if (!STATE.selectedTank) {
        hideModal('delete-tank-modal');
        return;
    }
    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}`, { method: 'DELETE' });
        if (res.ok) {
            STATE.selectedTank = null;
            document.getElementById('chat-toggle-btn').classList.add('hidden');
            hideModal('delete-tank-modal');
            await renderAquariumList();
            showView('aquariums');
        }
    } catch (e) { alert("Failed to delete tank."); }
}

async function handleChatSend() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const msg = input.value.trim();
    if (!msg || !STATE.selectedTank) return;

    const body = document.getElementById('chat-body');
    body.innerHTML += `<div style="text-align:right; margin:10px 0;"><span style="background:#1a73e8; color:white; padding:8px 12px; border-radius:12px; display:inline-block">${escHtml(msg)}</span></div>`;
    input.value = '';
    body.innerHTML += `<div id="chat-loading" style="text-align:left; margin:10px 0;"><span style="background:#e2e8f0; color:#64748b; padding:8px 12px; border-radius:12px; display:inline-block"><i class="fas fa-circle-notch fa-spin"></i> Düşünüyor…</span></div>`;
    body.scrollTop = body.scrollHeight;
    sendBtn.disabled = true;
    input.disabled = true;

    try {
        const res = await fetch(`${API}/tanks/${STATE.selectedTank.id}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg }),
        });
        document.getElementById('chat-loading')?.remove();
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const err = await res.json();
                detail = err.detail || err.message || detail;
            } catch (_) { /* ignore */ }
            body.innerHTML += `<div style="text-align:left; margin:10px 0;"><span style="background:#fee2e2; color:#991b1b; padding:8px 12px; border-radius:12px; display:inline-block; font-size:13px">${escHtml(String(detail))}</span></div>`;
        } else {
            const data = await res.json();
            const reply = data.response != null ? String(data.response) : '';
            body.innerHTML += `<div style="text-align:left; margin:10px 0;"><span style="background:#e2e8f0; color:#1e293b; padding:8px 12px; border-radius:12px; display:inline-block; white-space:pre-wrap">${escHtml(reply)}</span></div>`;
        }
        body.scrollTop = body.scrollHeight;
    } catch (e) {
        document.getElementById('chat-loading')?.remove();
        body.innerHTML += `<div style="text-align:left; margin:10px 0;"><span style="background:#fee2e2; color:#991b1b; padding:8px 12px; border-radius:12px; display:inline-block; font-size:13px">Bağlantı hatası: ${escHtml(e.message || String(e))}</span></div>`;
        body.scrollTop = body.scrollHeight;
    } finally {
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function escHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showInlineMsg(containerId, msg, type = 'info') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const existing = el.querySelector('.inline-msg');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `inline-msg ${type === 'error' ? 'error-state' : 'empty-state'}`;
    div.style.cssText = 'margin:1rem 0; border-radius:8px; background:#f0f9ff; padding:1rem;';
    div.textContent = msg;
    el.prepend(div);
    setTimeout(() => div.remove(), 6000);
}
