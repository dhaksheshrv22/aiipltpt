// Print arbitrary HTML by injecting it into a hidden iframe and triggering
// window.print() on the iframe's contentWindow. This avoids the blank-page
// issue caused by calling window.print() on the main document (which tries
// to print the entire app shell, modal portals and overflow).

export function printHtmlInIframe(bodyHtml: string, title = "Print") {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: 'Courier New', ui-monospace, monospace;
    font-weight: 700;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { padding: 6mm 4mm; }
  .receipt { width: 100%; max-width: 78mm; margin: 0 auto; }
  .center { text-align: center; }
  .left { text-align: left; }
  .right { text-align: right; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row .label { color: #000; }
  .row .value { font-weight: 800; text-align: right; }
  .dashed { border-top: 1px dashed #000; margin: 4px 0; }
  .lg { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
  .xl { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
  .sm { font-size: 11px; }
  .md { font-size: 13px; font-weight: 800; }
  p { margin: 2px 0; }
  @page { margin: 4mm; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  doc.close();

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Give the print dialog time to grab the document before removing.
      setTimeout(() => iframe.remove(), 1000);
    }
  };

  // Defer so layout + fonts are ready before printing.
  if (iframe.contentDocument?.readyState === "complete") {
    setTimeout(trigger, 50);
  } else {
    iframe.onload = () => setTimeout(trigger, 50);
    // Fallback timer in case onload doesn't fire.
    setTimeout(trigger, 400);
  }
}
