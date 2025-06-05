if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  var browser = chrome;
}

function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', () => {
  const cookieArea = $('cookie');
  const typeImages = $('type-images');
  const typeGifs = $('type-gifs');
  const typeVideos = $('type-videos');
  browser.storage.local.get(['cookie', 'fileTypes']).then(result => {
    if (result.cookie) cookieArea.value = result.cookie;
    const types = Object.assign({images:true, gifs:true, videos:false}, result.fileTypes);
    typeImages.checked = !!types.images;
    typeGifs.checked = !!types.gifs;
    typeVideos.checked = !!types.videos;
  });

  $('save').addEventListener('click', async () => {
    const cookieText = cookieArea.value.trim();
    const fileTypes = {
      images: typeImages.checked,
      gifs: typeGifs.checked,
      videos: typeVideos.checked
    };
    await browser.storage.local.set({ cookie: cookieText, fileTypes });
    try {
      const cookies = JSON.parse(cookieText);
      if (Array.isArray(cookies)) {
        for (const c of cookies) {
          if (!c.name || !c.value || !c.domain) continue;
          const urlDomain = c.domain.replace(/^\./, '');
          const url = `https://${urlDomain}${c.path || '/'}`;
          await browser.cookies.set({
            url,
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            expirationDate: c.expirationDate
          });
        }
      }
    } catch (e) {
      console.error('Invalid cookie JSON', e);
    }
    $('msg').textContent = 'Saved.';
  });
});
