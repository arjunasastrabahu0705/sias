// api.js
async function apiPost(url, body) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    return await resp.json();
  } catch (err) {
    return { ok:false, error: String(err) };
  }
}

async function callApi(action, payload) {
  const url = window.SIAS_WEBAPP || '';
  const token = sessionStorage.getItem('token');
  const body = Object.assign({ action: action }, payload || {});
  if (token) body.token = token;
  const res = await apiPost(url, body);
  return res;
}