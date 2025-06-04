// Use the browser namespace if available, otherwise fall back to chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  var browser = chrome;
}

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
    browser.runtime.sendMessage({action: 'error', message: 'Not on a Newgrounds gallery page.'});
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
  let urls;
  if (browser.scripting && browser.scripting.executeScript) {
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId },
      func: (exts) => Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(h => exts.some(ext => h.toLowerCase().endsWith('.' + ext))),
      args: [extensions]
    });
    urls = [result];
  } else {
    urls = await browser.tabs.executeScript(tabId, { code });
  }
  if (!urls || !urls[0] || urls[0].length === 0) {
    browser.runtime.sendMessage({action: 'error', message: 'No downloadable links found.'});
    return;
  }
  const seen = new Set();
  let downloaded = 0;
  const total = urls[0].length;
  for (const url of urls[0]) {
    if (seen.has(url)) continue;
    seen.add(url);
    const parts = url.split('/');
    const filename = folder + '/' + parts[parts.length - 1];
    await downloadFile(url, filename, cookie);
    downloaded++;
    browser.runtime.sendMessage({action: 'progress', completed: downloaded, total});
    await delay(rateLimitDelay);
  }
  browser.runtime.sendMessage({action: 'finished', total: downloaded});
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
