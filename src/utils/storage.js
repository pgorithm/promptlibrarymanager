// Инициализация структуры данных по умолчанию
const DEFAULT_DATA = {
  groups: []
};

// Сохранение данных
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
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Добавляет новый промт в группу
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

// Удаляет промт
//export async function deletePrompt(promptId) {
//  const data = await loadData();
//  let deleted = false;
//  
//  for (const group of data.groups) {
//    const initialLength = group.prompts.length;
//    group.prompts = group.prompts.filter(p => p.id !== promptId);
//    
//    if (group.prompts.length !== initialLength) {
//      deleted = true;
//    }
//  }
//  
//  if (deleted) {
//    await saveData(data);
//    return true;
//  }
//  
//  return false;
//}

// Удаляет группу по ID
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