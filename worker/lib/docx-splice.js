// Finds and replaces text inside a raw word/document.xml string while preserving
// every run's original formatting (<w:rPr>). Word frequently splits a single
// visible phrase across multiple <w:r> runs (spellcheck/rsid churn), so a plain
// string.replace() on the XML would miss most real-world matches — this instead
// flattens each paragraph's run text into one searchable string with an
// offset->run map, then splices only the runs a match actually touches.
//
// Scope: only <w:p> paragraphs inside word/document.xml are touched (this
// naturally covers table cells too, since <w:p> regex matches don't care about
// <w:tbl>/<w:tc> nesting). Headers, footers and footnotes live in separate XML
// parts and are never passed in here — out of scope for Phase 1.

const PARA_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const RUN_RE = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
const RPR_RE = /<w:rPr>[\s\S]*?<\/w:rPr>/;
const T_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/;
const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const BLANK_RE = /_{3,}/g;

function decodeXmlEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function encodeXmlText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildRun(rPr, text) {
  return `<w:r>${rPr}<w:t xml:space="preserve">${encodeXmlText(text)}</w:t></w:r>`;
}

// Splits a paragraph's inner XML into an ordered list of segments: "run" segments
// (which carry the run's formatting + decoded text) and "glue" segments (pPr,
// bookmarks, proofErr markers, etc. — zero text length, passed through untouched).
function parseRuns(innerXml) {
  const segments = [];
  let lastIndex = 0;
  RUN_RE.lastIndex = 0;
  let m;
  while ((m = RUN_RE.exec(innerXml))) {
    if (m.index > lastIndex) segments.push({ type: "glue", xml: innerXml.slice(lastIndex, m.index) });
    const runXml = m[0];
    const rPrMatch = runXml.match(RPR_RE);
    const tMatch = runXml.match(T_RE);
    segments.push({
      type: "run",
      xml: runXml,
      rPr: rPrMatch ? rPrMatch[0] : "",
      text: tMatch ? decodeXmlEntities(tMatch[1]) : "",
    });
    lastIndex = RUN_RE.lastIndex;
  }
  if (lastIndex < innerXml.length) segments.push({ type: "glue", xml: innerXml.slice(lastIndex) });
  return segments;
}

function flatText(segments) {
  return segments.filter((s) => s.type === "run").map((s) => s.text).join("");
}

// Replaces the [start, end) span of the segments' combined run-text with newText,
// in a single forward pass. Runs fully outside the span pass through unchanged;
// the first run touched by the span keeps its own rPr for both its untouched
// prefix AND the newly inserted text; the last run touched keeps its own rPr for
// its untouched suffix; any runs fully consumed in between are dropped.
function spliceSpan(segments, start, end, newText) {
  const out = [];
  let offset = 0;
  let inserted = false;

  for (const seg of segments) {
    if (seg.type !== "run") {
      out.push(seg);
      continue;
    }
    const segStart = offset;
    const segEnd = offset + seg.text.length;
    offset = segEnd;

    const overlapStart = Math.max(segStart, start);
    const overlapEnd = Math.min(segEnd, end);
    if (overlapStart >= overlapEnd) {
      out.push(seg);
      continue;
    }

    const prefix = seg.text.slice(0, overlapStart - segStart);
    const suffix = seg.text.slice(overlapEnd - segStart);
    if (prefix) out.push({ type: "run", xml: buildRun(seg.rPr, prefix), text: prefix });
    if (!inserted) {
      out.push({ type: "run", xml: buildRun(seg.rPr, newText), text: newText });
      inserted = true;
    }
    if (suffix) out.push({ type: "run", xml: buildRun(seg.rPr, suffix), text: suffix });
  }
  return out;
}

