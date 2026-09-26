// Everything on the page comes from content/portfolio.json.

const $ = (s) => document.querySelector(s);
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let data;
try {
  const r = await fetch('content/portfolio.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status);
  data = await r.json();
} catch (err) {
  $('#grid').innerHTML = `<p class="load-error">${location.protocol === 'file:'
    ? 'Open this through a local server (run <code>python -m http.server</code> in this folder) instead of double-clicking the file.'
    : 'Couldn\'t load content/portfolio.json. Check it for typos.'}</p>`;
  throw err;
}

/* Banner: falls back to a plain gradient until media/banner.jpg exists. */
const banner = $('#banner');
if (data.banner) {
  const img = new Image();
  img.alt = '';
  img.onload = () => banner.append(img);
  img.src = data.banner;
}

/* Profile */
const avatar = $('#avatar');
avatar.textContent = (data.name || '?')[0].toUpperCase();
if (data.avatar) {
  const img = new Image();
  img.alt = data.name;
  img.onload = () => { avatar.textContent = ''; avatar.append(img); };
  img.src = data.avatar;
}
$('#name').textContent = data.name;
$('#role').textContent = data.role || '';
$('#bio').textContent = data.bio || '';
$('#footer').textContent = `\u00A9 ${new Date().getFullYear()} ${data.name}`;

/* Contact block, shown in the profile and again under the gallery. */
document.querySelectorAll('.contact').forEach((box) => {
  box.innerHTML = `
    <p class="contact-title">Have a model in mind? <span>Write to me.</span></p>
    <button class="discord" type="button" aria-label="Copy Discord username ${esc(data.discord)}">
      <i class="ph-fill ph-discord-logo" aria-hidden="true"></i>
      <span class="handle">${esc(data.discord)}</span>
      <span class="copy"><i class="ph ph-copy" aria-hidden="true"></i> Copy</span>
    </button>`;
  box.querySelector('.discord').addEventListener('click', async (e) => {
    const label = e.currentTarget.querySelector('.copy');
    try {
      await navigator.clipboard.writeText(data.discord);
      label.innerHTML = '<i class="ph ph-check" aria-hidden="true"></i> Copied';
    } catch {
      prompt('Copy my Discord username', data.discord);
    }
    setTimeout(() => (label.innerHTML = '<i class="ph ph-copy" aria-hidden="true"></i> Copy'), 1800);
  });
});

/* Gallery */
const pieces = data.pieces || [];
const grid = $('#grid');
grid.innerHTML = pieces.length
  ? pieces.map((p, i) => `
      <button class="piece" type="button" data-i="${i}" style="--i:${i}" aria-label="View ${esc(p.title)}">
        <span class="frame"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async"></span>
        <span class="title">${esc(p.title)}</span>
      </button>`).join('')
  : '<p class="load-error">No pieces yet. Add some to content/portfolio.json.</p>';
grid.classList.add('enter');
$('#count').textContent = String(pieces.length).padStart(2, '0');

grid.querySelectorAll('img').forEach((img) => {
  const done = () => img.classList.add('loaded');
  if (img.complete && img.naturalWidth) done();
  else img.addEventListener('load', done, { once: true });
});

/* Viewer: one picture and its title. */
const viewer = $('#viewer');
const vImg = viewer.querySelector('img');
const vCap = viewer.querySelector('figcaption');
let current = 0;

function show(i) {
  current = (i + pieces.length) % pieces.length;
  vImg.src = pieces[current].image;
  vImg.alt = pieces[current].title;
  vCap.textContent = pieces[current].title;
}

grid.addEventListener('click', (e) => {
  const piece = e.target.closest('.piece');
  if (!piece) return;
  show(Number(piece.dataset.i));
  viewer.showModal();
});
viewer.querySelector('.close').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') show(current + 1);
  if (e.key === 'ArrowLeft') show(current - 1);
});

/* Developer upload tool: only ever loaded on your own machine. */
if (['localhost', '127.0.0.1'].includes(location.hostname)) import('./dev.js');
