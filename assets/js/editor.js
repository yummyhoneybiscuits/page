import {
    loadEditableDataFiles,
    serializeDataCategory,
    serializeDataManifest
} from './data-loader.js';
import { copyText as copyToClipboard, escapeHtml, revealJsonContent } from './site.js';

const elements = {
    categoryList: document.getElementById('categoryList'),
    entryList: document.getElementById('entryList'),
    categoryForm: document.getElementById('categoryForm'),
    entryForm: document.getElementById('entryForm'),
    preview: document.getElementById('jsonPreview'),
    previewLabel: document.getElementById('previewLabel'),
    status: document.getElementById('editorStatus'),
    layout: document.querySelector('.editor-layout')
};

const state = {
    manifest: null,
    categories: [],
    selectedCategoryId: '',
    selectedEntryId: '',
    previewMode: 'category',
    dragSortable: null,
    editSortable: null,
    dragFeature: null
};
const DATA_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('is-error', isError);
}

async function loadData() {
    const { manifest, categories } = await loadEditableDataFiles();

    state.manifest = manifest;
    state.categories = categories;
    state.selectedCategoryId = categories[0]?.data.id || '';
    state.selectedEntryId = categories[0]?.data.entries?.[0]?.id || '';
    state.previewMode = 'category';
    state.dragSortable = null;
    state.editSortable = null;
}

function getSelectedCategory() {
    return state.categories.find(category => category.data.id === state.selectedCategoryId) || null;
}

function getSelectedEntry() {
    const category = getSelectedCategory();
    return category?.data.entries.find(entry => entry.id === state.selectedEntryId) || null;
}

