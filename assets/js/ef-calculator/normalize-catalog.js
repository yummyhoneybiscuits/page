import { CODE_VERSION } from './core.js';

function requireString(value, location) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${location} must be a non-empty string.`);
    }
    return value.trim();
}

function requirePrice(value, location) {
    if (!Number.isFinite(value) || value < 0) {
        throw new TypeError(`${location} must be a non-negative number.`);
    }
    return value;
}

function registerEntry(entry, entriesById) {
    if (entriesById.has(entry.id)) {
        throw new TypeError(`Duplicate selectable id "${entry.id}".`);
    }
    entriesById.set(entry.id, entry);
    return entry;
}

function registerAlias(alias, entry, entriesById, aliases) {
    if (entriesById.has(alias) || aliases.has(alias)) {
        throw new TypeError(`Duplicate alias "${alias}".`);
    }
    aliases.set(alias, entry);
}

function normalizeDiscount(rawDiscount) {
    if (!rawDiscount || rawDiscount.enabled === false) {
        return { enabled: false, label: '', rate: 1 };
    }

    const rate = Number(rawDiscount.rate);
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 100) {
        throw new TypeError('Dropdown discount rate must be greater than 0 and less than 1.');
    }

    return {
        enabled: true,
        label: typeof rawDiscount.label === 'string' ? rawDiscount.label : 'SALE',
        rate
    };
}

function normalizeItem(rawEntry, common, location, entriesById) {
    return registerEntry({
        ...common,
        label: requireString(rawEntry.label, `${location}.label`),
        price: requirePrice(rawEntry.price, `${location}.price`),
        maxQuantity: Number.isInteger(rawEntry.maxQuantity) && rawEntry.maxQuantity > 0
            ? rawEntry.maxQuantity
            : 1
    }, entriesById);
}

function normalizeDropdown(
    rawEntry,
    common,
    location,
    defaults,
    entriesById,
    dropdownsById,
    aliases,
    nextSortIndex
) {
    if (!Array.isArray(rawEntry.options) || rawEntry.options.length === 0) {
        throw new TypeError(`${location}.options must contain at least one option.`);
    }

    const title = requireString(rawEntry.title, `${location}.title`);
    const dropdown = {
        ...common,
        title,
        label: typeof rawEntry.label === 'string' && rawEntry.label.trim()
            ? rawEntry.label.trim()
            : title,
        expanded: Boolean(rawEntry.expanded),
        discount: normalizeDiscount(
            rawEntry.fullSelectionDiscount
            ?? defaults?.dropdownFullSelectionDiscount
        ),
        offer: null,
        options: []
    };

    if (rawEntry.offer) {
        dropdown.offer = {
            id: requireString(rawEntry.offer.id, `${location}.offer.id`),
            label: typeof rawEntry.offer.label === 'string' && rawEntry.offer.label.trim()
                ? rawEntry.offer.label.trim()
                : dropdown.label,
            price: requirePrice(rawEntry.offer.price, `${location}.offer.price`)
        };
        if (!rawEntry.label) dropdown.label = dropdown.offer.label;
        registerAlias(dropdown.offer.id, dropdown, entriesById, aliases);
    }

    dropdown.options = rawEntry.options.map((rawOption, optionIndex) =>
        registerEntry({
            id: requireString(rawOption.id, `${location}.options[${optionIndex}].id`),
            type: 'dropdown-option',
            label: requireString(rawOption.label, `${location}.options[${optionIndex}].label`),
            price: requirePrice(rawOption.price, `${location}.options[${optionIndex}].price`),
            maxQuantity: 1,
            categoryId: common.categoryId,
            categoryTitle: common.categoryTitle,
            parentId: dropdown.id,
            parentTitle: dropdown.title,
            sortIndex: nextSortIndex()
        }, entriesById)
    );

    dropdownsById.set(dropdown.id, dropdown);
    return dropdown;
}

function normalizeChoices(rawEntry, common, location, entriesById, nextSortIndex) {
    if (!Array.isArray(rawEntry.options) || rawEntry.options.length === 0) {
        throw new TypeError(`${location}.options must contain at least one option.`);
    }

    const choices = {
        ...common,
        title: requireString(rawEntry.title, `${location}.title`),
        options: []
    };

    choices.options = rawEntry.options.map((rawOption, optionIndex) =>
        registerEntry({
            id: requireString(rawOption.id, `${location}.options[${optionIndex}].id`),
            type: 'choice-option',
            label: requireString(rawOption.label, `${location}.options[${optionIndex}].label`),
            price: requirePrice(rawOption.price, `${location}.options[${optionIndex}].price`),
            priceText: typeof rawOption.priceText === 'string' ? rawOption.priceText.trim() : '',
            maxQuantity: 1,
            categoryId: common.categoryId,
            categoryTitle: common.categoryTitle,
            parentId: choices.id,
            parentTitle: choices.title,
            sortIndex: nextSortIndex()
        }, entriesById)
    );

    return choices;
}

function normalizePackageMatrix(rawEntry, common, location, entriesById, nextSortIndex) {
    if (!Array.isArray(rawEntry.features) || rawEntry.features.length === 0) {
        throw new TypeError(`${location}.features must contain at least one feature.`);
    }
    if (!Array.isArray(rawEntry.options) || rawEntry.options.length === 0) {
        throw new TypeError(`${location}.options must contain at least one option.`);
    }

    const features = rawEntry.features.map((feature, featureIndex) =>
        requireString(feature, `${location}.features[${featureIndex}]`)
    );

    const matrix = {
        ...common,
        title: requireString(rawEntry.title, `${location}.title`),
        features,
        options: []
    };

    matrix.options = rawEntry.options.map((rawOption, optionIndex) => {
        const optionFeatures = Array.isArray(rawOption.features)
            ? rawOption.features.map((feature, featureIndex) =>
                requireString(feature, `${location}.options[${optionIndex}].features[${featureIndex}]`)
            )
            : [];

        return registerEntry({
            id: requireString(rawOption.id, `${location}.options[${optionIndex}].id`),
            type: 'package-option',
            label: requireString(rawOption.label, `${location}.options[${optionIndex}].label`),
            price: requirePrice(rawOption.price, `${location}.options[${optionIndex}].price`),
            priceText: typeof rawOption.priceText === 'string' ? rawOption.priceText.trim() : '',
            features: optionFeatures,
            maxQuantity: 1,
            categoryId: common.categoryId,
            categoryTitle: common.categoryTitle,
            parentId: matrix.id,
            parentTitle: matrix.title,
            parentType: 'package-matrix',
            sortIndex: nextSortIndex()
        }, entriesById);
    });

    return matrix;
}

function normalizeFormula(rawEntry, common, location, entriesById, aliases) {
    const minimum = Number.isFinite(rawEntry.minimum) ? rawEntry.minimum : 0;
    const totalQuantity = rawEntry.totalQuantity;
    const maximum = Number.isFinite(rawEntry.maximum)
        ? rawEntry.maximum
        : totalQuantity;
    if (maximum < minimum) {
        throw new TypeError(`${location}.maximum must be greater than minimum.`);
    }

    const formula = registerEntry({
        ...common,
        title: requireString(rawEntry.title, `${location}.title`),
        label: requireString(rawEntry.title, `${location}.title`),
        totalQuantity: requirePrice(totalQuantity, `${location}.totalQuantity`),
        unitPrice: requirePrice(rawEntry.unitPrice, `${location}.unitPrice`),
        minimum,
        maximum,
        defaultValue: Number.isFinite(rawEntry.defaultValue)
            ? Math.min(maximum, Math.max(minimum, rawEntry.defaultValue))
            : minimum,
        maxQuantity: 1
    }, entriesById);

    if (Array.isArray(rawEntry.aliases)) {
        rawEntry.aliases.forEach((alias, aliasIndex) => {
            registerAlias(
                requireString(alias, `${location}.aliases[${aliasIndex}]`),
                formula,
                entriesById,
                aliases
            );
        });
    }

    return formula;
}

export function normalizeCatalog(rawCatalog) {
    if (!rawCatalog || rawCatalog.version !== CODE_VERSION || !Array.isArray(rawCatalog.categories)) {
        throw new TypeError(`Config version must be ${CODE_VERSION}.`);
    }

    const entriesById = new Map();
    const dropdownsById = new Map();
    const aliases = new Map();
    let sortIndex = 0;
    const nextSortIndex = () => sortIndex++;

    const categories = rawCatalog.categories.map((rawCategory, categoryIndex) => {
        const category = {
            id: requireString(rawCategory.id, `categories[${categoryIndex}].id`),
            title: requireString(rawCategory.title, `categories[${categoryIndex}].title`),
            badge: typeof rawCategory.badge === 'string' ? rawCategory.badge.trim() : '',
            expanded: Boolean(rawCategory.expanded),
            entries: []
        };

        if (!Array.isArray(rawCategory.entries)) {
            throw new TypeError(`${category.id}.entries must be an array.`);
        }

        category.entries = rawCategory.entries.map((rawEntry, entryIndex) => {
            const location = `${category.id}.entries[${entryIndex}]`;
            const common = {
                id: requireString(rawEntry.id, `${location}.id`),
                type: requireString(rawEntry.type, `${location}.type`),
                categoryId: category.id,
                categoryTitle: category.title,
                sortIndex: nextSortIndex()
            };

            if (common.type === 'item') {
                return normalizeItem(rawEntry, common, location, entriesById);
            }
            if (common.type === 'dropdown') {
                return normalizeDropdown(
                    rawEntry,
                    common,
                    location,
                    rawCatalog.defaults,
                    entriesById,
                    dropdownsById,
                    aliases,
                    nextSortIndex
                );
            }
            if (common.type === 'choices') {
                return normalizeChoices(rawEntry, common, location, entriesById, nextSortIndex);
            }
            if (common.type === 'package-matrix') {
                return normalizePackageMatrix(rawEntry, common, location, entriesById, nextSortIndex);
            }
            if (common.type === 'formula') {
                return normalizeFormula(rawEntry, common, location, entriesById, aliases);
            }

            throw new TypeError(`Unknown entry type "${common.type}" at ${location}.`);
        });

        return category;
    });

    aliases.forEach((entry, alias) => {
        if (entriesById.has(alias)) {
            throw new TypeError(`Alias "${alias}" conflicts with a selectable id.`);
        }
    });

    return {
        config: {
            version: CODE_VERSION,
            currency: typeof rawCatalog.currency === 'string' ? rawCatalog.currency : '¥'
        },
        categories,
        entriesById,
        dropdownsById,
        aliases
    };
}
