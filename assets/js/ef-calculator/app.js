import { getCalculatorElements } from './dom.js';
import { HTML2CANVAS_URL } from './constants.js';
import { loadRawCatalog } from './load-catalog.js';
import { normalizeCatalog } from './normalize-catalog.js';
import { parsePricingCode } from './cart-code.js';
import {
    clampFormulaInput,
    findDropdown,
    getFormulaInput,
    getUnitPrice,
    isDropdownFullySelected
} from './pricing.js';
import { renderCart } from './render-cart.js';
import { renderCatalog } from './render-catalog.js';
import { state } from './state.js';
import { flash, formatPrice, setStatus } from './utils.js';

const elements = getCalculatorElements();
let html2canvasPromise;

function refresh() {
    renderCatalog(elements);
    renderCart(elements);
}

function toggleEntry(entryId) {
    if (state.cart.has(entryId)) {
        state.cart.delete(entryId);
    } else {
        state.cart.set(entryId, { quantity: 1 });
    }
    refresh();
}

function togglePackageOption(entryId) {
    const entry = state.entriesById.get(entryId);
    if (!entry || entry.type !== 'package-option') return;

    const wasSelected = state.cart.has(entryId);
    const packageEntry = state.categories
        .flatMap(category => category.entries)
        .find(item => item.id === entry.parentId && item.type === 'package-matrix');
    packageEntry?.options.forEach(option => state.cart.delete(option.id));

    if (!wasSelected) {
        state.cart.set(entryId, { quantity: 1 });
    }
    refresh();
}

function toggleDropdownOptions(dropdown) {
    const allSelected = isDropdownFullySelected(dropdown);
    dropdown.options.forEach(option => {
        if (allSelected) {
            state.cart.delete(option.id);
        } else {
            state.cart.set(option.id, { quantity: 1 });
        }
    });
    state.openDropdowns.add(dropdown.id);
    refresh();
}

function applyFormula(entryId) {
    const entry = state.entriesById.get(entryId);
    if (!entry || entry.type !== 'formula') return;

    if (state.cart.has(entryId)) {
        state.cart.delete(entryId);
        refresh();
        return;
    }

    const inputValue = getFormulaInput(entry);
    state.cart.set(entryId, { quantity: 1, inputValue });
    refresh();
}

function removeEntry(entryId) {
    const line = state.cart.get(entryId);
    if (!line) return;

    if (line.quantity > 1) {
        state.cart.set(entryId, { ...line, quantity: line.quantity - 1 });
    } else {
        state.cart.delete(entryId);
    }
    refresh();
}

function toggleCategory(button) {
    const categoryId = button.closest('[data-category-id]')?.dataset.categoryId;
    if (!categoryId) return;
    state.openCategories.has(categoryId)
        ? state.openCategories.delete(categoryId)
        : state.openCategories.add(categoryId);
    renderCatalog(elements);
}

function toggleDropdown(button) {
    const card = button.closest('[data-dropdown-id]');
    const dropdownId = card?.dataset.dropdownId;
    if (!dropdownId) return;

    const isOpen = !state.openDropdowns.has(dropdownId);
    if (isOpen) {
        state.openDropdowns.add(dropdownId);
    } else {
        state.openDropdowns.delete(dropdownId);
    }

    card.classList.toggle('is-open', isOpen);
    button.setAttribute('aria-expanded', String(isOpen));
    const icon = button.querySelector('.dropdown-toggle-icon');
    if (icon) {
        icon.style.rotate = `${isOpen ? 0 : -90}deg`;
    }
}

function handleCatalogClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const entryId = button.dataset.entryId;
    switch (button.dataset.action) {
        case 'toggle-category':
            toggleCategory(button);
            break;
        case 'toggle-dropdown':
            toggleDropdown(button);
            break;
        case 'toggle-dropdown-options': {
            const dropdownId = button.closest('[data-dropdown-id]')?.dataset.dropdownId;
            const dropdown = findDropdown(dropdownId);
            if (dropdown) toggleDropdownOptions(dropdown);
            break;
        }
        case 'toggle-item':
            toggleEntry(entryId);
            break;
        case 'toggle-option':
        case 'toggle-choice':
            toggleEntry(entryId);
            break;
        case 'toggle-package':
            togglePackageOption(entryId);
            break;
        case 'apply-formula':
            applyFormula(entryId);
            break;
    }
}