function renderCategoryList() {
    elements.categoryList.innerHTML = state.categories.map((category, index) => `
        <button
            type="button"
            data-category-id="${escapeHtml(category.data.id)}"
            data-sort-kind="category"
            data-sort-index="${index}"
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

function itemKind(entry) {
    if (entry.type === 'item') return 'Item';
    if (entry.type === 'formula') return 'Formula';
    if (entry.type === 'package-matrix') return 'List';
    return 'Items';
}

function renderEntryList() {
    const category = getSelectedCategory();
    if (!category) {
        elements.entryList.innerHTML = '';
        return;
    }

    if (!category.data.entries.length) {
        elements.entryList.innerHTML = '<small>No items</small>';
        return;
    }

    elements.entryList.innerHTML = category.data.entries.map((entry, index) => `
        <button
            type="button"
            data-entry-id="${escapeHtml(entry.id)}"
            data-sort-kind="entry"
            data-sort-index="${index}"
            draggable="true"
            class="${entry.id === state.selectedEntryId ? 'is-active' : ''}"
        >
            <span>${escapeHtml(entryLabel(entry))}</span>
            <small>${escapeHtml(itemKind(entry))}</small>
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
        <div class="editor-form-grid editor-form-grid--category">
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
        </div>
    `;
}

function renderFeatureBlocks(features) {
    return `
        <div class="editor-list-field editor-feature-field">
            <div class="editor-feature-field__header">
                <h3>Features</h3>
                <button class="editor-button" type="button" data-action="add-feature">+ FEATURES</button>
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

function renderOptionCard(option, index) {
    return `
        <div class="editor-option-card" draggable="true" data-sort-kind="option" data-sort-index="${index}" title="Drag to reorder or remove; double click to edit">
            <div class="editor-option-card__header">
                <h3 class="editor-drag-handle">Option ${index + 1}</h3>
            </div>
            <div class="editor-option-grid">
                <div class="editor-field editor-field--id">
                    <label>ID</label>
                    <input readonly data-option-index="${index}" data-option-field="id" value="${escapeHtml(option.id || '')}">
                </div>
                <div class="editor-field editor-field--label">
                    <label>Label</label>
                    <input readonly data-option-index="${index}" data-option-field="label" value="${escapeHtml(option.label || '')}">
                </div>
                <div class="editor-field editor-field--price">
                    <label>Price</label>
                    <input readonly data-option-index="${index}" data-option-field="price" type="number" step="0.01" value="${escapeHtml(option.price ?? '')}">
                </div>
                <div class="editor-field editor-field--description">
                    <label>Description</label>
                    <input readonly data-option-index="${index}" data-option-field="description" value="${escapeHtml(option.description || '')}">
                </div>
            </div>
            ${renderIncludedFeatureBlocks(option.features || [], index)}
        </div>
    `;
}

function renderOptionRow(option, index) {
    return `
        <div class="editor-option-row" draggable="true" data-sort-kind="option" data-sort-index="${index}" title="Drag to reorder or remove; double click to edit">
            <span class="editor-option-row__index editor-drag-handle">#</span>
            <input
                readonly
                aria-label="Option ${index + 1} label"
                placeholder="Label"
                data-option-index="${index}"
                data-option-field="label"
                value="${escapeHtml(option.label || '')}"
            >
            <input
                readonly
                aria-label="Option ${index + 1} price"
                placeholder="Price"
                data-option-index="${index}"
                data-option-field="price"
                type="number"
                step="0.01"
                value="${escapeHtml(option.price ?? '')}"
            >
            <input
                readonly
                aria-label="Option ${index + 1} description"
                placeholder="Description"
                data-option-index="${index}"
                data-option-field="description"
                value="${escapeHtml(option.description || '')}"
            >
            <input
                readonly
                aria-label="Option ${index + 1} ID"
                placeholder="ID"
                data-option-index="${index}"
                data-option-field="id"
                value="${escapeHtml(option.id || '')}"
            >
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
                    <input id="entryId" value="${escapeHtml(entry.id || '')}" readonly>
                </div>
                <div class="editor-field">
                <label for="entryType">Kind</label>
                    <input id="entryType" value="${escapeHtml(itemKind(entry))}" disabled>
                </div>
            </div>
        </details>
    `;

    if (entry.type === 'item') {
        elements.entryForm.innerHTML = `
            <div class="editor-form-grid editor-form-grid--item">
            <div class="editor-field">
                <label for="entryLabel">Name</label>
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
            </div>
            ${advanced}
        `;
        return;
    }

    if (entry.type === 'formula') {
        elements.entryForm.innerHTML = `
            <div class="editor-form-grid editor-form-grid--formula">
            <div class="editor-field editor-field--wide">
                <label for="entryTitle">Name</label>
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
            </div>
            ${advanced}
        `;
        return;
    }

    if (entry.type === 'package-matrix') {
        elements.entryForm.innerHTML = `
            <div class="editor-form-grid">
            <div class="editor-field editor-field--wide">
                <label for="entryTitle">Name</label>
                <input id="entryTitle" data-entry-field="title" value="${escapeHtml(entry.title || '')}">
            </div>
            </div>
            ${renderFeatureBlocks(entry.features || [])}
            <div class="editor-options">
                ${(entry.options || []).map((option, index) => renderOptionCard(option, index)).join('')}
            </div>
            <button class="editor-button" type="button" data-action="add-option">+ OPTION</button>
            ${advanced}
        `;
        return;
    }

    const offer = entry.offer || {};
    elements.entryForm.innerHTML = `
        <div class="editor-form-grid">
        <div class="editor-field">
            <label for="entryLabel">Name</label>
            <input id="entryLabel" data-entry-field="label" value="${escapeHtml(entry.label || '')}">
        </div>
        <div class="editor-field">
            <label for="entryTitle">Description</label>
            <input id="entryTitle" data-entry-field="title" value="${escapeHtml(entry.title || '')}">
        </div>
        <div class="editor-field">
            <label for="entryPresentation">Presentation</label>
            <select id="entryPresentation" data-entry-field="presentation">
                <option value="collapsible"${entry.type === 'dropdown' ? ' selected' : ''}>collapsible</option>
                <option value="inline"${entry.type === 'choices' ? ' selected' : ''}>inline</option>
            </select>
        </div>
        </div>
        ${entry.type === 'dropdown' ? `
            <section class="editor-settings">
                <h3>Settings</h3>
                <div class="editor-form-grid editor-form-grid--dropdown-settings">
                    <div class="editor-field"><label for="entryExpanded">Expanded</label><select id="entryExpanded" data-entry-field="expanded"><option value="true"${entry.expanded ? ' selected' : ''}>true</option><option value="false"${!entry.expanded ? ' selected' : ''}>false</option></select></div>
                    <div class="editor-field"><label for="entryOfferPrice">All Price</label><input id="entryOfferPrice" data-entry-field="offerPrice" type="number" step="0.01" value="${escapeHtml(offer.price ?? '')}"></div>
                    <div class="editor-field"><label for="entryDiscountEnabled">Discount</label><select id="entryDiscountEnabled" data-entry-field="discountEnabled"><option value="inherit"${entry.inheritsDiscount ? ' selected' : ''}>inherit default</option><option value="true"${!entry.inheritsDiscount && entry.fullSelectionDiscount?.enabled === true ? ' selected' : ''}>enabled</option><option value="false"${!entry.inheritsDiscount && entry.fullSelectionDiscount?.enabled === false ? ' selected' : ''}>disabled</option></select></div>
                    <div class="editor-field"><label for="entryDiscountLabel">Discount Label</label><input id="entryDiscountLabel" data-entry-field="discountLabel" value="${escapeHtml(entry.fullSelectionDiscount?.label || '')}"></div>
                    <div class="editor-field"><label for="entryDiscountRate">Multiplier</label><input id="entryDiscountRate" data-entry-field="discountRate" type="number" step="0.01" min="0" max="1" value="${escapeHtml(entry.fullSelectionDiscount?.rate ?? '')}"></div>
                </div>
            </section>
        ` : ''}
        <div class="editor-option-list">
            <div class="editor-option-list__header">
                <span>#</span>
                <span>Label</span>
                <span>Price</span>
                <span>Description</span>
                <span>ID</span>
            </div>
            ${(entry.options || []).map((option, index) => renderOptionRow(option, index)).join('')}
        </div>
        ${Array.isArray(entry.options) ? `
            <button class="editor-button" type="button" data-action="add-option">+ OPTION</button>
        ` : ''}
        ${advanced}
    `;
}

function buildManifestPreview() {
    return JSON.stringify(serializeDataManifest(state.manifest, state.categories), null, 2);
}

function buildCategoryPreview() {
    const category = getSelectedCategory();
    return category ? JSON.stringify(serializeDataCategory(category.data), null, 2) : '';
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
    return JSON.stringify(serializeDataCategory(data), null, 2);
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
    if (!DATA_ID_PATTERN.test(id)) {
        errors.push(`${location} must be a kebab-case id.`);
        return;
    }
    if (ids.has(id)) {
        errors.push(`Duplicate data id "${id}" at ${location}.`);
        return;
    }
    ids.set(id, location);
}

function validateOption(option, location, ids, errors) {
    registerExportId(option?.id, `${location}.id`, ids, errors);
    requireExportString(option?.label, `${location}.label`, errors);
    requireExportPrice(option?.price, `${location}.price`, errors);
}

function validateDataForExport() {
    const errors = [];
    const ids = new Map();

    state.categories.forEach((category, categoryIndex) => {
        const data = category.data;
        const categoryLocation = `categories[${categoryIndex}]`;
        registerExportId(data?.id, `${categoryLocation}.id`, ids, errors);
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
                    if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
                        errors.push(`${location}.discount.multiplier must be greater than 0 and at most 1.`);
                    }
                }
                if (type === 'dropdown' && entry.offer) {
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
    const errors = validateDataForExport();
    if (errors.length) {
        setStatus(errors[0], true);
        console.error('Data export validation failed:', errors);
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

function refreshEntryEditor() {
    renderEntryForm();
    renderPreview();
}

function parseNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function hasDataId(id) {
    return state.categories.some(category =>
        category.data.entries.some(entry =>
            entry.id === id
            || entry.options?.some(option => option.id === id)
        )
    );
}

function createDefaultOption(entryId, index) {
    return {
        id: `${entryId}-option-${String(index).padStart(2, '0')}`,
        label: `Option ${index}`,
        price: 0
    };
}

function renumberEntryChildren(entry) {
    entry.options?.forEach((option, index) => {
        option.id = `${entry.id}-option-${String(index + 1).padStart(2, '0')}`;
    });
    entry.featureIds?.forEach((_, index) => {
        entry.featureIds[index] = `${entry.id}-feature-${String(index + 1).padStart(2, '0')}`;
    });
    if (entry.offer) entry.offer.id = `${entry.id}-complete-selection`;
}

function renumberCategoryItems(category) {
    const selectedEntry = getSelectedEntry();
    category.data.entries.forEach((entry, index) => {
        entry.id = `${category.data.id}-${String(index + 1).padStart(2, '0')}`;
        renumberEntryChildren(entry);
    });
    if (selectedEntry) state.selectedEntryId = selectedEntry.id;
}

function createEntryTemplate(type) {
    const category = getSelectedCategory();
    const categoryId = category?.data.id || 'category';
    let index = (category?.data.entries.length || 0) + 1;
    let entryId = `${categoryId}-${String(index).padStart(2, '0')}`;
    while (hasDataId(entryId)) {
        index += 1;
        entryId = `${categoryId}-${String(index).padStart(2, '0')}`;
    }

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
        };
    }

    if (type === 'package-matrix') {
        return {
            type: 'package-matrix',
            id: entryId,
            title: 'New List',
            features: ['Feature 1'],
            featureIds: [`${entryId}-feature-01`],
            options: [{
                ...createDefaultOption(entryId, 1),
                features: ['Feature 1']
            }]
        };
    }

    return {
        type,
        id: entryId,
        label: type === 'dropdown' ? 'New Items' : 'New Inline Items',
        title: type === 'dropdown' ? 'New Description' : 'New Inline Items',
        ...(type === 'dropdown' ? { expanded: false } : {}),
        options: [createDefaultOption(entryId, 1)]
    };
}

function addEntry(type) {
    const category = getSelectedCategory();
    if (!category) return;

    const entry = createEntryTemplate(type);
    category.data.entries.push(entry);
    renumberCategoryItems(category);
    state.selectedEntryId = entry.id;
    refresh();
    setStatus(`${itemKind(entry)} added`);
}

function addOption() {
    const entry = getSelectedEntry();
    if (!entry || !Array.isArray(entry.options)) return;

    entry.options.push(createDefaultOption(entry.id, entry.options.length + 1));
    renumberEntryChildren(entry);
    refreshEntryEditor();
    setStatus('Option added');
}

function addFeature() {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix') return;

    if (!Array.isArray(entry.features)) entry.features = [];
    if (!Array.isArray(entry.featureIds)) entry.featureIds = [];
    entry.features.push(`Feature ${entry.features.length + 1}`);
    let suffix = entry.featureIds.length + 1;
    let id = `${entry.id}-feature-${String(suffix).padStart(2, '0')}`;
    while (entry.featureIds.includes(id)) {
        suffix += 1;
        id = `${entry.id}-feature-${String(suffix).padStart(2, '0')}`;
    }
    entry.featureIds.push(id);
    renumberEntryChildren(entry);
    refreshEntryEditor();
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
    refreshEntryEditor();
    setStatus('Feature renamed');
}

function removeFeature(index) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(entry.features)) return;

    const [removedFeature] = entry.features.splice(index, 1);
    entry.featureIds?.splice(index, 1);
    entry.options?.forEach(option => {
        if (!Array.isArray(option.features)) return;
        option.features = option.features.filter(feature => feature !== removedFeature);
    });
    clearFeatureDragState();
    renumberEntryChildren(entry);
    refreshEntryEditor();
    setStatus('Feature deleted');
}

function reorderFeature(fromIndex, toIndex) {
    const entry = getSelectedEntry();
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(entry.features)) return;

    moveItem(entry.features, fromIndex, toIndex);
    if (Array.isArray(entry.featureIds)) moveItem(entry.featureIds, fromIndex, toIndex);
    clearFeatureDragState();
    renumberEntryChildren(entry);
    refreshEntryEditor();
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
    refreshEntryEditor();
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
    refreshEntryEditor();
    setStatus('Included features updated');
}

