import { state } from './state.js';

export function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function roundPrice(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPrice(value) {
    const formatted = Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return `${state.config?.currency || '¥'}${formatted}`;
}

export function setStatus(element, message = '', isError = false) {
    element.textContent = message;
    element.classList.toggle('is-error', isError);
}

export function flash(element) {
    element.classList.remove('flash-success');
    requestAnimationFrame(() => element.classList.add('flash-success'));
    window.setTimeout(() => element.classList.remove('flash-success'), 500);
}

export function createMatcher(query) {
    if (!query) return { matches: () => false, isValid: true };

    try {
        const expression = new RegExp(query, 'i');
        return {
            matches: value => expression.test(String(value)),
            isValid: true
        };
    } catch {
        const normalizedQuery = query.toLocaleLowerCase();
        return {
            matches: value => String(value).toLocaleLowerCase().includes(normalizedQuery),
            isValid: false
        };
    }
}
