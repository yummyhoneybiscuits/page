export const CATALOG_MANIFEST_URL = './assets/data/ef-calculator/manifest.json';

export async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`JSON request failed: ${response.status} ${url}`);
    }
    return response.json();
}

export async function loadCatalogFiles(manifestUrl = CATALOG_MANIFEST_URL) {
    const url = new URL(manifestUrl, window.location.href);
    const manifest = await fetchJson(url);
    if (!Array.isArray(manifest.categories)) {
        throw new TypeError('Catalog manifest categories must be an array.');
    }

    const categories = await Promise.all(
        manifest.categories.map(async ref => {
            const file = typeof ref === 'string' ? ref : ref?.file;
            if (typeof file !== 'string' || file.trim() === '') {
                throw new TypeError('Each catalog category reference must define a file.');
            }

            const data = await fetchJson(new URL(file, url));

            return {
                file,
                data
            };
        })
    );

    return { manifest, categories };
}

export async function loadRawCatalog(manifestUrl = CATALOG_MANIFEST_URL) {
    const { manifest, categories } = await loadCatalogFiles(manifestUrl);
    return {
        version: manifest.version,
        currency: manifest.currency,
        defaults: manifest.defaults,
        categories: categories.map(category => category.data)
    };
}
