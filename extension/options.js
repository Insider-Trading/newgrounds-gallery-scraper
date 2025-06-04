function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', () => {
  const cookieArea = $('cookie');
  browser.storage.local.get('cookie').then(result => {
    if (result.cookie) cookieArea.value = result.cookie;
  });

  $('save').addEventListener('click', () => {
    const cookie = cookieArea.value.trim();
    browser.storage.local.set({ cookie }).then(() => {
      $('msg').textContent = 'Saved.';
    });
  });
});
