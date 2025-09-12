// src/background.js

// ===============================
// ФОНОВЫЙ СКРИПТ (service worker)
// ===============================
// Этот файл выполняется в контексте фонового процесса расширения.
// Здесь мы:
// - обрабатываем сообщения от контент‑скрипта и popup (chrome.runtime.onMessage)
// - по запросу открываем модальные окна прямо на вкладке (через chrome.scripting)
// - обновляем открытые меню на страницах после изменений данных
// - выполняем вспомогательные действия (копирование в буфер обмена)

import { loadData, addPrompt as addPromptToGroup, deletePrompt as deletePromptById } from './utils/storage.js';

// Инициализация расширения при установке/обновлении
// Здесь можно было бы создать структуру данных по умолчанию или выполнить миграции.
chrome.runtime.onInstalled.addListener(async () => { /* инициализация при установке, если потребуется */ });

// Событие обновления вкладок (зарезервировано на будущее)
// Можно использовать для автопоказа/скрытия UI при смене URL и т.п.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => { /* обновление вкладки */ });

// Обработка сообщений от контент‑скриптов и popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPrompts':
      // Возвращаем все данные (список групп и промтов)
      loadData().then(data => sendResponse(data));
      return true; // Важно: ответ асинхронный, поэтому возвращаем true
      
    case 'openModal':
      // Открываем модалку на активной вкладке для добавления/редактирования промта
      openModalInTab(sender.tab.id, request);
      break;
      
    case 'addPrompt':
      // Добавляет новый промт в указанную группу и обновляет открытые меню
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
      // Удаляет промт по ID и обновляет открытые меню
      deletePromptById(request.promptId).then((success) => {
        if (success) {
          refreshOpenMenus();
        }
      });
      break;

    case 'copyToClipboard':
      // Копирует текст в буфер обмена в контексте активной вкладки
      copyToClipboard(request.text);
      break;
  }
});

// Вставляет в контекст страницы функцию создания модального окна
function openModalInTab(tabId, request) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: openModalFromBackground,
    args: [request]
  });
}

// Функция, исполняемая уже в контексте страницы.
// Создаёт и показывает модальное окно для добавления/редактирования промта.
function openModalFromBackground(request) {
  // Если модалка уже есть — удаляем, чтобы не было дублей
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

  // Обработчики событий модального окна
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

    // Отправляем данные обратно в фоновый скрипт для сохранения
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
  // Рассылаем сообщение всем вкладкам, чтобы контент-скрипт перерисовал меню
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