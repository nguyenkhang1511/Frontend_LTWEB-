const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// A small DOM fixture keeps these behavioral tests runnable without dependencies.
function fixture(count = 25) {
    const observers = [];
    class Element {
        constructor(tag) {
            this.tag = tag;
            this.children = [];
            this.dataset = {};
            this.attributes = {};
            this.events = {};
            this.nodeType = 1;
        }
        append(...children) { this.children.push(...children); }
        add(option) { this.append(option); }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(type, callback) { this.events[type] = callback; }
        replaceChildren(...children) { this.children = children; }
        after(node) { this.controls = node; }
        focus() { this.focused = true; }
        matches(selector) { return this.tag === selector; }
        querySelectorAll(selector) {
            return this.children.filter(child => child instanceof Element).flatMap(child =>
                [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
        }
        querySelector() { return this.children.find(child => child.attributes?.['aria-current'] === 'page'); }
    }
    const body = new Element('tbody');
    function rows(size) {
        return Array.from({ length: size }, () => ({ cells: [{ colSpan: 1 }, { colSpan: 1 }], hidden: false }));
    }
    body.rows = rows(count);
    const table = new Element('table');
    table.tBodies = [body];
    table.append(body);
    body.closest = () => table;
    const root = new Element('body');
    root.append(table);
    const document = {
        readyState: 'complete', body: root,
        createElement: tag => new Element(tag),
        querySelectorAll: selector => root.querySelectorAll(selector)
    };
    const context = {
        document, Node: { ELEMENT_NODE: 1 },
        Option: function (label, value) { this.textContent = label; this.value = value; },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe(target, options) { observers.push({ target, options, callback: this.callback }); }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/pagination.js'), 'utf8'), context);
    const controls = table.controls;
    const [sizeLabel, summary, nav] = controls.children;
    const size = sizeLabel.children[1];
    return {
        table, body, controls, summary, nav, size, root, observers, Element, rows,
        click(text) {
            const button = nav.children.find(child => child.textContent === text);
            assert(button, `Button ${text} exists`);
            assert(!button.disabled, `Button ${text} is enabled`);
            button.events.click();
        },
        refresh() { observers.find(observer => observer.target === body).callback([]); },
        visible() { return body.rows.filter(row => !row.hidden); }
    };
}

test('page boundaries, last page and keyboard focus', () => {
    const f = fixture();
    assert.equal(f.visible().length, 10);
    assert.equal(f.nav.children[0].disabled, true);
    f.click('Sau');
    assert.equal(f.body.rows[0].hidden, true);
    assert.equal(f.body.rows[10].hidden, false);
    assert(f.nav.querySelector().focused);
    f.click('3');
    assert.equal(f.visible().length, 5);
    assert.equal(f.nav.children.at(-1).disabled, true);
    assert.match(f.summary.textContent, /21–25 \/ 25/);
    f.click('Trước');
    assert.equal(f.visible().length, 10);
});

test('page size and filtered rows reset to the first page', () => {
    const f = fixture(53);
    f.click('4');
    f.size.value = '20';
    f.size.events.change();
    assert.equal(f.visible().length, 20);
    assert.match(f.summary.textContent, /Trang 1\/3/);
    f.click('Sau');
    f.body.rows = f.rows(3);
    f.refresh();
    assert.equal(f.visible().length, 3);
    assert.match(f.summary.textContent, /Trang 1\/1/);
});

test('empty, loading and error rows stay visible without pagination', () => {
    const f = fixture(0);
    assert.equal(f.controls.hidden, true);
    f.body.rows = [{ cells: [{ colSpan: 100 }], hidden: false }];
    f.refresh();
    assert.equal(f.controls.hidden, true);
    assert.equal(f.body.rows[0].hidden, false);
    f.body.rows = f.rows(11);
    f.refresh();
    assert.equal(f.controls.hidden, false);
    assert.equal(f.visible().length, 10);
});

test('large page counts offer first and last page without unbounded buttons', () => {
    const f = fixture(1000);
    f.click('100');
    assert.equal(f.visible().length, 10);
    assert(f.nav.children.length <= 11);
    f.click('1');
    assert.equal(f.body.rows[0].hidden, false);
});

test('dynamic tables initialize once and have independent pagination', () => {
    const f = fixture();
    const table = new f.Element('table');
    const body = new f.Element('tbody');
    body.rows = f.rows(12);
    table.tBodies = [body];
    table.append(body);
    const observer = f.observers.find(item => item.target === f.root);
    observer.callback([{ addedNodes: [table] }]);
    assert(table.controls);
    assert.equal(body.rows.filter(row => !row.hidden).length, 10);
    const controls = table.controls;
    observer.callback([{ addedNodes: [table] }]);
    assert.equal(table.controls, controls);
    f.click('Sau');
    assert.equal(body.rows[0].hidden, false);
    assert.equal(f.observers.find(item => item.target === body).options.attributes, undefined);
});
