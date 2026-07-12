const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
let html2canvasPromise;

export function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`JSON request failed: ${response.status} ${url}`);
    }
    return response.json();
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }
}

export async function loadHtml2Canvas() {
    if (typeof window.html2canvas === 'function') return window.html2canvas;

    html2canvasPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HTML2CANVAS_URL;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
    });

    try {
        await html2canvasPromise;
    } catch (error) {
        html2canvasPromise = undefined;
        throw error;
    }

    if (typeof window.html2canvas !== 'function') {
        html2canvasPromise = undefined;
        throw new TypeError('html2canvas failed to initialize.');
    }
    return window.html2canvas;
}
