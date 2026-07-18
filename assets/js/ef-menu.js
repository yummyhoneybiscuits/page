import { loadPricingData } from './data-loader.js';
import { getItemsPricing } from './ef-calculator-core.js';
import { escapeHtml, loadHtml2Canvas } from './site.js';

const WATERMARK_TEXT = 'wechat@ shiroi333';
const dataElement = document.getElementById('menuData');
const exportButton = document.getElementById('menuExportButton');
const exportDialog = document.getElementById('menuExportDialog');
const exportForm = document.getElementById('menuExportForm');
const exportAreas = document.getElementById('menuExportAreas');

function formatPrice(value, currency) {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    return `${currency}${rounded.toLocaleString(undefined, {
        maximumFractionDigits: 2
    })}`;
}

function renderPriceLine(label, price, currency, detail = '') {
    return `
        <div class="menu-item">
            <div class="menu-item__name">
                <span>${escapeHtml(label)}</span>
                ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
            </div>
            <span class="menu-item__leader" aria-hidden="true"></span>
            <strong>${escapeHtml(price || formatPrice(0, currency))}</strong>
        </div>
    `;
}

function renderGroup(title, meta, content, expanded = false, className = '') {
    return `
        <details class="menu-group ${className}"${expanded ? ' open' : ''}>
            <summary class="menu-group__header">
                <span class="menu-group__toggle" aria-hidden="true">&gt;</span>
                <span class="menu-group__title">${title}</span>
                <span class="menu-group__meta">${meta}</span>
            </summary>
            <div class="menu-group__body">
                ${content}
            </div>
        </details>
    `;
}

function renderDropdown(entry, currency) {
    const originalTotal = entry.options.reduce((sum, option) => sum + option.price, 0);
    const salePrice = getItemsPricing(entry, new Set(entry.options.map(option => option.id))).total;
    const hasSale = Number.isFinite(salePrice) && salePrice < originalTotal;
    const price = hasSale
        ? `
            <del>${formatPrice(originalTotal, currency)}</del>
            <strong>${formatPrice(salePrice, currency)}</strong>
        `
        : `<strong>${formatPrice(originalTotal, currency)}</strong>`;
    const title = `
        <span>
            <strong>${escapeHtml(entry.label || entry.title)}</strong>
            ${entry.label !== entry.title ? `<small>${escapeHtml(entry.title)}</small>` : ''}
        </span>
    `;
    const items = `
        <div class="menu-group__items">
            ${entry.options.map(option =>
                renderPriceLine(option.label, option.description || formatPrice(option.price, currency), currency)
            ).join('')}
        </div>
    `;
    return renderGroup(title, price, items, entry.expanded);
}

function renderChoices(entry, currency) {
    const originalTotal = entry.options.reduce((sum, option) => sum + option.price, 0);
    const total = getItemsPricing(entry, new Set(entry.options.map(option => option.id))).total;
    const meta = entry.headerPrice === 'selected'
        ? ''
        : total < originalTotal
            ? `<del>${formatPrice(originalTotal, currency)}</del> <strong>${formatPrice(total, currency)}</strong>`
            : `<strong>${formatPrice(total, currency)}</strong>`;
    const items = `
        <div class="menu-group__items">
            ${entry.options.map(option =>
                renderPriceLine(
                    option.label,
                    option.description || formatPrice(option.price, currency),
                    currency
                )
            ).join('')}
        </div>
    `;
    return renderGroup(`<strong>${escapeHtml(entry.title)}</strong>`, meta, items, true);
}

function renderPackages(entry, currency) {
    const packages = `
            <div class="menu-packages">
                ${entry.options.map(option => `
                    <section class="menu-package">
                        <div class="menu-package__heading">
                            <h4>${escapeHtml(option.label)}</h4>
                            <strong>${escapeHtml(option.description || formatPrice(option.price, currency))}</strong>
                        </div>
                        <ul>
                            ${(option.features || []).map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}
                        </ul>
                    </section>
                `).join('')}
            </div>
    `;
    return renderGroup(`<strong>${escapeHtml(entry.title)}</strong>`, '套餐', packages, true, 'menu-group--packages');
}

function renderFormula(entry, currency) {
    const detail = `${entry.minimum ?? 0}-${entry.maximum ?? entry.totalQuantity} · ${formatPrice(entry.unitPrice, currency)}/单位`;
    return renderPriceLine(entry.title, '按量计价', currency, detail);
}

function renderEntry(entry, currency) {
    if (entry.type === 'item') {
        return renderPriceLine(entry.label, formatPrice(entry.price, currency), currency);
    }
    if (entry.type === 'dropdown') return renderDropdown(entry, currency);
    if (entry.type === 'choices') return renderChoices(entry, currency);
    if (entry.type === 'package-matrix') return renderPackages(entry, currency);
    if (entry.type === 'formula') return renderFormula(entry, currency);
    return '';
}

