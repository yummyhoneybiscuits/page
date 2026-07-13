import { fetchJson } from './site.js';

export const DATA_MANIFEST_URL = './assets/data/ef/manifest.json';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireArray(value, location) {
    if (!Array.isArray(value)) throw new TypeError(`${location} must be an array.`);
    return value;
}

function registerId(id, location, ids) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
        throw new TypeError(`${location} must be a kebab-case id.`);
    }
    if (ids.has(id)) throw new TypeError(`Duplicate data id "${id}" at ${location}.`);
    ids.add(id);
}

function validateCategory(category, ids) {
    registerId(category.id, `${category.id || 'category'}.id`, ids);
    requireArray(category.items, `${category.id}.items`).forEach((item, itemIndex) => {
        const location = `${category.id}.items[${itemIndex}]`;
        const expectedItemId = `${category.id}-${String(itemIndex + 1).padStart(2, '0')}`;
        if (item.id !== expectedItemId) {
            throw new TypeError(`${location}.id must be "${expectedItemId}".`);
        }
        registerId(item.id, `${location}.id`, ids);
        if (typeof item.name !== 'string' || !item.name.trim()) {
            throw new TypeError(`${location}.name must be a non-empty string.`);
        }
        if (!['Item', 'Items', 'List', 'Formula'].includes(item.kind)) {
            throw new TypeError(`${location}.kind is not supported.`);
        }
        if (item.kind === 'Item') {
            if (!Number.isFinite(item.price) || item.price < 0) {
                throw new TypeError(`${location}.price must be non-negative.`);
            }
            if (!Number.isInteger(item.maxQuantity) || item.maxQuantity < 1) {
                throw new TypeError(`${location}.maxQuantity must be a positive integer.`);
            }
        }
        if (item.kind === 'Formula') {
            const values = [item.totalQuantity, item.unitPrice, item.minValue, item.maxValue, item.defaultValue];
            if (!values.every(Number.isFinite) || item.totalQuantity < 0 || item.unitPrice < 0) {
                throw new TypeError(`${location} quantity values must be valid numbers.`);
            }
            if (item.maxValue < item.minValue || item.defaultValue < item.minValue || item.defaultValue > item.maxValue) {
                throw new TypeError(`${location} quantity range is invalid.`);
            }
        }
        if (item.kind === 'Items' && !['collapsible', 'inline'].includes(item.presentation)) {
            throw new TypeError(`${location}.presentation is not supported.`);
        }
        if (item.allPrice !== undefined
            && (!Number.isFinite(item.allPrice) || item.allPrice < 0)) {
            throw new TypeError(`${location}.allPrice must be non-negative.`);
        }
        if (item.kind === 'Items' || item.kind === 'List') {
            requireArray(item.options, `${location}.options`).forEach((option, optionIndex) => {
                const expectedOptionId = `${item.id}-option-${String(optionIndex + 1).padStart(2, '0')}`;
                if (option.id !== expectedOptionId) {
                    throw new TypeError(`${location}.options[${optionIndex}].id must be "${expectedOptionId}".`);
                }
                registerId(option.id, `${location}.options[${optionIndex}].id`, ids);
                if (!Number.isFinite(option.price) || option.price < 0) {
                    throw new TypeError(`${location}.options[${optionIndex}].price must be non-negative.`);
                }
                if (option.description !== undefined
                    && (typeof option.description !== 'string' || !option.description.trim())) {
                    throw new TypeError(`${location}.options[${optionIndex}].description must be a non-empty string.`);
                }
            });
        }
        const discount = item.discount;
        if (discount && (!Number.isFinite(discount.multiplier)
            || discount.multiplier <= 0
            || discount.multiplier > 1)) {
            throw new TypeError(`${location}.discount.multiplier must be greater than 0 and at most 1.`);
        }
        if (item.kind === 'List') {
            const featureIds = new Set();
            requireArray(item.features, `${location}.features`).forEach((feature, featureIndex) => {
                const expectedFeatureId = `${item.id}-feature-${String(featureIndex + 1).padStart(2, '0')}`;
                if (feature.id !== expectedFeatureId) {
                    throw new TypeError(`${location}.features[${featureIndex}].id must be "${expectedFeatureId}".`);
                }
                registerId(feature.id, `${location}.features[${featureIndex}].id`, ids);
                featureIds.add(feature.id);
            });
            item.options.forEach((option, optionIndex) => {
                const includedFeatureIds = requireArray(
                    option.includedFeatureIds,
                    `${location}.options[${optionIndex}].includedFeatureIds`
                );
                if (new Set(includedFeatureIds).size !== includedFeatureIds.length) {
                    throw new TypeError(`${location}.options[${optionIndex}].includedFeatureIds must be unique.`);
                }
                includedFeatureIds.forEach(featureId => {
                    if (!featureIds.has(featureId)) {
                        throw new TypeError(`${location}.options[${optionIndex}] references unknown feature "${featureId}".`);
                    }
                });
            });
        }
    });
}

