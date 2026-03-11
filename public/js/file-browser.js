// File browser state
let selectedEntry = null;
const selectedEntries = new Set();
let ctxTarget = null;
let currentViewerPath = null;
const expandedPaths = new Set();

// We resolve ROOT and API base from the parent page's origin
const API_BASE = '/api/files';
let ROOT = '';

// Fetch config to get files root
fetch('/api/config')
  .then(r => r.json())
  .then(config => {
    ROOT = config.filesRoot;
    loadTree(ROOT, document.getElementById('tree'), 0);
    connectSSE();
  });

// --- Icons ---
const C = '#6b7075';

const ICONS = {
  chevron: '<svg viewBox="0 0 8 8" fill="currentColor"><path d="M2 0.5l4 3.5-4 3.5z"/></svg>',
  folder: `<svg viewBox="0 0 20 20"><path d="M2 4h5l2 2h7.5a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 011 15.5V5.5A1.5 1.5 0 012 4z" fill="${C}"/></svg>`,
  folderOpen: `<svg viewBox="0 0 20 20"><path d="M2 4h5l2 2h7.5a1.5 1.5 0 011.5 1.5V10H8L3 17H2.5A1.5 1.5 0 011 15.5V5.5A1.5 1.5 0 012 4z" fill="${C}"/><path d="M8 10h11l-4 7H3z" fill="#8a8e92"/></svg>`,
  md: `<svg viewBox="0 0 16 16"><path d="M2 3h12v10H2z" fill="none" stroke="${C}" stroke-width="1.2"/><path d="M4.5 10V6l2 2.5L8.5 6v4M10.5 6v4l2-2" fill="none" stroke="${C}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  json: `<svg viewBox="0 0 16 16"><path d="M5 2.5C3.5 2.5 3 3.5 3 4.5v2c0 .5-.5 1-1 1 .5 0 1 .5 1 1v2c0 1 .5 2 2 2" fill="none" stroke="${C}" stroke-width="1.2" stroke-linecap="round"/><path d="M11 2.5c1.5 0 2 1 2 2v2c0 .5.5 1 1 1-.5 0-1 .5-1 1v2c0 1-.5 2-2 2" fill="none" stroke="${C}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  js: `<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="none" stroke="${C}" stroke-width="1.1"/><text x="8" y="11.5" text-anchor="middle" font-size="7.5" fill="${C}" font-family="system-ui" font-weight="700">JS</text></svg>`,
  html: `<svg viewBox="0 0 16 16"><path d="M5.5 3L2 8l3.5 5M10.5 3L14 8l-3.5 5" fill="none" stroke="${C}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  code: `<svg viewBox="0 0 16 16"><path d="M5.5 4L2.5 8l3 4M10.5 4l3 4-3 4" fill="none" stroke="${C}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  txt: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M5.5 8h5M5.5 10.5h3" stroke="${C}" stroke-width="0.9" stroke-linecap="round"/></svg>`,
  img: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="${C}" stroke-width="1.1"/><circle cx="5.5" cy="5.5" r="1.3" fill="${C}"/><path d="M2 12l3.5-4 2 2 2.5-3L14 12" fill="none" stroke="${C}" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
  pdf: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><text x="8" y="12.5" text-anchor="middle" font-size="5" fill="${C}" font-family="system-ui" font-weight="700">PDF</text></svg>`,
  word: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><text x="8" y="12.5" text-anchor="middle" font-size="5.5" fill="${C}" font-family="system-ui" font-weight="700">W</text></svg>`,
  excel: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M5.5 9l5 4M10.5 9l-5 4" stroke="${C}" stroke-width="0.9" stroke-linecap="round"/></svg>`,
  ppt: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><text x="8" y="12.5" text-anchor="middle" font-size="5.5" fill="${C}" font-family="system-ui" font-weight="700">P</text></svg>`,
  zip: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M7 7h2v2H7zM7 10h2v2H7z" fill="${C}" opacity="0.5"/></svg>`,
  default: `<svg viewBox="0 0 16 16"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="${C}" stroke-width="1.1"/><path d="M9 2v4h4" fill="none" stroke="${C}" stroke-width="1.1"/></svg>`,
};

