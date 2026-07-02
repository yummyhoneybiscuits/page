const DATA_URL = './assets/data/changelog.json?v=1';

const elements = {
    title: document.getElementById('pageTitle'),
    description: document.getElementById('pageDescription'),
    content: document.getElementById('changelogContent')
};

function appendInlineText(parent, text) {
    const parts = String(text).split('`');

    parts.forEach((part, index) => {
        if (!part) return;

        if (index % 2 === 1) {
            const code = document.createElement('code');
            code.textContent = part;
            parent.append(code);
            return;
        }

        parent.append(document.createTextNode(part));
    });
}

function createList(items, className) {
    const list = document.createElement('ul');
    if (className) list.className = className;

    items.forEach(item => {
        const listItem = document.createElement('li');
        appendInlineText(listItem, item);
        list.append(listItem);
    });

    return list;
}

function createSectionShell(section) {
    const block = document.createElement('section');
    block.className = 'changelog-section';
    block.setAttribute('aria-labelledby', `${section.id}Title`);

    const heading = document.createElement('h2');
    heading.id = `${section.id}Title`;
    heading.textContent = section.title;
    block.append(heading);

    return block;
}

function renderListSection(section) {
    const block = createSectionShell(section);
    block.append(createList(section.items || [], 'feature-list'));
    return block;
}

function renderHistorySection(section) {
    const block = createSectionShell(section);

    (section.entries || []).forEach(entry => {
        const article = document.createElement('article');
        article.className = 'change-entry';

        const time = document.createElement('time');
        time.dateTime = entry.date;
        time.textContent = entry.date;

        const heading = document.createElement('h3');
        heading.textContent = entry.title;

        article.append(time, heading, createList(entry.items || []));
        block.append(article);
    });

    return block;
}

function renderChangelog(data) {
    elements.title.textContent = data.title || 'CHANGELOG';
    elements.description.textContent = data.description || '';
    elements.content.replaceChildren();

    (data.sections || []).forEach(section => {
        if (section.type === 'history') {
            elements.content.append(renderHistorySection(section));
            return;
        }

        if (section.type && section.type !== 'list') {
            console.warn(`Unknown changelog section type: ${section.type}`);
            return;
        }

        elements.content.append(renderListSection(section));
    });
}

async function loadChangelog() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`Failed to load changelog data: ${response.status}`);
        renderChangelog(await response.json());
    } catch (error) {
        console.error(error);
        elements.description.textContent = 'Failed to load maintenance notes.';
        elements.content.innerHTML = '<p class="changelog-status changelog-status--error">[ERROR] Failed to load changelog data.</p>';
    }
}

loadChangelog();
