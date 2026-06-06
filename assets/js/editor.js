const MANIFEST_URL = './assets/data/ef-calculator/manifest.json';

const elements = {
    categoryList: document.getElementById('categoryList'),
    entryList: document.getElementById('entryList'),
    categoryForm: document.getElementById('categoryForm'),
    entryForm: document.getElementById('entryForm'),
    preview: document.getElementById('jsonPreview'),
    previewLabel: document.getElementById('previewLabel'),
    status: document.getElementById('editorStatus'),
    reloadButton: document.getElementById('reloadButton'),
    downloadCategoryButton: document.getElementById('downloadCategoryButton'),
    copyManifestButton: document.getElementById('copyManifestButton'),
    copyCategoryButton: document.getElementById('copyCategoryButton'),
    copyPreviewButton: document.getElementById('copyPreviewButton'),
    showManifestButton: document.getElementById('showManifestButton'),
    showCategoryButton: document.getElementById('showCategoryButton'),
    addItemButton: document.getElementById('addItemButton'),
    addDropdownButton: document.getElementById('addDropdownButton'),
    addChoicesButton: document.getElementById('addChoicesButton'),
    addFormulaButton: document.getElementById('addFormulaButton'),
    deleteEntryButton: document.getElementById('deleteEntryButton')
};

const state = {
    manifest: null,
    categories: [],
    selectedCategoryId: '',
    selectedEntryId: '',
    previewMode: 'category',
    dragCategoryId: '',
    dragEntryId: ''
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

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.json();
}

async function loadCatalog() {
    const manifestUrl = new URL(MANIFEST_URL, window.location.href);
    const manifest = await fetchJson(manifestUrl);
    const categories = await Promise.all(
        manifest.categories.map(async categoryRef => {
            const fileUrl = new URL(categoryRef.file, manifestUrl);
            const category = await fetchJson(fileUrl);
            return {
                ref: { ...categoryRef },
                file: categoryRef.file,
                data: category
            };
        })
    );

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
            <input id="categoryTitle" name="title" value="${escapeHtml(data.title || '')}">
        </div>
        <div class="editor-field">
            <label for="categoryBadge">Badge</label>
            <input id="categoryBadge" name="badge" value="${escapeHtml(data.badge || '')}">
        </div>
        <div class="editor-field">
            <label for="categoryExpanded">Expanded</label>
            <select id="categoryExpanded" name="expanded">
                <option value="true"${data.expanded ? ' selected' : ''}>true</option>
                <option value="false"${!data.expanded ? ' selected' : ''}>false</option>
            </select>
        </div>
    `;
}

function renderOptionCard(option, index) {
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
            <div class="editor-field">
                <label>ID</label>
                <input data-option-index="${index}" data-option-field="id" value="${escapeHtml(option.id || '')}">
            </div>
            <div class="editor-field">
                <label>Label</label>
                <input data-option-index="${index}" data-option-field="label" value="${escapeHtml(option.label || '')}">
            </div>
            <div class="editor-field">
                <label>Price</label>
                <input data-option-index="${index}" data-option-field="price" type="number" step="0.01" value="${escapeHtml(option.price ?? '')}">
            </div>
        </div>
    `;
}