function removeIncludedFeature(optionIndex, featureIndex) {
    const entry = getSelectedEntry();
    const option = entry?.options?.[optionIndex];
    if (!entry || entry.type !== 'package-matrix' || !Array.isArray(option?.features)) return;

    option.features.splice(featureIndex, 1);
    clearFeatureDragState();
    refreshEntryEditor();
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

function moveItem(list, fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
}

function swapItems(list, firstIndex, secondIndex) {
    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return;
    [list[firstIndex], list[secondIndex]] = [list[secondIndex], list[firstIndex]];
}

function moveItemToEdge(list, fromIndex, targetIndex, edge) {
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
    const [item] = list.splice(fromIndex, 1);
    let insertIndex = targetIndex + (edge === 'after' ? 1 : 0);
    if (fromIndex < insertIndex) insertIndex -= 1;
    list.splice(insertIndex, 0, item);
}

function handleCategoryFormInput(event) {
    const category = getSelectedCategory();
    if (!category) return;

    const field = event.target.dataset.categoryField;
    if (!field) return;

    if (field === 'expanded') {
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
        case 'presentation':
            entry.type = event.target.value === 'inline' ? 'choices' : 'dropdown';
            if (entry.type === 'choices') {
                delete entry.expanded;
                delete entry.offer;
                delete entry.fullSelectionDiscount;
                delete entry.inheritsDiscount;
            } else {
                entry.expanded = false;
                entry.inheritsDiscount = true;
            }
            renderEntryForm();
            break;
        case 'discountEnabled':
            if (event.target.value === 'inherit') {
                delete entry.fullSelectionDiscount;
                entry.inheritsDiscount = true;
            } else {
                entry.inheritsDiscount = false;
                entry.fullSelectionDiscount = {
                    ...(entry.fullSelectionDiscount || {}),
                    enabled: event.target.value === 'true'
                };
            }
            break;
        case 'discountLabel':
            entry.inheritsDiscount = false;
            if (!entry.fullSelectionDiscount) entry.fullSelectionDiscount = { enabled: true };
            entry.fullSelectionDiscount.label = event.target.value;
            break;
        case 'discountRate':
            entry.inheritsDiscount = false;
            if (!entry.fullSelectionDiscount) entry.fullSelectionDiscount = { enabled: true };
            entry.fullSelectionDiscount.rate = parseNumber(event.target.value);
            break;
        case 'offerPrice':
            if (event.target.value.trim() === '') {
                delete entry.offer;
            } else {
                if (!entry.offer) entry.offer = {};
                entry.offer.price = parseNumber(event.target.value);
            }
            break;
        default:
            entry[field] = event.target.value;
    }

    renderPreview();
}

async function copyText(text, successMessage) {
    await copyToClipboard(text);
    setStatus(successMessage);
}

function getSortableContainer(item) {
    if (item.dataset.sortKind === 'category') return elements.categoryList;
    if (item.dataset.sortKind === 'entry') return elements.entryList;
    if (item.dataset.sortKind === 'option') return item.parentElement;
    return null;
}

function clearSortableDragState() {
    document.querySelectorAll('.is-dragging-sortable, .is-sort-target, .is-insert-before, .is-insert-after, .is-delete-target')
        .forEach(element => element.classList.remove(
            'is-dragging-sortable',
            'is-sort-target',
            'is-insert-before',
            'is-insert-after',
            'is-delete-target'
        ));
    state.dragSortable = null;
}

function handleSortableDragStart(event) {
    if (state.dragFeature) return;

    const item = event.target.closest('[draggable="true"][data-sort-kind][data-sort-index]');
    if (!item) return;
    const container = item ? getSortableContainer(item) : null;
    if (!container || item.classList.contains('is-editing-sortable')) {
        event.preventDefault();
        return;
    }

    state.dragSortable = {
        kind: item.dataset.sortKind,
        index: Number(item.dataset.sortIndex),
        field: item.dataset.listField || '',
        container,
        action: { type: 'none' }
    };
    item.classList.add('is-dragging-sortable');
    event.dataTransfer.effectAllowed = 'move';
}

function handleSortableDragOver(event) {
    const drag = state.dragSortable;
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    document.querySelectorAll('.is-sort-target, .is-insert-before, .is-insert-after, .is-delete-target')
        .forEach(element => element.classList.remove(
            'is-sort-target',
            'is-insert-before',
            'is-insert-after',
            'is-delete-target'
        ));

    if (!drag.container.contains(event.target)) {
        drag.action = { type: 'remove' };
        drag.container.classList.add('is-delete-target');
        return;
    }

    const target = event.target.closest(`[data-sort-kind="${drag.kind}"][data-sort-index]`);
    if (!target || (drag.kind === 'list' && target.dataset.listField !== drag.field)) {
        drag.action = { type: 'none' };
        return;
    }

    const targetIndex = Number(target.dataset.sortIndex);
    const rect = target.getBoundingClientRect();
    const pointerRatio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
    const edge = pointerRatio < 0.25 ? 'before' : pointerRatio > 0.75 ? 'after' : '';
    drag.action = targetIndex === drag.index
        ? { type: 'none' }
        : edge
            ? { type: 'move', index: targetIndex, edge }
            : { type: 'swap', index: targetIndex };
    if (targetIndex === drag.index) return;
    target.classList.add(edge ? `is-insert-${edge}` : 'is-sort-target');
}

function handleSortableDrop(event) {
    const drag = state.dragSortable;
    if (!drag) return;
    event.preventDefault();
    const entry = getSelectedEntry();
    const category = getSelectedCategory();
    const action = drag.action;
    let list;
    let label;

    if (drag.kind === 'category') {
        list = state.categories;
        label = 'Category';
    } else if (drag.kind === 'entry') {
        list = category?.data.entries;
        label = 'Item';
    } else if (drag.kind === 'option') {
        list = entry?.options;
        label = 'Option';
    }

    if (!Array.isArray(list) || action.type === 'none') {
        clearSortableDragState();
        return;
    }

    if (action.type === 'swap' || action.type === 'move') {
        const reorder = action.type === 'swap'
            ? targetList => swapItems(targetList, drag.index, action.index)
            : targetList => moveItemToEdge(targetList, drag.index, action.index, action.edge);
        reorder(list);
        if (drag.kind === 'category') reorder(state.manifest.categories);
        if (drag.kind === 'entry') renumberCategoryItems(category);
        if (drag.kind === 'option') renumberEntryChildren(entry);
        clearSortableDragState();
        refresh();
        setStatus(`${label} ${action.type === 'swap' ? 'swapped' : 'moved'}`);
        return;
    }

    list.splice(drag.index, 1);
    if (drag.kind === 'category') {
        state.manifest.categories.splice(drag.index, 1);
        if (!getSelectedCategory()) {
            const nextCategory = state.categories[Math.min(drag.index, state.categories.length - 1)];
            state.selectedCategoryId = nextCategory?.data.id || '';
            state.selectedEntryId = nextCategory?.data.entries?.[0]?.id || '';
        }
    } else if (drag.kind === 'entry' && !getSelectedEntry()) {
        state.selectedEntryId = list[Math.min(drag.index, list.length - 1)]?.id || '';
    }
    if (drag.kind === 'entry') renumberCategoryItems(category);
    if (drag.kind === 'option') renumberEntryChildren(entry);
    clearSortableDragState();
    refresh();
    setStatus(`${label} deleted`);
}

function handleSortableDragEnd() {
    if (state.dragSortable) clearSortableDragState();
}

function startSortableEdit(item, targetInput = null) {
    if (item.dataset.sortKind !== 'option') return;
    if (state.editSortable?.item === item) return;
    if (state.editSortable) finishSortableEdit(true);

    const inputs = [...item.querySelectorAll('input[data-option-field]:not([data-option-field="id"])')];
    if (!inputs.length) return;
    const entry = getSelectedEntry();
    const index = Number(item.dataset.sortIndex);
    state.editSortable = {
        item,
        index,
        snapshot: structuredClone(entry?.options?.[index])
    };
    item.draggable = false;
    item.classList.add('is-editing-sortable');
    inputs.forEach(input => input.readOnly = false);
    const input = targetInput && inputs.includes(targetInput) ? targetInput : inputs[0];
    input.focus();
    input.select();
}

function finishSortableEdit(shouldCommit) {
    const edit = state.editSortable;
    if (!edit) return;
    const inputs = [...edit.item.querySelectorAll('input[data-option-field]:not([data-option-field="id"])')];

    if (!shouldCommit) {
        const entry = getSelectedEntry();
        if (entry?.options) {
            entry.options[edit.index] = edit.snapshot;
        }
        state.editSortable = null;
        refreshEntryEditor();
        setStatus('Edit cancelled');
        return;
    }

    inputs.forEach(input => input.readOnly = true);
    edit.item.classList.remove('is-editing-sortable');
    edit.item.draggable = true;
    state.editSortable = null;
    setStatus('Item updated');
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

    const featureBlock = event.target instanceof Element
        ? event.target.closest('.editor-feature-block[data-feature-index]')
        : null;
    if (state.dragFeature.kind === 'feature' && featureBlock) {
        event.dataTransfer.dropEffect = 'move';
        const featureIndex = Number(featureBlock.dataset.featureIndex);
        setFeatureDragAction(featureIndex === state.dragFeature.index
            ? { type: 'none' }
            : { type: 'sort', featureIndex });
        if (featureIndex === state.dragFeature.index) return;
        featureBlock.classList.add('is-drop-target');
        return;
    }

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

function handleFeatureDrop(event) {
    if (!state.dragFeature) return;
    event.preventDefault();
    const action = state.dragFeature.action || { type: 'none' };

    if (action.type === 'add') {
        moveIncludedFeature(action.optionIndex);
        return;
    }

    if (action.type === 'sort') {
        if (state.dragFeature.kind === 'feature') {
            reorderFeature(state.dragFeature.index, action.featureIndex);
            return;
        }
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

function handleFeatureDragEnd() {
    if (state.dragFeature) clearFeatureDragState();
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
    elements.layout.classList.add('is-json-loading');
    elements.layout.setAttribute('aria-busy', 'true');
    try {
        await loadData();
        refresh();
        setStatus('Editor loaded');
    } catch (error) {
        console.error(error);
        setStatus('Failed to load editor data', true);
    } finally {
        revealJsonContent(elements.layout);
    }
}

elements.categoryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-category-id]');
    if (!button) return;
    state.selectedCategoryId = button.dataset.categoryId;
    state.selectedEntryId = getSelectedCategory()?.data.entries?.[0]?.id || '';
    refresh();
});

elements.entryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-entry-id]');
    if (!button) return;
    state.selectedEntryId = button.dataset.entryId;
    refresh();
});

