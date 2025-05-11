javascript:(function() {
    const scripts = [
        { name: 'Scythe', url: 'https://raw.githubusercontent.com/Whyisthisnotavalable/n-scythe/main/scythe.js' },
        { name: 'Sword', url: 'https://raw.githubusercontent.com/Whyisthisnotavalable/n-scythe/main/sword.js' },
        { name: 'Spear', url: 'https://raw.githubusercontent.com/Whyisthisnotavalable/n-scythe/main/spear.js' },
        { name: 'Tachyonic Field', url: 'https://raw.githubusercontent.com/Whyisthisnotavalable/n-scythe/refs/heads/main/tachyonic%20field.js' },
        { name: 'Minimap', url: 'https://raw.githubusercontent.com/Whyisthisnotavalable/n-scythe/main/minmap.js' }
    ];
    const container = document.createElement('div');
    container.id = 'scriptLoaderContainer';
    container.style.position = 'fixed';
    container.style.height = "fit-content"
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.width = '300px';
    container.style.backgroundColor = '#1e1e1e';
    container.style.border = '1px solid #444';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#e0e0e0';
    const header = document.createElement('div');
    header.style.padding = '10px';
    header.style.backgroundColor = '#333';
    header.style.color = 'white';
    header.style.cursor = 'move';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.userSelect = 'none';
    const title = document.createElement('span');
    title.textContent = 'Script Loader';
    title.style.fontWeight = 'bold';
    header.appendChild(title);
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.onclick = function() {
        document.body.removeChild(container);
    };
    controls.appendChild(closeBtn);
    header.appendChild(controls);
    const content = document.createElement('div');
    content.style.padding = '15px';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '10px';
    scripts.forEach(script => {
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.alignItems = 'center';
        btnContainer.style.gap = '10px';

        const btn = document.createElement('button');
        btn.textContent = script.name;
        btn.style.flex = '1';
        btn.style.padding = '8px';
        btn.style.backgroundColor = '#3a3a4a';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.2s';

        const statusIcon = document.createElement('span');
        statusIcon.style.width = '20px';
        statusIcon.style.textAlign = 'center';

        btn.onmouseover = () => btn.style.backgroundColor = '#4a4a4a';
        btn.onmouseout = () => btn.style.backgroundColor = '#3a3a4a';
        
        btn.onclick = function() {
            btn.disabled = true;
            btn.style.backgroundColor = '#2a2a2a';
            statusIcon.textContent = '⏳';
            const r = new XMLHttpRequest();
            r.open("GET", script.url, true);
            r.onloadend = function(oEvent) {
                if (r.status === 200) {
                    try {
                        new Function(r.responseText)();
                        statusIcon.textContent = '✓';
                        statusIcon.style.color = '#4CAF50';
                    } catch (e) {
                        statusIcon.textContent = '✗';
                        statusIcon.style.color = '#F44336';
                        console.error('Error executing script:', e);
                    }
                } else {
                    statusIcon.textContent = '✗';
                    statusIcon.style.color = '#F44336';
                    console.error('Failed to load script:', script.url);
                }
                btn.disabled = false;
                btn.style.backgroundColor = '#3a3a3a';
            };
            r.onerror = function() {
                statusIcon.textContent = '✗';
                statusIcon.style.color = '#F44336';
                btn.disabled = false;
                btn.style.backgroundColor = '#3a3a3a';
            };
            r.send();
        };

        btnContainer.appendChild(btn);
        btnContainer.appendChild(statusIcon);
        content.appendChild(btnContainer);
    });
    const footer = document.createElement('div');
    footer.style.padding = '10px';
    footer.style.backgroundColor = '#252525';
    footer.style.fontSize = '12px';
    footer.style.color = '#aaa';
    footer.style.textAlign = 'center';
    footer.textContent = 'Click buttons to load scripts';
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);
    document.body.appendChild(container);
    let isDragging = false;
    let offsetX, offsetY;
    header.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
        container.style.cursor = 'grabbing';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        container.style.left = (e.clientX - offsetX) + 'px';
        container.style.top = (e.clientY - offsetY) + 'px';
    });
    document.addEventListener('mouseup', function() {
        isDragging = false;
        container.style.cursor = 'default';
    });
})();
