import { loadData, saveData, generateUUID, deletePrompt, deleteGroup } from '../utils/storage.js';
import { exportAsJSON } from '../utils/export.js';

// ===============================
// POPUP UI (окно расширения на панели браузера)
// ===============================
// Этот файл отвечает за интерфейс управления библиотекой промтов:
// - отображение групп и промтов
// - добавление/редактирование/удаление
// - импорт и экспорт данных
// Здесь нет прямого доступа к DOM страниц сайтов — только к DOM popup.

// DOM элементы
const groupsContainer = document.getElementById('groups-container');
const addGroupBtn = document.getElementById('add-group-btn');
const settingsBtn = document.getElementById('settings-btn');
const importFileInput = document.getElementById('import-file');

// Основные переменные состояния
let currentData = { groups: [] };
let collapsedGroupIds = new Set();

// Инициализация popup после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentData = await loadData();
    // Локально запоминаем, какие группы были свернуты пользователем, через localStorage
    const stored = localStorage.getItem('plm_collapsed_groups');
    if (stored) {
      try { collapsedGroupIds = new Set(JSON.parse(stored)); } catch (_) { collapsedGroupIds = new Set(); }
    }
    renderGroups(currentData.groups);
  } catch (error) {
    console.error('Data load error:', error);
    showNotification('Failed to load data', 'error');
  }
  
  // Назначение обработчиков для кнопок верхнего уровня
  addGroupBtn.addEventListener('click', showAddGroupModal);
  settingsBtn.addEventListener('click', openSettingsModal);
  importFileInput.addEventListener('change', handleImport);

  // Применяем сохранённую тему
  const savedTheme = localStorage.getItem('plm_theme') || 'system';
  applyTheme(savedTheme);
});

// Рендеринг списка групп
function renderGroups(groups) {
  groupsContainer.innerHTML = '';
  
  if (!groups || groups.length === 0) {
    groupsContainer.innerHTML = `
      <div class="empty-state">
        <p>No groups yet. Create the first one.</p>
      </div>
    `;
    return;
  }
  
  groups.forEach(group => {
    const groupElement = document.createElement('div');
    groupElement.className = 'group';
    if (collapsedGroupIds.has(group.id)) {
      groupElement.classList.add('collapsed');
    }
    groupElement.innerHTML = `
      <div class="group-header">
        <h3 class="group-toggle" data-group="${group.id}" title="Collapse/expand">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" style="transform:${collapsedGroupIds.has(group.id) ? 'rotate(-90deg)' : 'rotate(0)'}; transition: transform .15s ease;">
            <path d="M8 10l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          ${group.name} <span style="opacity:.7; font-weight:normal;">(${(group.prompts||[]).length})</span>
        </h3>
        <div class="group-actions">
          <button class="add-prompt-btn btn btn-primary" data-group="${group.id}" title="Add prompt">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Prompt
          </button>
          <button class="delete-group-btn icon-btn" title="Delete group" data-group="${group.id}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 7h12M9 7V5h6v2m-7 3l1 9h8l1-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="prompts-list" id="prompts-${group.id}"></div>
    `;
    
    groupsContainer.appendChild(groupElement);
    
    // Рендеринг промтов этой группы
    renderPrompts(group.id, group.prompts || []);
    
    // Обработчики для действий с группой
    groupElement.querySelector('.add-prompt-btn').addEventListener('click', (e) => {
      const groupId = (e.currentTarget || e.target).dataset.group;
      showPromptModal(null, groupId);
    });
    
    groupElement.querySelector('.delete-group-btn').addEventListener('click', async (e) => {
      const groupId = (e.currentTarget || e.target).dataset.group;
      // Кастомное подтверждение удаления группы (без window.confirm)
      const confirm = await openConfirmModal('Delete group?', 'All prompts in the group will be removed.');
      if (!confirm) return;
      deleteGroupHandler(groupId);
    });

    // Переключение свернуто/развернуто
    groupElement.querySelector('.group-toggle').addEventListener('click', (e) => {
      const gid = (e.currentTarget || e.target).dataset.group || group.id;
      groupElement.classList.toggle('collapsed');
      const isCollapsed = groupElement.classList.contains('collapsed');
      const icon = groupElement.querySelector('.group-toggle .icon');
      if (icon) icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0)';
      if (isCollapsed) {
        collapsedGroupIds.add(gid);
      } else {
        collapsedGroupIds.delete(gid);
      }
      localStorage.setItem('plm_collapsed_groups', JSON.stringify(Array.from(collapsedGroupIds)));
    });
  });
}

