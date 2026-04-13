<script>
  export const ssr = false;
  
  // Icons
  import { Shield, Download, Lock, User, LockOpen, BookOpen, LogOut, FileSignature, Settings, Upload, CheckCircle, FileKey, Menu, X, Github } from 'lucide-svelte';
  
  // Utilities
  import { 
    generateKeyPair, 
    unlockPrivateKey, 
    encryptMessage, 
    decryptMessage, 
    signMessage, 
    verifySignature,
    extractKeyInfo,
    getPublicKeyFromPrivate,
    loadSettings, 
    saveSettings, 
    loadCachedIdentity, 
    saveCachedIdentity, 
    clearCachedIdentity,
    safeCopy,
    downloadJson,
    downloadFile
  } from '$lib';
  
  import { onMount, onDestroy } from 'svelte';

  // --- Tab Management ---
  let activeTab = 'create';
  let sidebarOpen = false;
  let tabLoaded = false;
  
  // Restore activeTab from localStorage on mount
  onMount(() => {
    const saved = localStorage.getItem('void_activeTab');
    if (saved) {
      activeTab = saved;
      // Focus first input for restored tab
      setTimeout(() => focusFirstInput(saved), 100);
    }
    tabLoaded = true;
    
    // Save activeTab to localStorage on change
    window.addEventListener('storage', (e) => {
      if (e.key === 'void_activeTab' && e.newValue) {
        activeTab = e.newValue;
        setTimeout(() => focusFirstInput(e.newValue), 100);
      }
    });
  });
  
  function focusFirstInput(tab) {
    if (tab === 'create') {
      document.getElementById('input-name')?.focus();
    } else if (tab === 'unlock' && uploadedFile) {
      document.getElementById('input-unlock')?.focus();
    } else if (tab === 'encrypt') {
      document.getElementById('encrypt-pubkey')?.focus();
    } else if (tab === 'sign') {
      // If unlocked, focus Sign message; otherwise focus Verify section
      if (unlockedPrivateKey) {
        document.getElementById('sign-msg')?.focus();
      } else {
        document.getElementById('verify-msg')?.focus();
      }
    }
  }
  
  function setActiveTab(tab) {
    activeTab = tab;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('void_activeTab', tab);
    }
    // Focus first input field for the tab
    setTimeout(() => focusFirstInput(tab), 50);
  }

  // --- Creation ---
  let name = '';
  let email = '';
  let passphrase = '';
  let lastGeneratedPass = '';
  let loading = false;
  let error = '';
  let identityObject = null;

  // --- Unlock ---
  let uploadedFile = null;
  let isUserLoggedIn = false;
  let unlockPassphrase = '';
  let unlocking = false;
  let unlockError = '';
  let unlockedPrivateKey = null;
  let userDisplayName = '';
  let messageToDecrypt = '';
  let decryptedOutput = '';

  // --- Encrypt ---
  let recipientPublicKey = '';
  let messageToEncrypt = '';
  let encryptedOutput = '';

  // --- Sign & Verify ---
  let messageToSign = '';
  let signatureOutput = '';
  let verifyOriginalMessage = '';
  let verifySigInput = '';
  let verifyPubKeyInput = '';
  let verifyResult = '';

  // --- Settings ---
  let settings = {
    autoLock: false,
    autoLockTime: 5,
    cacheKeys: false,
  };
  
  let idleTimer = null;
  let isCached = false;
  let isListenerActive = false;

  // Load on startup
  onMount(() => {
    settings = loadSettings();
    checkCache();
    setupIdleTimer();
  });
  
  onDestroy(() => {
    removeIdleTimer();
  });

  // --- Generation ---
  async function handleGenerate() {
    error = '';
    if (!name || !email || !passphrase) {
      error = 'Please fill in all fields.';
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      error = 'Invalid email format. Must be like: john@void.com';
      return;
    }
    
    loading = true;
    try {
      const keys = await generateKeyPair(name, email, passphrase);
      identityObject = {
        name: name,
        email: email,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        created: new Date().toISOString()
      };
      lastGeneratedPass = passphrase;
      loading = false;
    } catch (err) {
      console.error(err);
      error = 'Error generating keys. Try again.';
      loading = false;
    }
  }

  function downloadIdentity() {
    const data = identityObject || uploadedFile;
    if (!data) return;
    downloadJson(data);
  }

  // --- File Upload ---
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      try {
        // JSON format
        if (file.name.toLowerCase().endsWith('.json')) {
          uploadedFile = JSON.parse(content);
        } 
        // ASC/PEM format
        else if (file.name.toLowerCase().endsWith('.asc') || file.name.toLowerCase().endsWith('.pem')) {
          const { name, email } = await extractKeyInfo(content);
          const publicKeyArmor = await getPublicKeyFromPrivate(content);
          uploadedFile = {
            name: name,
            email: email,
            privateKey: content,
            publicKey: publicKeyArmor
          };
        } else {
          throw new Error('Unsupported file format.');
        }
        unlockError = '';
      } catch (err) {
        console.error(err);
        unlockError = 'Invalid file format or corrupted key.';
        uploadedFile = null;
      }
    };
    reader.readAsText(file);
  }

  // --- Unlock ---
  async function handleUnlock() {
    unlocking = true;
    unlockError = '';
    try {
      unlockedPrivateKey = await unlockPrivateKey(uploadedFile.privateKey, unlockPassphrase);
      userDisplayName = uploadedFile.name;
      saveCachedIdentity(uploadedFile);
      isUserLoggedIn = true;
      resetIdleTimer();
    } catch (err) {
      console.error(err);
      unlockError = 'Incorrect passphrase or invalid file.';
      unlockedPrivateKey = null;
    } finally {
      unlocking = false;
    }
  }

  // --- Decrypt ---
  async function handleDecrypt() {
    if (!messageToDecrypt || !unlockedPrivateKey) return;
    try {
      decryptedOutput = await decryptMessage(messageToDecrypt.trim(), unlockedPrivateKey);
    } catch (err) {
      console.error(err);
      let errMsg = 'Decryption Failed: ';
      if (err.message.includes('Invalid armored message')) {
        errMsg += 'Invalid PGP message format.';
      } else if (err.message.includes('Session key decryption failed')) {
        errMsg += 'Wrong password or key.';
      } else {
        errMsg += err.message;
      }
      decryptedOutput = errMsg;
    }
  }

  // --- Encrypt ---
  async function handleEncrypt() {
    if (!messageToEncrypt || !recipientPublicKey) return;
    try {
      encryptedOutput = await encryptMessage(messageToEncrypt, recipientPublicKey);
    } catch (err) {
      console.error(err);
      encryptedOutput = 'Error: Invalid public key or message.';
    }
  }

  // --- Sign ---
  async function handleSign() {
    if (!messageToSign || !unlockedPrivateKey) {
      signatureOutput = 'Error: Please unlock your identity first.';
      return;
    }
    try {
      signatureOutput = await signMessage(messageToSign, unlockedPrivateKey);
    } catch (err) {
      console.error(err);
      signatureOutput = 'Error signing message.';
    }
  }

  // --- Verify ---
  async function handleVerify() {
    verifyResult = 'Verifying...';
    if (!verifySigInput || !verifyPubKeyInput) {
      verifyResult = 'Missing inputs. Provide signature and public key.';
      return;
    }
    try {
      const { isValid, data, author } = await verifySignature(verifySigInput, verifyPubKeyInput);
      if (!isValid) {
        verifyResult = 'INVALID SIGNATURE';
        return;
      }
      let output = 'VALID SIGNATURE\n\n';
      output += 'Authored by: ' + author + '\n\n';
      if (verifyOriginalMessage && verifyOriginalMessage.trim() !== '') {
        if (verifyOriginalMessage.trim() !== data) {
          output += 'WARNING: Text does not match signed content.\n\n';
        } else {
          output += 'Text matches signed content.\n\n';
        }
      }
      output += 'Content:\n' + data;
      verifyResult = output;
    } catch (err) {
      console.error(err);
      verifyResult = 'Verification Error: ' + err.message;
    }
  }

  // --- Downloads ---
  function downloadPrivateASC() {
    const data = identityObject || uploadedFile;
    if (!data) return;
    downloadFile(data.privateKey, `private_key_${data.email.replace('@', '_at_')}.asc`);
  }

  function downloadPublicASC() {
    const data = identityObject || uploadedFile;
    if (!data) return;
    downloadFile(data.publicKey, `public_key_${data.email.replace('@', '_at_')}.asc`);
  }

  function downloadAllASC() {
    const data = identityObject || uploadedFile;
    if (!data) return;
    downloadPrivateASC();
    setTimeout(() => downloadPublicASC(), 200);
  }

  // --- Logout ---
  function handleLogout() {
    unlockedPrivateKey = null;
    unlockPassphrase = '';
    userDisplayName = '';
    messageToDecrypt = '';
    decryptedOutput = '';
    isUserLoggedIn = false;
    lastGeneratedPass = '';
  }

  // --- Settings Logic ---
  function handleSaveSettings() {
    saveSettings(settings);
    removeIdleTimer();
    setupIdleTimer();
    if (settings.autoLock && unlockedPrivateKey) {
      resetIdleTimer();
    }
  }

  // --- Cache Logic ---
  function checkCache() {
    if (settings.cacheKeys) {
      const cached = loadCachedIdentity();
      if (cached) {
        uploadedFile = cached;
        isCached = true;
      }
    }
  }

  // --- Auto-Lock ---
  function resetIdleTimer() {
    if (!isUserLoggedIn || typeof window === 'undefined' || !settings.autoLock) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(handleAutoLock, settings.autoLockTime * 60 * 1000);
  }

  function setupIdleTimer() {
    if (typeof window !== 'undefined' && settings.autoLock && !isListenerActive) {
      window.addEventListener('mousemove', resetIdleTimer);
      window.addEventListener('keypress', resetIdleTimer);
      isListenerActive = true;
    }
  }

  function handleAutoLock() {
    unlockedPrivateKey = null;
    unlockPassphrase = '';
    isUserLoggedIn = false;
    removeIdleTimer();
  }

  function removeIdleTimer() {
    if (typeof window !== 'undefined') {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      isListenerActive = false;
    }
  }

  // --- Clear Cache ---
  function clearCache() {
    if (confirm('Clear cached identity?')) {
      clearCachedIdentity();
      uploadedFile = null;
      isCached = false;
      unlockedPrivateKey = null;
    }
  }

  function handleCacheToggle(e) {
    if (!e.target.checked) {
      if (confirm('Disable cache and clear keys?')) {
        settings.cacheKeys = false;
        clearCachedIdentity();
        handleSaveSettings();
        uploadedFile = null;
        isCached = false;
        if (unlockedPrivateKey) handleLogout();
      } else {
        e.preventDefault();
        e.target.checked = true;
      }
    } else {
      settings.cacheKeys = true;
      handleSaveSettings();
      if (uploadedFile) {
        saveCachedIdentity(uploadedFile);
      }
      checkCache();
    }
  }

  // --- Auto Unlock ---
  async function handleAutoUnlock() {
    if (!identityObject || !lastGeneratedPass) return;
    uploadedFile = identityObject;
    unlockPassphrase = lastGeneratedPass;
    await handleUnlock();
  }
