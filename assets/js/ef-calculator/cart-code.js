import { clampFormulaInput, isDropdownFullySelected } from './pricing.js';
import { state } from './state.js';

function decodeBase64(code) {
    return decodeURIComponent(escape(window.atob(code)));
}

function addResolvedEntry(cart, entry, quantity, inputValue) {
    if (entry.type === 'dropdown') {
        entry.options.forEach(option => cart.set(option.id, { quantity: 1 }));
        return;
    }

    const line = { quantity: Math.min(quantity, entry.maxQuantity) };
    if (entry.type === 'formula') {
        line.inputValue = clampFormulaInput(entry, inputValue);
        state.formulaValues.set(entry.id, line.inputValue);
    }
    cart.set(entry.id, line);
}

function buildCart(records) {
    const cart = new Map();

    records.forEach(record => {
        const id = String(record.id || '');
        const quantity = Number(record.quantity);
        if (!id || !Number.isInteger(quantity) || quantity <= 0) return;

        const entry = state.entriesById.get(id)
            || state.dropdownsById.get(id)
            || state.aliases.get(id);
        if (!entry) return;

        addResolvedEntry(cart, entry, quantity, Number(record.inputValue));
    });

    if (cart.size === 0) {
        throw new TypeError('Pricing code contains no valid items.');
    }
    return cart;
}

function parseCompactRecords(decoded) {
    return decoded.split(',').map(token => {
        const [id, quantity = '1', inputValue] = token.split('.');
        return { id, quantity, inputValue };
    });
}

function parseLegacyPairRecords(decoded) {
    return decoded.split(',').map(pair => {
        const [id, quantity] = pair.split(':');
        return { id, quantity };
    });
}

function parseLegacyArrayRecords(entries) {
    return entries
        .filter(entry => Array.isArray(entry) && entry.length >= 2)
        .map(([id, quantity]) => ({ id, quantity }));
}

export function encodePricingCode() {
    const foldedOptionIds = new Set();
    const tokens = [];

    state.dropdownsById.forEach(dropdown => {
        if (!isDropdownFullySelected(dropdown)) return;
        tokens.push(dropdown.id);
        dropdown.options.forEach(option => foldedOptionIds.add(option.id));
    });

    state.cart.forEach((line, id) => {
        if (foldedOptionIds.has(id)) return;
        if (Number.isFinite(line.inputValue)) {
            tokens.push(`${id}.${line.quantity}.${line.inputValue}`);
            return;
        }
        tokens.push(line.quantity === 1 ? id : `${id}.${line.quantity}`);
    });

    return window.btoa(unescape(encodeURIComponent(tokens.join(','))));
}

export function parsePricingCode(code) {
    const decoded = decodeBase64(code);

    if (decoded.startsWith('[')) {
        return buildCart(parseLegacyArrayRecords(JSON.parse(decoded)));
    }

    if (decoded.startsWith('{')) {
        const payload = JSON.parse(decoded);
        if (!Array.isArray(payload.items)) {
            throw new TypeError('Unsupported pricing code version.');
        }
        return buildCart(payload.items);
    }

    return buildCart(
        decoded.includes(':')
            ? parseLegacyPairRecords(decoded)
            : parseCompactRecords(decoded)
    );
}
