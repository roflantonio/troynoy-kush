const downloadLabel = "Загрузить файлы игры";
const unsupported = "Офлайн-загрузка недоступна в этом браузере.";

export function setupOfflineMenu() {
  const button = document.getElementById("download-game");
  const panel = document.getElementById("offline-panel");
  const status = document.getElementById("offline-status");
  const meter = document.getElementById("offline-progress");
  const remove = document.getElementById("delete-game-files");
  const removeStatus = document.getElementById("offline-delete-status");
  const workers = navigator.serviceWorker;

  function showPanel() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function deleteMessage(value) {
    removeStatus.hidden = !value;
    removeStatus.textContent = value;
  }

  if (!workers || !window.caches) {
    button.addEventListener("click", () => {
      showPanel();
      status.textContent = unsupported;
    });
    remove.addEventListener("click", () => deleteMessage("Удаление офлайн-файлов недоступно в этом браузере."));
    return;
  }

  const workerUrl = new URL("./offline-worker.js?v=22", document.baseURI).href;
  const registration = workers.register(workerUrl, { type: "module", updateViaCache: "none" }).catch(async error => {
    const existing = await workers.getRegistration();
    if (existing?.active?.scriptURL === workerUrl) return existing;
    throw error;
  });
  let ready = false;
  let saving = false;
  let removing = false;
  let revision = 0;

  function updateButtons() {
    button.disabled = saving || removing || ready;
    button.textContent = saving ? "Загрузка…" : ready ? "Игра загружена" : downloadLabel;
    remove.disabled = removing;
  }

  async function activeWorker() {
    const reg = await registration;
    const worker = [reg.installing, reg.waiting, reg.active].find(candidate => candidate?.scriptURL === workerUrl);
    if (!worker) throw new Error("Offline worker unavailable");
    if (worker.state === "activated") return worker;
    return new Promise((resolve, reject) => {
      function check() {
        if (worker.state === "activated" || worker.state === "redundant") {
          worker.removeEventListener("statechange", check);
          if (worker.state === "activated") resolve(worker);
          else reject(new Error("Offline worker unavailable"));
        }
      }
      worker.addEventListener("statechange", check);
      check();
    });
  }

  async function request(command, onProgress) {
    const worker = await activeWorker();
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
      worker.postMessage(command, [channel.port2]);
    });
  }

  button.addEventListener("click", async () => {
    const operation = ++revision;
    saving = true;
    showPanel();
    updateButtons();
    status.textContent = "Проверяем файлы игры.";
    navigator.storage?.persist?.().catch(() => {});
    try {
      await request("download", ({ done, total }) => {
        if (operation !== revision) return;
        meter.max = total;
        meter.value = done;
        meter.hidden = false;
        status.textContent = "Загружено " + done + " из " + total + " файлов.";
      });
      if (operation === revision) {
        ready = true;
        status.textContent = "Можно играть без интернета с ярлыка или по этой же ссылке.";
      }
    } catch (error) {
      if (operation === revision) {
        status.textContent = error?.storage ? "Освободи место и повтори загрузку."
          : error?.cancelled ? "Загрузка остановлена."
          : navigator.onLine ? "Загрузка прервалась. Нажми кнопку ещё раз."
          : "Подключись к интернету и повтори загрузку.";
      }
    } finally {
      meter.hidden = true;
      saving = false;
      updateButtons();
    }
  });

  remove.addEventListener("click", async () => {
    revision++;
    removing = true;
    updateButtons();
    deleteMessage("Удаляем файлы игры…");
    try {
      const result = await request("delete");
      ready = false;
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      deleteMessage(result.removed ? "Файлы игры удалены." : "Скачанных файлов игры нет.");
    } catch {
      deleteMessage("Не удалось удалить файлы. Попробуй ещё раз.");
    } finally {
      removing = false;
      updateButtons();
    }
  });

  request("status").then(state => {
    if (revision !== 0) return;
    ready = state.ready;
    updateButtons();
  }).catch(() => {});
}
