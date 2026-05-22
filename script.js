const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const status = document.getElementById('status');
const uiCard = document.getElementById('uiCard');
const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');
const download = document.getElementById('download');

// Configuration Interface Elements
const cutSelect = document.getElementById('cutSelect');
const marginSelect = document.getElementById('marginSelect');
const filterSelect = document.getElementById('filterSelect');
const brightRange = document.getElementById('brightRange');
const smoothRange = document.getElementById('smoothRange');

let shots = [];

// Event Listener: Sync live camera viewfinder filter with dropdown changes instantly
filterSelect.addEventListener('change', () => {
  if (filterSelect.value === 'bw') {
    video.classList.add('bw-filter');
  } else {
    video.classList.remove('bw-filter');
  }
});

// Initialize Camera Feed
async function init(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:'user',
        width:{ideal:1920},
        height:{ideal:1080}
      },
      audio:false
    });
    video.srcObject = stream;
    
    // Set initial viewfinder filter state on load based on default option selection
    if (filterSelect.value === 'bw') {
      video.classList.add('bw-filter');
    }
  }catch(e){
    status.classList.remove('hidden');
    status.textContent = 'camera permission needed';
  }
}
init();

// Utility function to handle async delays
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Countdown function that outputs values directly into the floating status overlay
async function countdown(n){
  for(let i=n; i>0; i--){
    status.textContent = i;
    await wait(1000);
  }
}

// Frame Capture & Emulsion Pixel Processor
function capture(){
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = canvas.width;
  const ch = canvas.height;

  const vr = vw/vh;
  const cr = cw/ch;

  let sx, sy, sw, sh;

  // Center crop image calculations to match preview constraints
  if(vr > cr){
    sh = vh;
    sw = vh*cr;
    sx = (vw-sw)/2;
    sy = 0;
  }else{
    sw = vw;
    sh = vw/cr;
    sx = 0;
    sy = (vh-sh)/2;
  }

  ctx.save();
  ctx.scale(-1, 1); // Mirror horizontal orientation matching the viewfinder
  ctx.translate(-cw, 0);

  ctx.drawImage(
    video,
    sx, sy, sw, sh,
    0, 0, cw, ch
  );

  ctx.restore();

  const brightLevel = parseInt(brightRange.value);
  const smoothVal = parseInt(smoothRange.value) / 100;
  const smoothRetain = 1 - smoothVal;
  const chosenFilter = filterSelect.value;

  let img = ctx.getImageData(0, 0, cw, ch);
  let d = img.data;

  // Emulsion Pixel Loop Processing
  for(let i=0; i<d.length; i+=4){
    let noise = (Math.random() - 0.5) * 12;

    // Apply basic exposure adjustments
    d[i] += noise + brightLevel;
    d[i+1] += noise + brightLevel * 0.8;
    d[i+2] += noise + brightLevel * 0.7;

    if (chosenFilter === 'bw') {
      // High-contrast, Silver Halide grayscale conversion weights
      let luminance = (d[i] * 0.299) + (d[i+1] * 0.587) + (d[i+2] * 0.114);
      d[i]   = luminance;
      d[i+1] = luminance;
      d[i+2] = luminance;
    } else {
      // Retro warm tone amplification curves
      d[i] *= 1.03;
      d[i+1] *= 1.01;
      d[i+2] *= 1.00;
    }

    // Shadow tone lift
    d[i] += 4;
    d[i+1] += 4;
    d[i+2] += 5;

    // Smoothing blend logic calculations
    let avg = (d[i] + d[i+1] + d[i+2]) / 3;
    d[i]   = d[i] * smoothRetain + avg * smoothVal;
    d[i+1] = d[i+1] * smoothRetain + avg * smoothVal;
    d[i+2] = d[i+2] * smoothRetain + avg * smoothVal;
  }

  ctx.putImageData(img, 0, 0);

  // Push finalized image array strings
  shots.push(canvas.toDataURL('image/jpeg', 0.96));

  // Trigger camera shutter flash overlay feedback action
  document.body.classList.add('flash');
  setTimeout(()=>{
    document.body.classList.remove('flash');
  }, 150);
}

// Composite Photo Strip Generator
function makeStrip(){
  const totalCuts = parseInt(cutSelect.value);
  
  const out = document.createElement('canvas');
  const o = out.getContext('2d');

  const w = 380;
  const h = 350;
  const p = 24; 
  const bottomMargin = 60; // Clean bottom edge height allocation

  out.width = w + (p * 2);
  out.height = (h * totalCuts) + (p * totalCuts) + p + bottomMargin;

  // Render margin color mask layer
  o.fillStyle = marginSelect.value;
  o.fillRect(0, 0, out.width, out.height);

  let loaded = 0;
  let imgs = [];

  shots.forEach((src, i) => {
    let im = new Image();

    im.onload = () => {
      imgs[i] = im;
      loaded++;

      if(loaded === shots.length){
        imgs.forEach((img, idx) => {
          o.drawImage(
            img,
            0, 0, img.width, img.height,
            p, p + (h + p) * idx, w, h
          );
        });

        // Exact matching target height baseline coordinate for bottom indicators
        const textBaselineY = out.height - 24;

        // --- Left aligned branding title text ---
        const isBlackMargin = marginSelect.value === '#000000';
        o.fillStyle = isBlackMargin ? '#fdfbf7' : '#2c251f';
        o.font = 'italic 20px "Playfair Display", Georgia, serif';
        o.textAlign = 'left';
        o.fillText("hmmmbooth", p, textBaselineY);

        // --- Right aligned retro camera orange date stamp string ---
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateText = `${yyyy} ${mm} ${dd}`; 

        o.fillStyle = '#FF5500'; 
        o.font = 'bold 16px "Courier New", Courier, monospace'; 
        o.textAlign = 'right';
        o.fillText(dateText, out.width - p, textBaselineY);

        // --- Apply Global Uniform Paper Texture/Grain ---
        const imgData = o.getImageData(0, 0, out.width, out.height);
        const data = imgData.data;
        for (let j = 0; j < data.length; j += 4) {
            const noise = (Math.random() - 0.5) * 8;
            data[j] = Math.min(255, Math.max(0, data[j] + noise));
            data[j+1] = Math.min(255, Math.max(0, data[j+1] + noise));
            data[j+2] = Math.min(255, Math.max(0, data[j+2] + noise));
        }
        o.putImageData(imgData, 0, 0);

        // Compile output formats
        const url = out.toDataURL('image/png');
        previewImg.src = url;
        download.href = url;
        download.download = `hmmmbooth-${totalCuts}cut.png`;

        // Clear shooting state overlays; restore configuration menu visibility card
        status.classList.add('hidden');
        uiCard.classList.remove('hidden');
        previewWrap.classList.remove('hidden');
        startBtn.textContent = "take another strip";
      }
    };

    im.src = src;
  });
}

// Session Initialization Trigger
startBtn.onclick = async () => {
  shots = [];
  const totalCuts = parseInt(cutSelect.value);

  // Instantly hide configuration component element box card layout
  uiCard.classList.add('hidden');
  
  // Bring out target countdown overlay indicator strings
  status.classList.remove('hidden');
  status.textContent = 'Get ready...';
  await wait(1200);

  // Individual image generation process flow sequences loop
  for(let i=0; i<totalCuts; i++){
    await countdown(3);
    capture();
    status.textContent = `Frame ${i+1}/${totalCuts}`;
    await wait(1200);
  }

  status.textContent = 'Developing film...';
  await wait(2000);

  // Build final film composite asset
  makeStrip();
}