const EXT_MAP = {
  md: ICONS.md, json: ICONS.json, js: ICONS.js,
  html: ICONS.html, htm: ICONS.html, css: ICONS.code,
  ts: ICONS.code, tsx: ICONS.code, jsx: ICONS.code,
  txt: ICONS.txt, log: ICONS.txt, cfg: ICONS.txt,
  png: ICONS.img, jpg: ICONS.img, jpeg: ICONS.img,
  gif: ICONS.img, svg: ICONS.img, webp: ICONS.img,
  sh: ICONS.code, py: ICONS.code, rb: ICONS.code,
  yaml: ICONS.txt, yml: ICONS.txt, toml: ICONS.txt,
  xml: ICONS.html, csv: ICONS.txt, sql: ICONS.code,
  pdf: ICONS.pdf,
  doc: ICONS.word, docx: ICONS.word, rtf: ICONS.word, odt: ICONS.word,
  xls: ICONS.excel, xlsx: ICONS.excel, ods: ICONS.excel,
  ppt: ICONS.ppt, pptx: ICONS.ppt, odp: ICONS.ppt,
  zip: ICONS.zip, gz: ICONS.zip, tar: ICONS.zip, rar: ICONS.zip, '7z': ICONS.zip,
};

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return EXT_MAP[ext] || ICONS.default;
}

// --- Toast ---
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// --- Upload loader ---
let uploadOverlay = null;
let uploadCancelled = false;

function showUploadLoader(msg) {
  if (uploadOverlay) return;
  uploadCancelled = false;
  uploadOverlay = document.createElement('div');
  uploadOverlay.className = 'upload-overlay';
  uploadOverlay.innerHTML = `
    <div class="upload-spinner"></div>
    <div class="upload-label">${msg}</div>
    <button class="upload-cancel">Cancel</button>`;
  uploadOverlay.querySelector('.upload-cancel').addEventListener('click', () => {
    uploadCancelled = true;
  });
  document.body.appendChild(uploadOverlay);
}

function updateUploadLoader(msg) {
  if (!uploadOverlay) return;
  const label = uploadOverlay.querySelector('.upload-label');
  if (label) label.textContent = msg;
}

function hideUploadLoader() {
  if (uploadOverlay) { uploadOverlay.remove(); uploadOverlay = null; }
}

// --- Drag & Drop ---
let dragSrcPath = null;

function setupDrag(row, entryPath, isDir) {
  row.draggable = true;

  row.addEventListener('dragstart', (e) => {
    dragSrcPath = entryPath;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entryPath);
  });

  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragSrcPath = null;
  });

  if (isDir) {
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      // External file drop or internal move
      if (!dragSrcPath || dragSrcPath !== entryPath) {
        e.dataTransfer.dropEffect = dragSrcPath ? 'move' : 'copy';
        row.classList.add('drag-over');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');

      // External file upload
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !dragSrcPath) {
        await handleFileDrop(e.dataTransfer.files, entryPath);
        return;
      }

      // Internal move
      if (dragSrcPath && dragSrcPath !== entryPath) {
        try {
          const res = await fetch(API_BASE + '/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ srcPath: dragSrcPath, destDir: entryPath }),
          });
          if (res.ok) {
            toast('Moved successfully');
            refresh();
          } else {
            toast('Move failed: ' + await res.text());
          }
        } catch (err) {
          toast('Move error: ' + err.message);
        }
      }
    });
  }
}

