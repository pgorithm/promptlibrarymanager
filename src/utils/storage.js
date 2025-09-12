// ===============================
// МОДУЛЬ ХРАНИЛИЩА ДАННЫХ (storage)
// ===============================
// В этом файле собраны функции для работы с данными расширения:
// - чтение и запись данных в chrome.storage (локальное хранилище расширения)
// - генерация UUID для новых сущностей
// - операции с группами и промтами (добавление, обновление, удаление)
//
// ВАЖНО: chrome.storage работает асинхронно. Поэтому все функции возвращают
// промисы (async/await). Это позволяет не блокировать UI и корректно
// обрабатывать результат операций.

// Инициализация структуры данных по умолчанию
const DEFAULT_DATA = {
  groups: []
};

// Сохранение данных
// Принимает объект данных и записывает его под ключом "promptLibrary"
// в локальное хранилище Chrome (или WebExtension API, если доступен browser.*).
// Возвращает промис, который резолвится после успешной записи.
export async function saveData(data) {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ promptLibrary: data }, resolve);
    } else if (browser?.storage?.local) {
      browser.storage.local.set({ promptLibrary: data }).then(resolve);
    }
  });
}

// Загрузка данных
// Читает объект под ключом "promptLibrary" из локального хранилища.
// Если данных ещё нет, возвращает DEFAULT_DATA (пустую структуру).
export async function loadData() {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get('promptLibrary', (result) => {
        resolve(result.promptLibrary || DEFAULT_DATA);
      });
    } else if (browser?.storage?.local) {
      browser.storage.local.get('promptLibrary').then((result) => {
        resolve(result.promptLibrary || DEFAULT_DATA);
      });
    }
  });
}

// Генерация UUID
// Упрощённая генерация уникального идентификатора формата XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX
// Подходит для локальной идентификации групп и промтов.
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Добавляет новый промт в группу
 * @param {string} groupId - идентификатор группы, в которую добавляем промт
 * @param {{title:string, content:string}} promptData - данные промта
 * @returns {Promise<boolean>} true, если добавление прошло успешно (группа найдена)
 */
export async function addPrompt(groupId, promptData) {
  const data = await loadData();
  const group = data.groups.find(g => g.id === groupId);
  
  if (group) {
    if (!group.prompts) group.prompts = [];
    
    group.prompts.push({
      id: generateUUID(),
      title: promptData.title,
      content: promptData.content
    });
    
    await saveData(data);
    return true;
  }
  
  return false;
}

/**
 * Обновляет существующий промт
 * @param {string} promptId - идентификатор промта
 * @param {{title:string, content:string}} promptData - новые данные промта
 * @returns {Promise<boolean>} true, если промт найден и обновлён
 */
export async function updatePrompt(promptId, promptData) {
  const data = await loadData();
  
  for (const group of data.groups) {
    const prompt = group.prompts.find(p => p.id === promptId);
    if (prompt) {
      prompt.title = promptData.title;
      prompt.content = promptData.content;
      await saveData(data);
      return true;
    }
  }
  
  return false;
}

// Ниже оставлен пример альтернативной реализации удаления промта (закомментирован).
// Он логически эквивалентен активной функции deletePrompt ниже, но был заменён
// на версию с дополнительной проверкой наличия массива prompts у каждой группы.
// Оставлено по приколу.
//
// export async function deletePrompt(promptId) {
//   const data = await loadData();
//   let deleted = false;
//   for (const group of data.groups) {
//     const initialLength = group.prompts.length;
//     group.prompts = group.prompts.filter(p => p.id !== promptId);
//     if (group.prompts.length !== initialLength) {
//       deleted = true;
//     }
//   }
//   if (deleted) {
//     await saveData(data);
//     return true;
//   }
//   return false;
// }

// Удаляет группу по ID
// Пробегается по списку групп и отфильтровывает ту, чей id равен groupId.
// Если количество групп уменьшилось — сохраняем и возвращаем true.
export async function deleteGroup(groupId) {
  const data = await loadData();
  const initialLength = data.groups.length;
  data.groups = data.groups.filter(group => group.id !== groupId);
  
  if (data.groups.length !== initialLength) {
    await saveData(data);
    return true;
  }
  
  return false;
}

// Удаляет промт по ID
// Ищет промт во всех группах, удаляет его при совпадении id.
// Если хотя бы один промт был удалён, сохраняем данные и возвращаем true.
export async function deletePrompt(promptId) {
  const data = await loadData();
  let deleted = false;
  
  for (const group of data.groups) {
    if (group.prompts) {
      const initialLength = group.prompts.length;
      group.prompts = group.prompts.filter(p => p.id !== promptId);
      
      if (group.prompts.length !== initialLength) {
        deleted = true;
      }
    }
  }
  
  if (deleted) {
    await saveData(data);
    return true;
  }
  
  return false;
}