/**
 * Expense & Budget Visualizer — js/app.js
 *
 * Features:
 *  - Add / delete transactions (name, amount, category)
 *  - Custom categories (add / delete, max 20)
 *  - Monthly summary view
 *  - Sort by date, amount, or category
 *  - Highlight transactions over a spending limit
 *  - Pie chart via Canvas 2D API (no external libs)
 *  - All data persisted in localStorage
 *  - Works via file:// and as Manifest V3 extension
 */

'use strict';

/* ============================================================
   STORAGE SERVICE
   ============================================================ */
const StorageService = (() => {
  const KEYS = {
    TRANSACTIONS: 'ebv_transactions',
    CATEGORIES:   'ebv_categories',
    SORT:         'ebv_sort',
    LIMIT:        'ebv_limit',
  };

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return { load, save, KEYS };
})();

/* ============================================================
   BALANCE FORMATTER  (Indonesian Rupiah: "Rp 150.000")
   ============================================================ */
const BalanceFormatter = (() => {
  function format(amount) {
    if (amount === 0) return 'Rp 0';
    const rounded = Math.round(amount);
    const parts = rounded.toString().split('');
    let result = '';
    parts.reverse().forEach((d, i) => {
      if (i > 0 && i % 3 === 0) result = '.' + result;
      result = d + result;
    });
    return 'Rp ' + result;
  }
  return { format };
})();

/* ============================================================
   STATE  (single source of truth)
   ============================================================ */
const State = {
  transactions:     [],   // Transaction[]
  customCategories: [],   // string[]
  activeSort:       'date_desc',
  spendingLimit:    0,    // 0 = no limit
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...State.customCategories];
}

/* ============================================================
   UUID HELPER
   ============================================================ */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

/* ============================================================
   TRANSACTION CONTROLLER
   ============================================================ */
const TransactionController = (() => {

  function validateForm(data) {
    const errors = {};
    const name = (data.name || '').trim();
    const amount = data.amount;
    const category = (data.category || '').trim();

    if (!name) {
      errors.itemName = 'Nama item tidak boleh kosong.';
    } else if (name.length > 100) {
      errors.itemName = 'Nama item maksimal 100 karakter.';
    }

    const num = parseFloat(amount);
    if (amount === '' || amount === null || amount === undefined || isNaN(num)) {
      errors.amount = 'Jumlah harus berupa angka.';
    } else if (num < 0.01 || num > 999_999_999.99) {
      errors.amount = 'Jumlah harus antara 0,01 dan 999.999.999,99.';
    }

    if (!category) {
      errors.category = 'Pilih kategori terlebih dahulu.';
    } else if (!getAllCategories().includes(category)) {
      errors.category = 'Kategori tidak valid.';
    }

    return errors; // empty object = valid
  }

  function add(data) {
    const errors = validateForm(data);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const tx = {
      id:        generateId(),
      name:      data.name.trim(),
      amount:    parseFloat(parseFloat(data.amount).toFixed(2)),
      category:  data.category.trim(),
      createdAt: new Date().toISOString(),
    };

    State.transactions.push(tx);
    const saved = StorageService.save(StorageService.KEYS.TRANSACTIONS, State.transactions);
    return { ok: true, saved, tx };
  }

  function remove(id) {
    const idx = State.transactions.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, error: 'Transaksi tidak ditemukan.' };

    const removed = State.transactions.splice(idx, 1)[0];
    const saved = StorageService.save(StorageService.KEYS.TRANSACTIONS, State.transactions);

    if (!saved) {
      // rollback
      State.transactions.splice(idx, 0, removed);
      return { ok: false, error: 'Gagal menyimpan perubahan ke storage.' };
    }
    return { ok: true };
  }

  return { validateForm, add, remove };
})();

/* ============================================================
   CATEGORY CONTROLLER
   ============================================================ */
