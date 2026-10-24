// Developer-only editor. Loaded by main.js on localhost, and only shown when
// dev.py is running (it answers /api/dev). Never appears on the live site.
//
// Edit mode: click a piece to rename, move or delete it; drag pieces to
// reorder; "Profile" edits name, bio, Discord, picture and banner.

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

async function post(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || 'Saving failed.');
  return out;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !IMAGE_TYPES.test(file.type)) return reject(new Error('Use a JPG, PNG, WebP or GIF image.'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Couldn\'t read that file.'));
    reader.readAsDataURL(file);
  });
}

/* A form dialog whose submit calls `action(dlg)`. dlg.run(fn) saves, shows errors inline, reloads on success. */
function dialog(id, title, fields, saveLabel, action, extraButton = '') {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="dev-dialog" id="${id}" aria-labelledby="${id}-title">
      <form class="dev-form" method="dialog" novalidate>
        <h2 id="${id}-title">${title}</h2>
        ${fields}
        <p class="dev-error" role="alert"></p>
        <div class="dev-actions">
          ${extraButton}
          <button class="dev-btn dev-cancel" type="button">Cancel</button>
          <button class="dev-btn dev-save" type="submit">${saveLabel}</button>
        </div>
      </form>
    </dialog>`);
  const dlg = document.getElementById(id);
  const error = dlg.querySelector('.dev-error');
  const save = dlg.querySelector('.dev-save');
  dlg.querySelector('.dev-cancel').addEventListener('click', () => dlg.close());
  dlg.fail = (msg) => { error.textContent = msg; };
  dlg.begin = () => { error.textContent = ''; save.disabled = false; save.textContent = saveLabel; dlg.showModal(); };
  dlg.run = async (fn, busyText = 'Saving…') => {
    error.textContent = '';
    save.disabled = true; save.textContent = busyText;
    try { await fn(); location.reload(); } catch (err) {
      error.textContent = err.message;
      save.disabled = false; save.textContent = saveLabel;
    }
  };
  dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); action(dlg); });
  return dlg;
}

/* Image picker (click or drop) inside `root`. get() returns the chosen data URL, or '' if none. */
function dropZone(dlg, root = dlg, onPick) {
  const drop = root.querySelector('.dev-drop');
  const input = root.querySelector('input[type=file]');
  const preview = drop.querySelector('img');
  let dataURL = '';
  const use = async (f) => {
    if (!f) return;
    try {
      dataURL = await readImage(f);
      preview.src = dataURL; preview.hidden = false; drop.classList.add('has-image');
      dlg.fail('');
      onPick?.(f);
    } catch (err) { dlg.fail(err.message); }
  };
  input.addEventListener('change', () => use(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); use(e.dataTransfer.files[0]); });
  return {
    get: () => dataURL,
    reset: (src = '') => {
      dataURL = ''; input.value = '';
      preview.src = src; preview.hidden = !src; drop.classList.toggle('has-image', !!src);
    },
  };
}

const dropHTML = (id, text, cls = '') => `
  <label class="dev-drop ${cls}" for="${id}">
    <img alt="" hidden>
    <span class="dev-drop-text"><i class="ph ph-image" aria-hidden="true"></i> ${text}</span>
  </label>
  <input id="${id}" type="file" accept="${ACCEPT}" class="sr-only">`;

const field = (id, label, input = `<input id="${id}" autocomplete="off">`) =>
  `<div class="dev-field"><label for="${id}">${label}</label>${input}</div>`;

function mount(data) {
  const pieces = data.pieces || [];
  const grid = document.querySelector('#grid');
  const saveContent = (changes) => post('/api/content', { ...data, pieces, ...changes });

  /* Toolbar */
  document.body.insertAdjacentHTML('beforeend', `
    <div class="dev-bar" role="toolbar" aria-label="Edit portfolio">
      <button class="dev-chip dev-tool" type="button" data-act="add"><i class="ph ph-plus" aria-hidden="true"></i> Add piece</button>
      <button class="dev-chip dev-tool" type="button" data-act="profile"><i class="ph ph-user" aria-hidden="true"></i> Profile</button>
      <button class="dev-chip dev-toggle" type="button" data-act="toggle" aria-pressed="false"></button>
    </div>`);
  const bar = document.querySelector('.dev-bar');
  const toggle = bar.querySelector('.dev-toggle');

  const setEditing = (on) => {
    document.body.classList.toggle('dev-editing', on);
    toggle.setAttribute('aria-pressed', on);
    toggle.innerHTML = on
      ? '<i class="ph ph-check" aria-hidden="true"></i> Done'
      : '<i class="ph ph-pencil-simple" aria-hidden="true"></i> Edit';
    grid.querySelectorAll('.piece').forEach((el) => (el.draggable = on));
    try { sessionStorage.setItem('dev-editing', on ? '1' : ''); } catch {}
  };
  let stored = '';
  try { stored = sessionStorage.getItem('dev-editing'); } catch {}
  setEditing(!!stored);

  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') setEditing(!document.body.classList.contains('dev-editing'));
    if (act === 'add') { addDlg.querySelector('form').reset(); addDrop.reset(); addDlg.begin(); }
    if (act === 'profile') openProfile();
  });

  /* Add piece */
  const addDlg = dialog('dev-add', 'Add a piece',
    dropHTML('dev-add-file', 'Choose or drop an image') + field('dev-add-title', 'Title'),
    'Add to portfolio',
    (dlg) => {
      const title = dlg.querySelector('#dev-add-title');
      if (!addDrop.get()) return dlg.fail('Pick an image first.');
      if (!title.value.trim()) { title.focus(); return dlg.fail('Add a title.'); }
      dlg.run(() => post('/api/pieces', { title: title.value.trim(), image: addDrop.get() }), 'Adding…');
    });
  const addDrop = dropZone(addDlg, addDlg, (f) => {
    const title = addDlg.querySelector('#dev-add-title');
    if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    title.focus(); title.select();
  });

  /* Edit piece: title, position, delete */
  let editing = 0;
  const pieceDlg = dialog('dev-piece', 'Edit piece',
    '<img class="dev-thumb" alt="">' +
    field('dev-piece-title', 'Title') +
    field('dev-piece-pos', 'Position', '<input id="dev-piece-pos" type="number" min="1" step="1" inputmode="numeric">'),
    'Save',
    (dlg) => {
      const title = dlg.querySelector('#dev-piece-title').value.trim();
      const pos = Math.round(Number(dlg.querySelector('#dev-piece-pos').value));
      if (!title) return dlg.fail('Add a title.');
      if (!(pos >= 1 && pos <= pieces.length)) return dlg.fail(`Position must be 1 to ${pieces.length}.`);
      const list = pieces.slice();
      const [piece] = list.splice(editing, 1);
      list.splice(pos - 1, 0, { ...piece, title });
      dlg.run(() => saveContent({ pieces: list }));
    },
    '<button class="dev-btn dev-delete" type="button"><i class="ph ph-trash" aria-hidden="true"></i> Delete</button>');
  pieceDlg.querySelector('.dev-delete').addEventListener('click', () => {
    if (!confirm(`Delete "${pieces[editing].title}"? Its image file is removed too.`)) return;
    pieceDlg.run(() => saveContent({ pieces: pieces.filter((_, i) => i !== editing) }), 'Deleting…');
  });

  // Capture phase so edit mode wins over main.js opening the viewer.
  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.piece');
    if (!el || !document.body.classList.contains('dev-editing')) return;
    e.stopPropagation();
    editing = Number(el.dataset.i);
    const p = pieces[editing];
    pieceDlg.querySelector('.dev-thumb').src = p.image;
    pieceDlg.querySelector('#dev-piece-title').value = p.title;
    const pos = pieceDlg.querySelector('#dev-piece-pos');
    pos.value = editing + 1; pos.max = pieces.length;
    pieceDlg.begin();
  }, true);

  /* Drag to reorder */
  let dragFrom = null;
  const clearDrag = () => grid.querySelectorAll('.dev-dragging, .dev-drop-target')
    .forEach((el) => el.classList.remove('dev-dragging', 'dev-drop-target'));
  grid.addEventListener('dragstart', (e) => {
    const el = e.target.closest('.piece');
    if (!el) return;
    dragFrom = Number(el.dataset.i);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dev-dragging');
  });
  grid.addEventListener('dragover', (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const target = e.target.closest('.piece');
    grid.querySelectorAll('.dev-drop-target').forEach((el) => el !== target && el.classList.remove('dev-drop-target'));
    target?.classList.add('dev-drop-target');
  });
  grid.addEventListener('dragend', () => { dragFrom = null; clearDrag(); });
  grid.addEventListener('drop', async (e) => {
    const target = e.target.closest('.piece');
    if (dragFrom === null || !target) return;
    e.preventDefault();
    const to = Number(target.dataset.i);
    if (to === dragFrom) return;
    const list = pieces.slice();
    list.splice(to, 0, list.splice(dragFrom, 1)[0]);
    try { await saveContent({ pieces: list }); location.reload(); } catch (err) { alert(err.message); }
  });

  /* Profile: text fields plus picture and banner */
  const profileDlg = dialog('dev-profile', 'Profile',
    field('dev-p-name', 'Name') +
    field('dev-p-role', 'Role') +
    field('dev-p-bio', 'Bio', '<textarea id="dev-p-bio" rows="3"></textarea>') +
    field('dev-p-discord', 'Discord username') +
    `<div class="dev-images">
      <div class="dev-field dev-avatar"><span class="dev-label">Picture</span>${dropHTML('dev-p-avatar', 'Change')}</div>
      <div class="dev-field dev-banner"><span class="dev-label">Banner</span>${dropHTML('dev-p-banner', 'Change', 'dev-drop-wide')}</div>
    </div>`,
    'Save',
    (dlg) => {
      const val = (id) => dlg.querySelector(id).value.trim();
      if (!val('#dev-p-name')) return dlg.fail('Your name can\'t be empty.');
      dlg.run(async () => {
        await saveContent({ name: val('#dev-p-name'), role: val('#dev-p-role'), bio: val('#dev-p-bio'), discord: val('#dev-p-discord') });
        if (avatarDrop.get()) await post('/api/asset', { kind: 'avatar', image: avatarDrop.get() });
        if (bannerDrop.get()) await post('/api/asset', { kind: 'banner', image: bannerDrop.get() });
      });
    });
  const avatarDrop = dropZone(profileDlg, profileDlg.querySelector('.dev-avatar'));
  const bannerDrop = dropZone(profileDlg, profileDlg.querySelector('.dev-banner'));
  const v = data.assetVersion ? `?v=${data.assetVersion}` : '';

  function openProfile() {
    for (const k of ['name', 'role', 'bio', 'discord']) profileDlg.querySelector(`#dev-p-${k}`).value = data[k] || '';
    avatarDrop.reset(data.avatar ? data.avatar + v : '');
    bannerDrop.reset(data.banner ? data.banner + v : '');
    profileDlg.begin();
  }
}

// Last, so every helper above is initialised before mount() runs.
const res = await fetch('/api/dev').catch(() => null);
if (res?.ok) mount(await (await fetch('content/portfolio.json')).json());
