import { DATA_MANIFEST_URL } from './constants.js';

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Catalog request failed: ${response.status} ${url}`);
    }
    return response.json();
}

export async function loadRawCatalog() {
    const manifestUrl = new URL(DATA_MANIFEST_URL, window.location.href);
    const manifest = await fetchJson(manifestUrl);
    if (!Array.isArray(manifest.categories)) {
        throw new TypeError('Catalog manifest categories must be an array.');
    }

    const categories = await Promise.all(
        manifest.categories.map(async categoryRef => {
            if (!categoryRef || typeof categoryRef.file !== 'string') {
                throw new TypeError('Each catalog category reference must define a file.');
            }

            const categoryUrl = new URL(categoryRef.file, manifestUrl);
            const category = await fetchJson(categoryUrl);
            if (categoryRef.id && category.id !== categoryRef.id) {
                throw new TypeError(
                    `Catalog category id mismatch: manifest has "${categoryRef.id}", file has "${category.id}".`
                );
            }
            return category;
        })
    );

    return {
        version: manifest.version,
        currency: manifest.currency,
        defaults: manifest.defaults,
        categories
    };
}