async function initialize() {
    try {
        const data = await loadPricingData();
        const currency = data.currency || '¥';
        const renderCategory = (category, index) => `
            <section id="${escapeHtml(category.id)}" class="menu-section" style="--menu-order: ${index}">
                <header class="menu-section__header">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <h2>${escapeHtml(category.title)}</h2>
                    ${category.badge ? `<small>${escapeHtml(category.badge)}</small>` : ''}
                </header>
                <div class="menu-section__content">
                    ${category.entries.map(entry => renderEntry(entry, currency)).join('')}
                </div>
            </section>
        `;
        dataElement.innerHTML = [0, 1].map(column => `
            <div class="menu-column">
                ${data.categories
                    .map((category, index) => ({ category, index }))
                    .filter(item => item.index % 2 === column)
                    .map(item => renderCategory(item.category, item.index))
                    .join('')}
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load menu:', error);
        dataElement.innerHTML = '<p class="menu-error" role="status">FAILED TO LOAD MENU DATA</p>';
    }
}

async function exportMenu(selectedIds) {
    exportButton.disabled = true;
    const sheet = document.createElement('div');
    sheet.className = 'menu-export-sheet';
    const dataClone = dataElement.cloneNode(true);
    const totalSectionCount = dataClone.querySelectorAll('.menu-section').length;
    dataClone.querySelectorAll('.menu-section').forEach(section => {
        if (!selectedIds.has(section.id)) section.remove();
    });
    dataClone.querySelectorAll('.menu-column').forEach(column => {
        if (!column.querySelector('.menu-section')) column.remove();
    });
    const sectionCount = dataClone.querySelectorAll('.menu-section').length;
    sheet.classList.toggle('is-partial', sectionCount < totalSectionCount);
    sheet.classList.toggle('is-single-section', sectionCount === 1);
    dataClone.querySelectorAll('details.menu-group').forEach(details => {
        const group = document.createElement('div');
        group.className = `${details.className}${details.open ? ' is-open' : ''}`;

        const summary = details.querySelector(':scope > summary');
        if (summary) {
            const header = document.createElement('div');
            header.className = summary.className;
            header.innerHTML = summary.innerHTML;
            group.append(header);
        }

        if (details.open) {
            const body = details.querySelector(':scope > .menu-group__body');
            if (body) group.append(body.cloneNode(true));
        }
        details.replaceWith(group);
    });
    sheet.append(dataClone);
    const watermark = document.createElement('div');
    watermark.className = 'menu-export-watermark';
    watermark.setAttribute('aria-hidden', 'true');
    watermark.innerHTML = Array.from({ length: 48 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        const top = 60 + row * 150;
        const left = 30 + column * 305 + (row % 2) * 70;
        return `<span style="top:${top}px;left:${left}px">${WATERMARK_TEXT}</span>`;
    }).join('');
    sheet.append(watermark);
    document.body.append(sheet);

    try {
        const html2canvas = await loadHtml2Canvas();
        await document.fonts?.ready;
        const canvas = await html2canvas(sheet, {
            scale: 2,
            backgroundColor: '#000000',
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `ef.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to export menu:', error);
    } finally {
        sheet.remove();
        exportButton.disabled = false;
    }
}

function openExportDialog() {
    exportAreas.innerHTML = [...dataElement.querySelectorAll('.menu-section')].map(section => {
        const number = section.querySelector('.menu-section__header > span')?.textContent || '';
        const title = section.querySelector('.menu-section__header h2')?.textContent || section.id;
        return `
            <label>
                <input type="checkbox" name="area" value="${escapeHtml(section.id)}" checked>
                <span>${escapeHtml(number)}</span>
                <strong>${escapeHtml(title)}</strong>
            </label>
        `;
    }).join('');
    exportDialog.showModal();
}

exportButton.addEventListener('click', openExportDialog);
exportDialog.addEventListener('click', event => {
    if (event.target === exportDialog) exportDialog.close();
    const command = event.target.closest('[data-export-command]')?.dataset.exportCommand;
    if (command === 'cancel') exportDialog.close();
    if (command === 'all' || command === 'none') {
        exportAreas.querySelectorAll('input[name="area"]').forEach(input => {
            input.checked = command === 'all';
        });
    }
});
exportForm.addEventListener('submit', event => {
    event.preventDefault();
    const selectedIds = new Set(
        [...exportAreas.querySelectorAll('input[name="area"]:checked')].map(input => input.value)
    );
    if (!selectedIds.size) return;
    exportDialog.close();
    exportMenu(selectedIds);
});
initialize();