// Рендеринг списка промтов конкретной группы
function renderPrompts(groupId, prompts) {
  const container = document.getElementById(`prompts-${groupId}`);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!prompts || prompts.length === 0) {
    container.innerHTML = '<p>No prompts yet. Add the first one.</p>';
    return;
  }
  
  prompts.forEach(prompt => {
    const promptElement = document.createElement('div');
    promptElement.className = 'prompt-card';
    promptElement.innerHTML = `
      <div class="prompt-header">
        <h4>${prompt.title}</h4>
        <div class="prompt-actions">
          <button class="copy-prompt-btn icon-btn" title="Copy to clipboard" data-content="${encodeURIComponent(prompt.content)}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 9h10v10H9zM5 5h10v2H7v8H5z" fill="currentColor"/>
            </svg>
          </button>
          <button class="edit-prompt-btn icon-btn" title="Edit prompt" data-prompt="${prompt.id}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4zm11-13l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <button class="delete-prompt-btn icon-btn" title="Delete prompt" data-prompt="${prompt.id}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 7h12M9 7V5h6v2m-7 3l1 9h8l1-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="prompt-content"></div>
    `;
    
    container.appendChild(promptElement);
    
    // Безопасная вставка текста промта: используем textContent (не innerHTML)
    const contentEl = promptElement.querySelector('.prompt-content');
    if (contentEl) contentEl.textContent = prompt.content;

    // Обработчики для действий над промтом
    promptElement.querySelector('.copy-prompt-btn').addEventListener('click', (e) => {
      const content = decodeURIComponent((e.currentTarget || e.target).dataset.content);
      copyToClipboard(content);
    });
    
    promptElement.querySelector('.edit-prompt-btn').addEventListener('click', (e) => {
      const promptId = (e.currentTarget || e.target).dataset.prompt;
      showPromptModal(promptId);
    });
    
    promptElement.querySelector('.delete-prompt-btn').addEventListener('click', async (e) => {
      const promptId = (e.currentTarget || e.target).dataset.prompt;
      // Кастомное подтверждение удаления промта (без window.confirm)
      const confirm = await openConfirmModal('Delete prompt?', 'This action cannot be undone.');
      if (!confirm) return;
      deletePromptHandler(promptId);
    });
  });
}

// ===== ОПЕРАЦИИ С ГРУППАМИ =====
async function showAddGroupModal() {
  // Показываем модальное окно с полем ввода для названия новой группы
  const name = await openInputModal('New group', 'Group name');
  if (!name) return;
  
  try {
    const newGroup = {
      id: generateUUID(),
      name: name,
      prompts: []
    };
    
    currentData.groups.push(newGroup);
    await saveData(currentData);
    renderGroups(currentData.groups);
    showNotification('Group created', 'success');
  } catch (error) {
    console.error('Group creation error:', error);
    showNotification('Failed to create group', 'error');
  }
}

async function deleteGroupHandler(groupId) {
  try {
    await deleteGroup(groupId);
    
    // Обновляем данные из хранилища и перерисовываем интерфейс
    currentData = await loadData();
    renderGroups(currentData.groups);
    showNotification('Group deleted', 'success');
  } catch (error) {
    console.error('Group deletion error:', error);
    showNotification('Failed to delete group', 'error');
  }
}