async function handleFileDrop(files, destDir) {
  showUploadLoader(`Uploading ${files.length} file(s)...`);
  let uploaded = 0;

  for (const file of files) {
    if (uploadCancelled) break;
    updateUploadLoader(`Uploading ${file.name} (${++uploaded}/${files.length})...`);

    try {
      const buf = await file.arrayBuffer();
      await fetch(
        API_BASE + '/upload?dir=' + encodeURIComponent(destDir) + '&name=' + encodeURIComponent(file.name),
        { method: 'POST', body: buf }
      );
    } catch (err) {
      toast('Upload failed: ' + err.message);
    }
  }

  hideUploadLoader();
  if (!uploadCancelled) toast(`Uploaded ${uploaded} file(s)`);
  refresh();
}

// --- External drag onto tree background ---
const tree = document.getElementById('tree');

tree.addEventListener('dragover', (e) => {
  if (!dragSrcPath) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

tree.addEventListener('drop', async (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !dragSrcPath) {
    e.preventDefault();
    await handleFileDrop(e.dataTransfer.files, ROOT);
  }
});

// --- Tree rendering ---
async function loadTree(dir, container, depth) {
  try {
    const res = await fetch(API_BASE + '/list?dir=' + encodeURIComponent(dir));
    const entries = await res.json();
    container.innerHTML = '';

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'entry';
      row.dataset.path = entry.path;
      row.dataset.isDir = entry.isDir;
      row.style.paddingLeft = (12 + depth * 16) + 'px';

      const chevron = document.createElement('span');
      chevron.className = 'chevron' + (expandedPaths.has(entry.path) ? ' open' : '');
      chevron.innerHTML = entry.isDir ? ICONS.chevron : '';
      if (!entry.isDir) chevron.style.visibility = 'hidden';

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.innerHTML = entry.isDir
        ? (expandedPaths.has(entry.path) ? ICONS.folderOpen : ICONS.folder)
        : getFileIcon(entry.name);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.name;

      row.appendChild(chevron);
      row.appendChild(icon);
      row.appendChild(name);

      // Click handler
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEntry(row);

        if (entry.isDir) {
          toggleDir(entry.path, row, chevron, icon, depth);
        } else {
          openFile(entry.path, entry.name);
        }
      });

      // Context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectEntry(row);
        ctxTarget = entry;
        showContextMenu(e.clientX, e.clientY);
      });

      // Drag & drop
      setupDrag(row, entry.path, entry.isDir);

      container.appendChild(row);

      // If previously expanded, re-expand
      if (entry.isDir && expandedPaths.has(entry.path)) {
        const children = document.createElement('div');
        children.className = 'children open';
        container.appendChild(children);
        await loadTree(entry.path, children, depth + 1);
      }
    }
  } catch (err) {
    console.error('Failed to load tree:', err);
  }
}

function toggleDir(dirPath, row, chevron, icon, depth) {
  const next = row.nextElementSibling;

  if (next && next.classList.contains('children') && next.classList.contains('open')) {
    // Collapse
    next.classList.remove('open');
    expandedPaths.delete(dirPath);
    chevron.classList.remove('open');
    icon.innerHTML = ICONS.folder;
  } else if (next && next.classList.contains('children')) {
    // Re-expand
    next.classList.add('open');
    expandedPaths.add(dirPath);
    chevron.classList.add('open');
    icon.innerHTML = ICONS.folderOpen;
  } else {
    // First expand
    expandedPaths.add(dirPath);
    chevron.classList.add('open');
    icon.innerHTML = ICONS.folderOpen;
    const children = document.createElement('div');
    children.className = 'children open';
    row.parentNode.insertBefore(children, row.nextSibling);
    loadTree(dirPath, children, depth + 1);
  }
}

function selectEntry(row) {
  if (selectedEntry) selectedEntry.classList.remove('selected');
  row.classList.add('selected');
  selectedEntry = row;
}

