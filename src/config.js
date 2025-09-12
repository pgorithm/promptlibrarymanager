const CONFIG = {
  allowList: [
    "https://chat.openai.com/*",
    "https://claude.ai/*"
  ],
  menuPosition: "bottom-right"
};

// Проверка соответствия URL списку разрешенных
function matchesAllowList(url) {
  return CONFIG.allowList.some(pattern => {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\//g, '\\/')}$`
    );
    return regex.test(url);
  });
}

// Экспортируем конфигурацию для использования в других модулях
export { CONFIG, matchesAllowList };