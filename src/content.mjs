// src/content.js
import { CONFIG, matchesAllowList } from './config.js';

// Проверяем, нужно ли активировать расширение на этой странице
if (matchesAllowList(window.location.href)) {
  // Создаем кнопку активации (как в предыдущей версии)
  const triggerButton = createTriggerButton();
  document.body.appendChild(triggerButton);
  
  // Создаем контекстное меню
  const menuContainer = document.createElement('div');
  menuContainer.id = 'plm-menu';
  menuContainer.style.cssText = `
    position: fixed;
    width: 350px;
    height: 500px;
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 10001;
    display: none;
    flex-direction: column;
    overflow: hidden;
    font-family: Arial, sans-serif;
    color: #333;
  `;
  
  menuContainer.innerHTML = `
    <div class="menu-header">
      <h3 style="margin: 0; padding: 15px; font-size: 16px;">Prompt Library</h3>
      <button id="plm-close-btn" class="plm-icon-btn" aria-label="Close" title="Close">
        <svg class="plm-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div id="plm-menu-content" style="flex: 1; overflow-y: auto; padding: 0 15px 15px;"></div>
    <div id="plm-loading" style="text-align: center; padding: 20px;">Loading…</div>
  `;
  
  document.body.appendChild(menuContainer);
  
  // Стили для header
  const headerStyle = document.createElement('style');
  headerStyle.textContent = `
    .menu-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:0 10px; }
    .plm-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:transparent; border:1px solid transparent; border-radius:6px; cursor:pointer; transition: background-color .2s ease, transform .05s ease; }
    .plm-icon-btn:hover { background-color: rgba(0,0,0,0.06); }
    .plm-icon-btn:active { transform: translateY(1px); }
    .plm-icon { width:16px; height:16px; fill: currentColor; }
    .plm-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; border-radius:6px; padding:6px 10px; font-weight:600; cursor:pointer; transition: background-color .2s ease, transform .05s ease, box-shadow .2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
    .plm-btn:active { transform: translateY(1px); }
    .plm-btn-primary { background:#6200ee; color:#fff; }
    .plm-btn-primary:hover { background:#3700b3; }
  `;
  document.head.appendChild(headerStyle);
  
  // Обработчики событий
  triggerButton.addEventListener('click', toggleMenu);
  document.getElementById('plm-close-btn').addEventListener('click', closeMenu);
  
  // Функции управления меню
  function toggleMenu() {
    if (menuContainer.style.display === 'block') {
      closeMenu();
    } else {
      openMenu();
    }
  }
  
  function openMenu() {
    const position = calculateMenuPosition();
    menuContainer.style.display = 'block';
    menuContainer.style.top = `${position.top}px`;
    menuContainer.style.left = `${position.left}px`;
    
    // Загружаем данные и рендерим меню
    chrome.runtime.sendMessage({ action: 'getPrompts' }, renderMenuContent);
  }
  
  function closeMenu() {
    menuContainer.style.display = 'none';
  }
  
  function calculateMenuPosition() {
    const buttonRect = triggerButton.getBoundingClientRect();
    const position = { top: 0, left: 0 };
    
    switch (CONFIG.menuPosition) {
      case 'top-right':
        position.top = buttonRect.bottom + 10;
        position.left = buttonRect.left - 350 + buttonRect.width;
        break;
      case 'top-left':
        position.top = buttonRect.bottom + 10;
        position.left = buttonRect.left;
        break;
      case 'bottom-left':
        position.top = buttonRect.top - 510;
        position.left = buttonRect.left;
        break;
      case 'bottom-right':
      default:
        position.top = buttonRect.top - 510;
        position.left = buttonRect.left - 350 + buttonRect.width;
    }
    
    return position;
  }
  
  function renderMenuContent(data) {
    const menuContent = document.getElementById('plm-menu-content');
    const loading = document.getElementById('plm-loading');
    
    if (!data || !data.groups || data.groups.length === 0) {
      menuContent.innerHTML = `<p style="text-align: center; color: #777;">No prompts yet</p>`;
      loading.style.display = 'none';
      return;
    }
    
    let html = '';
    data.groups.forEach(group => {
      let groupHtml = `
        <div class="group" style="margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; display: flex; align-items: center;">
            <span style="flex: 1;">${group.name}</span>
            <button class="add-prompt-btn plm-btn plm-btn-primary" data-group="${group.id}" title="Add prompt">
              <svg class="plm-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </h4>
          <div class="prompts-container" id="prompts-${group.id}">`;
      
      if (group.prompts && group.prompts.length > 0) {
        group.prompts.forEach(prompt => {
          groupHtml += `
            <div class="prompt-card" style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>${prompt.title}</strong>
                <div>
                  <button class="copy-prompt-btn plm-icon-btn" data-content="${encodeURIComponent(prompt.content)}" title="Copy" style="margin-left: 5px;">
                    <svg class="plm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v2H7v8H5z" fill="currentColor"/></svg>
                  </button>
                  <button class="edit-prompt-btn plm-icon-btn" data-id="${prompt.id}" data-group="${group.id}" title="Edit" style="margin-left: 5px;">
                    <svg class="plm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4zm11-13l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                  </button>
                  <button class="delete-prompt-btn plm-icon-btn" data-id="${prompt.id}" data-group="${group.id}" title="Delete" style="margin-left: 5px;">
                    <svg class="plm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2m-7 3l1 9h8l1-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                  </button>
                </div>
              </div>
              <div style="font-size: 14px; color: #555; white-space: pre-wrap;">${prompt.content}</div>
            </div>`;
        });
      } else {
        groupHtml += `<p style="color:#777;">No prompts yet</p>`;
      }
      
      groupHtml += `</div></div>`;
      html += groupHtml;
    });
    
    menuContent.innerHTML = html;
    loading.style.display = 'none';
    
    // Добавляем обработчики событий
    document.querySelectorAll('.copy-prompt-btn').forEach(btn => {
      btn.addEventListener('click', copyPrompt);
    });
    
    document.querySelectorAll('.add-prompt-btn').forEach(btn => {
      btn.addEventListener('click', openAddPromptModal);
    });
    
    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll('.delete-prompt-btn').forEach(btn => {
      btn.addEventListener('click', deletePromptHandler);
    });
  }

  function deletePromptHandler(e) {
    const promptId = (e.currentTarget || e.target).dataset.id;
    // Кастомное подтверждение удаления вместо confirm
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10002; display:flex; align-items:center; justify-content:center;`;
    const box = document.createElement('div');
    box.style.cssText = `background:#fff; border-radius: 8px; padding: 16px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);`;
    box.innerHTML = `
      <h4 style="margin:0 0 8px 0;">Delete prompt?</h4>
      <p style="margin:0 0 12px 0; color:#555;">This action cannot be undone.</p>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="plm-cancel">Cancel</button>
        <button id="plm-ok" style=\"background:#dc2626;color:#fff;border:none;padding:6px 10px;border-radius:4px;\">Delete</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    box.querySelector('#plm-cancel').addEventListener('click', cleanup);
    box.querySelector('#plm-ok').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'deletePrompt', promptId });
      cleanup();
    });
  }
  
  function copyPrompt(e) {
    const content = decodeURIComponent((e.currentTarget || e.target).dataset.content);
    navigator.clipboard.writeText(content).then(() => {
      // Минимальное уведомление о копировании
      const notification = document.createElement('div');
      notification.textContent = 'Copied';
      notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: #333; color: #fff; padding: 8px 12px; border-radius: 4px; z-index: 10002; box-shadow: 0 6px 18px rgba(0,0,0,0.18);`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 1600);
    });
  }

  // Слушатель обновления меню от фонового скрипта
  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.action === 'refreshMenu') {
      // Перезагружаем данные и перерисовываем
      chrome.runtime.sendMessage({ action: 'getPrompts' }, renderMenuContent);
    }
  });
  
  function openAddPromptModal(e) {
    const groupId = (e.currentTarget || e.target).dataset.group;
    chrome.runtime.sendMessage({
      action: 'openModal',
      type: 'addPrompt',
      groupId: groupId
    });
  }
}

// Функция создания кнопки (из предыдущей реализации)
function createTriggerButton() {
  const button = document.createElement('div');
  button.id = 'plm-trigger';
  button.innerHTML = '📝';
  button.style.cssText = `/* стили из предыдущей реализации */`;
  return button;
}

// Функция обновления позиции (из предыдущей реализации)
function updateButtonPosition(position) { /* ... */ }