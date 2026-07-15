/**
 * Permission Guard Utility
 * Usage: checkModuleAccess('dashboard', initDashboard);
 */

function getDataforceUser() {
  try {
    const saved = window.DataforceAuth
      ? DataforceAuth.getItem('df_user')
      : (localStorage.getItem('df_user') || sessionStorage.getItem('df_user'));
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function showNoAccess(message) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f9;font-family:Inter,Arial,sans-serif;color:#0d1f3c;padding:24px;">
      <div style="max-width:420px;width:100%;background:#fff;border:1px solid #dde0e8;border-radius:8px;padding:28px;text-align:center;box-shadow:0 18px 60px rgba(15,23,42,.08);">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;">No access</h1>
        <p style="margin:0 0 22px;color:#64748b;font-size:14px;line-height:1.5;">${message || 'Your account is not allowed to open this module.'}</p>
        <a href="https://dataforce.gsaforce.com/" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;border-radius:6px;padding:10px 16px;font-size:13px;font-weight:700;">Back to home</a>
      </div>
    </div>
  `;
}

async function checkModuleAccess(moduleName, initFunction) {
  const user = getDataforceUser();
  const email = user && user.email ? user.email : '';

  if (!email) {
    window.location.href = 'https://dataforce.gsaforce.com/';
    return;
  }

  try {
    const base = typeof API_BASE !== 'undefined' ? API_BASE : (typeof API !== 'undefined' ? API : '');
    if (!base) throw new Error('API base not configured');

    const resp = await fetch(`${base}/api/user_modules?email=${encodeURIComponent(email)}`);
    if (!resp.ok) throw new Error('Permission check failed');

    const data = await resp.json();
    if (window.DataforceAuth) {
      DataforceAuth.setItem('df_permissions', JSON.stringify(data));
    } else {
      sessionStorage.setItem('df_permissions', JSON.stringify(data));
    }
    const modules = (data.modules || []).map(m => String(m).toLowerCase().replace(/-/g, '_'));
    const normalized = String(moduleName).toLowerCase().replace(/-/g, '_');

    if (!modules.includes(normalized)) {
      showNoAccess('Your account is signed in, but this module has not been assigned to you.');
      return;
    }

    if (typeof initFunction === 'function') {
      initFunction();
    }
  } catch (e) {
    console.error(`Error checking access to ${moduleName}:`, e);
    showNoAccess('We could not verify your access. Please try again or contact an administrator.');
  }
}
