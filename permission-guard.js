/**
 * Permission Guard Utility
 * Checks if a user has access to a specific module and redirects if not.
 * 
 * Usage:
 *   checkModuleAccess('dashboard', initDashboard);
 *   checkModuleAccess('booked', loadBookedData);
 */

async function checkModuleAccess(moduleName, initFunction) {
  try {
    const email = localStorage.getItem('userEmail');
    if (!email) {
      // Not logged in, redirect to home
      window.location.href = './index.html';
      return;
    }
    
    // Check if API_BASE is available
    if (typeof API_BASE === 'undefined' || !API_BASE) {
      // Demo mode or API not available, allow access
      if (initFunction && typeof initFunction === 'function') {
        initFunction();
      }
      return;
    }
    
    const resp = await fetch(`${API_BASE}/api/user_modules?email=${encodeURIComponent(email)}`);
    const data = await resp.json();
    const modules = data.modules || [];
    
    if (!modules.includes(moduleName)) {
      // No access to this module, redirect to home
      window.location.href = './index.html';
      return;
    }
    
    // User has access, load module
    if (initFunction && typeof initFunction === 'function') {
      initFunction();
    }
  } catch (e) {
    console.error(`Error checking access to ${moduleName}:`, e);
    // On error, still allow loading (fallback to prevent lockout)
    if (initFunction && typeof initFunction === 'function') {
      initFunction();
    }
  }
}