function toRuntimeOption(option) {
    return {
        id: option.id,
        label: option.name,
        price: option.price,
        description: option.description || ''
    };
}

function toRuntimeItem(item, defaults) {
    if (item.kind === 'Item') {
        return {
            type: 'item',
            id: item.id,
            label: item.name,
            price: item.price,
            maxQuantity: item.maxQuantity
        };
    }

    if (item.kind === 'Formula') {
        return {
            type: 'formula',
            id: item.id,
            title: item.name,
            totalQuantity: item.totalQuantity,
            unitPrice: item.unitPrice,
            minimum: item.minValue,
            maximum: item.maxValue,
            defaultValue: item.defaultValue
        };
    }

    if (item.kind === 'List') {
        const featureNames = new Map(item.features.map(feature => [feature.id, feature.name]));
        return {
            type: 'package-matrix',
            id: item.id,
            title: item.name,
            features: item.features.map(feature => feature.name),
            featureIds: item.features.map(feature => feature.id),
            options: item.options.map(option => ({
                ...toRuntimeOption(option),
                features: option.includedFeatureIds.map(id => featureNames.get(id))
            }))
        };
    }

    if (item.kind === 'Items') {
        const discount = item.discount ?? defaults.discount;
        return {
            type: item.presentation === 'inline' ? 'choices' : 'dropdown',
            id: item.id,
            label: item.name,
            title: item.description || item.name,
            expanded: Boolean(item.Expanded),
            inheritsDiscount: item.discount === undefined,
            options: item.options.map(option => toRuntimeOption(option)),
            ...(item.allPrice === undefined ? {} : {
                offer: {
                    id: `${item.id}-complete-selection`,
                    label: item.name,
                    price: item.allPrice
                }
            }),
            ...(discount ? {
                fullSelectionDiscount: {
                    enabled: discount.enabled,
                    label: discount.label,
                    rate: discount.multiplier
                }
            } : {})
        };
    }

    throw new TypeError(`Unknown data item kind "${item.kind}".`);
}

function toRuntimeCategory(category, defaults) {
    return {
        id: category.id,
        title: category.name,
        badge: category.badge || '',
        expanded: Boolean(category.Expanded),
        entries: requireArray(category.items, `${category.id}.items`)
            .map(item => toRuntimeItem(item, defaults))
    };
}

function toDataOption(option) {
    return {
        id: option.id,
        name: option.label,
        price: option.price,
        ...(option.description?.trim() ? { description: option.description.trim() } : {})
    };
}