function renderEntryForm() {
    const entry = getSelectedEntry();
    if (!entry) {
        elements.entryForm.innerHTML = '';
        return;
    }

    const shared = `
        <div class="editor-field">
            <label for="entryId">ID</label>
            <input id="entryId" name="id" value="${escapeHtml(entry.id || '')}">
        </div>
        <div class="editor-field">
            <label for="entryType">Type</label>
            <input id="entryType" value="${escapeHtml(entry.type || '')}" disabled>
        </div>
    `;

    if (entry.type === 'item') {
        elements.entryForm.innerHTML = `
            ${shared}
            <div class="editor-field">
                <label for="entryLabel">Label</label>
                <input id="entryLabel" name="label" value="${escapeHtml(entry.label || '')}">
            </div>
            <div class="editor-field">
                <label for="entryPrice">Price</label>
                <input id="entryPrice" name="price" type="number" step="0.01" value="${escapeHtml(entry.price ?? '')}">
            </div>
        `;
        return;
    }

    if (entry.type === 'formula') {
        elements.entryForm.innerHTML = `
            ${shared}
            <div class="editor-field">
                <label for="entryTitle">Title</label>
                <input id="entryTitle" name="title" value="${escapeHtml(entry.title || '')}">
            </div>
            <div class="editor-field">
                <label for="entryTotalQuantity">Total Quantity</label>
                <input id="entryTotalQuantity" name="totalQuantity" type="number" step="1" value="${escapeHtml(entry.totalQuantity ?? '')}">
            </div>
            <div class="editor-field">
                <label for="entryUnitPrice">Unit Price</label>
                <input id="entryUnitPrice" name="unitPrice" type="number" step="0.01" value="${escapeHtml(entry.unitPrice ?? '')}">
            </div>
        `;
        return;
    }

    const offer = entry.offer || {};
    elements.entryForm.innerHTML = `
        ${shared}
        <div class="editor-field">
            <label for="entryLabel">Big Title</label>
            <input id="entryLabel" name="label" value="${escapeHtml(entry.label || '')}">
        </div>
        <div class="editor-field">
            <label for="entryTitle">Small Title</label>
            <input id="entryTitle" name="title" value="${escapeHtml(entry.title || '')}">
        </div>
        ${entry.type === 'dropdown' ? `
            <div class="editor-field">
                <label for="entryOfferId">Offer ID</label>
                <input id="entryOfferId" name="offerId" value="${escapeHtml(offer.id || '')}">
            </div>
            <div class="editor-field">
                <label for="entryOfferPrice">Offer Price</label>
                <input id="entryOfferPrice" name="offerPrice" type="number" step="0.01" value="${escapeHtml(offer.price ?? '')}">
            </div>
        ` : ''}
        <div class="editor-options">
            ${(entry.options || []).map((option, index) => renderOptionCard(option, index)).join('')}
        </div>
        ${Array.isArray(entry.options) ? `
            <button class="editor-button" type="button" data-action="add-option">+ OPTION</button>
        ` : ''}
    `;
}

function buildManifestPreview() {
    return JSON.stringify(state.manifest, null, 2);
}

function buildCategoryPreview() {
    const category = getSelectedCategory();
    return category ? JSON.stringify(category.data, null, 2) : '';
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

function createUniqueEntryId(prefix) {
    let index = 1;
    let nextId = `${prefix}-${index}`;
    while (hasEntryId(nextId)) {
        index += 1;
        nextId = `${prefix}-${index}`;
    }
    return nextId;
}

function createDefaultOption(entryId, index) {
    return {
        id: `${entryId}-option-${index}`,
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
            defaultValue: 0
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

    const filename = category.file.split('/').pop() || `${category.data.id}.json`;
    downloadText(filename, `${buildCategoryPreview()}\n`);
    setStatus(`${filename} downloaded`);
}

function moveItem(list, fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
}

function handleCategoryFormInput(event) {
    const category = getSelectedCategory();
    if (!category) return;

    const field = event.target.name;
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

    switch (event.target.name) {
        case 'price':
        case 'totalQuantity':
        case 'unitPrice':
            entry[event.target.name] = parseNumber(event.target.value);
            break;
        case 'offerPrice':
            if (!entry.offer) entry.offer = {};
            entry.offer.price = parseNumber(event.target.value);
            break;
        case 'offerId':
            if (!entry.offer) entry.offer = {};
            entry.offer.id = event.target.value;
            break;
        default:
            entry[event.target.name] = event.target.value;
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
elements.entryForm.addEventListener('input', handleEntryFormInput);
elements.entryForm.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'add-option') {
        addOption();
        return;
    }

    if (button.dataset.action === 'remove-option') {
        removeOption(Number(button.dataset.optionIndex));
    }
});

elements.reloadButton.addEventListener('click', initialize);
elements.downloadCategoryButton.addEventListener('click', downloadSelectedCategory);
elements.copyManifestButton.addEventListener('click', () => copyText(buildManifestPreview(), 'Manifest copied'));
elements.copyCategoryButton.addEventListener('click', () => copyText(buildCategoryPreview(), 'Category JSON copied'));
elements.copyPreviewButton.addEventListener('click', () => copyText(elements.preview.textContent, 'Preview copied'));
elements.showManifestButton.addEventListener('click', () => {
    state.previewMode = 'manifest';
    renderPreview();
});
elements.showCategoryButton.addEventListener('click', () => {
    state.previewMode = 'category';
    renderPreview();
});
elements.addItemButton.addEventListener('click', () => addEntry('item'));
elements.addDropdownButton.addEventListener('click', () => addEntry('dropdown'));
elements.addChoicesButton.addEventListener('click', () => addEntry('choices'));
elements.addFormulaButton.addEventListener('click', () => addEntry('formula'));
elements.deleteEntryButton.addEventListener('click', deleteSelectedEntry);

initialize();
