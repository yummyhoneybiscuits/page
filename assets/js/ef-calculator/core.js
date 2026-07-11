export const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
export const CODE_VERSION = 2;

export const state = {
    config: null,
    categories: [],
    entriesById: new Map(),
    dropdownsById: new Map(),
    aliases: new Map(),
    cart: new Map(),
    openCategories: new Set(),
    openDropdowns: new Set(),
    formulaValues: new Map()
};

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

export function clampFormulaInput(entry, value) {
    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue) ? numericValue : entry.defaultValue;
    return Math.min(entry.maximum, Math.max(entry.minimum, safeValue));
}

export function getFormulaInput(entry, cartLine = null) {
    return clampFormulaInput(
        entry,
        cartLine?.inputValue
            ?? state.formulaValues.get(entry.id)
            ?? entry.defaultValue
    );
}

export function formatFormulaExpression(entry, inputValue = 'owned') {
    const currency = state.config?.currency || '¥';
    return `${entry.totalQuantity} - (${inputValue}) *${entry.unitPrice}${currency}`;
}

export function isDropdownFullySelected(dropdown) {
    return dropdown.options.every(option => state.cart.has(option.id));
}

export function findDropdown(dropdownId) {
    return state.dropdownsById.get(dropdownId) || null;
}

export function getDropdownOriginalTotal(dropdown) {
    return roundPrice(dropdown.options.reduce(
        (total, option) => total + option.price,
        0
    ));
}

export function getDropdownSaleTotal(dropdown) {
    const originalTotal = getDropdownOriginalTotal(dropdown);
    if (dropdown.offer) return dropdown.offer.price;
    if (dropdown.discount.enabled) return roundPrice(originalTotal * dropdown.discount.rate);
    return originalTotal;
}

function getSelectedDropdownOptionPrice(dropdown, option) {
    const originalTotal = getDropdownOriginalTotal(dropdown);
    const saleTotal = getDropdownSaleTotal(dropdown);

    if (originalTotal === 0) return 0;

    const optionIndex = dropdown.options.findIndex(current => current.id === option.id);
    if (optionIndex === dropdown.options.length - 1) {
        const previousTotal = dropdown.options
            .slice(0, -1)
            .reduce((total, current) =>
                total + roundPrice(saleTotal * current.price / originalTotal), 0
            );
        return roundPrice(saleTotal - previousTotal);
    }

    return roundPrice(saleTotal * option.price / originalTotal);
}

export function getUnitPrice(entry, cartLine = null) {
    if (entry.type === 'formula') {
        const inputValue = getFormulaInput(entry, cartLine);
        return roundPrice(Math.max(
            0,
            entry.totalQuantity - inputValue
        ) * entry.unitPrice);
    }

    if (entry.type === 'dropdown-option') {
        const dropdown = findDropdown(entry.parentId);
        if (dropdown && isDropdownFullySelected(dropdown)) {
            return getSelectedDropdownOptionPrice(dropdown, entry);
        }
    }

    return entry.price;
}

function getSortedCartLines() {
    return [...state.cart.entries()]
        .map(([id, line]) => ({
            entry: state.entriesById.get(id),
            line
        }))
        .filter(item => item.entry)
        .sort((a, b) => a.entry.sortIndex - b.entry.sortIndex);
}

function getSaleDropdownSummaries() {
    const summaries = [];
    state.categories.forEach(category => {
        category.entries.forEach(entry => {
            if (entry.type !== 'dropdown' || !isDropdownFullySelected(entry)) return;

            const originalTotal = getDropdownOriginalTotal(entry);
            const saleTotal = getDropdownSaleTotal(entry);
            if (saleTotal >= originalTotal) return;

            summaries.push({
                categoryTitle: category.title,
                dropdown: entry,
                originalTotal,
                saleTotal
            });
        });
    });
    return summaries;
}

function getCartDisplayRows(cartLines) {
    const saleSummaries = getSaleDropdownSummaries();
    const hiddenOptionIds = new Set(
        saleSummaries.flatMap(summary => summary.dropdown.options.map(option => option.id))
    );
    const rows = saleSummaries.map(summary => ({
        type: 'dropdown-sale',
        categoryTitle: summary.categoryTitle,
        sortIndex: summary.dropdown.sortIndex,
        dropdown: summary.dropdown,
        label: summary.dropdown.label,
        originalTotal: summary.originalTotal,
        total: summary.saleTotal
    }));

    cartLines.forEach(item => {
        if (hiddenOptionIds.has(item.entry.id)) return;
        rows.push({
            type: 'entry',
            categoryTitle: item.entry.categoryTitle,
            sortIndex: item.entry.sortIndex,
            entry: item.entry,
            line: item.line
        });
    });

    return rows.sort((a, b) => a.sortIndex - b.sortIndex);
}

function decodeBase64(code) {
    return decodeURIComponent(escape(window.atob(code)));
}

