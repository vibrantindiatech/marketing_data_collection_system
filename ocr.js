/**
 * ocr.js — Visiting Card OCR using Tesseract.js
 * Extracts structured data from visiting card images
 */

const OCREngine = (() => {
  let worker = null;
  let isReady = false;

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

  async function scanCard(imageSource, onProgress) {
    if (!isReady) {
      await initialize(onProgress);
    }

    const { data } = await worker.recognize(imageSource);
    const rawText = data.text;
    return extractFields(rawText);
  }

  function extractFields(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = text.toLowerCase();

    const result = {
      name: '',
      designation: '',
      company: '',
      phone: '',
      email: '',
      address: '',
      website: '',
      raw: text,
    };

    // Email extraction
    const emailMatch = text.match(/[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) result.email = emailMatch[0].trim();

    // Phone extraction (various formats)
    const phonePatterns = [
      /(?:ph|phone|tel|mob|mobile|cell|m|t|p)[:\s.]*([+\d\s\-().]{8,})/i,
      /(\+?[\d\s\-().]{10,})/,
    ];
    for (const pat of phonePatterns) {
      const m = text.match(pat);
      if (m) {
        const cleaned = m[1].replace(/[^\d+\s\-()]/g, '').trim();
        if (cleaned.replace(/\D/g, '').length >= 7) {
          result.phone = cleaned;
          break;
        }
      }
    }

    // Website extraction
    const webMatch = text.match(/(?:www\.|https?:\/\/)[^\s,]+/i);
    if (webMatch) result.website = webMatch[0].trim();

    // Address heuristics
    const addressKeywords = ['street', 'road', 'avenue', 'nagar', 'colony', 'sector',
      'plot', 'floor', 'building', 'apt', 'suite', 'near', 'opp', 'behind',
      'pin', 'dist', 'district', 'state', 'city'];
    const addressLines = lines.filter(line =>
      addressKeywords.some(kw => line.toLowerCase().includes(kw)) ||
      /\d{6}/.test(line) // PIN code
    );
    if (addressLines.length > 0) result.address = addressLines.join(', ');

    // Name (usually the first prominent line, often Title Case)
    const skipPatterns = [
      /^(www|http|@|\+|\d)/i,
      new RegExp(result.email, 'i'),
      new RegExp(result.website, 'i'),
    ];
    const nameCandidates = lines.filter(line => {
      if (skipPatterns.some(p => p.test(line))) return false;
      if (line.length < 3 || line.length > 50) return false;
      // Prefer Title Case lines
      return true;
    });

    // Designation keywords
    const designationKeywords = ['manager', 'director', 'ceo', 'cto', 'cfo',
      'president', 'vice', 'engineer', 'developer', 'designer', 'analyst',
      'executive', 'officer', 'head', 'lead', 'consultant', 'associate',
      'assistant', 'senior', 'junior', 'intern', 'specialist', 'advisor',
      'founder', 'partner', 'proprietor', 'md', 'gm'];

    let nameIdx = -1;
    for (let i = 0; i < nameCandidates.length; i++) {
      const lower = nameCandidates[i].toLowerCase();
      if (designationKeywords.some(kw => lower.includes(kw))) {
        result.designation = nameCandidates[i];
      } else if (nameIdx === -1 && isTitleCase(nameCandidates[i])) {
        result.name = nameCandidates[i];
        nameIdx = i;
      }
    }

    // Company name: often ALL CAPS or after designation
    const companyCandidates = nameCandidates.filter(line => {
      if (line === result.name || line === result.designation) return false;
      return line === line.toUpperCase() && line.length > 3;
    });
    if (companyCandidates.length > 0) {
      result.company = companyCandidates[0];
    } else {
      // Take remaining lines as company
      const remaining = nameCandidates.filter(l =>
        l !== result.name && l !== result.designation && l !== result.address
      );
      if (remaining.length > 0) result.company = remaining[0];
    }

    return result;
  }

  function isTitleCase(str) {
    const words = str.split(/\s+/);
    return words.some(w => w.length > 0 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase());
  }

  async function terminate() {
    if (worker) {
      await worker.terminate();
      worker = null;
      isReady = false;
    }
  }

  return { initialize, scanCard, terminate };
})();

window.OCREngine = OCREngine;
