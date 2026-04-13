/**
 * Storage utilities - Settings and cache management
 */

// Default settings
const DEFAULT_SETTINGS = {
  autoLock: false,
  autoLockTime: 5,
  cacheKeys: false
};

/**
 * Load settings from localStorage
 * @returns {object}
 */
export function loadSettings() {
  const saved = localStorage.getItem('void_settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage
 * @param {object} settings 
 */
export function saveSettings(settings) {
  localStorage.setItem('void_settings', JSON.stringify(settings));
}

/**
 * Load cached identity from localStorage
 * @returns {object|null}
 */
export function loadCachedIdentity() {
  const cached = localStorage.getItem('void_cached_identity');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      localStorage.removeItem('void_cached_identity');
      return null;
    }
  }
  return null;
}

/**
 * Save identity to cache
 * @param {object} identity 
 */
export function saveCachedIdentity(identity) {
  if (identity) {
    localStorage.setItem('void_cached_identity', JSON.stringify(identity));
  }
}

/**
 * Clear cached identity
 */
export function clearCachedIdentity() {
  localStorage.removeItem('void_cached_identity');
}

/**
 * Save text to clipboard
 * @param {string} text 
 */
export async function safeCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

/**
 * Download JSON file
 * @param {object} data 
 */
export function downloadJson(data) {
  const jsonString = JSON.stringify(data, null, 2);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString);
  
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `void_identity_${data.email.replace('@', '_at_')}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Download text file
 * @param {string} content 
 * @param {string} filename 
 */
export function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}