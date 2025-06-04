if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  var browser = chrome;
}

function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', () => {
  const folderInput = $('folder');
  const status = $('status');
  const progress = $('progress');
  // load saved folder
  browser.storage.local.get('folder').then(result => {
    if (result.folder) folderInput.value = result.folder;
  });

  $('scrape').addEventListener('click', () => {
    const folder = folderInput.value.trim();
    browser.storage.local.set({ folder });
    progress.value = 0;
    progress.max = 0;
    progress.style.display = 'block';
    browser.runtime.sendMessage({ action: 'scrape', folder });
    status.textContent = 'Scraping started...';
  });

  browser.runtime.onMessage.addListener(msg => {
    if (msg.action === 'progress') {
      progress.max = msg.total;
      progress.value = msg.completed;
      status.textContent = `Downloaded ${msg.completed}/${msg.total}`;
    } else if (msg.action === 'finished') {
      progress.max = msg.total;
      progress.value = msg.total;
      status.textContent = `Finished downloading ${msg.total} files.`;
    } else if (msg.action === 'error') {
      status.textContent = msg.message;
    }
  });
});
