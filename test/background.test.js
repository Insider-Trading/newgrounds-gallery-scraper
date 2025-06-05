const {delay, fetchWithCookie} = require('../extension/background');

describe('delay function', () => {
  test('resolves after given milliseconds', async () => {
    const start = Date.now();
    await delay(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(100);
  });
});

describe('fetchWithCookie', () => {
  test('uses fetch with credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({status: 200});
    await fetchWithCookie('http://example.com');
    expect(global.fetch).toHaveBeenCalledWith('http://example.com', {
      credentials: 'include'
    });
  });

  test('uses XMLHttpRequest when available', async () => {
    const open = jest.fn();
    const send = jest.fn(function() {
      this.status = 200;
      this.statusText = 'OK';
      this.response = 'data';
      if (this.onload) this.onload();
    });
    function FakeXHR() {
      this.open = open;
      this.send = send;
    }
    const xhrInstance = new FakeXHR();
    global.XMLHttpRequest = jest.fn(() => xhrInstance);
    global.fetch = jest.fn();

    const res = await fetchWithCookie('http://example.com/resource');

    expect(global.XMLHttpRequest).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('GET', 'http://example.com/resource', true);
    expect(xhrInstance.responseType).toBe('blob');
    expect(xhrInstance.withCredentials).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.status).toBe(200);

    delete global.XMLHttpRequest;
  });
});