// --- File viewer ---
async function openFile(filePath, fileName) {
  try {
    const res = await fetch(API_BASE + '/read?file=' + encodeURIComponent(filePath));
    const content = await res.text();
    currentViewerPath = filePath;

    const viewer = document.getElementById('viewer');
    const viewerFilepath = document.getElementById('viewer-filepath');
    const viewerContent = document.getElementById('viewer-content');

    // Show path with filename highlighted
    const dir = filePath.substring(0, filePath.length - fileName.length);
    viewerFilepath.innerHTML = dir + '<span>' + fileName + '</span>';

    // Render with line numbers
    const lines = content.split('\n');
    viewerContent.innerHTML = lines.map((line, i) =>
      `<div class="viewer-line"><span class="line-num">${i + 1}</span><span class="line-text">${escapeHtml(line)}</span></div>`
    ).join('');

    viewer.classList.add('open');
  } catch (err) {
    toast('Failed to open file');
  }
}

function closeViewer() {
  document.getElementById('viewer').classList.remove('open');
  currentViewerPath = null;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Context menu ---
function showContextMenu(x, y) {
  const menu = document.getElementById('ctx-menu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('open');
}

function hideContextMenu() {
  document.getElementById('ctx-menu').classList.remove('open');
  ctxTarget = null;
}

document.addEventListener('click', hideContextMenu);

document.querySelectorAll('.ctx-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.stopPropagation();
    const action = item.dataset.action;
    hideContextMenu();
    if (!ctxTarget && action !== 'new-file' && action !== 'new-folder') return;

    switch (action) {
      case 'open':
        if (!ctxTarget.isDir) openFile(ctxTarget.path, ctxTarget.name);
        break;

      case 'download':
        if (!ctxTarget.isDir) {
          window.open(API_BASE + '/download?file=' + encodeURIComponent(ctxTarget.path));
        }
        break;

      case 'new-file':
        createNew(false);
        break;

      case 'new-folder':
        createNew(true);
        break;

      case 'rename':
        startRename(ctxTarget);
        break;

      case 'delete':
        if (confirm('Delete "' + ctxTarget.name + '"?')) {
          await fetch(API_BASE + '/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPath: ctxTarget.path }),
          });
          toast('Deleted');
          refresh();
        }
        break;
    }
  });
});

// --- Create new file/folder ---
function createNew(isDir) {
  const name = prompt(isDir ? 'New folder name:' : 'New file name:');
  if (!name) return;

  // Use selected dir or root
  let parentDir = ROOT;
  if (selectedEntry) {
    parentDir = selectedEntry.dataset.isDir === 'true'
      ? selectedEntry.dataset.path
      : selectedEntry.dataset.path.substring(0, selectedEntry.dataset.path.lastIndexOf('/'));
  }

  fetch(API_BASE + '/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentDir, name, isDir }),
  })
    .then(r => {
      if (r.ok) { toast('Created ' + name); refresh(); }
      else r.text().then(t => toast('Error: ' + t));
    });
}

// --- Rename ---
function startRename(entry) {
  const row = document.querySelector(`[data-path="${CSS.escape(entry.path)}"]`);
  if (!row) return;

  const nameEl = row.querySelector('.name');
  const oldName = entry.name;

  const input = document.createElement('input');
  input.className = 'inline-input';
  input.value = oldName;
  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();
  input.select();

  function finish() {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      fetch(API_BASE + '/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: entry.path, newName }),
      })
        .then(r => {
          if (r.ok) { toast('Renamed'); refresh(); }
          else { nameEl.textContent = oldName; r.text().then(t => toast('Error: ' + t)); }
        });
    } else {
      nameEl.textContent = oldName;
    }
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

// --- Refresh ---
function refresh() {
  loadTree(ROOT, document.getElementById('tree'), 0);
}

// --- SSE file watching ---
function connectSSE() {
  const es = new EventSource(API_BASE + '/watch');
  es.onmessage = (e) => {
    if (e.data === 'change') refresh();
  };
  es.onerror = () => {
    es.close();
    setTimeout(connectSSE, 3000);
  };
}

// Keyboard shortcut: Escape closes viewer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeViewer();
});

// Expose for header buttons
window.createNew = createNew;
window.refresh = refresh;
window.closeViewer = closeViewer;