function handleCatalogInput(event) {
    const input = event.target.closest('[data-action="formula-input"]');
    if (!input) return;

    const entry = state.entriesById.get(input.dataset.entryId);
    if (!entry || entry.type !== 'formula') return;

    const value = clampFormulaInput(entry, input.value);
    state.formulaValues.set(entry.id, value);

    const formulaEntry = input.closest('.formula-entry');
    formulaEntry.querySelector('.formula-price').textContent = formatPrice(getUnitPrice(entry));
}

function handleCartClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'remove-entry') {
        removeEntry(button.dataset.entryId);
        return;
    }
    if (button.dataset.action === 'remove-dropdown') {
        const dropdown = findDropdown(button.dataset.dropdownId);
        dropdown?.options.forEach(option => state.cart.delete(option.id));
        refresh();
    }
}

async function copyPricingCode() {
    if (!elements.generatedCode.value) return;
    try {
        await navigator.clipboard.writeText(elements.generatedCode.value);
    } catch {
        elements.generatedCode.select();
        document.execCommand('copy');
    }
    flash(elements.generatedCode);
    setStatus(elements.codeStatus, 'CODE COPIED');
}

function loadPricingCode() {
    const code = elements.loadCode.value.trim();
    if (!code) {
        setStatus(elements.codeStatus, 'ENTER A PRICING CODE', true);
        return;
    }

    try {
        state.cart = parsePricingCode(code);
        refresh();
        flash(elements.loadCode);
        setStatus(elements.codeStatus, 'CODE LOADED');
    } catch (error) {
        console.warn('Failed to parse pricing code:', error);
        setStatus(elements.codeStatus, 'INVALID PRICING CODE', true);
    }
}

async function exportInvoice() {
    if (state.cart.size === 0) return;

    elements.exportButton.disabled = true;
    elements.exportArea.classList.add('is-exporting');
    try {
        if (typeof window.html2canvas !== 'function') {
            html2canvasPromise ??= new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = HTML2CANVAS_URL;
                script.onload = resolve;
                script.onerror = reject;
                document.head.append(script);
            });
            await html2canvasPromise;
        }
        if (typeof window.html2canvas !== 'function') {
            throw new TypeError('html2canvas failed to initialize.');
        }

        const canvas = await window.html2canvas(elements.exportArea, {
            scale: 2,
            backgroundColor: '#000000',
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        html2canvasPromise = undefined;
        console.error('Failed to export invoice:', error);
        setStatus(elements.codeStatus, 'EXPORT FAILED', true);
    } finally {
        elements.exportArea.classList.remove('is-exporting');
        elements.exportButton.disabled = false;
    }
}

function hydrateInitialUiState() {
    state.categories.forEach(category => {
        if (category.expanded) state.openCategories.add(category.id);
        category.entries.forEach(entry => {
            if (entry.type === 'dropdown' && entry.expanded) {
                state.openDropdowns.add(entry.id);
            }
            if (entry.type === 'formula') {
                state.formulaValues.set(entry.id, entry.defaultValue);
            }
        });
    });
}

async function loadCatalog() {
    setStatus(elements.catalogStatus, 'LOADING...');
    try {
        const normalized = normalizeCatalog(await loadRawCatalog());
        state.config = normalized.config;
        state.categories = normalized.categories;
        state.entriesById = normalized.entriesById;
        state.dropdownsById = normalized.dropdownsById;
        state.aliases = normalized.aliases;
        hydrateInitialUiState();
        refresh();
    } catch (error) {
        console.error('Failed to load catalog:', error);
        setStatus(elements.catalogStatus, 'FAILED TO LOAD CATALOG', true);
    }
}

function bindEvents() {
    elements.search.addEventListener('input', () => renderCatalog(elements));
    elements.regexHelpButton?.addEventListener('click', () => {
        const isHidden = elements.regexHelpPanel.hasAttribute('hidden');
        if (isHidden) {
            elements.regexHelpPanel.removeAttribute('hidden');
        } else {
            elements.regexHelpPanel.setAttribute('hidden', '');
        }
        elements.regexHelpButton.setAttribute('aria-expanded', String(isHidden));
    });
    elements.catalog.addEventListener('click', handleCatalogClick);
    elements.catalog.addEventListener('input', handleCatalogInput);
    elements.cart.addEventListener('click', handleCartClick);
    elements.clearButton.addEventListener('click', () => {
        state.cart.clear();
        refresh();
    });
    elements.copyButton.addEventListener('click', copyPricingCode);
    elements.loadButton.addEventListener('click', loadPricingCode);
    elements.loadCode.addEventListener('keydown', event => {
        if (event.key === 'Enter') loadPricingCode();
    });
    elements.exportButton.addEventListener('click', exportInvoice);
}

bindEvents();
loadCatalog();
