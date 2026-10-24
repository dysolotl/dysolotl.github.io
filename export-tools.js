/* Shared page export tools. Libraries are loaded only when an export is requested. */
(function () {
    const LIBRARIES = {
        canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    };

    function loadScript(src, globalName) {
        if (globalName && window[globalName]) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Exportbibliotheek kon niet geladen worden.'));
            document.head.appendChild(script);
        });
    }

    function safeName(value) {
        return String(value || 'export')
            .trim()
            .replace(/[^a-z0-9À-ÿ]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'export';
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function makeCanvas(target) {
        await loadScript(LIBRARIES.canvas, 'html2canvas');
        return window.html2canvas(target, {
            backgroundColor: '#ffffff',
            scale: Math.min(2, window.devicePixelRatio || 1.5),
            useCORS: true,
            logging: false,
            imageTimeout: 15000,
            onclone: clonedDocument => {
                const dview = clonedDocument.defaultView;
                clonedDocument.querySelectorAll('.export-ui, .no-export').forEach(el => {
                    el.style.display = 'none';
                });
                clonedDocument.querySelectorAll('[contenteditable="true"]').forEach(el => {
                    el.style.caretColor = 'transparent';
                });

                // html2canvas renders box-shadow/text-shadow as flat grey rectangles
                // and dashed/dotted borders as solid grey lines. A stylesheet added here
                // is ignored (html2canvas snapshots styles before onclone), so clear the
                // properties directly on every element's inline style instead.
                clonedDocument.querySelectorAll('*').forEach(el => {
                    el.style.boxShadow = 'none';
                    el.style.textShadow = 'none';
                    const cs = dview ? dview.getComputedStyle(el) : null;
                    const bs = (cs && cs.borderStyle) || el.style.borderStyle;
                    if (bs === 'dashed' || bs === 'dotted') {
                        el.style.borderStyle = 'solid';
                        // keep the border visible, but in the element's own color
                        // instead of the grey html2canvas paints for dashed borders
                        el.style.borderColor = (cs && cs.color) || '#999';
                    }
                });

                // Hover-only tone pickers and semi-transparent block headers flatten to
                // grey in the export; keep them out or make them opaque.
                clonedDocument.querySelectorAll('.tone-group').forEach(el => {
                    el.style.display = 'none';
                });
                clonedDocument.querySelectorAll('.block-header').forEach(el => {
                    el.style.background = '#ffffff';
                });
            }
        });
    }

    async function exportPng(target, name) {
        const canvas = await makeCanvas(target);
        canvas.toBlob(blob => {
            if (blob) downloadBlob(blob, `${safeName(name)}.png`);
        }, 'image/png');
    }

    async function exportPdf(target, name) {
        const canvas = await makeCanvas(target);
        await loadScript(LIBRARIES.pdf, 'jspdf');
        const { jsPDF } = window.jspdf;
        const landscape = canvas.width > canvas.height;
        const doc = new jsPDF({
            orientation: landscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pageWidth = landscape ? 297 : 210;
        const pageHeight = landscape ? 210 : 297;
        const margin = 10;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const width = canvas.width * ratio;
        const height = canvas.height * ratio;
        const image = canvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(image, 'JPEG', (pageWidth - width) / 2, margin, width, height);
        doc.save(`${safeName(name)}.pdf`);
    }

    function setBusy(button, busy, label) {
        button.disabled = busy;
        button.textContent = busy ? 'Bezig…' : label;
    }

    function addButtons(target, name) {
        if (!target || (target.parentElement && target.parentElement.querySelector(':scope > .export-ui'))) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'export-ui';
        toolbar.innerHTML = `
            <span class="export-label">Exporteren</span>
            <button type="button" class="export-pdf">PDF downloaden</button>
            <button type="button" class="export-png">PNG downloaden</button>
        `;
        // Place the bar directly above the exported content when possible.
        if (target.parentElement) target.parentElement.insertBefore(toolbar, target);
        else document.body.appendChild(toolbar);

        const pdfButton = toolbar.querySelector('.export-pdf');
        const pngButton = toolbar.querySelector('.export-png');
        pdfButton.addEventListener('click', async () => {
            setBusy(pdfButton, true, 'PDF downloaden');
            try { await exportPdf(target, name); }
            catch (error) { console.error(error); alert('Export mislukt: ' + error.message); }
            finally { setBusy(pdfButton, false, 'PDF downloaden'); }
        });
        pngButton.addEventListener('click', async () => {
            setBusy(pngButton, true, 'PNG downloaden');
            try { await exportPng(target, name); }
            catch (error) { console.error(error); alert('Export mislukt: ' + error.message); }
            finally { setBusy(pngButton, false, 'PNG downloaden'); }
        });
    }

    function mount() {
        const body = document.body;
        if (!body) return;

        const targetSelector = body.dataset.exportTarget;
        if (!targetSelector) return;
        const target = document.querySelector(targetSelector);
        if (!target) return;

        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');
            body, button, input, textarea, select { font-family: "Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif; }
            body { font-size: 16px; }
            .export-ui { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin: 0 auto 16px; max-width: 1500px; }
            .export-label { color: #475569; font-size: 14px; font-weight: 700; margin-right: 2px; }
            .export-ui button { padding: 8px 13px; border: 1px solid #b8c4d1; border-radius: 7px; background: #fff; color: #1e3a5f; cursor: pointer; font-size: 14px; font-weight: 700; }
            .export-ui button:hover { background: #eef6ff; border-color: #2674b9; }
            .export-ui button:disabled { opacity: .6; cursor: wait; }
            @media (max-width: 600px) { .export-ui { justify-content: stretch; } .export-label { width: 100%; } .export-ui button { flex: 1; } }
            @media print { .export-ui, .topbar, .hint, .bar { display: none !important; } }
        `;
        document.head.appendChild(style);

        // Pages that already provide their own export controls opt out with data-export-ui="none".
        if (body.dataset.exportUi === 'none') return;
        addButtons(target, body.dataset.exportName || document.title);
    }

    window.ExportTools = { addButtons, exportPdf, exportPng };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
