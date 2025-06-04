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

async function downloadImage(url, filename, cookie) {
  const blob = await fetchWithCookie(url, cookie).then(r => r.blob());
  const objectUrl = URL.createObjectURL(blob);
  await browser.downloads.download({
    url: objectUrl,
    filename,
    saveAs: false
  });
  URL.revokeObjectURL(objectUrl);
}

async function scrapeGallery(tabId, folder, cookie) {
  const tab = await browser.tabs.get(tabId);
  if (!tab || !tab.url.includes('newgrounds.com')) {
    return;
  }
  // Request DOM info from content script
  const urls = await browser.tabs.executeScript(tabId, {
    code: `Array.from(document.querySelectorAll('a[href$=".png"],a[href$=".jpg"],a[href$=".gif"]')).map(a => a.href)`
  });
  if (!urls || !urls[0]) return;
  for (const url of urls[0]) {
    const parts = url.split('/');
    const filename = folder + '/' + parts[parts.length - 1];
    await downloadImage(url, filename, cookie);
    await delay(rateLimitDelay);
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'scrape') {
    browser.storage.local.get(['cookie']).then(result => {
      scrapeGallery(sender.tab.id, message.folder, result.cookie);
    });
  }
});
