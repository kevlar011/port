# kevlar_011 portfolio

One page: banner, square gallery, profile bar with Discord contact. Hosted free on GitHub Pages.

## Editing

Everything is in `content/portfolio.json`.

- **Profile picture**: save it as `media/pfp.jpg` (square, about 400x400).
- **Banner**: save it as `media/banner.jpg` (wide, about 2400x500).
- **Add a piece**: put the image in `media/` and add a line to `pieces`:

```json
{ "title": "My Robot", "image": "media/my-robot.jpg" }
```

Pieces show in the order they're listed. Square images look best (they get cropped to squares in the grid, but open uncropped when clicked). Keep each image under ~2 MB.

The placeholder photos (picsum.photos links) are samples. Replace them with your work.

## Adding new work (the easy way)

In this folder run:

```bash
python dev.py
```

Open http://localhost:8765. An **Add piece** button appears in the bottom-right corner (only on your computer, never on the live site). Drop in an image, type a title, click **Add to portfolio**. It lands at the top of the grid.

Then publish: open GitHub Desktop, commit, and push. The live site updates in about a minute.

To remove or reorder pieces, edit the `pieces` list in `content/portfolio.json`.

## Publish on GitHub Pages

1. GitHub Desktop: **File > Add local repository** > pick this folder > create repository > **Publish repository** (public).
2. On github.com: repo **Settings > Pages** > Deploy from a branch > `main`, `/ (root)` > Save.
3. It's live at `https://<username>.github.io/<repo>/` after a minute.

## Custom domain

1. Buy a domain (Cloudflare, Porkbun or Namecheap).
2. **Settings > Pages > Custom domain**: enter it and save. Then pull in GitHub Desktop (GitHub adds a `CNAME` file).
3. At your registrar add these DNS records:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<username>.github.io` |

4. Once it resolves, tick **Enforce HTTPS**.
