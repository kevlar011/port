// Developer-only "Add piece" tool. Loaded by main.js on localhost, and only
// shown when dev.py is running (it answers /api/dev). Never appears on the live site.

const res = await fetch('/api/dev').catch(() => null);
if (res?.ok) mount();

function mount() {
  document.body.insertAdjacentHTML('beforeend', `
    <button class="dev-add" type="button"><i class="ph ph-plus" aria-hidden="true"></i> Add piece</button>
    <dialog class="dev-dialog" aria-labelledby="dev-title">
      <form class="dev-form" method="dialog" novalidate>
        <h2 id="dev-title">Add a piece</h2>
        <label class="dev-drop" for="dev-file">
          <img alt="" hidden>
          <span class="dev-drop-text"><i class="ph ph-image" aria-hidden="true"></i> Choose or drop an image</span>
        </label>
        <input id="dev-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="sr-only">
        <div class="dev-field">
          <label for="dev-name">Title</label>
          <input id="dev-name" autocomplete="off" required>
        </div>
        <p class="dev-error" role="alert"></p>
        <div class="dev-actions">
          <button class="dev-btn dev-cancel" type="button">Cancel</button>
          <button class="dev-btn dev-save" type="submit">Add to portfolio</button>
        </div>
      </form>
    </dialog>`);

  const dlg = document.querySelector('.dev-dialog');
  const form = dlg.querySelector('form');
  const file = dlg.querySelector('#dev-file');
  const name = dlg.querySelector('#dev-name');
  const drop = dlg.querySelector('.dev-drop');
  const preview = drop.querySelector('img');
  const error = dlg.querySelector('.dev-error');
  const save = dlg.querySelector('.dev-save');
  let dataURL = '';

  const reset = () => {
    form.reset(); dataURL = ''; error.textContent = '';
    preview.hidden = true; drop.classList.remove('has-image');
    save.disabled = false; save.textContent = 'Add to portfolio';
  };

  const useFile = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { error.textContent = 'Use a JPG, PNG, WebP or GIF image.'; return; }
    const reader = new FileReader();
    reader.onload = () => {
      dataURL = reader.result;
      preview.src = dataURL; preview.hidden = false; drop.classList.add('has-image');
      error.textContent = '';
      if (!name.value) name.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      name.focus(); name.select();
    };
    reader.readAsDataURL(f);
  };

  document.querySelector('.dev-add').addEventListener('click', () => { reset(); dlg.showModal(); });
  dlg.querySelector('.dev-cancel').addEventListener('click', () => dlg.close());
  file.addEventListener('change', () => useFile(file.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); useFile(e.dataTransfer.files[0]); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dataURL) { error.textContent = 'Pick an image first.'; return; }
    if (!name.value.trim()) { error.textContent = 'Add a title.'; name.focus(); return; }
    save.disabled = true; save.textContent = 'Adding…';
    try {
      const r = await fetch('/api/pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.value.trim(), image: dataURL }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || 'Upload failed.');
      location.reload();
    } catch (err) {
      error.textContent = err.message;
      save.disabled = false; save.textContent = 'Add to portfolio';
    }
  });
}
