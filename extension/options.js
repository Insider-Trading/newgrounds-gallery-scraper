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

  $('save').addEventListener('click', () => {
    const cookie = cookieArea.value.trim();
    const fileTypes = {
      images: typeImages.checked,
      gifs: typeGifs.checked,
      videos: typeVideos.checked
    };
    browser.storage.local.set({ cookie, fileTypes }).then(() => {
      $('msg').textContent = 'Saved.';
    });
  });
});