function replaceInParagraph(paraXml, oldText, newText, maxCount) {
  if (maxCount <= 0 || !oldText) return { xml: paraXml, count: 0 };

  const openTag = paraXml.match(/^<w:p\b[^>]*>/)[0];
  const closeTag = "</w:p>";
  const inner = paraXml.slice(openTag.length, paraXml.length - closeTag.length);

  let segments = parseRuns(inner);
  let text = flatText(segments);
  let count = 0;
  let searchFrom = 0;

  while (count < maxCount) {
    const idx = text.indexOf(oldText, searchFrom);
    if (idx === -1) break;
    segments = spliceSpan(segments, idx, idx + oldText.length, newText);
    count++;
    text = flatText(segments);
    searchFrom = idx + newText.length;
  }

  if (count === 0) return { xml: paraXml, count: 0 };
  return { xml: openTag + segments.map((s) => s.xml).join("") + closeTag, count };
}

// Returns the document's visible body+table text as one string, paragraphs
// joined by "\n". This is the canonical text to hand the LLM — it must match
// character-for-character what applyReplacements() searches against, so it's
// derived the same way (straight from the XML), never from a separate
// mammoth/pdfjs extraction which handles whitespace differently.
function extractFlatText(documentXml) {
  const paragraphs = documentXml.match(PARA_RE) || [];
  return paragraphs
    .map((p) => {
      const openTag = p.match(/^<w:p\b[^>]*>/)[0];
      const inner = p.slice(openTag.length, p.length - "</w:p>".length);
      return flatText(parseRuns(inner));
    })
    .join("\n");
}

// Locates runs of 3+ underscores ("fill-in-the-blank" lines, common in contract
// templates) with surrounding context. Unlike free-text substring matching, this
// gives the caller exact (paragraphIndex, start, end) offsets up front — no need
// for the LLM to reproduce a long, easy-to-miscount underscore run character-for-
// character just to locate it.
function findBlanks(documentXml, contextChars = 40) {
  const paragraphs = documentXml.match(PARA_RE) || [];
  const blanks = [];
  let id = 0;

  paragraphs.forEach((p, paragraphIndex) => {
    const openTag = p.match(/^<w:p\b[^>]*>/)[0];
    const inner = p.slice(openTag.length, p.length - "</w:p>".length);
    const text = flatText(parseRuns(inner));

    BLANK_RE.lastIndex = 0;
    let m;
    while ((m = BLANK_RE.exec(text))) {
      const start = m.index;
      const end = m.index + m[0].length;
      blanks.push({
        id: id++,
        paragraphIndex,
        start,
        end,
        before: text.slice(Math.max(0, start - contextChars), start),
        after: text.slice(end, end + contextChars),
      });
    }
  });

  return blanks;
}

// Fills specific blank spans found by findBlanks(). fills: [{ id, paragraphIndex,
// start, end, value }]. Offsets are exact (computed by findBlanks against the same
// XML), so this never needs to search for text — it can't misfire on a repeated
// blank the way substring matching would.
function applyBlankFills(documentXml, fills) {
  const applied = [];
  const byParagraph = new Map();
  for (const f of fills) {
    if (!byParagraph.has(f.paragraphIndex)) byParagraph.set(f.paragraphIndex, []);
    byParagraph.get(f.paragraphIndex).push(f);
  }

  let paragraphIndex = -1;
  const newXml = documentXml.replace(PARA_RE, (paraMatch) => {
    paragraphIndex++;
    const list = byParagraph.get(paragraphIndex);
    if (!list || list.length === 0) return paraMatch;

    const openTag = paraMatch.match(/^<w:p\b[^>]*>/)[0];
    const closeTag = "</w:p>";
    const inner = paraMatch.slice(openTag.length, paraMatch.length - closeTag.length);
    let segments = parseRuns(inner);

    // Right-to-left so earlier spans' offsets stay valid as later ones splice in.
    const sorted = [...list].sort((a, b) => b.start - a.start);
    for (const f of sorted) {
      segments = spliceSpan(segments, f.start, f.end, f.value);
      applied.push({ id: f.id, value: f.value });
    }
    return openTag + segments.map((s) => s.xml).join("") + closeTag;
  });

  return { xml: newXml, applied };
}