elements.categoryForm.addEventListener('input', handleCategoryFormInput);
elements.categoryForm.addEventListener('change', handleCategoryFormInput);
elements.entryForm.addEventListener('input', handleEntryFormInput);
elements.entryForm.addEventListener('change', handleEntryFormInput);
elements.entryForm.addEventListener('dragstart', handleFeatureDragStart);
document.addEventListener('dragstart', handleSortableDragStart);
document.addEventListener('dragover', handleFeatureDragOver);
document.addEventListener('dragover', handleSortableDragOver);
document.addEventListener('drop', handleFeatureDrop);
document.addEventListener('drop', handleSortableDrop);
document.addEventListener('dragend', handleFeatureDragEnd, true);
document.addEventListener('dragend', handleSortableDragEnd, true);
elements.entryForm.addEventListener('dblclick', event => {
    const block = event.target.closest('.editor-feature-block');
    if (block?.classList.contains('editor-included-feature-block')) return;
    if (block) {
        startFeatureEdit(block);
        return;
    }
    const item = event.target.closest('[data-sort-kind="option"]');
    if (item) startSortableEdit(item, event.target.closest('input'));
});
elements.entryForm.addEventListener('focusout', event => {
    const block = event.target.closest('.editor-feature-block.is-editing');
    if (block) finishFeatureEdit(block);

    const item = event.target.closest('.is-editing-sortable');
    if (item && !item.contains(event.relatedTarget)) finishSortableEdit(true);
});
elements.entryForm.addEventListener('keydown', event => {
    const block = event.target.closest('.editor-feature-block.is-editing');
    const sortable = event.target.closest('.is-editing-sortable');
    if (!block && !sortable) return;
    if (event.key === 'Enter') {
        event.preventDefault();
        block ? finishFeatureEdit(block) : finishSortableEdit(true);
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        block ? finishFeatureEdit(block, false) : finishSortableEdit(false);
    }
});
elements.entryForm.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const actions = {
        'add-option': addOption,
        'add-feature': addFeature
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
