let rateLimitDelay = 1000; // start with 1 second between requests

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithCookie(url, cookie) {
  const headers = {};
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  const response = await fetch(url, { credentials: 'include', headers });
  if (response.status === 429) { // rate limited
    rateLimitDelay = Math.min(rateLimitDelay + 500, 5000);
    await delay(rateLimitDelay);
    return fetchWithCookie(url, cookie);
  } else {
    rateLimitDelay = Math.max(1000, rateLimitDelay - 100);
    return response;
  }
}

async function downloadFile(url, filename, cookie) {
  const blob = await fetchWithCookie(url, cookie).then(r => r.blob());
  const objectUrl = URL.createObjectURL(blob);
  await browser.downloads.download({
    url: objectUrl,
    filename,
    saveAs: false
  });
  URL.revokeObjectURL(objectUrl);
}

async function scrapeGallery(tabId, folder, cookie, fileTypes) {
  const tab = await browser.tabs.get(tabId);
  if (!tab || !tab.url.includes('newgrounds.com')) {
    return;
  }
  const extensions = [];
  if (fileTypes && fileTypes.images !== false) {
    extensions.push('png','jpg','jpeg');
  }
  if (fileTypes && fileTypes.gifs) {
    extensions.push('gif');
  }
  if (fileTypes && fileTypes.videos) {
    extensions.push('mp4','webm');
  }
  const code = `Array.from(document.querySelectorAll('a')).map(a=>a.href).filter(h=>${JSON.stringify(extensions)}.some(ext=>h.toLowerCase().endsWith('.'+ext)))`;
  const urls = await browser.tabs.executeScript(tabId, { code });
  if (!urls || !urls[0]) return;
  const seen = new Set();
  for (const url of urls[0]) {
    if (seen.has(url)) continue;
    seen.add(url);
    const parts = url.split('/');
    const filename = folder + '/' + parts[parts.length - 1];
    await downloadFile(url, filename, cookie);
    await delay(rateLimitDelay);
  }
}


if (typeof browser !== 'undefined' &&
    browser.runtime &&
    browser.runtime.onMessage &&
    typeof browser.runtime.onMessage.addListener === 'function') {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'scrape') {
      browser.storage.local.get(['cookie','fileTypes']).then(result => {
        scrapeGallery(sender.tab.id, message.folder, result.cookie, result.fileTypes || {});
      });
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    delay,
    fetchWithCookie,
    downloadFile,
    scrapeGallery
  };
}