</script>

{#if !tabLoaded}
  <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#050505;color:#00f3ff;">Loading...</div>
{:else}
<main class="app-layout">
  
  <!-- Hamburger -->
  <button class="hamburger" on:click={() => sidebarOpen = !sidebarOpen}>
    {#if sidebarOpen}
      <X size={24} />
    {:else}
      <Menu size={24} />
    {/if}
  </button>
  
  <!-- Sidebar overlay -->
  <div class="sidebar-overlay" class:show={sidebarOpen} on:click={() => sidebarOpen = false}></div>
  
  <!-- SIDEBAR -->
  <nav class="sidebar" class:open={sidebarOpen}>
    <div class="brand">
      <Shield size={28} stroke="#00f3ff" />
      <span>VOID-KEY</span>
      <button class="github-btn" on:click={() => window.open('https://github.com/P4v3r/void-key', '_blank')}>
        <Github size={20} />
      </button>
    </div>
    
    <div class="header-separator"></div>

    <div class="nav-menu">
      <button class="nav-btn" class:active={activeTab === 'create'} on:click={() => { setActiveTab('create'); sidebarOpen = false; }}>
        <User size={20} /> Create Identity
      </button>

      <button class="nav-btn" class:active={activeTab === 'unlock'} on:click={() => { setActiveTab('unlock'); sidebarOpen = false; }}>
        <LockOpen size={20} /> Unlock & Decrypt
      </button>

      <button class="nav-btn" class:active={activeTab === 'encrypt'} on:click={() => { setActiveTab('encrypt'); sidebarOpen = false; }}>
        <Lock size={20} /> Encrypt Message
      </button>

      <button class="nav-btn" class:active={activeTab === 'sign'} on:click={() => { setActiveTab('sign'); sidebarOpen = false; }}>
        <FileSignature size={20} /> Sign & Verify
      </button>

      <div class="nav-separator"></div>

      <button class="nav-btn" class:active={activeTab === 'settings'} on:click={() => { setActiveTab('settings'); sidebarOpen = false; }}>
        <Settings size={20} /> Settings
      </button>

      <button class="nav-btn" class:active={activeTab === 'guide'} on:click={() => { setActiveTab('guide'); sidebarOpen = false; }}>
        <BookOpen size={20} /> User Guide
      </button>
    </div>
  </nav>

  <!-- CONTENT AREA -->
  <div class="content-area">
    
    <!-- TAB 1: CREATE -->
    {#if activeTab === 'create'}
      <div class="card full-height">
        <h2><User size={20} /> Create Identity</h2>
        
        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        <div class="input-group">
          <label for="input-name">Name</label>
          <input type="text" id="input-name" placeholder="John Doe" bind:value={name} autocomplete="off" />
        </div>

        <div class="input-group">
          <label for="input-email">Email</label>
          <input type="email" id="input-email" placeholder="john@void.com" bind:value={email} autocomplete="off" />
        </div>

        <div class="input-group">
          <label for="input-pass">Passphrase</label>
          <input type="password" id="input-pass" placeholder="Strong password" bind:value={passphrase} autocomplete="new-password" on:keydown={(e) => { if (e.key === 'Enter') handleGenerate() }} />
        </div>

        <button class="btn-primary" on:click={handleGenerate} disabled={loading}>
          {#if loading}Generating...{:else}Generate Key Pair{/if}
        </button>

        {#if identityObject}
          <div class="success-area">
            <p><CheckCircle size={18} color="#00ff66" /> Keys generated successfully!</p>
            
            <div class="download-section-clean">
              <button class="btn-main-download" on:click={downloadIdentity}>
                <Download size={18} /> Download .JSON (Backup)
              </button>
              
              <div class="secondary-download-line">
                <p class="hint-small">For other applications:</p>
                <button class="btn-secondary-full" on:click={downloadAllASC}>
                  <FileKey size={20} /> Download .ASC Keys
                </button>
              </div>

              <div class="warning-box">
                {#if settings.cacheKeys}
                  <strong>INFO: CACHING ENABLED</strong><br>
                  Keys saved in browser cache.
                {:else}
                  <strong>WARNING: SAVE YOUR FILE NOW</strong><br>
                  Keys in RAM. Refresh = lose identity.
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 2: UNLOCK -->
    {#if activeTab === 'unlock'}
      <div class="card full-height">
        
        {#if !unlockedPrivateKey && identityObject && lastGeneratedPass}
          <div style="text-align: center; margin-bottom: 20px;">
            <p class="hint">New identity detected. Auto-unlocking...</p>
            {#await handleAutoUnlock() catch err}
               <div class="error-message">Auto-login failed.</div>
            {/await}
          </div>
        {/if}

        {#if !unlockedPrivateKey}
          <h2><LockOpen size={20} /> Unlock Identity</h2>
          
          <div class="file-upload-wrapper">
            <label for="fileInput" class="file-label">
              <Upload size={32} />
              <div><strong>Upload Identity File</strong><br><small>.json or .asc (private key)</small></div>
            </label>
            <input type="file" id="fileInput" accept=".json,.asc" on:change={handleFileUpload} hidden />
          </div>

          {#if uploadedFile}
            <div class="file-info">Loaded: <strong>{uploadedFile.email}</strong></div>

            <div class="input-group">
              <label for="input-unlock">Passphrase</label>
              <input type="password" id="input-unlock" placeholder="Password" bind:value={unlockPassphrase} on:keydown={(e) => { if (e.key === 'Enter') handleUnlock() }} />
            </div>

            <button class="btn-primary" on:click={handleUnlock} disabled={unlocking}>
              {#if unlocking}Unlocking...{:else}Unlock{/if}
            </button>

            {#if unlockError}
              <div class="error-message">{unlockError}</div>
            {/if}
          {/if}
        {:else}
          <div class="welcome-header">
            <h2>Welcome, <span style="color: #00f3ff;">{userDisplayName}</span></h2>

            {#if settings.cacheKeys}
              <button class="btn-clear" on:click={handleLogout}>
                <LogOut size={18} /> Logout
              </button>
            {:else}
              <p class="clear-hint">Refresh page to clear keys.</p>
            {/if}
          </div>

          <div class="backup-section">
            <p class="hint-small"><strong>Backup:</strong></p>
            <div class="backup-buttons-inline">
              <button class="btn-backup" on:click={downloadIdentity}>
                <Download size={18} /> .JSON
              </button>
              <button class="btn-backup" on:click={downloadAllASC}>
                <FileKey size={18} /> .ASC
              </button>
            </div>
          </div>
          
          <div class="public-key-box-fixed">
            <p class="hint-small">Your Public Key:</p>
            <textarea readonly class="public-key-view-mini">{uploadedFile.publicKey}</textarea>
            <button class="btn-copy-mini" on:click={() => safeCopy(uploadedFile.publicKey)}>Copy</button>
          </div>

          <div class="decrypt-only">
            <label for="decrypt-msg"><LockOpen size={18} /> Decrypt Message</label>
            <textarea id="decrypt-msg" class="msg-area" placeholder="Paste PGP message..." bind:value={messageToDecrypt} on:keydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDecrypt() }}></textarea>
            <button class="btn-tool" on:click={handleDecrypt}>Decrypt</button>
            {#if decryptedOutput}
              <div class="plain-text-result">{decryptedOutput}</div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 3: ENCRYPT -->
    {#if activeTab === 'encrypt'}
      <div class="card full-height">
        <h2><Lock size={20} /> Encrypt Message</h2>
        
        <div class="input-group">
          <label for="encrypt-pubkey">Recipient Public Key</label>
          <textarea id="encrypt-pubkey" class="key-area" placeholder="-----BEGIN PGP..." bind:value={recipientPublicKey}></textarea>
        </div>

        <div class="input-group">
          <label for="encrypt-msg">Your Message</label>
          <textarea id="encrypt-msg" class="msg-area" placeholder="Secret message..." bind:value={messageToEncrypt} on:keydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEncrypt() }}></textarea>
        </div>
        
        <button class="btn-tool" on:click={handleEncrypt}>Encrypt</button>
        
        {#if encryptedOutput}
          <div class="result-box">
            <label for="encrypt-result">Result:</label>
            <textarea readonly id="encrypt-result" class="result-text-full">{encryptedOutput}</textarea>
            <button class="btn-copy-mini" on:click={() => safeCopy(encryptedOutput)}>Copy</button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 4: SIGN & VERIFY -->
    {#if activeTab === 'sign'}
      <div class="card full-height">
        <h2><FileSignature size={20} /> Sign & Verify</h2>
        
        <div class="grid-inputs">
          <div class="input-col">
            <h3 style="margin-top:0; font-size: 1.1rem; color:#00f3ff;">Sign</h3>
            
            {#if !unlockedPrivateKey}
              <div class="error-message">Unlock to sign.</div>
            {:else}
              <div class="input-group">
                <label for="sign-msg">Message</label>
                <textarea id="sign-msg" class="msg-area" placeholder="Write..." bind:value={messageToSign} on:keydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSign() }}></textarea>
              </div>
              
              <button class="btn-tool" on:click={handleSign}>Sign</button>
              
              {#if signatureOutput}
                <div class="result-box">
                  <label for="sign-result">Signature:</label>
                  <textarea readonly id="sign-result" class="result-text-full">{signatureOutput}</textarea>
                  <button class="btn-copy-mini" on:click={() => safeCopy(signatureOutput)}>Copy</button>
                </div>
              {/if}
            {/if}
          </div>

          <div class="input-col">
            <h3 style="margin-top:10; font-size: 1.1rem; color:#ff3333;">Verify</h3>
            
            <div class="input-group">
              <label for="verify-msg">Original Message (Optional)</label>
              <textarea id="verify-msg" class="msg-area" placeholder="Original text..." bind:value={verifyOriginalMessage}></textarea>
            </div>

            <div class="input-group">
              <label for="verify-sig">Signature</label>
              <textarea id="verify-sig" class="key-area" placeholder="Signature block..." bind:value={verifySigInput}></textarea>
            </div>

            <div class="input-group">
              <label for="verify-pub">Sender Key</label>
              <textarea id="verify-pub" class="key-area" placeholder="Public key..." bind:value={verifyPubKeyInput}></textarea>
            </div>

            <button class="btn-tool" on:click={handleVerify}>Verify</button>

            {#if verifyResult}
              <div class="verify-result-box">
                <pre>{verifyResult}</pre>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- TAB 5: GUIDE -->
    {#if activeTab === 'guide'}
      <div class="card full-height">
        <h2><BookOpen size={20} /> User Guide</h2>
        <p class="hint">How to exchange messages securely:</p>
        
        <div class="steps-container">
          <div class="step">
            <span class="step-num">1</span>
            <div class="step-content">
              <strong>Generate & Share:</strong><br><br>
              Create your Identity in the "Create" tab. Copy your Public Key and send it to your friend (via email, chat, etc).<br>
              <span style="color: #ff3333;">Important:</span> Never share your JSON file or your password with anyone.
            </div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <div class="step-content">
              <strong>Encrypt (Sending):</strong><br><br>
              Ask your friend for their Public Key. Go to the "Encrypt Message" tab. Paste their key in the "Recipient" field. Write your message and click Encrypt. Send the resulting code to your friend.
            </div>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <div class="step-content">
              <strong>Decrypt (Receiving):</strong><br><br>
              When you receive an encrypted message code, Login (Unlock) here with your JSON file and password. Paste the code into the "Decrypt Received Message" box to read it.
            </div>
          </div>
          <div class="step">
            <span class="step-num">4</span>
            <div class="step-content">
              <strong>Sign & Verify:</strong><br><br>
              <strong>Sign:</strong> To prove authorship, write a message in "Sign" tab (requires login). Send the text + the generated signature block to the recipient.<br>
              <strong>Verify:</strong> If you receive a signed message, go to "Verify" tab. Paste the original text, the signature block, and the sender's Public Key. If it says "VALID", the message is 100% authentic and unmodified.
            </div>
          </div>
          <p class="hint">Other info:</p>
          <div class="step">
            <span class="step-num">1</span>
            <div class="step-content">
              <strong>File Formats (.json vs .asc):</strong><br><br>
              <strong>.json (Void Backup):</strong> Use this to backup your identity specifically for Void Key. It contains both keys and your details in one file.<br>
              <strong>.asc (Standard PGP):</strong> Use this to import your keys into other apps (Thunderbird, GPG for Linux, etc.) or to share your Public Key publicly. The Private Key (.asc) and Public Key (.asc) are separate files.
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- TAB: SETTINGS -->
    {#if activeTab === 'settings'}
      <div class="card full-height">
        <h2><Settings size={20} /> Settings</h2>
        
        <div class="settings-group">
          <div class="setting-row">
            <div>
              <strong>Auto-Lock</strong>
              <p class="hint-small">Logout after inactivity.</p>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={settings.autoLock} on:change={handleSaveSettings} />
              <span class="slider round"></span>
            </label>
          </div>

          {#if settings.autoLock}
            <div class="setting-sub">
              <label for="autoLockTime">Minutes:</label>
              <select bind:value={settings.autoLockTime} on:change={handleSaveSettings}>
                <option value={1}>1</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={30}>30</option>
              </select>
            </div>
          {/if}
        </div>

        <div class="settings-group">
          <div class="setting-row">
            <div>
              <strong>Cache Keys</strong>
              <p class="hint-small">Keep after refresh.</p>
            </div>
            <label class="switch">
              <input type="checkbox" checked={settings.cacheKeys} on:change={handleCacheToggle} />
              <span class="slider round"></span>
            </label>
          </div>
        </div>
      </div>
    {/if}

  </div>
</main>
{/if}