const API_BASE_URL = 'http://localhost:8082/api';

// Các thư mục con của từng cổng (cần '../' để quay về index.html)
const PORTAL_FOLDERS = ['/admin/', '/student/', '/lecturer/'];

function isInPortalFolder() {
    return PORTAL_FOLDERS.some(folder => window.location.pathname.includes(folder));
}

async function apiFetch(endpoint, options = {}) {
    const normalizedEndpoint = endpoint.startsWith('/api/')
        ? endpoint.slice(4)
        : endpoint.startsWith('/api')
            ? endpoint.slice(4) || '/'
            : endpoint.startsWith('/')
                ? endpoint
                : `/${endpoint}`;
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});

    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        if (isInPortalFolder()) {
            window.location.href = '../index.html';
        } else if (window.location.pathname !== '/' && !window.location.pathname.endsWith('/index.html')) {
            window.location.href = 'index.html';
        }
    }

    return response;
}

function populateFilterOptions(select, values, placeholder, formatLabel = value => value, defaultValue = '') {
    if (!select || select.options.length > 1) return;

    const options = [...new Set(values.filter(value => value != null && value !== '' && value !== defaultValue))];
    select.replaceChildren(
        new Option(placeholder, defaultValue),
        ...options.map(value => new Option(formatLabel(value), value))
    );
}

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

window.removeVietnameseTones = removeVietnameseTones;

function normalizeSelectSearchText(value) {
    return removeVietnameseTones(value);
}

function enhanceSelect(select) {
    if (select.dataset.searchableSelect === 'true' || select.multiple) return;
    select.dataset.searchableSelect = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select';
    if (select.style.width) wrapper.style.width = select.style.width;
    if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;
    if (select.style.maxWidth) wrapper.style.maxWidth = select.style.maxWidth;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'searchable-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'searchable-select-label';

    const arrow = document.createElement('span');
    arrow.className = 'searchable-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');

    trigger.append(label, arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'searchable-select-search';
    search.placeholder = 'Tìm kiếm...';
    search.setAttribute('aria-label', 'Tìm kiếm lựa chọn');
    search.autocomplete = 'off';

    const optionsList = document.createElement('div');
    optionsList.className = 'searchable-select-options';
    optionsList.setAttribute('role', 'listbox');

    dropdown.append(search, optionsList);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger, dropdown);
    select.classList.add('searchable-select-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    function renderOptions() {
        const selectedOption = select.options[select.selectedIndex];
        label.textContent = selectedOption ? selectedOption.textContent.trim() : '';
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label', label.textContent || 'Chọn một mục');

        optionsList.replaceChildren();
        [...select.options].forEach(option => {
            if (option.hidden) return;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'searchable-select-option';
            item.textContent = option.textContent.trim();
            item.disabled = option.disabled || select.disabled;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(option.selected));

            const query = normalizeSelectSearchText(search.value);
            const searchableText = normalizeSelectSearchText(option.textContent);
            item.hidden = Boolean(query) && !searchableText.includes(query);
            item.classList.toggle('selected', option.selected);

            item.addEventListener('click', () => {
                select.value = option.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                renderOptions();
                closeDropdown();
                trigger.focus();
            });

            optionsList.append(item);
        });

        const hasVisibleOption = [...optionsList.children].some(item => !item.hidden);
        let emptyMessage = optionsList.querySelector('.searchable-select-empty');
        if (!hasVisibleOption) {
            if (!emptyMessage) {
                emptyMessage = document.createElement('div');
                emptyMessage.className = 'searchable-select-empty';
                emptyMessage.textContent = 'Không tìm thấy lựa chọn phù hợp';
                optionsList.append(emptyMessage);
            }
        } else {
            emptyMessage?.remove();
        }
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    function openDropdown() {
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(openMenu => {
            if (openMenu !== dropdown) {
                openMenu.classList.remove('open');
                openMenu.previousElementSibling?.setAttribute('aria-expanded', 'false');
            }
        });
        renderOptions();
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        search.value = '';
        renderOptions();
        search.focus();
    }

    trigger.addEventListener('click', () => {
        if (dropdown.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    search.addEventListener('input', renderOptions);
    search.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeDropdown();
            trigger.focus();
        } else if (event.key === 'Enter') {
            const firstVisibleOption = [...optionsList.querySelectorAll('.searchable-select-option')]
                .find(item => !item.hidden && !item.disabled);
            if (firstVisibleOption) firstVisibleOption.click();
        }
    });

    select.labels?.forEach(labelElement => {
        labelElement.addEventListener('click', event => {
            event.preventDefault();
            if (!trigger.disabled) openDropdown();
        });
    });

    select.addEventListener('change', renderOptions);
    select.addEventListener('invalid', () => {
        openDropdown();
        trigger.focus();
    });

    new MutationObserver(renderOptions).observe(select, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
    });

    renderOptions();
}

function enhancePageSelects(root = document) {
    if (root.matches?.('select')) enhanceSelect(root);
    root.querySelectorAll?.('select').forEach(enhanceSelect);
}

function initializeSearchableSelects() {
    enhancePageSelects();
    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) enhancePageSelects(node);
            });
        });
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', event => {
        if (!event.target.closest('.searchable-select')) {
            document.querySelectorAll('.searchable-select-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
                dropdown.previousElementSibling?.setAttribute('aria-expanded', 'false');
            });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSearchableSelects, { once: true });
} else {
    initializeSearchableSelects();
}
