export function getCalculatorElements() {
    return {
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
}
