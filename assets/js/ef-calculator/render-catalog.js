import {
    createMatcher,
    formatPrice,
    formatFormulaExpression,
    getFormulaInput,
    getDropdownOriginalTotal,
    getDropdownSaleTotal,
    getUnitPrice,
    isDropdownFullySelected,
    roundPrice,
    setStatus,
    state
} from './core.js';
import { escapeHtml } from '../site.js';

const packageMatrixSelectionHistory = new Map();

function renderPrice(entry) {
    const effectivePrice = getUnitPrice(entry);
    const hasDiscount = entry.type === 'dropdown-option' && effectivePrice !== entry.price;

    if (!hasDiscount) {
        return `<span class="price-current">${formatPrice(effectivePrice)}</span>`;
    }

    return `
        <span class="price-original">${formatPrice(entry.price)}</span>
        <span class="price-sale">${formatPrice(effectivePrice)}</span>
    `;
}

function entryMatches(entry, matches) {
    if (matches(entry.title || '') || matches(entry.label || '')) return true;
    if (entry.features?.some(feature => matches(feature))) return true;
    return entry.options?.some(option =>
        matches(option.label)
        || option.features?.some(feature => matches(feature))
    ) || false;
}

function isEntryHighlighted(entry, categoryMatches, matches) {
    return categoryMatches
        || matches(entry.title || '')
        || matches(entry.label || '')
        || entry.options?.some(option => matches(option.label))
        || false;
}

function renderToggleButton({ selected, action, entryId = '' }) {
    return `
        <button
            class="button${selected ? ' button--remove' : ''}"
            type="button"
            data-action="${action}"
            ${entryId ? `data-entry-id="${escapeHtml(entryId)}"` : ''}
        >${selected ? 'REMOVE' : 'ADD'}</button>
    `;
}

function renderItem(entry, highlighted) {
    const isSelected = state.cart.has(entry.id);
    return `
        <div class="catalog-row${highlighted ? ' is-highlighted' : ''}">
            <span class="catalog-row__title">${escapeHtml(entry.label)}</span>
            <span class="catalog-row__price">${renderPrice(entry)}</span>
            ${renderToggleButton({
                selected: isSelected,
                action: 'toggle-item',
                entryId: entry.id
            })}
        </div>
    `;
}

