import { loadCatalogFiles } from './catalog-loader.js';

const elements = {
    categoryList: document.getElementById('categoryList'),
    entryList: document.getElementById('entryList'),
    categoryForm: document.getElementById('categoryForm'),
    entryForm: document.getElementById('entryForm'),
    preview: document.getElementById('jsonPreview'),
    previewLabel: document.getElementById('previewLabel'),
    status: document.getElementById('editorStatus')
};

const state = {
    manifest: null,
    categories: [],
    selectedCategoryId: '',
    selectedEntryId: '',
    previewMode: 'category',
    dragCategoryId: '',
    dragEntryId: '',
    dragFeature: null
};

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('is-error', isError);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function loadCatalog() {
    const { manifest, categories } = await loadCatalogFiles();

    state.manifest = manifest;
    state.categories = categories;
    state.selectedCategoryId = categories[0]?.data.id || '';
    state.selectedEntryId = categories[0]?.data.entries?.[0]?.id || '';
    state.previewMode = 'category';
    state.dragCategoryId = '';
    state.dragEntryId = '';
}

function getSelectedCategory() {
    return state.categories.find(category => category.data.id === state.selectedCategoryId) || null;
}

function getSelectedEntry() {
    const category = getSelectedCategory();
    return category?.data.entries.find(entry => entry.id === state.selectedEntryId) || null;
}

function renderCategoryList() {
    elements.categoryList.innerHTML = state.categories.map(category => `
        <button
            type="button"
            data-category-id="${escapeHtml(category.data.id)}"
            draggable="true"
            class="${category.data.id === state.selectedCategoryId ? 'is-active' : ''}"
        >
            <span>${escapeHtml(category.data.title)}</span>
            <small>${escapeHtml(category.file)}</small>
        </button>
    `).join('');
}

function entryLabel(entry) {
    if (entry.type === 'dropdown') return `${entry.label} / ${entry.title}`;
    return entry.label || entry.title || entry.id;
}

function renderEntryList() {
    const category = getSelectedCategory();
    if (!category) {
        elements.entryList.innerHTML = '';
        return;
    }

    if (!category.data.entries.length) {
        elements.entryList.innerHTML = '<small>No entries</small>';
        return;
    }

    elements.entryList.innerHTML = category.data.entries.map(entry => `
        <button
            type="button"
            data-entry-id="${escapeHtml(entry.id)}"
            draggable="true"
            class="${entry.id === state.selectedEntryId ? 'is-active' : ''}"
        >
            <span>${escapeHtml(entryLabel(entry))}</span>
            <small>${escapeHtml(entry.type)}</small>
        </button>
    `).join('');
}

function renderCategoryForm() {
    const category = getSelectedCategory();
    if (!category) {
        elements.categoryForm.innerHTML = '';
        return;
    }

    const data = category.data;
    elements.categoryForm.innerHTML = `
        <div class="editor-field">
            <label for="categoryTitle">Title</label>
            <input id="categoryTitle" data-category-field="title" value="${escapeHtml(data.title || '')}">
        </div>
        <div class="editor-field">
            <label for="categoryBadge">Badge</label>
            <input id="categoryBadge" data-category-field="badge" value="${escapeHtml(data.badge || '')}">
        </div>
        <div class="editor-field">
            <label for="categoryExpanded">Expanded</label>
            <select id="categoryExpanded" data-category-field="expanded">
                <option value="true"${data.expanded ? ' selected' : ''}>true</option>
                <option value="false"${!data.expanded ? ' selected' : ''}>false</option>
            </select>
        </div>
    `;
}

