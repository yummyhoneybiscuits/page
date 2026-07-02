export function getCalculatorElements() {
    const elements = {
        catalog: document.querySelector('#catalogContainer'),
        catalogStatus: document.querySelector('#catalogStatus'),
        search: document.querySelector('#searchInput'),
        regexHelpButton: document.querySelector('#regexHelpButton'),
        regexHelpPanel: document.querySelector('#regexHelpPanel'),
        cart: document.querySelector('#cartContainer'),
        total: document.querySelector('#totalPrice'),
        generatedCode: document.querySelector('#generatedCode'),
        loadCode: document.querySelector('#loadCodeInput'),
        codeStatus: document.querySelector('#codeStatus'),
        clearButton: document.querySelector('#clearCartButton'),
        exportButton: document.querySelector('#exportButton'),
        copyButton: document.querySelector('#copyCodeButton'),
        loadButton: document.querySelector('#loadCodeButton'),
        exportArea: document.querySelector('#exportArea')
    };

    const optionalKeys = new Set(['regexHelpButton', 'regexHelpPanel']);
    const missing = Object.entries(elements)
        .filter(([key, element]) => !optionalKeys.has(key) && !element)
        .map(([key]) => key);

    if (Boolean(elements.regexHelpButton) !== Boolean(elements.regexHelpPanel)) {
        missing.push(elements.regexHelpButton ? 'regexHelpPanel' : 'regexHelpButton');
    }

    if (missing.length > 0) {
        throw new Error(`Calculator DOM initialization failed. Missing element keys: ${missing.join(', ')}`);
    }

    return elements;
}
