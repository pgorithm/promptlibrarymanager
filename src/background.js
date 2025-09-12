// src/background.js

import { loadData, addPrompt as addPromptToGroup, deletePrompt as deletePromptById } from './utils/storage.js';

// Инициализация хранилища (как ранее)
chrome.runtime.onInstalled.addListener(async () => { /* ... */ });

// Управление контекстным меню (как ранее)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => { /* ... */ });

// Обработка сообщений от контент-скриптов и попапа
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPrompts':
      loadData().then(data => sendResponse(data));
      return true; // Указываем, что ответ будет асинхронным
      
    case 'openModal':
      openModalInTab(sender.tab.id, request);
      break;
      
    case 'addPrompt':






























































































      if (request && request.data && request.data.groupId) {
        addPromptToGroup(request.data.groupId, {
          title: request.data.title,
          content: request.data.content
        }).then((success) => {
          if (success) {
            refreshOpenMenus();
          }
        });
      }
      break;
      
    case 'deletePrompt':
      deletePromptById(request.promptId).then((success) => {
        if (success) {
          refreshOpenMenus();
        }
      });
      break;

    case 'copyToClipboard':
      copyToClipboard(request.text);
      break;
  }
});














function openModalInTab(tabId, request) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: openModalFromBackground,
    args: [request]
  });
}

// Функция для вызова в контексте страницы
function openModalFromBackground(request) {
  // Создаем модальное окно для добавления/редактирования промта
  if (window.plmModal) window.plmModal.remove();

  const modal = document.createElement('div');
  modal.id = 'plm-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 10002;
    padding: 20px;
  `;

  modal.innerHTML = `
    <h3 style="margin-top: 0;">${request.type === 'addPrompt' ? 'Add prompt' : 'Edit prompt'}</h3>
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold;">Title</label>
      <input type="text" id="plm-prompt-title" value="${request.title || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
    </div>
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold;">Prompt text</label>
      <textarea id="plm-prompt-content" style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;">${request.content || ''}</textarea>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button id="plm-modal-cancel" style="padding: 8px 16px; background: #eee; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      <button id="plm-modal-save" style="padding: 8px 16px; background: #6200ee; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
    </div>
  `;

  document.body.appendChild(modal);
  window.plmModal = modal;

  // Обработчики событий
  document.getElementById('plm-modal-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('plm-modal-save').addEventListener('click', () => {
    const title = document.getElementById('plm-prompt-title').value;
    const content = document.getElementById('plm-prompt-content').value;

    if (!title || !content) {
      let errorEl = document.getElementById('plm-modal-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'plm-modal-error';
        errorEl.style.cssText = 'margin-top: 10px; color: #dc2626; font-size: 13px;';
        document.querySelector('#plm-modal-save').parentElement.before(errorEl);
      }
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    // Отправляем данные в фоновый скрипт для сохранения
    chrome.runtime.sendMessage({
      action: 'addPrompt',
      data: {
        groupId: request.groupId,
        title: title,
        content: content
      }
    });

    modal.remove();
  });
}
function refreshOpenMenus() {
  // Отправляем сообщение всем контент-скриптам для обновления
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'refreshMenu' });
    });
  });
}

function copyToClipboard(text) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (!activeTab) return;
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (t) => navigator.clipboard.writeText(t),
      args: [text]
    });
  });
}