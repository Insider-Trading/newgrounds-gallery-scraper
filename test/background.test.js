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
  test('sends cookie header when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({status: 200});
    await fetchWithCookie('http://example.com', 'foo=bar');
    expect(global.fetch).toHaveBeenCalledWith('http://example.com', {
      credentials: 'include',
      headers: { Cookie: 'foo=bar' }
    });
  });
});
