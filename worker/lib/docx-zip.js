const PizZip = require("pizzip");

function loadDocx(buffer) {
  return new PizZip(buffer);
}

function readXml(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  return file.asText();
}

function writeXml(zip, path, xml) {
  zip.file(path, xml);
}

function toBuffer(zip) {
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { loadDocx, readXml, writeXml, toBuffer };
