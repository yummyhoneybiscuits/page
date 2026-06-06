import { state } from './state.js';
import { roundPrice } from './utils.js';

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

export function getSelectedDropdownOptionPrice(dropdown, option) {
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

export function getSortedCartLines() {
    return [...state.cart.entries()]
        .map(([id, line]) => ({
            entry: state.entriesById.get(id),
            line
        }))
        .filter(item => item.entry)
        .sort((a, b) => a.entry.sortIndex - b.entry.sortIndex);
}

export function getSaleDropdownSummaries() {
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

export function getCartDisplayRows(cartLines) {
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
