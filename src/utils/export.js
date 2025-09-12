// ===============================
// МОДУЛЬ ЭКСПОРТА ДАННЫХ (export)
// ===============================
// Содержит функцию для скачивания произвольного JS-объекта как JSON-файла.
// Работает целиком на стороне клиента через Blob и временную ссылку (ObjectURL).

export function exportAsJSON(data, filename) {
  // Создаем строку JSON
  const jsonStr = JSON.stringify(data, null, 2);
  
  // Создаем Blob
  const blob = new Blob([jsonStr], { type: 'application/json' });
  
  // Создаем ссылку для скачивания
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  
  // Имитируем клик для скачивания
  document.body.appendChild(a);
  a.click();
  
  // Очистка
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}