function renderTextList(field, items, title) {
    return `
        <div class="editor-list-field">
            <div class="editor-list-field__header">
                <h3>${escapeHtml(title)}</h3>
                <button class="editor-button" type="button" data-action="add-list-item" data-list-field="${escapeHtml(field)}">+ ${escapeHtml(title)}</button>
            </div>
            ${(items || []).map((item, index) => `
                <div class="editor-list-field__row">
                    <input data-list-field="${escapeHtml(field)}" data-list-index="${index}" value="${escapeHtml(item)}">
                    <button class="editor-button editor-button--danger" type="button" data-action="remove-list-item" data-list-field="${escapeHtml(field)}" data-list-index="${index}">DELETE</button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderFeatureBlocks(features) {
    return `
        <div class="editor-list-field editor-feature-field">
            <div class="editor-list-field__header">
                <h3>Features</h3>
                <div class="editor-feature-field__actions">
                    <button class="editor-button" type="button" data-action="add-feature">+ Features</button>
                </div>
            </div>
            <div class="editor-feature-blocks">
                ${(features || []).map((feature, index) => `
                    <div
                        class="editor-feature-block"
                        draggable="true"
                        data-feature-index="${index}"
                        data-feature-name="${escapeHtml(feature)}"
                        title="Double click to edit"
                    >${escapeHtml(feature)}</div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderIncludedFeatureBlocks(features, optionIndex) {
    return `
        <div class="editor-included-features" data-option-index="${optionIndex}">
            <div class="editor-included-features__header">
                <span>Included</span>
            </div>
            <div class="editor-included-feature-blocks" data-option-index="${optionIndex}">
                ${(features || []).map((feature, featureIndex) => `
                    <div
                        class="editor-feature-block editor-included-feature-block"
                        draggable="true"
                        data-option-index="${optionIndex}"
                        data-option-feature-index="${featureIndex}"
                    >${escapeHtml(feature)}</div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderOptionCard(option, index, entryType) {
    const supportsPriceText = entryType === 'choices' || entryType === 'package-matrix';
    const supportsFeatures = entryType === 'package-matrix';
    return `
        <div class="editor-option-card">
            <div class="editor-option-card__header">
                <h3>Option ${index + 1}</h3>
                <button
                    class="editor-button editor-button--danger"
                    type="button"
                    data-action="remove-option"
                    data-option-index="${index}"
                >DELETE</button>
            </div>
            <div class="editor-option-grid">
                <div class="editor-field editor-field--id">
                    <label>ID</label>
                    <input data-option-index="${index}" data-option-field="id" value="${escapeHtml(option.id || '')}">
                </div>
                <div class="editor-field editor-field--label">
                    <label>Label</label>
                    <input data-option-index="${index}" data-option-field="label" value="${escapeHtml(option.label || '')}">
                </div>
                <div class="editor-field editor-field--price">
                    <label>Price</label>
                    <input data-option-index="${index}" data-option-field="price" type="number" step="0.01" value="${escapeHtml(option.price ?? '')}">
                </div>
                ${supportsPriceText ? `
                    <div class="editor-field editor-field--price-text">
                        <label>Text</label>
                        <input data-option-index="${index}" data-option-field="priceText" value="${escapeHtml(option.priceText || '')}">
                    </div>
                ` : ''}
            </div>
            ${supportsFeatures ? renderIncludedFeatureBlocks(option.features || [], index) : ''}
        </div>
    `;
}

function renderEntryForm() {
    const entry = getSelectedEntry();
    if (!entry) {
        elements.entryForm.innerHTML = '';
        return;
    }

    const advanced = `
        <details class="editor-advanced">
            <summary>Advanced</summary>
            <div class="editor-entry-grid editor-entry-grid--shared">
                <div class="editor-field">
                    <label for="entryId">ID</label>
                    <input id="entryId" data-entry-field="id" value="${escapeHtml(entry.id || '')}">
                </div>
                <div class="editor-field">
                    <label for="entryType">Type</label>
                    <input id="entryType" value="${escapeHtml(entry.type || '')}" disabled>
                </div>
            </div>
        </details>
    `;

    if (entry.type === 'item') {
        elements.entryForm.innerHTML = `
            <div class="editor-field">
                <label for="entryLabel">Title</label>
                <input id="entryLabel" data-entry-field="label" value="${escapeHtml(entry.label || '')}">
            </div>
            <div class="editor-field">
                <label for="entryPrice">Price</label>
                <input id="entryPrice" data-entry-field="price" type="number" step="0.01" value="${escapeHtml(entry.price ?? '')}">
            </div>
            <div class="editor-field">
                <label for="entryMaxQuantity">Max</label>
                <input id="entryMaxQuantity" data-entry-field="maxQuantity" type="number" step="1" min="1" value="${escapeHtml(entry.maxQuantity ?? 1)}">
            </div>
            ${advanced}
        `;
        return;
    }

    if (entry.type === 'formula') {
        elements.entryForm.innerHTML = `
            <div class="editor-field">
                <label for="entryTitle">Title</label>
                <input id="entryTitle" data-entry-field="title" value="${escapeHtml(entry.title || '')}">
            </div>
            <div class="editor-field">
                <label for="entryTotalQuantity">Total</label>
                <input id="entryTotalQuantity" data-entry-field="totalQuantity" type="number" step="1" value="${escapeHtml(entry.totalQuantity ?? '')}">
            </div>
            <div class="editor-field">
                <label for="entryUnitPrice">Unit</label>
                <input id="entryUnitPrice" data-entry-field="unitPrice" type="number" step="0.01" value="${escapeHtml(entry.unitPrice ?? '')}">
            </div>
            <div class="editor-field">
                <label for="entryMinimum">Minimum</label>
                <input id="entryMinimum" data-entry-field="minimum" type="number" step="1" value="${escapeHtml(entry.minimum ?? 0)}">
            </div>
            <div class="editor-field">
                <label for="entryMaximum">Maximum</label>
                <input id="entryMaximum" data-entry-field="maximum" type="number" step="1" value="${escapeHtml(entry.maximum ?? entry.totalQuantity ?? '')}">
            </div>
            <div class="editor-field">
                <label for="entryDefaultValue">Default</label>
                <input id="entryDefaultValue" data-entry-field="defaultValue" type="number" step="1" value="${escapeHtml(entry.defaultValue ?? entry.minimum ?? 0)}">
            </div>
            ${renderTextList('aliases', entry.aliases || [], 'Aliases')}
            ${advanced}
        `;
        return;
    }

    if (entry.type === 'package-matrix') {
        elements.entryForm.innerHTML = `
            <div class="editor-field">
                <label for="entryTitle">Title</label>
                <input id="entryTitle" data-entry-field="title" value="${escapeHtml(entry.title || '')}">
            </div>
            ${renderFeatureBlocks(entry.features || [])}
            <div class="editor-options">
                ${(entry.options || []).map((option, index) => renderOptionCard(option, index, entry.type)).join('')}
            </div>
            <button class="editor-button" type="button" data-action="add-option">+ OPTION</button>
            ${advanced}
        `;
        return;
    }

    const offer = entry.offer || {};
    elements.entryForm.innerHTML = `
        <div class="editor-field">
            <label for="entryLabel">Title</label>
            <input id="entryLabel" data-entry-field="label" value="${escapeHtml(entry.label || '')}">
        </div>
        <div class="editor-field">
            <label for="entryTitle">Sub</label>
            <input id="entryTitle" data-entry-field="title" value="${escapeHtml(entry.title || '')}">
        </div>
        ${entry.type === 'dropdown' ? `
            <div class="editor-field">
                <label for="entryExpanded">Expanded</label>
                <select id="entryExpanded" data-entry-field="expanded">
                    <option value="true"${entry.expanded ? ' selected' : ''}>true</option>
                    <option value="false"${!entry.expanded ? ' selected' : ''}>false</option>
                </select>
            </div>
            <div class="editor-field">
                <label for="entryOfferId">Offer ID</label>
                <input id="entryOfferId" data-entry-field="offerId" value="${escapeHtml(offer.id || '')}">
            </div>
            <div class="editor-field">
                <label for="entryOfferLabel">Offer</label>
                <input id="entryOfferLabel" data-entry-field="offerLabel" value="${escapeHtml(offer.label || '')}">
            </div>
            <div class="editor-field">
                <label for="entryOfferPrice">Price</label>
                <input id="entryOfferPrice" data-entry-field="offerPrice" type="number" step="0.01" value="${escapeHtml(offer.price ?? '')}">
            </div>
            <button class="editor-button editor-button--danger" type="button" data-action="clear-offer">CLEAR OFFER</button>
            <div class="editor-field">
                <label for="entryDiscountEnabled">Discount</label>
                <select id="entryDiscountEnabled" data-entry-field="discountEnabled">
                    <option value="inherit"${!entry.fullSelectionDiscount ? ' selected' : ''}>inherit default</option>
                    <option value="true"${entry.fullSelectionDiscount?.enabled === true ? ' selected' : ''}>enabled</option>
                    <option value="false"${entry.fullSelectionDiscount?.enabled === false ? ' selected' : ''}>disabled</option>
                </select>
            </div>
            <div class="editor-field">
                <label for="entryDiscountLabel">Label</label>
                <input id="entryDiscountLabel" data-entry-field="discountLabel" value="${escapeHtml(entry.fullSelectionDiscount?.label || '')}">
            </div>
            <div class="editor-field">
                <label for="entryDiscountRate">Rate</label>
                <input id="entryDiscountRate" data-entry-field="discountRate" type="number" step="0.01" min="0" max="1" value="${escapeHtml(entry.fullSelectionDiscount?.rate ?? '')}">
            </div>
        ` : ''}
        <div class="editor-options">
            ${(entry.options || []).map((option, index) => renderOptionCard(option, index, entry.type)).join('')}
        </div>
        ${Array.isArray(entry.options) ? `
            <button class="editor-button" type="button" data-action="add-option">+ OPTION</button>
        ` : ''}
        ${advanced}
    `;
}

function buildManifestPreview() {
    return JSON.stringify(state.manifest, null, 2);
}

function buildCategoryPreview() {
    const category = getSelectedCategory();
    return category ? JSON.stringify(category.data, null, 2) : '';
}

function buildExportCategoryPreview() {
    const category = getSelectedCategory();
    if (!category) return '';

    const data = structuredClone(category.data);
    data.entries?.forEach(entry => {
        if (entry.type === 'item') {
            entry.maxQuantity = Number.isInteger(entry.maxQuantity) && entry.maxQuantity > 0
                ? entry.maxQuantity
                : 1;
        }
    });
    return JSON.stringify(data, null, 2);
}

function requireExportString(value, location, errors) {
    if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${location} must be a non-empty string.`);
        return '';
    }
    return value.trim();
}

function requireExportPrice(value, location, errors) {
    if (!Number.isFinite(value) || value < 0) {
        errors.push(`${location} must be a non-negative number.`);
    }
}

function registerExportId(value, location, ids, errors) {
    const id = requireExportString(value, location, errors);
    if (!id) return;
    if (ids.has(id)) {
        errors.push(`Duplicate catalog id "${id}" at ${location}.`);
        return;
    }
    ids.set(id, location);
}

function validateOption(option, location, ids, errors) {
    registerExportId(option?.id, `${location}.id`, ids, errors);
    requireExportString(option?.label, `${location}.label`, errors);
    requireExportPrice(option?.price, `${location}.price`, errors);
}

function validateCatalogForExport() {
    const errors = [];
    const ids = new Map();

    state.categories.forEach((category, categoryIndex) => {
        const data = category.data;
        const categoryLocation = `categories[${categoryIndex}]`;
        requireExportString(data?.id, `${categoryLocation}.id`, errors);
        requireExportString(data?.title, `${categoryLocation}.title`, errors);

        if (!Array.isArray(data?.entries)) {
            errors.push(`${categoryLocation}.entries must be an array.`);
            return;
        }

        data.entries.forEach((entry, entryIndex) => {
            const location = `${data.id || categoryLocation}.entries[${entryIndex}]`;
            const type = requireExportString(entry?.type, `${location}.type`, errors);
            registerExportId(entry?.id, `${location}.id`, ids, errors);

            if (type === 'item') {
                requireExportString(entry.label, `${location}.label`, errors);
                requireExportPrice(entry.price, `${location}.price`, errors);
                return;
            }

            if (type === 'formula') {
                const minimum = Number.isFinite(entry.minimum) ? entry.minimum : 0;
                const maximum = Number.isFinite(entry.maximum) ? entry.maximum : entry.totalQuantity;
                requireExportString(entry.title, `${location}.title`, errors);
                requireExportPrice(entry.totalQuantity, `${location}.totalQuantity`, errors);
                requireExportPrice(entry.unitPrice, `${location}.unitPrice`, errors);
                if (!Number.isFinite(maximum) || maximum < minimum) {
                    errors.push(`${location}.maximum must be greater than or equal to minimum.`);
                }
                entry.aliases?.forEach((alias, aliasIndex) => {
                    registerExportId(alias, `${location}.aliases[${aliasIndex}]`, ids, errors);
                });
                return;
            }

            if (type === 'package-matrix') {
                requireExportString(entry.title, `${location}.title`, errors);
                if (!Array.isArray(entry.features) || entry.features.length === 0) {
                    errors.push(`${location}.features must contain at least one feature.`);
                } else {
                    const features = new Set();
                    entry.features.forEach((feature, featureIndex) => {
                        const featureName = requireExportString(feature, `${location}.features[${featureIndex}]`, errors);
                        if (!featureName) return;
                        if (features.has(featureName)) {
                            errors.push(`Duplicate package feature "${featureName}" at ${location}.features[${featureIndex}].`);
                        }
                        features.add(featureName);
                    });
                }
                if (!Array.isArray(entry.options) || entry.options.length === 0) {
                    errors.push(`${location}.options must contain at least one option.`);
                } else {
                    entry.options.forEach((option, optionIndex) => {
                        const optionLocation = `${location}.options[${optionIndex}]`;
                        validateOption(option, optionLocation, ids, errors);
                        option.features?.forEach((feature, featureIndex) => {
                            requireExportString(feature, `${optionLocation}.features[${featureIndex}]`, errors);
                        });
                    });
                }
                return;
            }

            if (type === 'dropdown' || type === 'choices') {
                requireExportString(entry.title, `${location}.title`, errors);
                if (type === 'dropdown' && entry.fullSelectionDiscount && entry.fullSelectionDiscount.enabled !== false) {
                    const rate = Number(entry.fullSelectionDiscount.rate);
                    if (!Number.isFinite(rate) || rate <= 0 || rate >= 1) {
                        errors.push(`${location}.fullSelectionDiscount.rate must be greater than 0 and less than 1.`);
                    }
                }
                if (type === 'dropdown' && entry.offer) {
                    registerExportId(entry.offer.id, `${location}.offer.id`, ids, errors);
                    requireExportPrice(entry.offer.price, `${location}.offer.price`, errors);
                }
                if (!Array.isArray(entry.options) || entry.options.length === 0) {
                    errors.push(`${location}.options must contain at least one option.`);
                } else {
                    entry.options.forEach((option, optionIndex) => {
                        validateOption(option, `${location}.options[${optionIndex}]`, ids, errors);
                    });
                }
                return;
            }

            errors.push(`Unknown entry type "${type}" at ${location}.`);
        });
    });

    return errors;
}

function canExportCategory() {
    const errors = validateCatalogForExport();
    if (errors.length) {
        setStatus(errors[0], true);
        console.error('Catalog export validation failed:', errors);
        return false;
    }
    return true;
}

function renderPreview() {
    const category = getSelectedCategory();
    const isCategoryMode = state.previewMode === 'category' && category;
    elements.previewLabel.textContent = isCategoryMode
        ? category.file
        : 'manifest.json';
    elements.preview.textContent = isCategoryMode
        ? buildCategoryPreview()
        : buildManifestPreview();
}

function refresh() {
    renderCategoryList();
    renderEntryList();
    renderCategoryForm();
    renderEntryForm();
    renderPreview();
}

function parseNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function hasEntryId(id) {
    return state.categories.some(category =>
        category.data.entries.some(entry => entry.id === id)
    );
}

function hasCatalogId(id) {
    return state.categories.some(category =>
        category.data.entries.some(entry =>
            entry.id === id
            || entry.offer?.id === id
            || entry.aliases?.includes(id)
            || entry.options?.some(option => option.id === id)
        )
    );
}

function createUniqueEntryId(prefix) {
    let index = 1;
    let nextId = `${prefix}-${index}`;
    while (hasEntryId(nextId)) {
        index += 1;
        nextId = `${prefix}-${index}`;
    }
    return nextId;
}

function createUniqueCatalogId(prefix) {
    let index = 1;
    let nextId = `${prefix}-${index}`;
    while (hasCatalogId(nextId)) {
        index += 1;
        nextId = `${prefix}-${index}`;
    }
    return nextId;
}

function createDefaultOption(entryId, index) {
    return {
        id: createUniqueCatalogId(`${entryId}-option`),
        label: `Option ${index}`,
        price: 0
    };
}

function createEntryTemplate(type) {
    const entryId = createUniqueEntryId(type);

    if (type === 'item') {
        return {
            type: 'item',
            id: entryId,
            label: 'New Item',
            price: 0
        };
    }

    if (type === 'formula') {
        return {
            type: 'formula',
            id: entryId,
            title: 'New Formula',
            totalQuantity: 0,
            unitPrice: 0,
            minimum: 0,
            maximum: 999,
            defaultValue: 0,
            aliases: []
        };
    }

    if (type === 'package-matrix') {
        return {
            type: 'package-matrix',
            id: entryId,
            title: 'New Package Matrix',
            features: ['Feature 1'],
            options: [{
                ...createDefaultOption(entryId, 1),
                priceText: '',
                features: ['Feature 1']
            }]
        };
    }

    return {
        type,
        id: entryId,
        label: type === 'dropdown' ? 'New Dropdown' : 'New Choices',
        title: type === 'dropdown' ? 'New Subheader' : 'New Choices',
        ...(type === 'dropdown' ? {
            expanded: false,
            offer: {
                id: `${entryId}-offer`,
                price: 0
            }
        } : {}),
        options: [createDefaultOption(entryId, 1)]
    };
}

function addEntry(type) {
    const category = getSelectedCategory();
    if (!category) return;

    const entry = createEntryTemplate(type);
    category.data.entries.push(entry);
    state.selectedEntryId = entry.id;
    refresh();
    setStatus(`${type} added`);
}

function deleteSelectedEntry() {
    const category = getSelectedCategory();
    const entry = getSelectedEntry();
    if (!category || !entry) return;

    category.data.entries = category.data.entries.filter(item => item.id !== entry.id);
    state.selectedEntryId = category.data.entries[0]?.id || '';
    refresh();
    setStatus('Entry deleted');
}

function addOption() {
    const entry = getSelectedEntry();
    if (!entry || !Array.isArray(entry.options)) return;

    entry.options.push(createDefaultOption(entry.id, entry.options.length + 1));
    renderEntryForm();
    renderPreview();
    setStatus('Option added');
}

function removeOption(index) {
    const entry = getSelectedEntry();
    if (!entry || !Array.isArray(entry.options)) return;

    entry.options.splice(index, 1);
    renderEntryForm();
    renderPreview();
    setStatus('Option removed');
}

function addListItem(field) {
    const entry = getSelectedEntry();
    if (!entry) return;

    if (!Array.isArray(entry[field])) entry[field] = [];
    entry[field].push('');
    renderEntryForm();
    renderPreview();
    setStatus(`${field} item added`);
}

function removeListItem(field, index) {
    const entry = getSelectedEntry();
    if (!entry || !Array.isArray(entry[field])) return;

    entry[field].splice(index, 1);
    renderEntryForm();
    renderPreview();
    setStatus(`${field} item removed`);
}

function addFeature() {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix') return;

    if (!Array.isArray(entry.features)) entry.features = [];
    entry.features.push(`Feature ${entry.features.length + 1}`);
    renderEntryForm();
    renderPreview();
    setStatus('Feature added');
}

function renameFeature(index, nextName) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(entry.features)) return;

    const previousName = entry.features[index];
    const trimmedName = nextName.trim();
    if (!previousName || !trimmedName) {
        renderEntryForm();
        return;
    }

    entry.features[index] = trimmedName;
    entry.options?.forEach(option => {
        if (!Array.isArray(option.features)) return;
        option.features = option.features.map(feature => feature === previousName ? trimmedName : feature);
    });
    renderEntryForm();
    renderPreview();
    setStatus('Feature renamed');
}

function removeFeature(index) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(entry.features)) return;

    const [removedFeature] = entry.features.splice(index, 1);
    entry.options?.forEach(option => {
        if (!Array.isArray(option.features)) return;
        option.features = option.features.filter(feature => feature !== removedFeature);
    });
    clearFeatureDragState();
    renderEntryForm();
    renderPreview();
    setStatus('Feature deleted');
}

function reorderFeature(fromIndex, toIndex) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(entry.features)) return;

    moveItem(entry.features, fromIndex, toIndex);
    clearFeatureDragState();
    renderEntryForm();
    renderPreview();
    setStatus('Features reordered');
}

function getOptionCardTarget(target) {
    return target instanceof Element ? target.closest('.editor-option-card') : null;
}

function getOptionIndexFromCard(card) {
    return card ? [...card.parentElement.children].indexOf(card) : -1;
}

function getDraggedFeatureName(entry) {
    if (!state.dragFeature) return '';
    if (state.dragFeature.kind === 'feature') return entry.features?.[state.dragFeature.index] || '';
    return entry.options?.[state.dragFeature.optionIndex]?.features?.[state.dragFeature.featureIndex] || '';
}

function clearFeatureDragUi() {
    [
        elements.entryForm,
        ...elements.entryForm.querySelectorAll('.is-drop-target, .is-delete-target, .is-included-highlight, .is-drag-match, .is-dragging-feature')
    ]
        .forEach(element => element.classList.remove(
            'is-drop-target',
            'is-delete-target',
            'is-included-highlight',
            'is-drag-match',
            'is-dragging-feature'
        ));
}

function clearFeatureDragState() {
    state.dragFeature = null;
    clearFeatureDragUi();
}

function setFeatureDragAction(action) {
    if (!state.dragFeature) return;
    state.dragFeature.action = action;
}

function highlightIncludedFeatures(optionIndex) {
    const entry = getSelectedEntry();
    const included = new Set(entry?.options?.[optionIndex]?.features || []);
    const draggedFeatureName = getDraggedFeatureName(entry);
    elements.entryForm
        .querySelectorAll('.editor-feature-block[data-feature-index]')
        .forEach(block => {
            block.classList.toggle('is-included-highlight', included.has(block.dataset.featureName));
        });
    elements.entryForm
        .querySelectorAll(`.editor-included-feature-block[data-option-index="${optionIndex}"]`)
        .forEach(block => {
            block.classList.toggle('is-drag-match', block.textContent === draggedFeatureName);
        });
}

function addFeatureToOption(optionIndex, featureName, insertIndex = null) {
    const entry = getSelectedEntry();
    const option = entry?.options?.[optionIndex];
    if (!entry || entry.type !== 'package-matrix' || !option || !featureName) return;

    if (!Array.isArray(option.features)) option.features = [];
    if (option.features.includes(featureName)) return;

    const targetIndex = insertIndex === null ? option.features.length : insertIndex;
    option.features.splice(targetIndex, 0, featureName);
    renderEntryForm();
    renderPreview();
    setStatus('Included feature added');
}

function moveIncludedFeature(toOptionIndex, toFeatureIndex = null) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix') return;

    const featureName = getDraggedFeatureName(entry);
    if (!featureName) return;

    if (state.dragFeature?.kind === 'feature') {
        addFeatureToOption(toOptionIndex, featureName, toFeatureIndex);
        return;
    }

    const fromOptionIndex = state.dragFeature.optionIndex;
    const fromFeatureIndex = state.dragFeature.featureIndex;
    const fromOption = entry.options?.[fromOptionIndex];
    const toOption = entry.options?.[toOptionIndex];
    if (!fromOption || !toOption || !Array.isArray(fromOption.features)) return;

    fromOption.features.splice(fromFeatureIndex, 1);
    if (!Array.isArray(toOption.features)) toOption.features = [];

    const targetIndex = toFeatureIndex === null
        ? toOption.features.length
        : toOptionIndex === fromOptionIndex && toFeatureIndex > fromFeatureIndex
            ? toFeatureIndex - 1
            : toFeatureIndex;
    if (!toOption.features.includes(featureName)) {
        toOption.features.splice(targetIndex, 0, featureName);
    }

    clearFeatureDragState();
    renderEntryForm();
    renderPreview();
    setStatus('Included features updated');
}

function removeIncludedFeature(optionIndex, featureIndex) {
    const entry = getSelectedEntry();
    const option = entry?.options?.[optionIndex];
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(option?.features)) return;

    option.features.splice(featureIndex, 1);
    clearFeatureDragState();
    renderEntryForm();
    renderPreview();
    setStatus('Included feature removed');
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function downloadSelectedCategory() {
    const category = getSelectedCategory();
    if (!category) return;
    if (!canExportCategory()) return;

    const filename = category.file.split('/').pop() || `${category.data.id}.json`;
    downloadText(filename, `${buildExportCategoryPreview()}\n`);
    setStatus(`${filename} downloaded`);
}

function copySelectedCategory() {
    if (!canExportCategory()) return;
    copyText(buildExportCategoryPreview(), 'Category JSON copied');
}

function clearOffer() {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'dropdown') return;

    delete entry.offer;
    renderEntryForm();
    renderPreview();
    setStatus('Offer cleared');
}

function moveItem(list, fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
}

function handleCategoryFormInput(event) {
    const category = getSelectedCategory();
    if (!category) return;

    const field = event.target.dataset.categoryField;
    if (!field) return;

    if (field === 'id') {
        category.data.id = event.target.value;
        state.selectedCategoryId = event.target.value;
        renderCategoryList();
    } else if (field === 'expanded') {
        category.data.expanded = event.target.value === 'true';
    } else {
        category.data[field] = event.target.value;
    }
    renderPreview();
}

function handleEntryFormInput(event) {
    const entry = getSelectedEntry();
    if (!entry) return;

    const listField = event.target.dataset.listField;
    const listIndex = event.target.dataset.listIndex;
    if (listField && listIndex !== undefined) {
        if (!Array.isArray(entry[listField])) entry[listField] = [];
        entry[listField][Number(listIndex)] = event.target.value;
        renderPreview();
        return;
    }

    const optionIndex = event.target.dataset.optionIndex;
    const optionField = event.target.dataset.optionField;
    if (optionIndex !== undefined && optionField) {
        const option = entry.options?.[Number(optionIndex)];
        if (!option) return;
        option[optionField] = optionField === 'price'
            ? parseNumber(event.target.value)
            : event.target.value;
        renderPreview();
        return;
    }

    const field = event.target.dataset.entryField;
    if (!field) return;

    switch (field) {
        case 'id':
            entry.id = event.target.value;
            state.selectedEntryId = event.target.value;
            renderEntryList();
            break;
        case 'price':
        case 'totalQuantity':
        case 'unitPrice':
        case 'minimum':
        case 'maximum':
        case 'defaultValue':
            entry[field] = parseNumber(event.target.value);
            break;
        case 'maxQuantity':
            entry.maxQuantity = Math.trunc(parseNumber(event.target.value));
            break;
        case 'expanded':
            entry.expanded = event.target.value === 'true';
            break;
        case 'discountEnabled':
            if (event.target.value === 'inherit') {
                delete entry.fullSelectionDiscount;
            } else {
                entry.fullSelectionDiscount = {
                    ...(entry.fullSelectionDiscount || {}),
                    enabled: event.target.value === 'true'
                };
            }
            break;
        case 'discountLabel':
            if (!entry.fullSelectionDiscount) entry.fullSelectionDiscount = { enabled: true };
            entry.fullSelectionDiscount.label = event.target.value;
            break;
        case 'discountRate':
            if (!entry.fullSelectionDiscount) entry.fullSelectionDiscount = { enabled: true };
            entry.fullSelectionDiscount.rate = parseNumber(event.target.value);
            break;
        case 'offerPrice':
            if (!entry.offer) entry.offer = {};
            entry.offer.price = parseNumber(event.target.value);
            break;
        case 'offerId':
            if (!entry.offer) entry.offer = {};
            entry.offer.id = event.target.value;
            break;
        case 'offerLabel':
            if (!entry.offer) entry.offer = {};
            entry.offer.label = event.target.value;
            break;
        default:
            entry[field] = event.target.value;
    }

    renderPreview();
}

async function copyText(text, successMessage) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }
    setStatus(successMessage);
}

function handleCategoryDragStart(event) {
    const button = event.target.closest('button[data-category-id]');
    if (!button) return;
    state.dragCategoryId = button.dataset.categoryId;
    event.dataTransfer.effectAllowed = 'move';
}

function handleCategoryDragOver(event) {
    const button = event.target.closest('button[data-category-id]');
    if (!button || !state.dragCategoryId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleCategoryDrop(event) {
    const button = event.target.closest('button[data-category-id]');
    if (!button || !state.dragCategoryId) return;
    event.preventDefault();

    const draggedCategoryId = state.dragCategoryId;
    const fromIndex = state.categories.findIndex(item => item.data.id === state.dragCategoryId);
    const toIndex = state.categories.findIndex(item => item.data.id === button.dataset.categoryId);
    moveItem(state.categories, fromIndex, toIndex);
    moveItem(state.manifest.categories, fromIndex, toIndex);
    state.selectedCategoryId = draggedCategoryId;
    state.selectedEntryId = getSelectedCategory()?.data.entries?.[0]?.id || '';
    state.dragCategoryId = '';
    refresh();
    setStatus('Categories reordered');
}

function handleEntryDragStart(event) {
    const button = event.target.closest('button[data-entry-id]');
    if (!button) return;
    state.dragEntryId = button.dataset.entryId;
    event.dataTransfer.effectAllowed = 'move';
}

function handleEntryDragOver(event) {
    const button = event.target.closest('button[data-entry-id]');
    if (!button || !state.dragEntryId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleEntryDrop(event) {
    const button = event.target.closest('button[data-entry-id]');
    const category = getSelectedCategory();
    if (!button || !category || !state.dragEntryId) return;
    event.preventDefault();

    const draggedEntryId = state.dragEntryId;
    const fromIndex = category.data.entries.findIndex(item => item.id === state.dragEntryId);
    const toIndex = category.data.entries.findIndex(item => item.id === button.dataset.entryId);
    moveItem(category.data.entries, fromIndex, toIndex);
    state.selectedEntryId = draggedEntryId;
    state.dragEntryId = '';
    refresh();
    setStatus('Entries reordered');
}

function handleFeatureDragStart(event) {
    clearFeatureDragUi();
    const includedBlock = event.target.closest('.editor-included-feature-block');
    if (includedBlock) {
        state.dragFeature = {
            kind: 'included',
            optionIndex: Number(includedBlock.dataset.optionIndex),
            featureIndex: Number(includedBlock.dataset.optionFeatureIndex),
            originCard: includedBlock.closest('.editor-option-card'),
            action: { type: 'none' }
        };
        includedBlock.classList.add('is-dragging-feature');
        event.dataTransfer.effectAllowed = 'move';
        return;
    }

    const block = event.target.closest('.editor-feature-block');
    if (!block || block.classList.contains('is-editing')) return;

    state.dragFeature = {
        kind: 'feature',
        index: Number(block.dataset.featureIndex),
        action: { type: 'none' }
    };
    block.classList.add('is-dragging-feature');
    event.dataTransfer.effectAllowed = 'move';
}

function handleFeatureDragOver(event) {
    if (!state.dragFeature) return;
    event.preventDefault();

    clearFeatureDragUi();
    const source = state.dragFeature.kind === 'feature'
        ? elements.entryForm.querySelector(`.editor-feature-block[data-feature-index="${state.dragFeature.index}"]`)
        : elements.entryForm.querySelector(`.editor-included-feature-block[data-option-index="${state.dragFeature.optionIndex}"][data-option-feature-index="${state.dragFeature.featureIndex}"]`);
    source?.classList.add('is-dragging-feature');

    const optionCard = getOptionCardTarget(event.target);
    if (state.dragFeature.kind === 'included') {
        if (optionCard === state.dragFeature.originCard) {
            setFeatureDragAction({
                type: 'sort',
                optionIndex: state.dragFeature.optionIndex,
                featureIndex: event.target instanceof Element
                    ? event.target.closest('.editor-included-feature-block')?.dataset.optionFeatureIndex
                    : undefined
            });
            optionCard.classList.add('is-drop-target');
        } else {
            setFeatureDragAction({ type: 'remove' });
            state.dragFeature.originCard?.classList.add('is-delete-target');
        }
        return;
    }

    if (optionCard) {
        event.dataTransfer.dropEffect = 'move';
        const optionIndex = getOptionIndexFromCard(optionCard);
        setFeatureDragAction({ type: 'add', optionIndex });
        optionCard.classList.add('is-drop-target');
        if (optionIndex >= 0) highlightIncludedFeatures(optionIndex);
        return;
    }

    if (!elements.entryForm.contains(event.target)) {
        setFeatureDragAction({ type: 'remove' });
        elements.entryForm.classList.add('is-delete-target');
    } else {
        setFeatureDragAction({ type: 'none' });
    }
}

function handleFeatureDragEnd() {
    if (!state.dragFeature) return;
    const action = state.dragFeature.action || { type: 'none' };

    if (action.type === 'add') {
        moveIncludedFeature(action.optionIndex);
        return;
    }

    if (action.type === 'sort') {
        moveIncludedFeature(
            action.optionIndex,
            action.featureIndex === undefined ? null : Number(action.featureIndex)
        );
        return;
    }

    if (action.type === 'remove' && state.dragFeature.kind === 'included') {
        removeIncludedFeature(state.dragFeature.optionIndex, state.dragFeature.featureIndex);
        return;
    }

    if (action.type === 'remove' && state.dragFeature.kind === 'feature') {
        removeFeature(state.dragFeature.index);
        return;
    }

    clearFeatureDragState();
}

function startFeatureEdit(block) {
    block.draggable = false;
    block.contentEditable = 'true';
    block.classList.add('is-editing');
    block.focus();

    const range = document.createRange();
    range.selectNodeContents(block);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function finishFeatureEdit(block, shouldCommit = true) {
    if (!block.classList.contains('is-editing')) return;

    const index = Number(block.dataset.featureIndex);
    if (shouldCommit) {
        renameFeature(index, block.textContent || '');
    } else {
        renderEntryForm();
    }
}

async function initialize() {
    try {
        await loadCatalog();
        refresh();
        setStatus('Editor loaded');
    } catch (error) {
        console.error(error);
        setStatus('Failed to load editor data', true);
    }
}

elements.categoryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-category-id]');
    if (!button) return;
    state.selectedCategoryId = button.dataset.categoryId;
    state.selectedEntryId = getSelectedCategory()?.data.entries?.[0]?.id || '';
    refresh();
});

elements.categoryList.addEventListener('dragstart', handleCategoryDragStart);
elements.categoryList.addEventListener('dragover', handleCategoryDragOver);
elements.categoryList.addEventListener('drop', handleCategoryDrop);

elements.entryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-entry-id]');
    if (!button) return;
    state.selectedEntryId = button.dataset.entryId;
    refresh();
});

elements.entryList.addEventListener('dragstart', handleEntryDragStart);
elements.entryList.addEventListener('dragover', handleEntryDragOver);
elements.entryList.addEventListener('drop', handleEntryDrop);

elements.categoryForm.addEventListener('input', handleCategoryFormInput);
elements.categoryForm.addEventListener('change', handleCategoryFormInput);
elements.entryForm.addEventListener('input', handleEntryFormInput);
elements.entryForm.addEventListener('change', handleEntryFormInput);
elements.entryForm.addEventListener('dragstart', handleFeatureDragStart);
document.addEventListener('dragover', handleFeatureDragOver);
document.addEventListener('dragend', handleFeatureDragEnd, true);
elements.entryForm.addEventListener('dblclick', event => {
    const block = event.target.closest('.editor-feature-block');
    if (block?.classList.contains('editor-included-feature-block')) return;
    if (block) startFeatureEdit(block);
});
elements.entryForm.addEventListener('focusout', event => {
    const block = event.target.closest('.editor-feature-block.is-editing');
    if (block) finishFeatureEdit(block);
});
elements.entryForm.addEventListener('keydown', event => {
    const block = event.target.closest('.editor-feature-block.is-editing');
    if (!block) return;

    if (event.key === 'Enter') {
        event.preventDefault();
        finishFeatureEdit(block);
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        finishFeatureEdit(block, false);
    }
});
elements.entryForm.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const actions = {
        'add-option': addOption,
        'remove-option': () => removeOption(Number(button.dataset.optionIndex)),
        'add-list-item': () => addListItem(button.dataset.listField),
        'remove-list-item': () => removeListItem(button.dataset.listField, Number(button.dataset.listIndex)),
        'add-feature': addFeature,
        'clear-offer': clearOffer
    };
    actions[button.dataset.action]?.();
});

document.addEventListener('click', event => {
    const addEntryButton = event.target.closest('button[data-add-entry]');
    if (addEntryButton) {
        addEntry(addEntryButton.dataset.addEntry);
        return;
    }

    const commandButton = event.target.closest('button[data-editor-command]');
    if (!commandButton) return;

    const commands = {
        reload: initialize,
        'download-category': downloadSelectedCategory,
        'copy-manifest': () => copyText(buildManifestPreview(), 'Manifest copied'),
        'copy-category': copySelectedCategory,
        'copy-preview': () => copyText(elements.preview.textContent, 'Preview copied'),
        'delete-entry': deleteSelectedEntry,
        'show-manifest': () => {
            state.previewMode = 'manifest';
            renderPreview();
        },
        'show-category': () => {
            state.previewMode = 'category';
            renderPreview();
        }
    };
    commands[commandButton.dataset.editorCommand]?.();
});

initialize();
