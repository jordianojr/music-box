// ── View controls ──
(() => {
  const scene = document.querySelector('.box-scene');
  const viewX = document.getElementById('viewX');
  const viewXVal = document.getElementById('viewXVal');

  function updateView() {
    scene.style.setProperty('--viewX', viewX.value + 'deg');
    viewXVal.textContent = viewX.value + '°';
  }

  viewX.addEventListener('input', updateView);
  updateView();
})();

(() => {
  // ── Determine mode: uploaded song or default melody ──
  const params = new URLSearchParams(window.location.search);
  const songId = params.get('song') ? parseInt(params.get('song')) : null;
  const songSource = params.get('source') === 'shared' ? 'shared_songs' : 'songs';
  const boxColor = params.get('color') || 'classic';
  let boxParticles = params.get('particles') || 'notes';

  // ── Supabase ──
  const SUPABASE_URL = 'https://idtoiuwzitbgggmkvryy.supabase.co';
  const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/share-box`;

  let currentSong = null; // store loaded song data for sharing

  // ── Apply box colour theme ──
  const colorThemes = {
    classic: { front: '#8B4513', mid: '#5C2E0A', dark: '#3E1A00', side: '#7A3B10', sideMid: '#52280A', sideDark: '#361800', left: '#9B5020', leftMid: '#6C3510', leftDark: '#4E2508', lid: '#9B5523', lidMid: '#6C3E1A', lidDark: '#4E2A10', top: '#A05828', topMid: '#7C4218', topDark: '#5E3010' },
    mahogany: { front: '#6B1010', mid: '#4A0808', dark: '#2E0000', side: '#5A0A0A', sideMid: '#3E0505', sideDark: '#2A0000', left: '#7A1515', leftMid: '#550A0A', leftDark: '#3A0505', lid: '#7A1818', lidMid: '#551010', lidDark: '#3A0808', top: '#8A2020', topMid: '#651515', topDark: '#4A0A0A' },
    ebony: { front: '#2a2a2a', mid: '#1a1a1a', dark: '#0e0e0e', side: '#222', sideMid: '#151515', sideDark: '#0a0a0a', left: '#303030', leftMid: '#1e1e1e', leftDark: '#121212', lid: '#2e2e2e', lidMid: '#1c1c1c', lidDark: '#101010', top: '#353535', topMid: '#252525', topDark: '#181818' },
    ivory: { front: '#D2C6A0', mid: '#B8A880', dark: '#9A8A60', side: '#C8BC98', sideMid: '#A89878', sideDark: '#8A7A58', left: '#D8CCA8', leftMid: '#BCA888', leftDark: '#9E8A68', lid: '#D5C8A0', lidMid: '#BAA880', lidDark: '#9E8A60', top: '#DED2AA', topMid: '#C4B290', topDark: '#AA9A70' },
    navy: { front: '#1a3050', mid: '#0e1e35', dark: '#06101e', side: '#152840', sideMid: '#0c1828', sideDark: '#060e18', left: '#1e3858', leftMid: '#122240', leftDark: '#0a1628', lid: '#1c3450', lidMid: '#102035', lidDark: '#081420', top: '#203c5c', topMid: '#152840', topDark: '#0c1828' },
    rosewood: { front: '#6B1530', mid: '#4A0A1E', dark: '#2E0512', side: '#5A1028', sideMid: '#3E0818', sideDark: '#2A0410', left: '#7A1A38', leftMid: '#551025', leftDark: '#3A0815', lid: '#721835', lidMid: '#501020', lidDark: '#380810', top: '#822040', topMid: '#601530', topDark: '#450A1E' },
  };

  function applyColorTheme(colorName) {
    const theme = colorThemes[colorName] || colorThemes.classic;
    document.querySelectorAll('.box-front').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.front} 0%, ${theme.mid} 40%, ${theme.dark} 100%)`);
    document.querySelectorAll('.box-back').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.dark} 0%, ${theme.mid} 40%, ${theme.dark} 100%)`);
    document.querySelectorAll('.box-right').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.side} 0%, ${theme.sideMid} 40%, ${theme.sideDark} 100%)`);
    document.querySelectorAll('.box-left').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.left} 0%, ${theme.leftMid} 40%, ${theme.leftDark} 100%)`);
    document.querySelectorAll('.lid-front').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.lid} 0%, ${theme.lidMid} 40%, ${theme.lidDark} 100%)`);
    document.querySelectorAll('.lid-back').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.lidDark} 0%, ${theme.lidMid} 40%, ${theme.lidDark} 100%)`);
    document.querySelectorAll('.lid-top').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.top} 0%, ${theme.topMid} 40%, ${theme.topDark} 100%)`);
    document.querySelectorAll('.lid-right').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.side} 0%, ${theme.sideMid} 100%)`);
    document.querySelectorAll('.lid-left').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.left} 0%, ${theme.leftMid} 100%)`);
    document.querySelectorAll('.lid-inner').forEach(el => el.style.background = `linear-gradient(to bottom, ${theme.dark}, ${theme.lidDark})`);
    document.querySelectorAll('.box-bottom').forEach(el => el.style.background = `linear-gradient(145deg, ${theme.dark} 0%, ${theme.dark} 100%)`);
  }

  applyColorTheme(boxColor);

  let useUploadedAudio = !!songId;
  let audioBuffer = null;     // decoded AudioBuffer for uploaded file
  let audioSource = null;     // currently playing BufferSource
  let playbackPosition = 0;   // seconds into the audio we've played so far

  const STATE_KEY = songId ? `musicbox_state_${songId}` : 'musicbox_state_default';

  let savedState = loadState();
  if (savedState) {
    playbackPosition = savedState.playbackPosition || 0;
  }

  let isWinding = false;
  let windStartTime = 0;
  let windAccumulated = 0;
  let lastAngle = null;
  let totalRotation = 0;

  let isPlaying = false;
  let playStartTime = 0;
  let playDuration = 0;
  let playTimer = null;
  let audioCtx = null;
  let pendingAudioData = null; // raw ArrayBuffer waiting to be decoded on user gesture

  // For default melody mode
  let noteIndex = savedState ? (savedState.noteIndex || 0) : 0;
  let scheduledNotes = [];

  // For image slideshow
  let currentImgIndex = savedState ? (savedState.currentImgIndex || 0) : 0;

  // ── Elements ──
  const windArea = document.getElementById('windArea');
  const keyHandle = document.getElementById('keyHandle');
  const lid = document.getElementById('lid');
  const record = document.getElementById('record');
  const energyBar = document.getElementById('energyBar');
  const statusText = document.getElementById('statusText');
  const timeInfo = document.getElementById('timeInfo');

  const musicBox = document.getElementById('musicBox');

  // ── Default Melody ──
  const melody = [
    { freq: 1047, dur: 200 }, { freq: 1319, dur: 200 }, { freq: 1568, dur: 300 },
    { freq: 1319, dur: 200 }, { freq: 1047, dur: 200 }, { freq: 1175, dur: 300 },
    { freq: 1047, dur: 200 }, { freq: 880, dur: 200 },  { freq: 784, dur: 400 },
    { freq: 0, dur: 200 },
    { freq: 784, dur: 200 },  { freq: 880, dur: 200 },  { freq: 1047, dur: 300 },
    { freq: 1175, dur: 200 }, { freq: 1319, dur: 200 }, { freq: 1568, dur: 300 },
    { freq: 1319, dur: 200 }, { freq: 1175, dur: 200 }, { freq: 1047, dur: 400 },
    { freq: 0, dur: 200 },
    { freq: 1568, dur: 200 }, { freq: 1397, dur: 200 }, { freq: 1319, dur: 300 },
    { freq: 1175, dur: 200 }, { freq: 1047, dur: 200 }, { freq: 880, dur: 300 },
    { freq: 784, dur: 200 },  { freq: 880, dur: 200 },  { freq: 1047, dur: 400 },
    { freq: 0, dur: 300 },
    { freq: 1319, dur: 200 }, { freq: 1175, dur: 200 }, { freq: 1047, dur: 200 },
    { freq: 880, dur: 200 },  { freq: 784, dur: 300 },  { freq: 880, dur: 200 },
    { freq: 1047, dur: 300 }, { freq: 1319, dur: 200 }, { freq: 1568, dur: 400 },
    { freq: 0, dur: 400 },
  ];

  // ── Load uploaded song from IndexedDB ──
  function loadSongFromDB(id, storeName) {
    storeName = storeName || 'songs';
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('musicbox_db', 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('shared_songs')) {
          db.createObjectStore('shared_songs', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getReq = store.get(id);
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Audio ──
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playMelodyNote(freq, duration, time) {
    if (!audioCtx || freq === 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, time);
    filter.Q.setValueAtTime(1, time);

    const attackTime = 0.005;
    const decayTime = Math.min(duration / 1000 * 2, 1.5);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.001, time + attackTime + decayTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + attackTime + decayTime + 0.05);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, time);
    gain2.gain.setValueAtTime(0, time);
    gain2.gain.linearRampToValueAtTime(0.08, time + attackTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + attackTime + decayTime * 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(time);
    osc2.stop(time + attackTime + decayTime + 0.05);
  }

  function playClickSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  }

  // ── Winding ──
  function getAngle(e) {
    const rect = windArea.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }

  let windTimer = null;
  const windLabel = document.getElementById('windLabel');

  function updateWindDisplay() {
    if (!isWinding) return;
    const elapsed = (Date.now() - windStartTime) / 1000;
    const playSecs = Math.max(elapsed, 0.5) * 5;
    statusText.textContent = `${playSecs.toFixed(1)}s of playback`;
    windTimer = requestAnimationFrame(updateWindDisplay);
  }

  async function onWindStart(e) {
    e.preventDefault();
    if (isPlaying) return;

    ensureAudio();

    // Decode audio on first user gesture (mobile/Safari requires this)
    if (pendingAudioData && !audioBuffer) {
      try {
        const copy = pendingAudioData.slice(0);
        audioBuffer = await new Promise((resolve, reject) => {
          audioCtx.decodeAudioData(copy, resolve, reject);
        });
        pendingAudioData = null;
      } catch (err) {
        console.error('Failed to decode audio:', err);
      }
    }

    isWinding = true;
    windStartTime = Date.now();
    lastAngle = getAngle(e);
    totalRotation = 0;
    keyHandle.classList.add('active');
    windLabel.textContent = 'release to play';
    updateWindDisplay();
  }

  function onWindMove(e) {
    if (!isWinding) return;
    e.preventDefault();

    const angle = getAngle(e);
    if (lastAngle !== null) {
      let delta = angle - lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      totalRotation += delta;

      const currentRot = parseFloat(keyHandle.dataset.rot || 0);
      const newRot = currentRot + delta;
      keyHandle.dataset.rot = newRot;
      keyHandle.style.transform = `translateX(-50%) rotate(${newRot}deg)`;

      if (Math.abs(totalRotation) % 30 < Math.abs(delta)) {
        playClickSound();
      }
    }
    lastAngle = angle;
  }

  function onWindEnd() {
    if (!isWinding) return;
    isWinding = false;
    lastAngle = null;
    cancelAnimationFrame(windTimer);
    keyHandle.classList.remove('active');
    windLabel.textContent = 'hold & drag to power up';

    const windDuration = (Date.now() - windStartTime) / 1000;
    windAccumulated = Math.max(windDuration, 0.5);

    startPlaying();
  }

  windArea.addEventListener('mousedown', onWindStart);
  window.addEventListener('mousemove', onWindMove);
  window.addEventListener('mouseup', onWindEnd);
  windArea.addEventListener('touchstart', onWindStart, { passive: false });
  window.addEventListener('touchmove', onWindMove, { passive: false });
  window.addEventListener('touchend', onWindEnd);

  // ── Playback ──
  function startPlaying() {
    ensureAudio();

    playDuration = windAccumulated * 5 * 1000;
    isPlaying = true;
    playStartTime = Date.now();

    record.classList.add('spinning');
    statusText.textContent = 'playing...';

    if (useUploadedAudio && audioBuffer) {
      startAudioPlayback();
    } else {
      scheduleMelodyNotes();
    }

    updatePlayback();
  }

  // ── Uploaded audio playback ──
  function startAudioPlayback() {
    if (audioSource) {
      try { audioSource.stop(); } catch(e) {}
    }

    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioCtx.destination);

    // Start from saved position, looping
    const startOffset = playbackPosition % audioBuffer.duration;
    audioSource.loop = true;
    audioSource.loopStart = 0;
    audioSource.loopEnd = audioBuffer.duration;
    audioSource.start(0, startOffset);

    // Schedule stop at playDuration
    audioSource.stopTime = audioCtx.currentTime + playDuration / 1000;
  }

  // ── Default melody scheduling ──
  function scheduleMelodyNotes() {
    const now = audioCtx.currentTime;
    let timeOffset = 0;
    let idx = noteIndex;
    scheduledNotes = [];

    while (timeOffset < playDuration) {
      const note = melody[idx % melody.length];
      const noteTime = now + timeOffset / 1000;
      playMelodyNote(note.freq, note.dur, noteTime);

      scheduledNotes.push({ time: timeOffset, idx });
      timeOffset += note.dur;
      idx++;
    }
    scheduledNotes._finalIdx = idx;
  }

  function updatePlayback() {
    if (!isPlaying) return;

    const elapsed = Date.now() - playStartTime;
    const remaining = playDuration - elapsed;
    const progress = Math.max(0, 1 - elapsed / playDuration);

    energyBar.style.width = (progress * 100) + '%';

    // Animate lid: open over first 2s, close over last 2s
    const openMs = 2000;
    const closeMs = 2000;
    const maxAngle = 75;
    let lidAngle;
    if (elapsed < openMs) {
      // Ease out during opening
      const t = elapsed / openMs;
      lidAngle = maxAngle * (1 - Math.pow(1 - t, 3));
    } else if (remaining < closeMs) {
      // Ease in during closing
      const t = Math.max(0, remaining) / closeMs;
      lidAngle = maxAngle * (1 - Math.pow(1 - t, 3));
    } else {
      lidAngle = maxAngle;
    }
    lid.style.transform = `rotateX(${lidAngle}deg)`;
    // Show interior proportionally
    const interiorEl = document.querySelector('.box-interior');
    interiorEl.style.opacity = Math.min(1, lidAngle / 30);

    const remSec = Math.max(0, remaining / 1000).toFixed(1);
    timeInfo.textContent = `${remSec}s remaining`;

    // Animate teeth at intervals
    // Spawn floating notes periodically
    if (useUploadedAudio) {
      const interval = 300;
      const cur = Math.floor(elapsed / interval);
      const prev = Math.floor((elapsed - 16) / interval);
      if (cur !== prev) spawnNote();
    } else {
      for (const sn of scheduledNotes) {
        if (!sn.triggered && elapsed >= sn.time) {
          sn.triggered = true;
          spawnNote();
        }
      }
    }

    if (elapsed >= playDuration) {
      stopPlaying();
      return;
    }

    playTimer = requestAnimationFrame(updatePlayback);
  }

  function stopPlaying() {
    isPlaying = false;
    cancelAnimationFrame(playTimer);
    record.classList.remove('spinning');

    // Stop uploaded audio
    if (audioSource) {
      try { audioSource.stop(); } catch(e) {}
      audioSource = null;
    }

    const elapsed = Date.now() - playStartTime;

    if (useUploadedAudio && audioBuffer) {
      // Save how far into the audio file we got
      playbackPosition += (elapsed / 1000);
      // Wrap around if past the end
      playbackPosition = playbackPosition % audioBuffer.duration;

      saveState({ playbackPosition, currentImgIndex });

      statusText.textContent = 'power depleted — power up again to continue';
      timeInfo.textContent = '';
    } else {
      // Default melody — save note index
      let timeAcc = 0;
      let idx = noteIndex;
      while (timeAcc < elapsed && timeAcc < playDuration) {
        timeAcc += melody[idx % melody.length].dur;
        idx++;
      }
      noteIndex = idx;
      saveState({ noteIndex, currentImgIndex });

      statusText.textContent = 'power depleted — power up again to continue';
      timeInfo.textContent = '';
    }

    lid.style.transform = 'rotateX(0deg)';
    document.querySelector('.box-interior').style.opacity = '0';
    energyBar.style.width = '0%';
    savedState = loadState();
  }

  const particleSets = {
    notes: ['\u266B', '\u266A', '\u266C', '\u2669'],
    hearts: ['\u2764', '\u2765', '\u2661', '\u2763'],
    flowers: ['\u2740', '\u2741', '\u273F', '\u2743'],
  };

  function spawnNote() {
    const symbols = particleSets[boxParticles] || particleSets.notes;
    const el = document.createElement('div');
    el.className = 'note';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = (80 + Math.random() * 120) + 'px';
    el.style.top = (60 + Math.random() * 40) + 'px';
    el.style.color = `hsl(${40 + Math.random() * 20}, 80%, ${60 + Math.random() * 20}%)`;
    musicBox.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ── Persistence ──
  function saveState(state) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function loadState() {
    try {
      const s = localStorage.getItem(STATE_KEY);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  }

  // ── Setup song visuals (name, images) ──
  function setupSongVisuals(name, images) {
    const textPath = document.getElementById('recordTextPath');
    if (textPath && name) {
      textPath.textContent = name.toUpperCase();
    }

    if (images && images.length > 0) {
      const container = document.getElementById('lidPhotos');
      currentImgIndex = currentImgIndex % images.length;
      images.forEach((dataUrl, i) => {
        const img = document.createElement('img');
        img.src = dataUrl;
        if (i === currentImgIndex) img.classList.add('active');
        container.appendChild(img);
      });

      if (images.length > 1) {
        setInterval(() => {
          const imgs = container.querySelectorAll('img');
          imgs[currentImgIndex].classList.remove('active');
          currentImgIndex = (currentImgIndex + 1) % imgs.length;
          imgs[currentImgIndex].classList.add('active');
        }, 3000);
      }
    } else {
      document.getElementById('lidPhotos').style.display = 'none';
    }
  }

  // ── Helper: base64 data URL to Blob ──
  function dataUrlToBlob(dataUrl) {
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ── Share button handler ──
  async function handleShare() {
    const shareBtn = document.getElementById('shareBtn');
    if (!currentSong) return;
    shareBtn.disabled = true;
    shareBtn.textContent = 'uploading...';

    try {
      // Build FormData for Edge Function
      const formData = new FormData();
      formData.append('name', currentSong.name || 'Music Box');
      formData.append('color', boxColor);
      formData.append('particles', boxParticles);
      formData.append('duration', String(currentSong.duration || 0));
      formData.append('isDefault', String(!!currentSong.isDefault));

      if (!currentSong.isDefault) {
        const audioBlob = new Blob([currentSong.data], { type: 'audio/wav' });
        formData.append('audio', audioBlob, 'audio.wav');
      }

      if (currentSong.images && currentSong.images.length > 0) {
        for (let i = 0; i < currentSong.images.length; i++) {
          const imgBlob = dataUrlToBlob(currentSong.images[i]);
          const ext = imgBlob.type.split('/')[1] || 'png';
          formData.append(`image_${i}`, imgBlob, `image_${i}.${ext}`);
        }
      }

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Share failed');
      }

      const { id: shareUuid } = await res.json();

      // Build share URL
      const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
      const shareUrl = `${baseUrl}/share.html?id=${shareUuid}`;
      showShareModal(shareUrl);
    } catch (e) {
      console.error('Share failed:', e);
      alert('Share failed: ' + e.message);
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = 'share \u2192';
    }
  }

  function showShareModal(url) {
    const overlay = document.getElementById('shareOverlay');
    const input = document.getElementById('shareUrlInput');
    input.value = url;
    overlay.classList.add('visible');

    document.getElementById('copyShareUrl').onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        document.getElementById('copyShareUrl').textContent = 'Copied!';
        setTimeout(() => { document.getElementById('copyShareUrl').textContent = 'Copy'; }, 2000);
      });
    };

    document.getElementById('shareClose').onclick = () => overlay.classList.remove('visible');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('visible'); };
  }

  // ── Init ──
  async function init() {
    if (songId) {
      try {
        const song = await loadSongFromDB(songId, songSource);
        if (song) {
          currentSong = song; // store for sharing

          if (song.isDefault) {
            // Fetch default audio — check cache first, then network
            const defaultUrl = `${SUPABASE_URL}/storage/v1/object/public/audio/default.mp3`;
            const cache = await caches.open('musicbox-defaults');
            let res = await cache.match(defaultUrl);
            if (!res) {
              res = await fetch(defaultUrl);
              if (res.ok) cache.put(defaultUrl, res.clone());
            }
            if (!res.ok) throw new Error('Failed to fetch default audio');
            pendingAudioData = await res.arrayBuffer();
          } else {
            pendingAudioData = song.data.slice(0);
          }

          setupSongVisuals(song.name, song.images);

          // Show share button for local songs
          document.getElementById('shareBtn').style.display = '';
          document.getElementById('shareBtn').onclick = handleShare;

          if (savedState && savedState.playbackPosition != null) {
            statusText.textContent = 'power up to resume';
          }
        } else {
          useUploadedAudio = false;
        }
      } catch(e) {
        console.error('Failed to load song:', e);
        useUploadedAudio = false;
      }
    } else {
      useUploadedAudio = false;
    }
  }

  init();
})();
