import { escapeHtml } from './site.js';

export const CODE_VERSION = 3;

export const state = {
    config: null,
    categories: [],
    entriesById: new Map(),
    dropdownsById: new Map(),
    cart: new Map(),
    openCategories: new Set(),
    openDropdowns: new Set(),
    formulaValues: new Map()
};

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

export function getItemsPricing(items, selectedIds = null) {
    const selected = items.options.filter(option =>
        selectedIds ? selectedIds.has(option.id) : state.cart.has(option.id)
    );
    const originalTotal = roundPrice(selected.reduce((total, option) => total + option.price, 0));
    const prices = new Map(selected.map(option => [option.id, option.price]));
    const labels = new Set();

    (items.discountRules || []).forEach(rule => {
        const applies = rule.type === 'combination'
            ? rule.optionIds.every(id => selected.some(option => option.id === id))
            : rule.type === 'threshold' && originalTotal >= rule.minimumPrice;
        if (!applies) return;

        const affectedIds = rule.type === 'combination'
            ? new Set(rule.optionIds)
            : new Set(selected.map(option => option.id));
        selected.forEach(option => {
            if (!affectedIds.has(option.id)) return;
            prices.set(option.id, Math.min(
                prices.get(option.id),
                roundPrice(option.price * rule.multiplier)
            ));
        });
        labels.add(rule.label || 'SALE');
    });

    const isFullySelected = selected.length === items.options.length;
    if (isFullySelected && Number.isFinite(items.price)) {
        const fixedTotal = roundPrice(items.price);
        let allocatedTotal = 0;
        selected.forEach((option, index) => {
            if (originalTotal === 0) {
                prices.set(option.id, index === selected.length - 1 ? fixedTotal : 0);
                return;
            }
            const price = index === selected.length - 1
                ? roundPrice(fixedTotal - allocatedTotal)
                : roundPrice(fixedTotal * option.price / originalTotal);
            prices.set(option.id, price);
            allocatedTotal = roundPrice(allocatedTotal + price);
        });
        labels.clear();
        labels.add('SALE');
    }

    return {
        selectedCount: selected.length,
        originalTotal,
        total: roundPrice([...prices.values()].reduce((total, price) => total + price, 0)),
        prices,
        label: [...labels].join(' + ')
    };
}

export function getDropdownSaleTotal(dropdown) {
    return getItemsPricing(dropdown, new Set(dropdown.options.map(option => option.id))).total;
}

export function getUnitPrice(entry, cartLine = null) {
    if (entry.type === 'formula') {
        const inputValue = getFormulaInput(entry, cartLine);
        return roundPrice(Math.max(
            0,
            entry.totalQuantity - inputValue
        ) * entry.unitPrice);
    }

    if (entry.type === 'dropdown-option' || entry.type === 'choice-option') {
        const dropdown = findDropdown(entry.parentId);
        if (dropdown) {
            return getItemsPricing(dropdown).prices.get(entry.id) ?? entry.price;
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
            if (!['dropdown', 'choices'].includes(entry.type)) return;

            const pricing = getItemsPricing(entry);
            if (!pricing.selectedCount || pricing.total >= pricing.originalTotal) return;

            summaries.push({
                categoryTitle: category.title,
                dropdown: entry,
                originalTotal: pricing.originalTotal,
                saleTotal: pricing.total,
                label: pricing.label
            });
        });
    });
    return summaries;
}

function getCartDisplayRows(cartLines) {
    const saleSummaries = getSaleDropdownSummaries();
    const hiddenOptionIds = new Set(
        saleSummaries.flatMap(summary => summary.dropdown.options
            .filter(option => state.cart.has(option.id))
            .map(option => option.id))
    );
    const rows = saleSummaries.map(summary => ({
        type: 'dropdown-sale',
        categoryTitle: summary.categoryTitle,
        sortIndex: summary.dropdown.sortIndex,
        dropdown: summary.dropdown,
        label: summary.dropdown.label,
        originalTotal: summary.originalTotal,
        total: summary.saleTotal,
        saleLabel: summary.label
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
    if (entry.type === 'dropdown' || entry.type === 'choices') {
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
            || state.dropdownsById.get(id);
        if (!entry) return;

        addResolvedEntry(cart, formulaValues, entry, quantity, Number(record.inputValue));
    });

    if (cart.size === 0) {
        throw new TypeError('Pricing code contains no valid items.');
    }

    state.formulaValues = formulaValues;
    return cart;
}

export function encodePricingCode() {
    const foldedOptionIds = new Set();
    const items = [];

    state.dropdownsById.forEach(dropdown => {
        if (!isDropdownFullySelected(dropdown)) return;
        items.push({ id: dropdown.id, quantity: 1 });
        dropdown.options.forEach(option => foldedOptionIds.add(option.id));
    });

    state.cart.forEach((line, id) => {
        if (foldedOptionIds.has(id)) return;
        items.push({
            id,
            quantity: line.quantity,
            ...(Number.isFinite(line.inputValue) ? { inputValue: line.inputValue } : {})
        });
    });

    return window.btoa(unescape(encodeURIComponent(JSON.stringify({
        version: CODE_VERSION,
        items
    }))));
}

export function parsePricingCode(code) {
    const decoded = decodeBase64(String(code || '').trim()).trim();
    if (!decoded) {
        throw new TypeError('Pricing code is empty.');
    }

    const payload = JSON.parse(decoded);
    if (payload.version !== CODE_VERSION || !Array.isArray(payload.items)) {
        throw new TypeError('Unsupported pricing code version.');
    }
    return buildCart(payload.items);
}

function renderSaleRow(item) {
    return `
        <div class="cart-row cart-row--sale">
            <div class="cart-row__description cart-row__description--sale">
                <small class="cart-sale-label">${escapeHtml(item.saleLabel || 'SALE')}</small>
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
