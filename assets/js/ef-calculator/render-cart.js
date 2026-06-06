import { encodePricingCode } from './cart-code.js';
import {
    formatFormulaExpression,
    getCartDisplayRows,
    getSortedCartLines,
    getUnitPrice
} from './pricing.js';
import { escapeHtml, formatPrice, roundPrice } from './utils.js';

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

function renderEntryRow(entry, line, lineTotal, detail) {
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
    const cartLines = getSortedCartLines();
    const displayRows = getCartDisplayRows(cartLines);
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
            cartHtml += renderEntryRow(entry, line, lineTotal, detail);
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
