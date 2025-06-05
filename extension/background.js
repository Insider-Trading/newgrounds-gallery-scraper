// Use the browser namespace if available, otherwise fall back to chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  var browser = chrome;
}

// Ensure Newgrounds accepts our requests by spoofing the Origin header
if (typeof browser !== 'undefined' &&
    browser.webRequest && browser.webRequest.onBeforeSendHeaders) {
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      const headers = details.requestHeaders || [];
      let found = false;
      for (const h of headers) {
        if (h.name.toLowerCase() === 'origin') {
          h.value = 'https://www.newgrounds.com';
          found = true;
          break;
        }
      }
      if (!found) {
        headers.push({ name: 'Origin', value: 'https://www.newgrounds.com' });
      }
      return { requestHeaders: headers };
    },
    { urls: ['https://*.newgrounds.com/*', 'https://*.ngfiles.com/*'] },
    ['blocking', 'requestHeaders', 'extraHeaders']
  );

  browser.webRequest.onHeadersReceived.addListener(
    details => {
      const headers = details.responseHeaders || [];
      let found = false;
      for (const h of headers) {
        const name = h.name.toLowerCase();
        if (name === 'access-control-allow-origin') {
          h.value = '*';
          found = true;
        }
        if (name === 'access-control-allow-credentials') {
          h.value = 'true';
        }
      }
      if (!found) {
        headers.push({ name: 'Access-Control-Allow-Origin', value: '*' });
      }
      return { responseHeaders: headers };
    },
    { urls: ['https://*.newgrounds.com/*', 'https://*.ngfiles.com/*'] },
    ['blocking', 'responseHeaders', 'extraHeaders']
  );
}

let rateLimitDelay = 1000; // start with 1 second between requests

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithCookie(url) {
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.withCredentials = true;
      xhr.onload = async () => {
        if (xhr.status === 429) {
          rateLimitDelay = Math.min(rateLimitDelay + 500, 5000);
          await delay(rateLimitDelay);
          resolve(fetchWithCookie(url));
          return;
        }
        rateLimitDelay = Math.max(1000, rateLimitDelay - 100);
        resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
      };
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.send();
    });
  }
  const response = await fetch(url, { credentials: 'include' });
  if (response.status === 429) { // rate limited
    rateLimitDelay = Math.min(rateLimitDelay + 500, 5000);
    await delay(rateLimitDelay);
    return fetchWithCookie(url);
  } else {
    rateLimitDelay = Math.max(1000, rateLimitDelay - 100);
    return response;
  }
}

async function downloadFile(url, filename) {
  const blob = await fetchWithCookie(url).then(r => r.blob());
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
    // Fallback: get art page links and extract asset URLs
    const pageCode = `Array.from(document.querySelectorAll('a')).map(a=>a.href).filter(h=>/\/art\/view\//.test(h))`;
    let pageUrls;
    if (browser.scripting && browser.scripting.executeScript) {
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId },
        func: () => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => /\/art\/view\//.test(h))
      });
      pageUrls = [result];
    } else {
      pageUrls = await browser.tabs.executeScript(tabId, { code: pageCode });
    }
    if (!pageUrls || !pageUrls[0] || pageUrls[0].length === 0) {
      browser.runtime.sendMessage({action: 'error', message: 'No downloadable links found.'});
      return;
    }
    const assetUrls = [];
    for (const link of pageUrls[0]) {
      try {
        const html = await fetchWithCookie(link).then(r => r.text());
        const m = html.match(/<meta[^>]+property="og:(?:image|video)"[^>]+content="([^"]+)"/i);
        if (m && extensions.some(ext => m[1].toLowerCase().includes('.' + ext))) {
          assetUrls.push(m[1]);
        }
      } catch(e) {
        // ignore
      }
    }
    if (assetUrls.length === 0) {
      browser.runtime.sendMessage({action: 'error', message: 'No downloadable links found.'});
      return;
    }
    urls = [assetUrls];
  }
  const seen = new Set();
  let downloaded = 0;
  const total = urls[0].length;
  for (const url of urls[0]) {
    if (seen.has(url)) continue;
    seen.add(url);
    const parts = url.split('/');
    const filename = folder + '/' + parts[parts.length - 1];
    await downloadFile(url, filename);
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
        const tabPromise = sender.tab ?
          Promise.resolve(sender.tab) :
          browser.tabs.query({active: true, currentWindow: true}).then(tabs => tabs[0]);
        tabPromise.then(tab => {
          if (tab) {
            scrapeGallery(tab.id, message.folder, result.cookie, result.fileTypes || {});
          } else {
            browser.runtime.sendMessage({action: 'error', message: 'No active tab found.'});
          }
        });
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
