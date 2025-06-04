function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', () => {
  const folderInput = $('folder');
  // load saved folder
  browser.storage.local.get('folder').then(result => {
    if (result.folder) folderInput.value = result.folder;
  });

  $('scrape').addEventListener('click', () => {
    const folder = folderInput.value.trim();
    browser.storage.local.set({ folder });
    browser.runtime.sendMessage({ action: 'scrape', folder });
    $('status').textContent = 'Scraping started...';
  });
});