function findPlaceholders(text) {
  const names = new Set();
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text))) names.add(m[1].trim());
  return Array.from(names);
}

// replacements: [{ oldText, newText, replaceAll }]. replaceAll=true replaces every
// occurrence across the whole document (placeholder mode); false replaces only the
// first occurrence found (freeform mode, to avoid over-replacing generic phrases).
function countOccurrences(text, sub) {
  if (!sub) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(sub, idx)) !== -1) {
    count++;
    idx += sub.length;
  }
  return count;
}

function applyReplacements(documentXml, replacements) {
  const applied = [];
  const skipped = [];
  let workingXml = documentXml;

  for (const { oldText, newText, replaceAll } of replacements) {
    if (!oldText || !oldText.trim()) {
      skipped.push({ oldText, reason: "empty" });
      continue;
    }

    // Templates often repeat an identical blank ("__________") in several unrelated
    // spots. If oldText isn't unique, blindly taking the first match would silently
    // fill the wrong field — safer to skip and surface it than guess.
    if (!replaceAll) {
      const occurrences = countOccurrences(extractFlatText(workingXml), oldText);
      if (occurrences === 0) {
        skipped.push({ oldText, reason: "not_found" });
        continue;
      }
      if (occurrences > 1) {
        skipped.push({ oldText, reason: "ambiguous" });
        continue;
      }
    }

    let totalCount = 0;
    workingXml = workingXml.replace(PARA_RE, (paraMatch) => {
      const remaining = replaceAll ? Infinity : totalCount > 0 ? 0 : 1;
      const result = replaceInParagraph(paraMatch, oldText, newText, remaining);
      totalCount += result.count;
      return result.xml;
    });
    if (totalCount > 0) applied.push({ oldText, newText, count: totalCount });
    else skipped.push({ oldText, reason: "not_found" });
  }

  return { xml: workingXml, applied, skipped };
}

// Fills {{name}} placeholders from a { name: value } map. Locates spans via
// PLACEHOLDER_RE directly (rather than string-searching for a reconstructed
// "{{name}}") since the original markup may have different internal spacing
// than a freshly-built literal would ("{{ФИО}}" vs "{{ ФИО }}").
function applyPlaceholders(documentXml, valueMap) {
  const applied = [];
  const unmatched = new Set(Object.keys(valueMap));

  const newXml = documentXml.replace(PARA_RE, (paraMatch) => {
    const openTag = paraMatch.match(/^<w:p\b[^>]*>/)[0];
    const closeTag = "</w:p>";
    const inner = paraMatch.slice(openTag.length, paraMatch.length - closeTag.length);
    let segments = parseRuns(inner);
    const text = flatText(segments);

    const spans = [];
    PLACEHOLDER_RE.lastIndex = 0;
    let m;
    while ((m = PLACEHOLDER_RE.exec(text))) {
      const name = m[1].trim();
      if (Object.prototype.hasOwnProperty.call(valueMap, name)) {
        spans.push({ start: m.index, end: m.index + m[0].length, name, value: String(valueMap[name]) });
      }
    }
    if (spans.length === 0) return paraMatch;

    // Apply right-to-left so earlier spans' offsets stay valid as later ones splice in.
    spans.sort((a, b) => b.start - a.start);
    for (const span of spans) {
      segments = spliceSpan(segments, span.start, span.end, span.value);
      applied.push({ oldText: `{{${span.name}}}`, newText: span.value, count: 1 });
      unmatched.delete(span.name);
    }
    return openTag + segments.map((s) => s.xml).join("") + closeTag;
  });

  const skipped = Array.from(unmatched).map((name) => ({ oldText: `{{${name}}}`, reason: "not_found" }));
  return { xml: newXml, applied, skipped };
}

module.exports = { extractFlatText, findPlaceholders, applyReplacements, applyPlaceholders, findBlanks, applyBlankFills, PLACEHOLDER_RE, BLANK_RE };