function addResolvedEntry(cart, formulaValues, entry, quantity, inputValue) {
    if (entry.type === 'dropdown') {
        entry.options.forEach(option => cart.set(option.id, { quantity: 1 }));
        return;
    }

    const maxQuantity = Number.isInteger(entry.maxQuantity) ? entry.maxQuantity : quantity;
    const line = { quantity: Math.min(quantity, maxQuantity) };
    if (entry.type === 'formula') {
        line.inputValue = clampFormulaInput(entry, inputValue);
        formulaValues.set(entry.id, line.inputValue);
    }
    cart.set(entry.id, line);
}

function buildCart(records) {
    if (!Array.isArray(records)) {
        throw new TypeError('Pricing code records must be an array.');
    }

    const cart = new Map();
    const formulaValues = new Map(state.formulaValues);

    records.forEach(record => {
        if (!record || typeof record !== 'object') return;

        const id = String(record.id || '');
        const quantity = Number(record.quantity);
        if (!id || !Number.isInteger(quantity) || quantity <= 0) return;

        const entry = state.entriesById.get(id)
            || state.dropdownsById.get(id)
            || state.aliases.get(id);
        if (!entry) return;

        addResolvedEntry(cart, formulaValues, entry, quantity, Number(record.inputValue));
    });

    if (cart.size === 0) {
        throw new TypeError('Pricing code contains no valid items.');
    }

    state.formulaValues = formulaValues;
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
    const decoded = decodeBase64(String(code || '').trim()).trim();
    if (!decoded) {
        throw new TypeError('Pricing code is empty.');
    }

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

function renderSaleRow(item) {
    return `
        <div class="cart-row cart-row--sale">
            <div class="cart-row__description cart-row__description--sale">
                <small class="cart-sale-label">${escapeHtml(item.dropdown.discount.label)}</small>
                <span>${escapeHtml(item.label)}</span>
            </div>
            <div class="cart-row__price-stack">
                <span class="price-original">${formatPrice(item.originalTotal)}</span>
                <strong class="cart-row__total price-sale">${formatPrice(item.total)}</strong>
            </div>
            <button
                class="button button--danger"
                type="button"
                data-action="remove-dropdown"
                data-dropdown-id="${escapeHtml(item.dropdown.id)}"
                data-html2canvas-ignore="true"
            >REMOVE</button>
        </div>
    `;
}

function renderEntryRow(entry, lineTotal, detail) {
    return `
        <div class="cart-row">
            <div class="cart-row__description">
                <span>${escapeHtml(entry.label)}</span>
                <small>${escapeHtml(detail)}</small>
            </div>
            <strong class="cart-row__total">${formatPrice(lineTotal)}</strong>
            <button
                class="button button--danger"
                type="button"
                data-action="remove-entry"
                data-entry-id="${escapeHtml(entry.id)}"
                data-html2canvas-ignore="true"
            >REMOVE</button>
        </div>
    `;
}

export function renderCart(elements) {
    const displayRows = getCartDisplayRows(getSortedCartLines());
    const hasItems = displayRows.length > 0;
    elements.clearButton.disabled = !hasItems;
    elements.exportButton.disabled = !hasItems;
    elements.copyButton.disabled = !hasItems;

    if (!hasItems) {
        elements.cart.innerHTML = '<p class="empty-message">NO ITEMS SELECTED</p>';
        elements.total.textContent = `TOTAL: ${formatPrice(0)}`;
        elements.generatedCode.value = '';
        return;
    }

    const grouped = new Map();
    displayRows.forEach(item => {
        const key = item.categoryTitle;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(item);
    });

    let total = 0;
    let originalTotal = 0;
    let cartHtml = '';
    grouped.forEach((items, categoryTitle) => {
        cartHtml += `<h3 class="cart-group-title">${escapeHtml(categoryTitle)}</h3>`;

        items.forEach(item => {
            if (item.type === 'dropdown-sale') {
                total = roundPrice(total + item.total);
                originalTotal = roundPrice(originalTotal + item.originalTotal);
                cartHtml += renderSaleRow(item);
                return;
            }

            const { entry, line } = item;
            const unitPrice = getUnitPrice(entry, line);
            const lineTotal = roundPrice(unitPrice * line.quantity);
            const detail = entry.type === 'formula'
                ? formatFormulaExpression(entry, line.inputValue)
                : `${formatPrice(unitPrice)} × ${line.quantity}`;
            total = roundPrice(total + lineTotal);
            originalTotal = roundPrice(originalTotal + lineTotal);
            cartHtml += renderEntryRow(entry, lineTotal, detail);
        });
    });

    elements.cart.innerHTML = cartHtml;
    elements.total.innerHTML = originalTotal > total
        ? `
            <span>TOTAL:</span>
            <span class="total-price__stack">
                <span class="price-original">${formatPrice(originalTotal)}</span>
                <strong class="price-sale">${formatPrice(total)}</strong>
            </span>
        `
        : `TOTAL: ${formatPrice(total)}`;
    elements.generatedCode.value = encodePricingCode();
}
