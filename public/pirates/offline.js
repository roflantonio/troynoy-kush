export function setupOfflineMenu() {
  const button = document.getElementById("download-game");
  const status = document.getElementById("offline-status");
  const meter = document.getElementById("offline-progress");
  const message = value => {
    status.textContent = value;
    status.hidden = !value;
  };
  const ready = () => {
    button.textContent = "Игра загружена";
    button.disabled = true;
    meter.hidden = true;
    message("Можно играть без интернета с ярлыка или по этой же ссылке.");
  };
  const unsupported = "Офлайн-загрузка недоступна в этом браузере.";
  const workers = navigator.serviceWorker;
  if (!workers || !window.caches) {
    button.addEventListener("click", () => message(unsupported));
    return;
  }

  const registration = workers.register("./offline-worker.js", { type: "module", updateViaCache: "none" }).catch(async error => {
    const existing = await workers.getRegistration();
    if (existing?.active) return existing;
    throw error;
  });
  let saving = false;

  async function request(command, onProgress) {
    const reg = await registration;
    const active = reg.active ?? (await workers.ready).active;
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (data.type === "progress") {
          onProgress?.(data);
          return;
        }
        channel.port1.close();
        if (data.type === "error") reject(data);
        else resolve(data);
      };
      active.postMessage(command, [channel.port2]);
    });
  }

  button.addEventListener("click", async () => {
    saving = true;
    button.disabled = true;
    button.textContent = "Загрузка…";
    message("Проверяем файлы игры.");
    navigator.storage?.persist?.().catch(() => {});
    try {
      await request("download", ({ done, total }) => {
        meter.max = total;
        meter.value = done;
        meter.hidden = false;
        message("Загружено " + done + " из " + total + " файлов.");
      });
      ready();
    } catch (error) {
      meter.hidden = true;
      button.disabled = false;
      button.textContent = "Загрузить игру";
      message(error?.storage ? "Освободи место и повтори загрузку."
        : navigator.onLine ? "Загрузка прервалась. Нажми кнопку ещё раз." : "Подключись к интернету и повтори загрузку.");
    } finally {
      saving = false;
    }
  });

  request("status").then(state => {
    if (state.ready && !saving) ready();
  }).catch(() => {});
}
