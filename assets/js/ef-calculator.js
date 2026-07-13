import { loadPricingData } from './data-loader.js';
import { copyText, loadHtml2Canvas, revealJsonContent } from './site.js';
import { normalizePricingData } from './data-normalize.js';
import {
    clampFormulaInput,
    findDropdown,
    getFormulaInput,
    getUnitPrice,
    isDropdownFullySelected,
    parsePricingCode,
    renderCart,
    state,
    flash,
    formatPrice,
    setStatus
} from './ef-calculator-core.js';
import { renderPricingData } from './data-render.js';

function getCalculatorElements() {
    const selectors = {
        data: '#pricingData',
        dataBrowser: '.data-browser',
        categoryNav: '#categoryNavItems',
        dataStatus: '#dataStatus',
        search: '#searchInput',
        regexHelpButton: '#regexHelpButton',
        regexHelpPanel: '#regexHelpPanel',
        cart: '#cartContainer',
        total: '#totalPrice',
        generatedCode: '#generatedCode',
        loadCode: '#loadCodeInput',
        codeStatus: '#codeStatus',
        clearButton: '#clearCartButton',
        exportButton: '#exportButton',
        copyButton: '#copyCodeButton',
        loadButton: '#loadCodeButton',
        exportArea: '#exportArea',
        cartDialog: '#cartDialog',
        openCartButton: '#openCartButton',
        closeCartButton: '#closeCartButton'
    };
    const elements = Object.fromEntries(
        Object.entries(selectors).map(([key, selector]) => [key, document.querySelector(selector)])
    );
    const missing = Object.entries(elements)
        .filter(([, element]) => !element)
        .map(([key]) => key);
    if (missing.length) {
        throw new Error(`Calculator DOM initialization failed: ${missing.join(', ')}`);
    }
    return elements;
}

const elements = getCalculatorElements();

function refresh() {
    renderPricingData(elements);
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
    renderPricingData(elements);
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
        icon.style.rotate = `${isOpen ? 90 : 0}deg`;
    }
}

function handleDataClick(event) {
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

function handleDataInput(event) {
    const input = event.target.closest('[data-action="formula-input"]');
    if (!input) return;

    const entry = state.entriesById.get(input.dataset.entryId);
    if (!entry || entry.type !== 'formula') return;

    const value = clampFormulaInput(entry, input.value);
    state.formulaValues.set(entry.id, value);

    const cartLine = state.cart.get(entry.id);
    if (cartLine) {
        state.cart.set(entry.id, { ...cartLine, inputValue: value });
        renderCart(elements);
    }

    const formulaEntry = input.closest('.formula-entry');
    const priceOutput = formulaEntry?.querySelector('.formula-price');
    if (priceOutput) priceOutput.textContent = formatPrice(getUnitPrice(entry));
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
    await copyText(elements.generatedCode.value);
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
        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(elements.exportArea, {
            scale: 2,
            backgroundColor: '#000000',
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
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

async function loadData() {
    elements.dataBrowser.classList.add('is-json-loading');
    elements.dataBrowser.setAttribute('aria-busy', 'true');
    setStatus(elements.dataStatus, 'LOADING...');
    try {
        const normalized = normalizePricingData(await loadPricingData());
        state.config = normalized.config;
        state.categories = normalized.categories;
        state.entriesById = normalized.entriesById;
        state.dropdownsById = normalized.dropdownsById;
        hydrateInitialUiState();
        refresh();
    } catch (error) {
        console.error('Failed to load pricing data:', error);
        setStatus(elements.dataStatus, 'FAILED TO LOAD DATA', true);
    } finally {
        revealJsonContent(elements.dataBrowser);
    }
}

function bindEvents() {
    elements.search.addEventListener('input', () => renderPricingData(elements));
    elements.categoryNav.addEventListener('click', event => {
        const button = event.target.closest('button[data-category-nav]');
        if (!button) return;
        state.openCategories.add(button.dataset.categoryNav);
        renderPricingData(elements);
        requestAnimationFrame(() => {
            const heading = document.getElementById(`category-${button.dataset.categoryNav}`);
            const group = heading?.closest('.group');
            if (group) {
                const top = window.scrollY + group.getBoundingClientRect().top - 14;
                window.scrollTo({ top, behavior: 'smooth' });
            }
            heading?.focus({ preventScroll: true });
            group?.classList.remove('is-navigation-flash');
            requestAnimationFrame(() => group?.classList.add('is-navigation-flash'));
        });
    });
    elements.regexHelpButton?.addEventListener('click', () => {
        const isHidden = elements.regexHelpPanel.hasAttribute('hidden');
        if (isHidden) {
            elements.regexHelpPanel.removeAttribute('hidden');
        } else {
            elements.regexHelpPanel.setAttribute('hidden', '');
        }
        elements.regexHelpButton.setAttribute('aria-expanded', String(isHidden));
    });
    elements.data.addEventListener('click', handleDataClick);
    elements.data.addEventListener('input', handleDataInput);
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
    elements.openCartButton.addEventListener('click', () => elements.cartDialog.showModal());
    elements.closeCartButton.addEventListener('click', () => elements.cartDialog.close());
    elements.cartDialog.addEventListener('click', event => {
        if (event.target === elements.cartDialog) elements.cartDialog.close();
    });
}

bindEvents();
loadData();
