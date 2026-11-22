const incoming = new URL(location.href).searchParams.get("room")?.trim().toUpperCase() ?? "";
if (/^[A-HJ-NP-Z2-9]{6}$/.test(incoming)) {
  const oldInvite = new URL("./heist/", location.href);
  oldInvite.searchParams.set("room", incoming);
  location.replace(oldInvite);
} else {
  const button = document.getElementById("music");
  const track = document.getElementById("soundtrack");
  const preference = "botan-launcher-music";
  let enabled = true;
  try { enabled = localStorage.getItem(preference) !== "off"; } catch { /* Audio remains available without storage. */ }
  track.volume = .24;

  function paint() {
    const on = !track.paused;
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Поставить музыку на паузу" : "Включить музыку");
  }
  function start() {
    if (!enabled || !track.paused) return;
    track.play().catch(paint);
  }
  track.addEventListener("play", paint);
  track.addEventListener("pause", paint);
  track.addEventListener("error", paint);

  button.addEventListener("click", () => {
    enabled = track.paused;
    try { localStorage.setItem(preference, enabled ? "on" : "off"); } catch { /* The current page still works. */ }
    if (enabled) start();
    else track.pause();
  });

  document.addEventListener("pointerdown", event => {
    if (!button.contains(event.target)) start();
  }, { once: true });
  document.addEventListener("keydown", event => {
    if (!button.contains(event.target)) start();
  }, { once: true });
  paint();
  start();
}