const CategoryController = (() => {

  function validate(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Nama kategori tidak boleh kosong.';
    if (trimmed.length > 30) return 'Nama kategori maksimal 30 karakter.';
    if (!/^[A-Za-z0-9 \-]+$/.test(trimmed)) return 'Hanya huruf, angka, spasi, dan tanda hubung yang diizinkan.';
    if (DEFAULT_CATEGORIES.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      return 'Nama ini sudah digunakan sebagai kategori default.';
    }
    if (State.customCategories.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      return 'Kategori ini sudah ada.';
    }
    if (State.customCategories.length >= 20) {
      return 'Maksimal 20 kategori kustom.';
    }
    return null;
  }

  function add(name) {
    const err = validate(name);
    if (err) return { ok: false, error: err };
    const trimmed = name.trim();
    State.customCategories.push(trimmed);
    StorageService.save(StorageService.KEYS.CATEGORIES, State.customCategories);
    return { ok: true };
  }

  function remove(name) {
    if (DEFAULT_CATEGORIES.includes(name)) {
      return { ok: false, error: 'Kategori default tidak dapat dihapus.' };
    }
    const idx = State.customCategories.indexOf(name);
    if (idx === -1) return { ok: false, error: 'Kategori tidak ditemukan.' };
    State.customCategories.splice(idx, 1);
    StorageService.save(StorageService.KEYS.CATEGORIES, State.customCategories);
    return { ok: true };
  }

  return { validate, add, remove };
})();

/* ============================================================
   SORT CONTROLLER
   ============================================================ */
