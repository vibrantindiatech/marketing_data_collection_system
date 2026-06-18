/**
 * ocr.js — Visiting Card OCR using Tesseract.js
 * Extracts structured data from visiting card images.
 * Supports: multiple owner names, multiple phone numbers, address,
 * spatial company-name detection (logo area), designation, website, email.
 */

const OCREngine = (() => {
  let worker = null;
  let isReady = false;

  // ── Init ──────────────────────────────────────────────────
  async function initialize(onProgress) {
    if (isReady) return;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        }
      });
      isReady = true;
    } catch (e) {
      console.error('Tesseract init failed:', e);
      throw e;
    }
  }

  // ── Scan card ─────────────────────────────────────────────
  async function scanCard(imageSource, onProgress) {
    if (!isReady) {
      await initialize(onProgress);
    }
    // Get full data including word positions for spatial analysis
    const { data } = await worker.recognize(imageSource);
    return extractFields(data.text, data);
  }

  // ── Crop logo area from card image ────────────────────────
  // Returns a data-URL of the top-left 40% × 50% of the card
  // (where logos are usually printed)
  async function extractLogoFromImage(imageDataUrl) {
    return new Promise((resolve) => {
      if (!imageDataUrl) return resolve(null);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const cropW = Math.round(img.width  * 0.45);
          const cropH = Math.round(img.height * 0.52);
          canvas.width  = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cropW, cropH, 0, 0, cropW, cropH);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageDataUrl;
    });
  }

  // ── Extract all phone numbers ─────────────────────────────
  function extractAllPhones(text) {
    // Matches Indian and international formats including:
    //  +91-XXXXX-XXXXX, 0XXXXXXX, (022) XXXXXXX, etc.
    const phoneRegex =
      /(?:\+?(?:91|1|44|61|971|65|60|86|81|82|49|33|39|34|55|27|7|966|971)[\s\-.]?)?(?:\(?\d{2,5}\)?[\s\-.]?)?\d{3,5}[\s\-.]?\d{4,5}(?:[\s\-.]?\d{2,4})?/g;

    const found = [];
    const seen  = new Set();
    let m;
    while ((m = phoneRegex.exec(text)) !== null) {
      const raw    = m[0].trim();
      const digits = raw.replace(/\D/g, '');
      // Must be 7-15 digits and not already captured
      if (digits.length >= 7 && digits.length <= 15 && !seen.has(digits)) {
        seen.add(digits);
        found.push(raw);
        if (found.length === 2) break; // max 2 numbers
      }
    }
    return found;
  }

  // ── Main field extractor ──────────────────────────────────
  function extractFields(text, ocrData) {
    const lines    = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const fullText = text;

    const result = {
      name:        '',
      name2:       '',
      designation: '',
      company:     '',
      phone:       '',
      phone2:      '',
      email:       '',
      address:     '',
      website:     '',
      raw:         text,
    };

    // ── Email ────────────────────────────────────────────────
    // Broad regex: captures most real-world email formats on visiting cards
    const emailMatch = fullText.match(/[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) result.email = emailMatch[0].trim().toLowerCase();

    // ── Website ──────────────────────────────────────────────
    const webMatch = fullText.match(/(?:www\.|https?:\/\/)[^\s,<>"]+/i);
    if (webMatch) result.website = webMatch[0].replace(/[,;.]$/, '').trim();

    // ── Phone numbers (up to 2) ──────────────────────────────
    const phones = extractAllPhones(fullText);
    if (phones[0]) result.phone  = phones[0];
    if (phones[1]) result.phone2 = phones[1];

    // ── Address ──────────────────────────────────────────────
    const addressKeywords = [
      'street', 'st.', 'road', 'rd.', 'avenue', 'ave', 'nagar', 'colony',
      'sector', 'plot', 'floor', 'building', 'bldg', 'apt', 'suite', 'flat',
      'near', 'opp', 'opposite', 'behind', 'pin', 'pincode', 'dist', 'district',
      'state', 'area', 'phase', 'block', 'lane', 'marg', 'chowk', 'bazaar',
      'market', 'complex', 'tower', 'centre', 'center', 'industrial', 'estate',
      'zone', 'village', 'taluk', 'tehsil', 'taluka', 'mandal', 'post',
      'indore', 'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune',
      'ahmedabad', 'jaipur', 'surat', 'kolkata', 'lucknow', 'nagpur',
    ];
    const addressLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return addressKeywords.some(kw => lower.includes(kw))
          || /\d{6}/.test(line);          // 6-digit PIN code
    });
    if (addressLines.length > 0) result.address = addressLines.join(', ');

    // ── Skip set (content already captured) ──────────────────
    const skipContent = [result.email, result.website].filter(Boolean);
    const isSkipLine  = (line) =>
      skipContent.some(s => line.toLowerCase().includes(s.toLowerCase()))
      || addressLines.includes(line)
      || /^[+\d(]/.test(line)
      || line.includes('@')
      || /^(www\.|http)/i.test(line)
      || line.length < 2
      || line.length > 70;

    // ── Designation keywords ─────────────────────────────────
    const designationKW = [
      'manager', 'director', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'chro',
      'president', 'vice president', 'vp', 'engineer', 'developer', 'designer',
      'analyst', 'executive', 'officer', 'head', 'lead', 'consultant',
      'associate', 'assistant', 'senior', 'junior', 'intern', 'specialist',
      'advisor', 'founder', 'co-founder', 'partner', 'proprietor', 'md', 'gm',
      'agm', 'dgm', 'sales', 'marketing', 'account', 'business development',
      'regional', 'national', 'zonal', 'area', 'branch', 'general manager',
      'managing director', 'chairperson', 'chairman', 'secretary', 'treasurer',
      'supervisor', 'coordinator', 'representative', 'agent', 'broker',
    ];

    const isDesignation = (line) => {
      const lower = line.toLowerCase();
      return designationKW.some(kw => lower.includes(kw));
    };

    // ── Candidate lines for name / company / designation ─────
    const candidates = lines.filter(line => !isSkipLine(line));

    // ── Company name: spatial (logo area) + ALL-CAPS heuristic ──
    // Strategy 1: Tesseract bounding-box – find ALL-CAPS words in top 40% of card
    let spatialCompany = '';
    if (ocrData && ocrData.words && ocrData.words.length > 0) {
      // Find card height from word bboxes
      const maxY = ocrData.words.reduce((mx, w) => Math.max(mx, w.bbox.y1), 0);
      const topThreshold = maxY * 0.42;

      // Words in top 42% of card
      const topWords = ocrData.words.filter(w =>
        w.bbox.y0 < topThreshold && w.text.trim().length > 1
      );

      // ALL-CAPS words (likely company name)
      const capsWords = topWords
        .filter(w => {
          const t = w.text.replace(/[^a-zA-Z]/g, '');
          return t.length > 1 && t === t.toUpperCase();
        })
        .map(w => w.text.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (capsWords.length > 2) spatialCompany = capsWords;
    }

    // Strategy 2: ALL-CAPS candidate lines
    const capsLines = candidates.filter(line => {
      const stripped = line.replace(/[^a-zA-Z\s&.,-]/g, '').trim();
      return stripped.length > 3
          && stripped === stripped.toUpperCase()
          && !/^(Mr|Mrs|Ms|Dr|Prof)/i.test(line);
    });

    result.company = spatialCompany || (capsLines.length > 0 ? capsLines[0] : '');

    // ── Designation ──────────────────────────────────────────
    for (const line of candidates) {
      if (line === result.company) continue;
      if (isDesignation(line)) {
        result.designation = line;
        break;
      }
    }

    // ── Names: Title-Case, not company / designation ─────────
    const nameCandidates = candidates.filter(line => {
      if (line === result.company)     return false;
      if (line === result.designation) return false;
      if (isDesignation(line))         return false;
      if (capsLines.includes(line))    return false; // already used as company
      
      const words = line.trim().split(/\s+/);
      if (words.length > 4 || words.length < 1) return false; // Name is usually 1-4 words
      if (/\d/.test(line)) return false; // typically no digits in a name

      // Must start with letter, allow initials
      return /^[A-Z]/i.test(line);
    });

    if (nameCandidates[0]) result.name  = nameCandidates[0];
    if (nameCandidates[1]) result.name2 = nameCandidates[1];

    // ── Fallback company: if still empty ─────────────────────
    if (!result.company) {
      const remaining = candidates.filter(l =>
        l !== result.name && l !== result.name2 && l !== result.designation
      );
      if (remaining.length > 0) result.company = remaining[0];
    }

    return result;
  }

  // ── isTitleCase helper ────────────────────────────────────
  function isTitleCase(str) {
    const words = str.split(/\s+/);
    return words.some(w =>
      w.length > 0 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()
    );
  }

  async function terminate() {
    if (worker) {
      await worker.terminate();
      worker = null;
      isReady = false;
    }
  }

  return { initialize, scanCard, extractLogoFromImage, terminate };
})();

window.OCREngine = OCREngine;
