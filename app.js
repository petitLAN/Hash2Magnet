'use strict';

const CONFIG = Object.freeze({
  base32Alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  messages: {
    emptyMagnet: 'Paste a hash above…',
    invalidMagnet: 'Invalid hash',
    waitingType: 'Waiting for input',
    invalidType: 'Not recognized',
    helper: 'Use the copy icon to copy the magnet link, or the external-link icon to open it in your torrent app.',
    invalid: 'Use a 40-character hex info-hash, 32-character base32 hash, or a magnet:? link.',
    copied: 'Copied magnet link to clipboard.',
    copyFailed: 'Could not copy automatically. Select the magnet text and copy it manually.',
    opened: 'Your browser should ask whether to open the magnet link in an external app.',
    torrentCache: 'Opening a public torrent-cache URL. This only works when that cache has metadata for this hash.'
  },
  selectors: {
    input: '#hashInput',
    magnetText: '#magnetText',
    copyButton: '#copyButton',
    openButton: '#openButton',
    downloadButton: '#downloadButton',
    status: '#status',
    hashType: '#hashType'
  },
  torrentCacheUrl(hexHash) {
    return `https://itorrents.org/torrent/${hexHash.toUpperCase()}.torrent`;
  }
});

const HASH_PATTERNS = Object.freeze({
  hexV1: /^[a-f0-9]{40}$/i,
  base32V1: /^[a-z2-7]{32}$/i,
  btihXt: /^urn:btih:([a-f0-9]{40}|[a-z2-7]{32})$/i
});

const dom = getDomElements(CONFIG.selectors);
const state = createInitialState();

function getDomElements(selectors) {
  return Object.fromEntries(
    Object.entries(selectors).map(([name, selector]) => [name, document.querySelector(selector)])
  );
}

function createInitialState() {
  return {
    magnet: '',
    hexHash: '',
    torrentUrl: '',
    valid: false,
    canDownloadTorrent: false
  };
}

function cleanHashInput(value) {
  return value
    .trim()
    .replace(/^urn:btih:/i, '')
    .replace(/^btih:/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

function base32ToHex(base32) {
  let bits = '';
  let hex = '';

  for (const character of base32.toUpperCase()) {
    const value = CONFIG.base32Alphabet.indexOf(character);
    if (value === -1) return '';
    bits += value.toString(2).padStart(5, '0');
  }

  for (let index = 0; index + 4 <= bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }

  return hex.slice(0, 40).toLowerCase();
}

function getHexFromBtih(hash) {
  return HASH_PATTERNS.hexV1.test(hash) ? hash.toLowerCase() : base32ToHex(hash);
}

function parseMagnetLink(rawValue) {
  const params = new URLSearchParams(rawValue.slice('magnet:?'.length));
  const btihXt = params.getAll('xt').find((xtValue) => HASH_PATTERNS.btihXt.test(xtValue));
  const btihHash = btihXt?.match(HASH_PATTERNS.btihXt)?.[1] ?? '';
  const hexHash = btihHash ? getHexFromBtih(btihHash) : '';

  return {
    valid: true,
    magnet: rawValue,
    hexHash,
    label: 'Existing magnet link',
    canDownloadTorrent: Boolean(hexHash)
  };
}

function parseHash(rawValue) {
  const raw = rawValue.trim();

  if (!raw) {
    return { valid: false, reason: 'empty' };
  }

  if (raw.toLowerCase().startsWith('magnet:?')) {
    return parseMagnetLink(raw);
  }

  const cleaned = cleanHashInput(raw);

  if (HASH_PATTERNS.hexV1.test(cleaned)) {
    const hexHash = cleaned.toLowerCase();
    return {
      valid: true,
      magnet: `magnet:?xt=urn:btih:${hexHash}`,
      hexHash,
      label: 'BitTorrent v1 hex hash',
      canDownloadTorrent: true
    };
  }

  if (HASH_PATTERNS.base32V1.test(cleaned)) {
    return {
      valid: true,
      magnet: `magnet:?xt=urn:btih:${cleaned.toUpperCase()}`,
      hexHash: base32ToHex(cleaned),
      label: 'BitTorrent v1 base32 hash',
      canDownloadTorrent: true
    };
  }

  return { valid: false, reason: 'invalid' };
}

function updateState(parsedHash) {
  state.valid = parsedHash.valid;
  state.magnet = parsedHash.magnet ?? '';
  state.hexHash = parsedHash.hexHash ?? '';
  state.canDownloadTorrent = Boolean(parsedHash.canDownloadTorrent && parsedHash.hexHash);
  state.torrentUrl = state.canDownloadTorrent ? CONFIG.torrentCacheUrl(state.hexHash) : '';
}

function setStatus(message, type = '') {
  dom.status.textContent = message;
  dom.status.className = type ? `status status--${type}` : 'status';
}

function setButtonsEnabled({ copy, open, download }) {
  dom.copyButton.disabled = !copy;
  dom.openButton.disabled = !open;
  dom.downloadButton.disabled = !download;
}

function renderEmptyState() {
  dom.magnetText.textContent = CONFIG.messages.emptyMagnet;
  dom.hashType.textContent = CONFIG.messages.waitingType;
  setButtonsEnabled({ copy: false, open: false, download: false });
  setStatus('');
}

function renderInvalidState() {
  dom.magnetText.textContent = CONFIG.messages.invalidMagnet;
  dom.hashType.textContent = CONFIG.messages.invalidType;
  setButtonsEnabled({ copy: false, open: false, download: false });
  setStatus(CONFIG.messages.invalid, 'error');
}

function renderValidState(parsedHash) {
  dom.magnetText.textContent = state.magnet;
  dom.hashType.textContent = parsedHash.label;
  setButtonsEnabled({ copy: true, open: true, download: state.canDownloadTorrent });
  setStatus(CONFIG.messages.helper);
}

function render(parsedHash) {
  updateState(parsedHash);

  if (parsedHash.reason === 'empty') {
    renderEmptyState();
    return;
  }

  if (!parsedHash.valid) {
    renderInvalidState();
    return;
  }

  renderValidState(parsedHash);
}

function updateFromInput() {
  render(parseHash(dom.input.value));
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  copyUsingTemporaryTextarea(text);
}

function copyUsingTemporaryTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function handleCopyClick() {
  if (!state.valid) return;

  try {
    await copyToClipboard(state.magnet);
    setStatus(CONFIG.messages.copied, 'ok');
  } catch (_error) {
    setStatus(CONFIG.messages.copyFailed, 'error');
  }
}

function handleOpenClick() {
  if (!state.valid) return;

  window.location.href = state.magnet;
  setStatus(CONFIG.messages.opened, 'ok');
}

function handleDownloadClick() {
  if (!state.canDownloadTorrent) return;

  const link = document.createElement('a');
  link.href = state.torrentUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = `${state.hexHash.toUpperCase()}.torrent`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setStatus(CONFIG.messages.torrentCache, 'ok');
}

function bindEvents() {
  dom.input.addEventListener('input', updateFromInput);
  dom.copyButton.addEventListener('click', handleCopyClick);
  dom.openButton.addEventListener('click', handleOpenClick);
  dom.downloadButton.addEventListener('click', handleDownloadClick);
}

bindEvents();
updateFromInput();