// ===== ОПЕРАЦИИ С ПРОМТАМИ =====
async function showPromptModal(promptId = null, groupId = null) {
  // Создаем модальное окно для добавления/редактирования промта
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${promptId ? 'Edit prompt' : 'New prompt'}</h3>
      
      <label>Title</label>
      <input type="text" id="prompt-title" value="${promptId ? getPromptById(promptId)?.title || '' : ''}">
      
      <label>Prompt text</label>
      <textarea id="prompt-content">${promptId ? getPromptById(promptId)?.content || '' : ''}</textarea>
      
      <label>Group</label>
      <select id="prompt-group">
        ${currentData.groups.map(group => `
          <option value="${group.id}" 
            ${(groupId && group.id === groupId) || 
              (promptId && group.prompts?.some(p => p.id === promptId)) ? 'selected' : ''}>
            ${group.name}
          </option>
        `).join('')}
      </select>
      
      <div class="modal-actions">
        <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
        <button id="modal-save" class="btn btn-primary">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчики модального окна
  document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.remove();
  });
  
  document.getElementById('modal-save').addEventListener('click', async () => {
    const title = document.getElementById('prompt-title').value;
    const content = document.getElementById('prompt-content').value;
    const groupId = document.getElementById('prompt-group').value;
    
    if (!title || !content) {
      showNotification('Please fill in all fields', 'error');
      return;
    }
    
    try {
      if (promptId) {
        // Обновление существующего промта
        await updatePrompt(promptId, title, content, groupId);
      } else {
        // Добавление нового промта
        await addPrompt(title, content, groupId);
      }
      
      modal.remove();
      currentData = await loadData();
      renderGroups(currentData.groups);
      showNotification('Prompt saved', 'success');
    } catch (error) {
      console.error('Prompt save error:', error);
      showNotification('Failed to save prompt', 'error');
    }
  });
}

async function addPrompt(title, content, groupId) {
  const newPrompt = {
    id: generateUUID(),
    title,
    content
  };
  
  const group = currentData.groups.find(g => g.id === groupId);
  if (group) {
    if (!group.prompts) group.prompts = [];
    group.prompts.push(newPrompt);
    await saveData(currentData);
  }
}

async function updatePrompt(promptId, title, content, newGroupId) {
  // Находим текущую группу и сам промт
  let currentGroup, currentPrompt;
  for (const group of currentData.groups) {
    if (group.prompts) {
      const prompt = group.prompts.find(p => p.id === promptId);
      if (prompt) {
        currentGroup = group;
        currentPrompt = prompt;
        break;
      }
    }
  }
  
  if (!currentPrompt) {
    throw new Error('Prompt not found');
  }
  
  // Обновляем поля промта
  currentPrompt.title = title;
  currentPrompt.content = content;
  
  // Если пользователь выбрал другую группу — перемещаем промт
  if (currentGroup.id !== newGroupId) {
    // Удаляем из текущей группы
    currentGroup.prompts = currentGroup.prompts.filter(p => p.id !== promptId);
    
    // Добавляем в новую группу
    const newGroup = currentData.groups.find(g => g.id === newGroupId);
    if (newGroup) {
      if (!newGroup.prompts) newGroup.prompts = [];
      newGroup.prompts.push(currentPrompt);
    }
  }
  
  await saveData(currentData);
}

async function deletePromptHandler(promptId) {
  try {
    await deletePrompt(promptId);
    
    // Обновляем данные и интерфейс
    currentData = await loadData();
    renderGroups(currentData.groups);
    showNotification('Prompt deleted', 'success');
  } catch (error) {
    console.error('Prompt deletion error:', error);
    showNotification('Failed to delete prompt', 'error');
  }
}