function toDataItem(entry) {
    if (entry.type === 'item') {
        return {
            kind: 'Item',
            id: entry.id,
            name: entry.label,
            price: entry.price,
            maxQuantity: entry.maxQuantity ?? 1
        };
    }

    if (entry.type === 'formula') {
        return {
            kind: 'Formula',
            id: entry.id,
            name: entry.title,
            totalQuantity: entry.totalQuantity,
            unitPrice: entry.unitPrice,
            minValue: entry.minimum,
            maxValue: entry.maximum,
            defaultValue: entry.defaultValue
        };
    }

    if (entry.type === 'package-matrix') {
        const features = entry.features.map((name, index) => ({
            id: entry.featureIds?.[index]
                || `${entry.id}-feature-${String(index + 1).padStart(2, '0')}`,
            name
        }));
        const featureIds = new Map(features.map(feature => [feature.name, feature.id]));
        return {
            kind: 'List',
            id: entry.id,
            name: entry.title,
            features,
            options: entry.options.map(option => ({
                ...toDataOption(option),
                includedFeatureIds: (option.features || []).map(name => featureIds.get(name)).filter(Boolean)
            }))
        };
    }

    return {
        kind: 'Items',
        id: entry.id,
        name: entry.label || entry.title,
        description: entry.title || entry.label || '',
        presentation: entry.type === 'choices' ? 'inline' : 'collapsible',
        Expanded: Boolean(entry.expanded),
        ...(entry.offer ? { allPrice: entry.offer.price } : {}),
        ...(!entry.inheritsDiscount && entry.fullSelectionDiscount ? {
            discount: {
                enabled: entry.fullSelectionDiscount.enabled,
                label: entry.fullSelectionDiscount.label || 'SALE',
                multiplier: entry.fullSelectionDiscount.rate
            }
        } : {}),
        options: entry.options.map(option => toDataOption(option))
    };
}

export function serializeDataCategory(category) {
    return {
        id: category.id,
        name: category.title,
        ...(category.badge ? { badge: category.badge } : {}),
        Expanded: Boolean(category.expanded),
        items: category.entries.map(entry => toDataItem(entry))
    };
}

export function serializeDataManifest(manifest, categories) {
    return {
        currencycode: manifest.currencyCode || 'CNY',
        currencysymbol: manifest.currency || '¥',
        offsymbol: manifest.defaults?.dropdownFullSelectionDiscount?.enabled !== false,
        offlabel: manifest.defaults?.dropdownFullSelectionDiscount?.label || 'SALE',
        offrate: manifest.defaults?.dropdownFullSelectionDiscount?.rate ?? 1,
        categoryFiles: categories.map(category => ({
            id: category.data.id,
            path: category.file
        }))
    };
}

export async function loadDataFiles(manifestUrl = DATA_MANIFEST_URL) {
    const url = new URL(manifestUrl, window.location.href);
    const manifest = await fetchJson(url);
    const refs = requireArray(manifest.categoryFiles, 'categoryFiles');
    const categories = await Promise.all(refs.map(async ref => {
        if (!ref || typeof ref.id !== 'string' || typeof ref.path !== 'string') {
            throw new TypeError('Each categoryFiles entry must define id and path.');
        }
        const data = await fetchJson(new URL(ref.path, url));
        if (data.id !== ref.id) throw new TypeError(`Category id mismatch for ${ref.path}.`);
        return { file: ref.path, data };
    }));
    const ids = new Set();
    categories.forEach(category => validateCategory(category.data, ids));
    return { manifest, categories };
}

export async function loadEditableDataFiles(manifestUrl = DATA_MANIFEST_URL) {
    const { manifest: rawManifest, categories: rawCategories } = await loadDataFiles(manifestUrl);
    const defaults = {
        discount: {
            enabled: rawManifest.offsymbol !== false,
            label: rawManifest.offlabel || 'SALE',
            multiplier: rawManifest.offrate ?? 1
        }
    };
    return {
        manifest: {
            currency: rawManifest.currencysymbol || '¥',
            currencyCode: rawManifest.currencycode || 'CNY',
            defaults: {
                dropdownFullSelectionDiscount: {
                    enabled: defaults.discount.enabled,
                    label: defaults.discount.label,
                    rate: defaults.discount.multiplier
                }
            },
            categories: rawCategories.map(category => ({ file: category.file }))
        },
        categories: rawCategories.map(category => ({
            file: category.file,
            data: toRuntimeCategory(category.data, defaults)
        }))
    };
}

export async function loadPricingData(manifestUrl = DATA_MANIFEST_URL) {
    const { manifest, categories } = await loadEditableDataFiles(manifestUrl);
    return {
        currency: manifest.currency,
        defaults: manifest.defaults,
        categories: categories.map(category => category.data)
    };
}
