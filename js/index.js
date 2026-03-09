(() => {
  const DB_NAME = 'musicbox_db';
  const STORE_NAME = 'songs';
  const SUPABASE_URL = 'https://idtoiuwzitbgggmkvryy.supabase.co';
  const DEFAULT_AUDIO_URL = `${SUPABASE_URL}/storage/v1/object/public/default/default.mp3`;
  let db = null;

  // ── IndexedDB ──
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('shared_songs')) {
          db.createObjectStore('shared_songs', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e);
    });
  }

  function addSong(song) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(song);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  function deleteSong(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  function updateSong(id, updates) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const song = getReq.result;
        Object.assign(song, updates);
        const putReq = store.put(song);
        putReq.onsuccess = () => resolve();
        putReq.onerror = (e) => reject(e);
      };
      getReq.onerror = (e) => reject(e);
    });
  }

  function getAllSongs() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  // ── UI ──
  const createBtn = document.getElementById('createBtn');
  const fileInput = document.getElementById('fileInput');
  const imageInput = document.getElementById('imageInput');
  const boxList = document.getElementById('boxList');
  const toast = document.getElementById('toast');

  const creatorOverlay = document.getElementById('creatorOverlay');
  const boxNameInput = document.getElementById('boxNameInput');
  const colorOptions = document.getElementById('colorOptions');
  const audioUploadBtn = document.getElementById('audioUploadBtn');
  const audioFileName = document.getElementById('audioFileName');
  const imageUploadBtn = document.getElementById('imageUploadBtn');
  const imageFileCount = document.getElementById('imageFileCount');
  const imagePreviewRow = document.getElementById('imagePreviewRow');
  const createCancel = document.getElementById('createCancel');
  const createConfirm = document.getElementById('createConfirm');

  let selectedColor = 'classic';
  let selectedParticles = 'notes';
  let pendingAudio = null;
  let pendingImages = [];
  let editingBoxId = null;

  const particleOptions = document.getElementById('particleOptions');

  // ── Color picker ──
  colorOptions.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    colorOptions.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
  });

  // ── Particle picker ──
  particleOptions.addEventListener('click', (e) => {
    const opt = e.target.closest('.particle-option');
    if (!opt) return;
    particleOptions.querySelectorAll('.particle-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedParticles = opt.dataset.particles;
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatDuration(seconds) {
    if (seconds < 60) return Math.round(seconds) + 's';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const colorSwatchBgs = {
    classic: '#8B4513', mahogany: '#4A0000', ebony: '#1a1a1a',
    ivory: '#D2C6A0', navy: '#0a1628', rosewood: '#65000B'
  };

  // ── Render box list ──
  async function renderBoxes() {
    const boxes = await getAllSongs();
    boxList.innerHTML = '';
    for (const box of boxes) {
      const li = document.createElement('li');
      li.className = 'song-item';

      const durText = box.duration ? ` · ${formatDuration(box.duration)}` : '';
      const imgCount = box.images ? box.images.length : 0;
      const imgText = imgCount > 0 ? ` · ${imgCount} photo${imgCount > 1 ? 's' : ''}` : '';
      const dotColor = colorSwatchBgs[box.color] || colorSwatchBgs.classic;

      li.innerHTML = `
        <div class="song-icon">&#9835;</div>
        <div class="song-info">
          <div class="song-name">${escapeHtml(box.name)}</div>
          <div class="song-meta">${formatSize(box.size)}${durText}${imgText}</div>
        </div>
        <div class="box-color-dot" style="background:${dotColor}"></div>
        <button class="song-rename" data-id="${box.id}" title="Rename">&#9998;</button>
        <button class="song-delete" data-id="${box.id}">&times;</button>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.song-delete') || e.target.closest('.song-rename')) return;
        window.location.href = `player.html?song=${box.id}&color=${box.color || 'classic'}&particles=${box.particles || 'notes'}`;
      });

      li.querySelector('.song-rename').addEventListener('click', async (e) => {
        e.stopPropagation();
        openEditor(box);
      });

      li.querySelector('.song-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteSong(box.id);
        showToast('Music box removed');
        renderBoxes();
      });

      boxList.appendChild(li);
    }
  }

  // ── Creator/Editor modal ──
  const creatorTitle = document.getElementById('creatorTitle');

  function openCreator() {
    editingBoxId = null;
    pendingAudio = null;
    pendingImages = [];
    boxNameInput.value = '';
    audioFileName.textContent = 'choose audio file';
    audioUploadBtn.classList.remove('has-file');
    defaultAudioCheck.checked = false;
    imageFileCount.textContent = 'choose images';
    imageUploadBtn.classList.remove('has-file');
    imagePreviewRow.innerHTML = '';
    createConfirm.disabled = true;
    createConfirm.textContent = 'create';
    creatorTitle.textContent = 'create music box';
    selectedColor = 'classic';
    colorOptions.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    colorOptions.querySelector('[data-color="classic"]').classList.add('selected');
    selectedParticles = 'notes';
    particleOptions.querySelectorAll('.particle-option').forEach(o => o.classList.remove('selected'));
    particleOptions.querySelector('[data-particles="notes"]').classList.add('selected');
    creatorOverlay.classList.add('active');
  }

  function openEditor(box) {
    editingBoxId = box.id;
    creatorTitle.textContent = 'edit music box';
    createConfirm.textContent = 'save';

    boxNameInput.value = box.name || '';

    selectedColor = box.color || 'classic';
    colorOptions.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    const swatch = colorOptions.querySelector(`[data-color="${selectedColor}"]`);
    if (swatch) swatch.classList.add('selected');

    selectedParticles = box.particles || 'notes';
    particleOptions.querySelectorAll('.particle-option').forEach(o => o.classList.remove('selected'));
    const pOpt = particleOptions.querySelector(`[data-particles="${selectedParticles}"]`);
    if (pOpt) pOpt.classList.add('selected');

    if (box.isDefault) {
      defaultAudioCheck.checked = true;
      pendingAudio = { arrayBuffer: null, fileName: 'default', size: 0, type: 'audio/mp3', duration: null, isDefault: true };
      audioFileName.textContent = 'choose audio file';
      audioUploadBtn.classList.remove('has-file');
    } else {
      defaultAudioCheck.checked = false;
      pendingAudio = {
        arrayBuffer: box.data,
        fileName: box.fileName,
        size: box.size,
        type: box.type,
        duration: box.duration,
      };
      audioFileName.textContent = box.fileName || 'Current audio';
      audioUploadBtn.classList.add('has-file');
    }

    pendingImages = [];
    imagePreviewRow.innerHTML = '';
    if (box.images && box.images.length > 0) {
      box.images.forEach(dataUrl => {
        pendingImages.push({ dataUrl, name: 'existing' });
        addImagePreview(dataUrl);
      });
    }
    updateImageCount();

    createConfirm.disabled = false;
    creatorOverlay.classList.add('active');
  }

  function closeCreator() {
    creatorOverlay.classList.remove('active');
    editingBoxId = null;
  }

  createBtn.addEventListener('click', openCreator);
  createCancel.addEventListener('click', closeCreator);

  // Audio upload
  audioUploadBtn.addEventListener('click', () => fileInput.click());

  // Default audio checkbox
  const defaultAudioCheck = document.getElementById('defaultAudioCheck');

  function updateCreateBtn() {
    const hasUpload = pendingAudio && !pendingAudio.isDefault;
    const hasDefault = defaultAudioCheck.checked;
    createConfirm.disabled = !(hasUpload || hasDefault);
  }

  defaultAudioCheck.addEventListener('change', () => {
    if (defaultAudioCheck.checked) {
      pendingAudio = {
        arrayBuffer: null,
        fileName: 'default',
        size: 0,
        type: 'audio/mp3',
        duration: null,
        isDefault: true,
      };
      audioFileName.textContent = 'choose audio file';
      audioUploadBtn.classList.remove('has-file');
      fileInput.value = '';
    } else {
      pendingAudio = null;
    }
    updateCreateBtn();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = '';

    const audioExts = /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|webm|3gp|3gpp|amr|caf|mp4)$/i;
    const audioMime = file.type.startsWith('audio/') || file.type.startsWith('video/');
    if (!audioMime && !audioExts.test(file.name)) {
      showToast('Please upload an audio file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;

      const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
      let decoded;
      try {
        decoded = await new Promise((resolve, reject) => {
          tempCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });
      } catch (err) {
        showToast('Could not decode audio file');
        tempCtx.close();
        return;
      }

      const duration = decoded.duration;

      if (duration > 60) {
        openTrimmer(file, arrayBuffer, decoded, tempCtx);
      } else {
        tempCtx.close();
        pendingAudio = {
          arrayBuffer,
          fileName: file.name,
          size: file.size,
          type: file.type,
          duration,
        };
        defaultAudioCheck.checked = false;
        audioFileName.textContent = file.name;
        audioUploadBtn.classList.add('has-file');
        if (!boxNameInput.value.trim()) {
          boxNameInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
        updateCreateBtn();
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Image helpers
  function addImagePreview(dataUrl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-preview-item';
    const img = document.createElement('img');
    img.src = dataUrl;
    const btn = document.createElement('button');
    btn.className = 'img-remove';
    btn.textContent = '\u00d7';
    btn.addEventListener('click', () => {
      const idx = Array.from(imagePreviewRow.children).indexOf(wrapper);
      if (idx > -1) pendingImages.splice(idx, 1);
      wrapper.remove();
      updateImageCount();
    });
    wrapper.appendChild(img);
    wrapper.appendChild(btn);
    imagePreviewRow.appendChild(wrapper);
  }

  function updateImageCount() {
    if (pendingImages.length > 0) {
      imageFileCount.textContent = `${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''} selected`;
      imageUploadBtn.classList.add('has-file');
    } else {
      imageFileCount.textContent = 'choose images';
      imageUploadBtn.classList.remove('has-file');
    }
  }

  // Image upload
  imageUploadBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    const files = Array.from(imageInput.files);
    imageInput.value = '';
    if (!files.length) return;

    pendingImages = [];
    imagePreviewRow.innerHTML = '';

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingImages.push({ dataUrl: e.target.result, name: file.name });
        addImagePreview(e.target.result);
        updateImageCount();
      };
      reader.readAsDataURL(file);
    }
  });

  // Create/Save confirm
  createConfirm.addEventListener('click', async () => {
    const hasUpload = pendingAudio && !pendingAudio.isDefault;
    const hasDefault = defaultAudioCheck.checked;

    if (!hasUpload && !hasDefault) {
      showToast('Please upload audio or select default');
      return;
    }
    if (hasUpload && hasDefault) {
      showToast('Choose either uploaded audio or default, not both');
      return;
    }

    const name = boxNameInput.value.trim() || (pendingAudio.isDefault ? 'Music Box' : pendingAudio.fileName.replace(/\.[^/.]+$/, ''));

    if (editingBoxId != null) {
      await updateSong(editingBoxId, {
        name,
        fileName: pendingAudio.fileName,
        size: pendingAudio.size,
        type: pendingAudio.type,
        data: pendingAudio.arrayBuffer,
        duration: pendingAudio.duration,
        color: selectedColor,
        particles: selectedParticles,
        images: pendingImages.map(img => img.dataUrl),
        isDefault: !!pendingAudio.isDefault,
      });
      closeCreator();
      showToast('Music box updated!');
    } else {
      await addSong({
        name,
        fileName: pendingAudio.fileName,
        size: pendingAudio.size,
        type: pendingAudio.type,
        data: pendingAudio.arrayBuffer,
        duration: pendingAudio.duration,
        color: selectedColor,
        particles: selectedParticles,
        images: pendingImages.map(img => img.dataUrl),
        isDefault: !!pendingAudio.isDefault,
        addedAt: Date.now(),
      });
      closeCreator();
      showToast('Music box created!');
    }

    renderBoxes();
  });

  // ══════════════════════════════════════
  // ── TRIMMER ──
  // ══════════════════════════════════════
  const trimmerOverlay = document.getElementById('trimmerOverlay');
  const waveformContainer = document.getElementById('waveformContainer');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const handleLeft = document.getElementById('handleLeft');
  const handleRight = document.getElementById('handleRight');
  const trimOverlayLeft = document.getElementById('trimOverlayLeft');
  const trimOverlayRight = document.getElementById('trimOverlayRight');
  const trimStartTime = document.getElementById('trimStartTime');
  const trimEndTime = document.getElementById('trimEndTime');
  const trimSelectionInfo = document.getElementById('trimSelectionInfo');
  const trimPreviewBtn = document.getElementById('trimPreviewBtn');
  const trimCancel = document.getElementById('trimCancel');
  const trimConfirm = document.getElementById('trimConfirm');
  const trimmerSubtitle = document.getElementById('trimmerSubtitle');
  const playhead = document.getElementById('playhead');

  let trimState = null;
  let dragging = null;
  let previewSource = null;
  let previewTimer = null;

  function openTrimmer(file, arrayBuffer, decoded, audioCtx) {
    trimState = { file, arrayBuffer, decoded, audioCtx, startPct: 0, endPct: 1 };
    trimmerSubtitle.textContent = `${escapeHtml(file.name)} — ${formatDuration(decoded.duration)}`;
    trimmerOverlay.classList.add('active');
    drawWaveform();
    updateTrimUI();
  }

  function closeTrimmer() {
    trimmerOverlay.classList.remove('active');
    stopPreview();
    if (trimState && trimState.audioCtx) trimState.audioCtx.close();
    trimState = null;
  }

  function drawWaveform() {
    const canvas = waveformCanvas;
    const rect = waveformContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const data = trimState.decoded.getChannelData(0);
    const step = Math.ceil(data.length / w);
    const mid = h / 2;

    ctx.fillStyle = '#d4af37';

    for (let i = 0; i < w; i++) {
      let min = 1, max = -1;
      const start = i * step;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const val = data[start + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const barTop = mid + min * mid;
      const barHeight = (max - min) * mid;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(i, barTop, 1, Math.max(1, barHeight));
    }

    ctx.globalAlpha = 1;
  }

  function updateTrimUI() {
    if (!trimState) return;

    const containerW = waveformContainer.getBoundingClientRect().width;
    const leftPx = trimState.startPct * containerW;
    const rightPx = trimState.endPct * containerW;

    handleLeft.style.left = (leftPx - 8) + 'px';
    handleRight.style.left = (rightPx - 8) + 'px';

    trimOverlayLeft.style.width = leftPx + 'px';
    trimOverlayRight.style.width = (containerW - rightPx) + 'px';

    const dur = trimState.decoded.duration;
    const startSec = trimState.startPct * dur;
    const endSec = trimState.endPct * dur;
    const selDur = endSec - startSec;

    trimStartTime.textContent = formatTime(startSec);
    trimEndTime.textContent = formatTime(endSec);

    const tooLong = selDur >= 60;
    trimSelectionInfo.textContent = tooLong
      ? `Selected: ${formatTime(startSec)} — ${formatTime(endSec)} (${formatDuration(selDur)}) — must be under 1 min`
      : `Selected: ${formatTime(startSec)} — ${formatTime(endSec)} (${formatDuration(selDur)})`;
    trimConfirm.disabled = tooLong;
  }

  function getHandlePct(e) {
    const rect = waveformContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function onHandleStart(which, e) {
    e.preventDefault();
    e.stopPropagation();
    dragging = which;
    if (isPreviewing) {
      isPreviewing = false;
      stopPreview();
    }
  }

  handleLeft.addEventListener('mousedown', (e) => onHandleStart('left', e));
  handleLeft.addEventListener('touchstart', (e) => onHandleStart('left', e), { passive: false });
  handleRight.addEventListener('mousedown', (e) => onHandleStart('right', e));
  handleRight.addEventListener('touchstart', (e) => onHandleStart('right', e), { passive: false });

  function onDragMove(e) {
    if (!dragging || !trimState) return;
    e.preventDefault();

    const pct = getHandlePct(e);
    const minGap = 5 / trimState.decoded.duration;

    if (dragging === 'left') {
      trimState.startPct = Math.min(pct, trimState.endPct - minGap);
      trimState.startPct = Math.max(0, trimState.startPct);
    } else {
      trimState.endPct = Math.max(pct, trimState.startPct + minGap);
      trimState.endPct = Math.min(1, trimState.endPct);
    }

    updateTrimUI();
  }

  function onDragEnd() { dragging = null; }

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  function stopPreview() {
    if (previewSource) {
      try { previewSource.stop(); } catch(e) {}
      previewSource = null;
    }
    if (previewTimer) {
      cancelAnimationFrame(previewTimer);
      previewTimer = null;
    }
    playhead.classList.remove('active');
    trimPreviewBtn.textContent = 'preview selection';
  }

  let isPreviewing = false;

  trimPreviewBtn.addEventListener('click', () => {
    if (isPreviewing) {
      isPreviewing = false;
      stopPreview();
      return;
    }

    if (!trimState) return;
    stopPreview();

    isPreviewing = true;
    trimPreviewBtn.textContent = 'stop preview';

    const ctx = trimState.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const startSec = trimState.startPct * trimState.decoded.duration;
    const endSec = trimState.endPct * trimState.decoded.duration;
    const dur = endSec - startSec;

    previewSource = ctx.createBufferSource();
    previewSource.buffer = trimState.decoded;
    previewSource.connect(ctx.destination);
    previewSource.start(0, startSec, dur);

    const playStartTime = ctx.currentTime;
    playhead.classList.add('active');

    function animatePlayhead() {
      const elapsed = ctx.currentTime - playStartTime;
      if (elapsed >= dur) {
        stopPreview();
        isPreviewing = false;
        return;
      }
      const pct = trimState.startPct + (elapsed / dur) * (trimState.endPct - trimState.startPct);
      const containerW = waveformContainer.getBoundingClientRect().width;
      playhead.style.left = (pct * containerW) + 'px';
      previewTimer = requestAnimationFrame(animatePlayhead);
    }

    animatePlayhead();

    previewSource.onended = () => {
      isPreviewing = false;
      stopPreview();
    };
  });

  trimCancel.addEventListener('click', () => closeTrimmer());

  trimConfirm.addEventListener('click', async () => {
    if (!trimState) return;

    const { file, decoded, startPct, endPct } = trimState;
    const startSec = startPct * decoded.duration;
    const endSec = endPct * decoded.duration;
    const trimDuration = endSec - startSec;

    const sampleRate = decoded.sampleRate;
    const channels = decoded.numberOfChannels;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = Math.floor(endSec * sampleRate);
    const trimmedLength = endSample - startSample;

    const offlineCtx = new OfflineAudioContext(channels, trimmedLength, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0, startSec, trimDuration);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavArrayBuffer = audioBufferToWav(renderedBuffer);

    pendingAudio = {
      arrayBuffer: wavArrayBuffer,
      fileName: file.name,
      size: wavArrayBuffer.byteLength,
      type: 'audio/wav',
      duration: trimDuration,
    };
    defaultAudioCheck.checked = false;
    audioFileName.textContent = `${file.name} (trimmed ${formatTime(startSec)}-${formatTime(endSec)})`;
    audioUploadBtn.classList.add('has-file');
    if (!boxNameInput.value.trim()) {
      boxNameInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
    updateCreateBtn();

    closeTrimmer();
    showToast('Audio trimmed!');
  });

  // ── WAV encoder ──
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    let interleaved;
    if (numChannels === 1) {
      interleaved = buffer.getChannelData(0);
    } else {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      interleaved = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
        interleaved[i * 2] = left[i];
        interleaved[i * 2 + 1] = right[i];
      }
    }

    const dataLength = interleaved.length * (bitDepth / 8);
    const headerLength = 44;
    const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(arrayBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
      const sample = Math.max(-1, Math.min(1, interleaved[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }

    return arrayBuffer;
  }

  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // ── Preload default audio into Cache API ──
  async function preloadDefaultAudio() {
    const cache = await caches.open('musicbox-defaults');
    const cached = await cache.match(DEFAULT_AUDIO_URL);
    if (!cached) {
      try {
        await cache.add(DEFAULT_AUDIO_URL);
      } catch (e) {
        console.warn('Failed to preload default audio:', e);
      }
    }
  }

  // ── Init ──
  openDB().then(() => {
    renderBoxes();
    preloadDefaultAudio();
  });
})();