function renderDropdown(dropdown, context) {
    const fullySelected = isDropdownFullySelected(dropdown);
    const isOpen = context.isSearching || state.openDropdowns.has(dropdown.id);
    const parentMatches = context.highlighted;
    const visibleOptions = context.isSearching
        ? dropdown.options.filter(option =>
            parentMatches || context.matches(option.label)
        )
        : dropdown.options;
    const offerPrice = dropdown.offer
        ? dropdown.offer.price
        : roundPrice(dropdown.options.reduce((total, option) => total + option.price, 0));
    const originalTotal = getDropdownOriginalTotal(dropdown);
    const selectedTotal = getDropdownSaleTotal(dropdown);
    const displayPrice = fullySelected ? selectedTotal : offerPrice;
    const hasSale = fullySelected && displayPrice < originalTotal;

    return `
        <section class="dropdown-card${isOpen ? ' is-open' : ''}${parentMatches ? ' is-highlighted' : ''}" data-dropdown-id="${escapeHtml(dropdown.id)}">
            <div class="dropdown-summary">
                <div class="dropdown-summary__copy">
                    <h4 class="dropdown-summary__title">${escapeHtml(dropdown.label)}</h4>
                    <button
                        class="dropdown-title"
                        type="button"
                        data-action="toggle-dropdown"
                        aria-expanded="${isOpen}"
                    >
                        <span
                            class="dropdown-toggle-icon"
                            aria-hidden="true"
                            style="rotate: ${isOpen ? 90 : 0}deg"
                        >&gt;</span>
                        <span>${escapeHtml(dropdown.title)}</span>
                    </button>
                </div>
                <div class="dropdown-summary__price">
                    ${hasSale
                        ? `
                            <span class="original-price-wrap">
                                <span class="sale-label">${escapeHtml(dropdown.discount.label)}</span>
                                <span class="price-original">${formatPrice(originalTotal)}</span>
                            </span>
                            <strong class="price-sale">${formatPrice(displayPrice)}</strong>
                        `
                        : `<strong class="price-current">${formatPrice(displayPrice)}</strong>`
                    }
                </div>
                <div class="dropdown-summary__actions">
                    ${renderToggleButton({
                        selected: fullySelected,
                        action: 'toggle-dropdown-options'
                    })}
                </div>
            </div>
            <div class="dropdown-options">
                ${visibleOptions.map(option => `
                    <button
                        class="option-button${state.cart.has(option.id) ? ' is-selected' : ''}${context.isSearching && context.matches(option.label) ? ' is-highlighted' : ''}"
                        type="button"
                        data-action="toggle-option"
                        data-entry-id="${escapeHtml(option.id)}"
                        aria-pressed="${state.cart.has(option.id)}"
                    >
                        <span>${escapeHtml(option.label)}</span>
                        <span class="option-button__price">${renderPrice(option)}</span>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function renderChoices(entry, context) {
    return `
        <section class="choice-entry${context.highlighted ? ' is-highlighted' : ''}">
            <h4 class="entry-title">${escapeHtml(entry.title)}</h4>
            <div class="choice-options">
                ${entry.options.map(option => `
                    <button
                        class="choice-button${state.cart.has(option.id) ? ' is-selected' : ''}${context.isSearching && context.matches(option.label) ? ' is-highlighted' : ''}"
                        type="button"
                        data-action="toggle-choice"
                        data-entry-id="${escapeHtml(option.id)}"
                        aria-pressed="${state.cart.has(option.id)}"
                    >
                        <span>${escapeHtml(option.label)}</span>
                        <span>${escapeHtml(option.priceText || formatPrice(option.price))}</span>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function getPackageSlideFrom(previousOptionIndex, selectedOptionIndex) {
    return (previousOptionIndex ?? selectedOptionIndex) - selectedOptionIndex;
}

function renderPackageHeader(option, selectedOptionId, slideFrom) {
    const isActive = selectedOptionId === option.id;
    return `
        <th
            scope="col"
            class="${isActive ? 'is-active' : ''}"
            ${isActive ? `style="--package-slide-from: ${slideFrom};"` : ''}
        >
            <span>${escapeHtml(option.label)}</span>
            <small>${escapeHtml(option.priceText || formatPrice(option.price))}</small>
        </th>
    `;
}

function renderPackageCell(option, selectedOptionId, feature, slideFrom) {
    const hasFeature = option.features.includes(feature);
    const isActive = selectedOptionId === option.id && hasFeature;
    return `
        <td
            class="${isActive ? 'is-active' : ''}"
            ${isActive ? `style="--package-slide-from: ${slideFrom};"` : ''}
        >
            ${hasFeature ? '<span class="package-check" aria-label="included">✓</span>' : ''}
        </td>
    `;
}

function renderPackageMatrix(entry, context) {
    const selectedOptionId = entry.options.find(option => state.cart.has(option.id))?.id || '';
    const selectedOptionIndex = entry.options.findIndex(option => option.id === selectedOptionId);
    const previousOptionIndex = packageMatrixSelectionHistory.get(entry.id);
    const hasActiveColumn = selectedOptionIndex >= 0;
    const shouldAnimateColumn = hasActiveColumn
        && previousOptionIndex !== undefined
        && previousOptionIndex !== selectedOptionIndex;
    const slideFrom = getPackageSlideFrom(previousOptionIndex, selectedOptionIndex);

    if (hasActiveColumn) {
        packageMatrixSelectionHistory.set(entry.id, selectedOptionIndex);
    } else {
        packageMatrixSelectionHistory.delete(entry.id);
    }

    return `
        <section class="package-matrix${context.highlighted ? ' is-highlighted' : ''}">
            <h4 class="entry-title">${escapeHtml(entry.title)}</h4>
            <div class="package-selector">
                ${entry.options.map(option => {
                    const isSelected = state.cart.has(option.id);
                    return `
                        <button
                            class="package-selector__button${isSelected ? ' is-selected' : ''}${context.isSearching && context.matches(option.label) ? ' is-highlighted' : ''}"
                            type="button"
                            data-action="toggle-package"
                            data-entry-id="${escapeHtml(option.id)}"
                            aria-pressed="${isSelected}"
                        >
                            <span>${escapeHtml(option.label)}</span>
                            <strong>${escapeHtml(option.priceText || formatPrice(option.price))}</strong>
                        </button>
                    `;
                }).join('')}
            </div>
            <div
                class="package-table-wrap${shouldAnimateColumn ? ' is-moving' : ''}"
                style="--package-option-count: ${entry.options.length};"
            >
                <table class="package-table">
                    <thead>
                        <tr>
                            <th scope="col">内容</th>
                            ${entry.options.map(option =>
                                renderPackageHeader(option, selectedOptionId, slideFrom)
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${entry.features.map(feature => `
                            <tr>
                                <th scope="row">${escapeHtml(feature)}</th>
                                ${entry.options.map(option =>
                                    renderPackageCell(option, selectedOptionId, feature, slideFrom)
                                ).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderFormula(entry, highlighted) {
    const inputValue = getFormulaInput(entry);
    const isSelected = state.cart.has(entry.id);
    return `
        <section class="formula-entry${highlighted ? ' is-highlighted' : ''}">
            <div class="formula-entry__heading">
                <h4 class="entry-title">${escapeHtml(entry.title)}</h4>
                <span class="formula-rule">
                    ${formatFormulaExpression(entry)}
                </span>
            </div>
            <div class="formula-controls">
                <input
                    class="formula-input"
                    type="number"
                    min="${entry.minimum}"
                    max="${entry.maximum}"
                    step="1"
                    value="${inputValue}"
                    data-action="formula-input"
                    data-entry-id="${escapeHtml(entry.id)}"
                    aria-label="${escapeHtml(entry.title)} owned quantity"
                >
                <output class="formula-price">${formatPrice(getUnitPrice(entry))}</output>
                ${renderToggleButton({
                    selected: isSelected,
                    action: 'apply-formula',
                    entryId: entry.id
                })}
            </div>
        </section>
    `;
}

function renderEntry(entry, context) {
    if (entry.type === 'item') return renderItem(entry, context.highlighted);
    if (entry.type === 'dropdown') return renderDropdown(entry, context);
    if (entry.type === 'package-matrix') return renderPackageMatrix(entry, context);
    if (entry.type === 'choices') return renderChoices(entry, context);
    return renderFormula(entry, context.highlighted);
}

export function renderCatalog(elements) {
    const query = elements.search.value.trim();
    const isSearching = query.length > 0;
    const { matches, isValid } = createMatcher(query);
    elements.search.setAttribute('aria-invalid', String(!isValid));
    elements.categoryNav.innerHTML = state.categories.map(category => `
        <button
            type="button"
            data-category-nav="${escapeHtml(category.id)}"
        >
            <span>${escapeHtml(category.title)}</span>
            ${category.badge ? `<small>${escapeHtml(category.badge)}</small>` : ''}
        </button>
    `).join('');

    const renderCategory = category => {
        const categoryMatches = matches(category.title);
        const entriesHtml = category.entries.map(entry => {
            if (isSearching && !categoryMatches && !entryMatches(entry, matches)) return '';
            const highlighted = isSearching && isEntryHighlighted(entry, categoryMatches, matches);
            return renderEntry(entry, {
                isSearching,
                matches,
                highlighted
            });
        }).join('');

        if (!entriesHtml) return '';

        const isOpen = isSearching || state.openCategories.has(category.id);
        const badgeHtml = category.badge
            ? `<span class="group-badge">${escapeHtml(category.badge)}</span>`
            : '';

        return `
            <section class="group${isOpen ? ' is-open' : ''}" data-category-id="${escapeHtml(category.id)}">
                <button
                    class="group-header"
                    type="button"
                    data-action="toggle-category"
                    aria-expanded="${isOpen}"
                    id="category-${escapeHtml(category.id)}"
                >
                    ${badgeHtml}
                    <h3>${escapeHtml(category.title)}</h3>
                    <span class="toggle-icon" aria-hidden="true">&gt;</span>
                </button>
                <div class="group-content">${entriesHtml}</div>
            </section>
        `;
    };
    const catalogHtml = [0, 1].map(column => `
        <div class="catalog-column">
            ${state.categories
                .filter((_, index) => index % 2 === column)
                .map(renderCategory)
                .join('')}
        </div>
    `).join('');

    elements.catalog.innerHTML = catalogHtml;
    setStatus(elements.catalogStatus, catalogHtml ? '' : 'NO MATCHING ITEMS');
}