// ===== ИМПОРТ/ЭКСПОРТ =====
function handleExport() {
  try {
    const date = new Date().toISOString().split('T')[0];
    exportAsJSON(currentData, `prompts_${date}.json`);
    showNotification('Data exported', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Failed to export data', 'error');
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      await mergeImportedData(importedData);
      
      // Обновляем данные и интерфейс после успешного слияния
      currentData = await loadData();
      renderGroups(currentData.groups);
      showNotification('Data imported', 'success');
    } catch (error) {
      console.error('Import error:', error);
      showNotification('Invalid data structure', 'error');
    }
    
    // Сброс input
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

async function mergeImportedData(importedData) {
  if (!importedData || !Array.isArray(importedData.groups)) {
    throw new Error('Invalid data format');
  }
  
  // Загружаем текущие данные
  const currentData = await loadData();
  
  // Слияние групп
  importedData.groups.forEach(importedGroup => {
    const existingGroup = currentData.groups.find(g => g.name === importedGroup.name);
    
    if (existingGroup) {
      // Слияние промтов
      importedGroup.prompts.forEach(importedPrompt => {
        if (!existingGroup.prompts.some(p => p.title === importedPrompt.title)) {
          existingGroup.prompts.push({
            ...importedPrompt,
            id: generateUUID() // Генерируем новый ID
          });
        }
      });
    } else {
      // Добавляем новую группу
      currentData.groups.push({
        ...importedGroup,
        id: generateUUID(),
        prompts: importedGroup.prompts.map(p => ({
          ...p,
          id: generateUUID()
        }))
      });
    }
  });
  
  await saveData(currentData);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getPromptById(promptId) {
  for (const group of currentData.groups) {
    if (group.prompts) {
      const prompt = group.prompts.find(p => p.id === promptId);
      if (prompt) return prompt;
    }
  }
  return null;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showNotification('Copied to clipboard', 'success'))
    .catch(err => showNotification(`Copy error: ${err}`, 'error'));
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const text = document.createElement('div');
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';

  closeBtn.addEventListener('click', () => removeToast(toast));

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Запускаем анимацию появления (force reflow)
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Авто-скрытие через 3 секунды (для ошибок — 5 секунд)
  const ttl = type === 'error' ? 5000 : 3000;
  const hideTimer = setTimeout(() => removeToast(toast), ttl);

  // Если пользователь навёл курсор, не скрываем уведомление
  toast.addEventListener('mouseenter', () => clearTimeout(hideTimer));
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.remove('show');
  const removeAfter = 180;
  setTimeout(() => {
    toast.remove();
  }, removeAfter);
}

// Кастомные модальные окна: подтверждение и ввод
async function openConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>${title}</h3>
        <p class="confirm-text">${message}</p>
        <div class="modal-actions">
          <button id="confirm-cancel" class="btn btn-secondary">Cancel</button>
          <button id="confirm-ok" class="btn btn-danger">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cleanup = (result) => {
      modal.remove();
      resolve(result);
    };

    document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false));
    document.getElementById('confirm-ok').addEventListener('click', () => cleanup(true));
  });
}

async function openInputModal(title, placeholder) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>${title}</h3>
        <input id="input-value" class="input-field" type="text" placeholder="${placeholder}" />
        <div class="modal-actions">
          <button id="input-cancel" class="btn btn-secondary">Cancel</button>
          <button id="input-ok" class="btn btn-primary">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#input-value');
    input.focus();

    const cleanup = (value) => {
      modal.remove();
      resolve(value);
    };

    document.getElementById('input-cancel').addEventListener('click', () => cleanup(null));
    document.getElementById('input-ok').addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) {
        showNotification('Please enter a name', 'error');
        return;
      }
      cleanup(value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('input-ok').click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(null);
      }
    });
  });
}

// ===== НАСТРОЙКИ (МОДАЛКА) =====
function openSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const currentTheme = localStorage.getItem('plm_theme') || 'system';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Settings</h3>
      <div style="margin-top:10px;">
        <label style="display:block; font-weight:600; margin-bottom:6px;">Theme</label>
        <div class="theme-select" style="display:flex; gap:8px; flex-wrap:wrap;">
          <label class="btn btn-secondary" style="padding:6px 10px;">
            <input type="radio" name="theme" value="system" ${currentTheme==='system'?'checked':''} /> System
          </label>
          <label class="btn btn-secondary" style="padding:6px 10px;">
            <input type="radio" name="theme" value="light" ${currentTheme==='light'?'checked':''} /> Light
          </label>
          <label class="btn btn-secondary" style="padding:6px 10px;">
            <input type="radio" name="theme" value="dark" ${currentTheme==='dark'?'checked':''} /> Dark
          </label>
        </div>
      </div>
      <div style="margin-top:16px;">
        <label style="display:block; font-weight:600; margin-bottom:6px;">Data</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="settings-import" class="btn btn-secondary">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0l3-3m-3 3L5 7M3 12h10v2H3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            Import
          </button>
          <button id="settings-export" class="btn btn-secondary">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V6m0 0l3 3M8 6L5 9M3 2h10v2H3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            Export
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button id="settings-close" class="btn btn-primary">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Theme change
  modal.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const value = e.target.value;
      applyTheme(value);
      localStorage.setItem('plm_theme', value);
    });
  });

  // Import/Export
  modal.querySelector('#settings-import').addEventListener('click', () => importFileInput.click());
  modal.querySelector('#settings-export').addEventListener('click', handleExport);

  // Close
  modal.querySelector('#settings-close').addEventListener('click', () => modal.remove());
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else if (mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
}