const SortController = (() => {
  const OPTIONS = {
    DATE_DESC:    'date_desc',
    AMOUNT_ASC:   'amount_asc',
    AMOUNT_DESC:  'amount_desc',
    CATEGORY_AZ:  'category_az',
  };

  function getSorted(transactions, option) {
    const arr = [...transactions];
    switch (option) {
      case OPTIONS.AMOUNT_ASC:
        return arr.sort((a, b) => a.amount - b.amount || new Date(b.createdAt) - new Date(a.createdAt));
      case OPTIONS.AMOUNT_DESC:
        return arr.sort((a, b) => b.amount - a.amount || new Date(b.createdAt) - new Date(a.createdAt));
      case OPTIONS.CATEGORY_AZ:
        return arr.sort((a, b) => a.category.localeCompare(b.category, 'id') || new Date(b.createdAt) - new Date(a.createdAt));
      case OPTIONS.DATE_DESC:
      default:
        return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  function setSort(option) {
    State.activeSort = option;
    StorageService.save(StorageService.KEYS.SORT, option);
  }

  return { getSorted, setSort, OPTIONS };
})();

/* ============================================================
   CHART RENDERER  (Canvas 2D, no external libs)
   ============================================================ */
const ChartRenderer = (() => {
  // Palette: up to 23 distinct colours
  const PALETTE = [
    '#4f46e5','#f59e0b','#22c55e','#ef4444','#06b6d4',
    '#a855f7','#f97316','#14b8a6','#ec4899','#84cc16',
    '#6366f1','#eab308','#10b981','#f43f5e','#0ea5e9',
    '#8b5cf6','#fb923c','#2dd4bf','#e879f9','#a3e635',
    '#818cf8','#fbbf24','#34d399',
  ];

  // Assign a stable colour per category name
  const colorMap = new Map();
  let colorIdx = 0;

  function getColor(category) {
    if (!colorMap.has(category)) {
      colorMap.set(category, PALETTE[colorIdx % PALETTE.length]);
      colorIdx++;
    }
    return colorMap.get(category);
  }

  function computeTotals(transactions) {
    const map = new Map();
    for (const tx of transactions) {
      map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
    }
    return map;
  }

  function draw(transactions) {
    const canvas = document.getElementById('pieChart');
    const emptyMsg = document.getElementById('chartEmpty');
    const legend = document.getElementById('chartLegend');
    if (!canvas) return;

    const totals = computeTotals(transactions);
    const entries = [...totals.entries()].filter(([, v]) => v > 0);

    if (entries.length === 0) {
      canvas.style.opacity = '0';
      emptyMsg.style.display = 'flex';
      legend.innerHTML = '';
      return;
    }

    canvas.style.opacity = '1';
    emptyMsg.style.display = 'none';

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(cx, cy) - 10;

    ctx.clearRect(0, 0, W, H);

    const total = entries.reduce((s, [, v]) => s + v, 0);
    let startAngle = -Math.PI / 2;

    entries.forEach(([cat, val]) => {
      const slice = (val / total) * 2 * Math.PI;
      const color = getColor(cat);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += slice;
    });

    // Legend
    legend.innerHTML = '';
    entries.forEach(([cat, val]) => {
      const pct = ((val / total) * 100).toFixed(1);
      const li = document.createElement('li');
      li.className = 'legend-item';
      li.innerHTML = `
        <span class="legend-dot" style="background:${getColor(cat)}"></span>
        <span>${cat} (${pct}%)</span>
      `;
      legend.appendChild(li);
    });
  }

  function drawEmpty() {
    const canvas = document.getElementById('pieChart');
    const emptyMsg = document.getElementById('chartEmpty');
    const legend = document.getElementById('chartLegend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.opacity = '0';
    if (emptyMsg) emptyMsg.style.display = 'flex';
    if (legend) legend.innerHTML = '';
  }

  return { draw, drawEmpty, getColor };
})();

/* ============================================================
   VIEW
   ============================================================ */
const View = (() => {

  // ---- Balance ----
  function renderBalance(transactions) {
    const el = document.getElementById('balanceDisplay');
    if (!el) return;
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    el.textContent = BalanceFormatter.format(total);
  }

  // ---- Spending Limit Banner ----
  function renderLimitBanner(transactions) {
    const banner = document.getElementById('limitBanner');
    const msg = document.getElementById('limitBannerMsg');
    if (!banner || !msg) return;
    const limit = State.spendingLimit;
    if (limit <= 0) { banner.hidden = true; return; }
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    if (total > limit) {
      msg.textContent = `⚠️ Total pengeluaran (${BalanceFormatter.format(total)}) melebihi batas yang ditetapkan (${BalanceFormatter.format(limit)})!`;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  // ---- Transaction List ----
  function renderTransactionList(transactions) {
    const list = document.getElementById('transactionList');
    const empty = document.getElementById('emptyState');
    if (!list) return;

    // Remove all tx items (keep emptyState li)
    [...list.querySelectorAll('.tx-item')].forEach(el => el.remove());

    const sorted = SortController.getSorted(transactions, State.activeSort);
    const limit = State.spendingLimit;

    if (sorted.length === 0) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    sorted.forEach(tx => {
      const isOver = limit > 0 && tx.amount > limit;
      const li = document.createElement('li');
      li.className = 'tx-item' + (isOver ? ' over-limit' : '');
      li.dataset.id = tx.id;

      const date = new Date(tx.createdAt);
      const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

      li.innerHTML = `
        <div class="tx-info">
          <div class="tx-name">${escapeHtml(tx.name)}</div>
          <div class="tx-meta">${escapeHtml(tx.category)} · ${dateStr}${isOver ? ' <span class="tx-over-badge">⚠ Melebihi batas</span>' : ''}</div>
        </div>
        <span class="tx-amount">${BalanceFormatter.format(tx.amount)}</span>
        <button class="tx-delete" data-id="${tx.id}" aria-label="Hapus transaksi ${escapeHtml(tx.name)}">🗑</button>
      `;
      list.appendChild(li);
    });
  }

  // ---- Chart ----
  function renderChart(transactions) {
    if (transactions.length === 0) {
      ChartRenderer.drawEmpty();
    } else {
      ChartRenderer.draw(transactions);
    }
  }

  // ---- Monthly Summary ----
  function renderMonthlySummary(transactions) {
    const container = document.getElementById('monthlySummary');
    if (!container) return;

    if (transactions.length === 0) {
      container.innerHTML = '<p class="empty-state">Belum ada data pengeluaran</p>';
      return;
    }

    // Group by YYYY-MM
    const map = new Map();
    transactions.forEach(tx => {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + tx.amount);
    });

    // Sort reverse chronological
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    const table = document.createElement('table');
    table.className = 'monthly-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Bulan</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    entries.forEach(([key, total]) => {
      const [year, month] = key.split('-');
      const label = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="month-label">${label}</td>
        <td class="month-total">${BalanceFormatter.format(total)}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
  }

  // ---- Category Selector ----
  function renderCategorySelector() {
    const sel = document.getElementById('category');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Kategori --</option>';
    getAllCategories().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ---- Category List (manager panel) ----
  function renderCategoryList() {
    const ul = document.getElementById('catList');
    if (!ul) return;
    ul.innerHTML = '';
    getAllCategories().forEach(cat => {
      const isDefault = DEFAULT_CATEGORIES.includes(cat);
      const li = document.createElement('li');
      li.className = 'cat-item';
      li.innerHTML = `
        <span class="cat-name">${escapeHtml(cat)}${isDefault ? '<span class="cat-badge">default</span>' : ''}</span>
        <button class="cat-delete" data-cat="${escapeHtml(cat)}"
          ${isDefault ? 'disabled aria-disabled="true"' : ''}
          aria-label="Hapus kategori ${escapeHtml(cat)}">✕</button>
      `;
      ul.appendChild(li);
    });
  }

  // ---- Toast ----
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // ---- Inline field errors ----
  function showFieldErrors(errors) {
    clearFieldErrors();
    Object.entries(errors).forEach(([field, msg]) => {
      const errEl = document.getElementById(field + 'Error');
      const inputEl = document.getElementById(field);
      if (errEl) errEl.textContent = msg;
      if (inputEl) inputEl.classList.add('error');
    });
  }

  function clearFieldErrors() {
    ['itemName', 'amount', 'category'].forEach(f => {
      const errEl = document.getElementById(f + 'Error');
      const inputEl = document.getElementById(f);
      if (errEl) errEl.textContent = '';
      if (inputEl) inputEl.classList.remove('error');
    });
  }

  // ---- Reset form ----
  function resetForm() {
    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    clearFieldErrors();
  }

  // ---- Storage banner ----
  function showBanner(message) {
    const banner = document.getElementById('storageBanner');
    const msg = document.getElementById('bannerMessage');
    if (!banner || !msg) return;
    msg.textContent = message;
    banner.hidden = false;
  }

  // ---- Full re-render ----
  function renderAll(transactions) {
    renderBalance(transactions);
    renderLimitBanner(transactions);
    renderTransactionList(transactions);
    renderChart(transactions);
    renderMonthlySummary(transactions);
  }

  return {
    renderAll,
    renderBalance,
    renderLimitBanner,
    renderTransactionList,
    renderChart,
    renderMonthlySummary,
    renderCategorySelector,
    renderCategoryList,
    showToast,
    showFieldErrors,
    clearFieldErrors,
    resetForm,
    showBanner,
  };
})();

/* ============================================================
   UTILITY
   ============================================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   APP  (bootstrap + event wiring)
   ============================================================ */
const App = (() => {

  function init() {
    loadState();
    wireEvents();
    View.renderCategorySelector();
    View.renderCategoryList();
    View.renderAll(State.transactions);
    syncSortSelect();
    syncLimitInput();
  }

  // ---- Load state from Storage ----
  function loadState() {
    // Transactions
    const rawTx = StorageService.load(StorageService.KEYS.TRANSACTIONS);
    if (rawTx === null) {
      // Could be first run or storage error — start fresh silently
    } else if (!Array.isArray(rawTx)) {
      View.showBanner('Data transaksi sebelumnya tidak dapat dipulihkan. Memulai dengan daftar kosong.');
    } else {
      State.transactions = rawTx;
    }

    // Custom categories
    const rawCats = StorageService.load(StorageService.KEYS.CATEGORIES);
    if (Array.isArray(rawCats)) {
      State.customCategories = rawCats;
    }

    // Sort
    const rawSort = StorageService.load(StorageService.KEYS.SORT);
    if (rawSort && Object.values(SortController.OPTIONS).includes(rawSort)) {
      State.activeSort = rawSort;
    }

    // Spending limit
    const rawLimit = StorageService.load(StorageService.KEYS.LIMIT);
    if (typeof rawLimit === 'number' && rawLimit >= 0) {
      State.spendingLimit = rawLimit;
    }
  }

  function syncSortSelect() {
    const sel = document.getElementById('sortSelect');
    if (sel) sel.value = State.activeSort;
  }

  function syncLimitInput() {
    const inp = document.getElementById('spendingLimit');
    if (inp && State.spendingLimit > 0) inp.value = State.spendingLimit;
  }

  // ---- Wire all events ----
  function wireEvents() {

    // --- Transaction form submit ---
    const form = document.getElementById('transactionForm');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        View.clearFieldErrors();

        const data = {
          name:     document.getElementById('itemName').value,
          amount:   document.getElementById('amount').value,
          category: document.getElementById('category').value,
        };

        // Update spending limit from form field
        const limitVal = parseFloat(document.getElementById('spendingLimit').value);
        if (!isNaN(limitVal) && limitVal >= 0) {
          State.spendingLimit = limitVal;
          StorageService.save(StorageService.KEYS.LIMIT, limitVal);
        }

        const result = TransactionController.add(data);
        if (!result.ok) {
          View.showFieldErrors(result.errors);
          return;
        }
        if (result.saved === false) {
          View.showToast('⚠️ Data mungkin tidak tersimpan (storage penuh atau tidak tersedia).');
        }

        View.resetForm();
        View.renderCategorySelector();
        View.renderAll(State.transactions);
      });
    }

    // --- Delete transaction (event delegation) ---
    const txList = document.getElementById('transactionList');
    if (txList) {
      txList.addEventListener('click', e => {
        const btn = e.target.closest('.tx-delete');
        if (!btn) return;
        const id = btn.dataset.id;
        const tx = State.transactions.find(t => t.id === id);
        const name = tx ? tx.name : 'transaksi ini';
        if (!confirm(`Hapus "${name}"?`)) return;

        const result = TransactionController.remove(id);
        if (!result.ok) {
          View.showToast('❌ ' + result.error);
          return;
        }
        View.renderAll(State.transactions);
      });
    }

    // --- Sort select ---
    const sortSel = document.getElementById('sortSelect');
    if (sortSel) {
      sortSel.addEventListener('change', () => {
        SortController.setSort(sortSel.value);
        View.renderTransactionList(State.transactions);
      });
    }

    // --- Toggle category manager panel ---
    const manageCatBtn = document.getElementById('manageCatBtn');
    const categoryPanel = document.getElementById('categoryPanel');
    if (manageCatBtn && categoryPanel) {
      manageCatBtn.addEventListener('click', () => {
        const hidden = categoryPanel.hidden;
        categoryPanel.hidden = !hidden;
        manageCatBtn.setAttribute('aria-expanded', String(hidden));
      });
    }

    // --- Add custom category ---
    const addCatBtn = document.getElementById('addCatBtn');
    if (addCatBtn) {
      addCatBtn.addEventListener('click', () => {
        const input = document.getElementById('newCatInput');
        const errEl = document.getElementById('catError');
        const name = input ? input.value : '';

        const result = CategoryController.add(name);
        if (!result.ok) {
          if (errEl) errEl.textContent = result.error;
          return;
        }
        if (errEl) errEl.textContent = '';
        if (input) input.value = '';
        View.renderCategorySelector();
        View.renderCategoryList();
      });
    }

    // Also allow Enter key in category input
    const newCatInput = document.getElementById('newCatInput');
    if (newCatInput) {
      newCatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('addCatBtn').click();
        }
      });
    }

    // --- Delete custom category (event delegation on cat list) ---
    const catList = document.getElementById('catList');
    if (catList) {
      catList.addEventListener('click', e => {
        const btn = e.target.closest('.cat-delete');
        if (!btn || btn.disabled) return;
        const cat = btn.dataset.cat;
        const result = CategoryController.remove(cat);
        if (!result.ok) {
          View.showToast('❌ ' + result.error);
          return;
        }
        View.renderCategorySelector();
        View.renderCategoryList();
        // Re-render list in case some transactions had this category
        View.renderAll(State.transactions);
      });
    }

    // --- Close storage banner ---
    const bannerClose = document.getElementById('bannerClose');
    if (bannerClose) {
      bannerClose.addEventListener('click', () => {
        const banner = document.getElementById('storageBanner');
        if (banner) banner.hidden = true;
      });
    }
  }

  return { init };
})();

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', App.init);
