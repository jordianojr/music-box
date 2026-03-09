// ── View controls ──
(() => {
  const scene = document.querySelector('.box-scene');
  const viewX = document.getElementById('viewX');
  const viewXVal = document.getElementById('viewXVal');

  function updateView() {
    scene.style.setProperty('--viewX', viewX.value + 'deg');
    viewXVal.textContent = viewX.value + '\u00B0';
  }

  viewX.addEventListener('input', updateView);
  updateView();
})();

(() => {
  // ── Get share ID from URL ──
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get('id');

  if (!shareId) {
    document.getElementById('statusText').textContent = 'No music box ID provided';
    return;
  }

  // ── Supabase ──
  const SUPABASE_URL = 'https://idtoiuwzitbgggmkvryy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdG9pdXd6aXRiZ2dnbWt2cnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzM4MTgsImV4cCI6MjA4ODU0OTgxOH0.4ziW9Pllmlk7mUft-6A0HHOCMzIOQdIt7Hi-RBmC3ME';

  // ── Color themes ──
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

  // ── State ──
  let pendingAudioData = null;
  let audioBuffer = null;
  let audioSource = null;
  let playbackPosition = 0;
  let boxParticles = 'notes';

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

  let currentImgIndex = 0;

  // ── Elements ──
  const windArea = document.getElementById('windArea');
  const keyHandle = document.getElementById('keyHandle');
  const lid = document.getElementById('lid');
  const record = document.getElementById('record');
  const energyBar = document.getElementById('energyBar');
  const statusText = document.getElementById('statusText');
  const timeInfo = document.getElementById('timeInfo');
  const musicBox = document.getElementById('musicBox');

  // ── Audio ──
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
    if (isPlaying || (!audioBuffer && !pendingAudioData)) return;

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
        return;
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

    startAudioPlayback();
    updatePlayback();
  }

  function startAudioPlayback() {
    if (audioSource) {
      try { audioSource.stop(); } catch(e) {}
    }

    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioCtx.destination);

    const startOffset = playbackPosition % audioBuffer.duration;
    audioSource.loop = true;
    audioSource.loopStart = 0;
    audioSource.loopEnd = audioBuffer.duration;
    audioSource.start(0, startOffset);
  }

  function updatePlayback() {
    if (!isPlaying) return;

    const elapsed = Date.now() - playStartTime;
    const remaining = playDuration - elapsed;
    const progress = Math.max(0, 1 - elapsed / playDuration);

    energyBar.style.width = (progress * 100) + '%';

    const openMs = 2000;
    const closeMs = 2000;
    const maxAngle = 75;
    let lidAngle;
    if (elapsed < openMs) {
      const t = elapsed / openMs;
      lidAngle = maxAngle * (1 - Math.pow(1 - t, 3));
    } else if (remaining < closeMs) {
      const t = Math.max(0, remaining) / closeMs;
      lidAngle = maxAngle * (1 - Math.pow(1 - t, 3));
    } else {
      lidAngle = maxAngle;
    }
    lid.style.transform = `rotateX(${lidAngle}deg)`;
    const interiorEl = document.querySelector('.box-interior');
    interiorEl.style.opacity = Math.min(1, lidAngle / 30);

    const remSec = Math.max(0, remaining / 1000).toFixed(1);
    timeInfo.textContent = `${remSec}s remaining`;

    const interval = 300;
    const cur = Math.floor(elapsed / interval);
    const prev = Math.floor((elapsed - 16) / interval);
    if (cur !== prev) spawnNote();

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

    if (audioSource) {
      try { audioSource.stop(); } catch(e) {}
      audioSource = null;
    }

    const elapsed = Date.now() - playStartTime;
    playbackPosition += (elapsed / 1000);
    playbackPosition = playbackPosition % audioBuffer.duration;

    statusText.textContent = 'power depleted \u2014 power up again to continue';
    timeInfo.textContent = '';

    lid.style.transform = 'rotateX(0deg)';
    document.querySelector('.box-interior').style.opacity = '0';
    energyBar.style.width = '0%';
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

  // ── Setup song visuals ──
  function setupSongVisuals(name, images) {
    const textPath = document.getElementById('recordTextPath');
    if (textPath && name) {
      textPath.textContent = name.toUpperCase();
    }

    if (images && images.length > 0) {
      const container = document.getElementById('lidPhotos');
      currentImgIndex = currentImgIndex % images.length;
      images.forEach((url, i) => {
        const img = document.createElement('img');
        img.src = url;
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

  // ── Load shared box from Supabase ──
  const loadingDetail = document.getElementById('loadingDetail');

  async function loadSharedBox(id) {
    loadingDetail.textContent = 'fetching config...';
    const url = `${SUPABASE_URL}/rest/v1/shared_boxes?id=eq.${id}&select=*`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error('failed to fetch shared box');
    const rows = await res.json();
    if (!rows.length) throw new Error('shared box not found');
    const box = rows[0];

    loadingDetail.textContent = 'downloading audio...';
    const audioRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/audio/${box.audio_path}`);
    if (!audioRes.ok) throw new Error('Failed to fetch audio');
    const audioData = await audioRes.arrayBuffer();

    // Convert image storage paths to public URLs and download as data URLs for IndexedDB
    const imageDataUrls = [];
    if (box.images && box.images.length > 0) {
      loadingDetail.textContent = 'downloading images...';
      for (const path of box.images) {
        const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/audio/${path}`;
        try {
          const imgRes = await fetch(imgUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            imageDataUrls.push(dataUrl);
          }
        } catch (e) { /* skip failed images */ }
      }
      box.images = box.images.map(path =>
        `${SUPABASE_URL}/storage/v1/object/public/audio/${path}`
      );
    }

    return { ...box, audioData, imageDataUrls };
  }

  // ── IndexedDB ──
  function openSharedDB() {
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
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  function findCachedBox(db, shareUuid) {
    return new Promise((resolve) => {
      const tx = db.transaction('shared_songs', 'readonly');
      const store = tx.objectStore('shared_songs');
      const req = store.getAll();
      req.onsuccess = () => {
        const match = req.result.find(r => r.shareId === shareUuid);
        resolve(match || null);
      };
      req.onerror = () => resolve(null);
    });
  }

  function saveSongToDB(db, song) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('shared_songs', 'readwrite');
      const store = tx.objectStore('shared_songs');
      const addReq = store.add(song);
      addReq.onsuccess = () => resolve(addReq.result);
      addReq.onerror = () => reject(addReq.error);
    });
  }

  // ── Init ──
  async function init() {
    const overlay = document.getElementById('loadingOverlay');
    try {
      const db = await openSharedDB();

      // Check IndexedDB cache first
      loadingDetail.textContent = 'Checking local cache...';
      const cached = await findCachedBox(db, shareId);

      let audioData, color, particles, name, images;

      if (cached && cached.data) {
        loadingDetail.textContent = 'Loading from cache...';
        audioData = cached.data;
        color = cached.color;
        particles = cached.particles;
        name = cached.name;
        images = cached.images || [];
      } else {
        // Fetch from Supabase
        const box = await loadSharedBox(shareId);
        audioData = box.audioData;
        color = box.color;
        particles = box.particles;
        name = box.name;
        images = box.images || [];

        // Save to IndexedDB for next time
        loadingDetail.textContent = 'Saving to cache...';
        try {
          await saveSongToDB(db, {
            shareId: shareId,
            name: name || 'Music Box',
            data: audioData,
            duration: box.duration || null,
            color: color || 'classic',
            particles: particles || 'notes',
            images: box.imageDataUrls || [],
            addedAt: Date.now(),
          });
        } catch (dbErr) {
          console.warn('Could not save to IndexedDB:', dbErr);
        }
      }

      pendingAudioData = audioData;

      if (color) applyColorTheme(color);
      if (particles) boxParticles = particles;

      setupSongVisuals(name, images);

      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(() => overlay.remove(), 400);

      statusText.textContent = 'Power up to play';
    } catch (e) {
      console.error('Failed to load shared box:', e);
      overlay.remove();
      statusText.textContent = 'Shared music box not found';
    }
  }

  init();
})();
