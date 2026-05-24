function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeJsString(text) {
  if (!text) return "";
  return String(text).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}
